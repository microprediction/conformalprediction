"""Recompute Ye et al.'s set-size (SS) model rankings from their own stored logits,
at several alpha levels, for LAC and APS separately, and under temperature scaling
(which leaves every argmax and hence every accuracy unchanged)."""
import pickle, json, os, glob, sys, itertools
import numpy as np
from sklearn.model_selection import train_test_split
from scipy.stats import kendalltau
R = "LLM-Uncertainty-Bench"
options = ["A", "B", "C", "D", "E", "F"]
ids_to_remove = [1, 3, 5, 7, 9]
TASKS = {"mmlu_10k": "QA", "cosmosqa_10k": "RC", "hellaswag_10k": "CI",
         "halu_dialogue": "DRS", "halu_summarization": "DS"}
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "base"
ALPHAS = [0.05, 0.1, 0.2, 0.3]
TEMPS = [0.5, 1.0, 2.0]

def softmax(x):
    e = np.exp(x - x.max(axis=1, keepdims=True)); return e / e.sum(axis=1, keepdims=True)

def sets_lac(pc, yc, pt, alpha):
    n = len(yc); s = 1 - pc[np.arange(n), yc]
    q = np.quantile(s, min(np.ceil((n + 1) * (1 - alpha)) / n, 1.0), method="higher")
    keep = pt >= 1 - q
    empty = ~keep.any(axis=1); keep[empty, pt[empty].argmax(axis=1)] = True
    return keep

def sets_aps(pc, yc, pt, alpha):
    n = len(yc)
    order = np.argsort(-pc, axis=1); cs = np.take_along_axis(pc, order, axis=1).cumsum(axis=1)
    rank_of_true = (order == yc[:, None]).argmax(axis=1)
    s = cs[np.arange(n), rank_of_true]
    q = np.quantile(s, min(np.ceil((n + 1) * (1 - alpha)) / n, 1.0), method="higher")
    order_t = np.argsort(-pt, axis=1); cst = np.take_along_axis(pt, order_t, axis=1).cumsum(axis=1)
    inc = cst <= q                       # their loop: include while cumsum <= qhat
    inc[:, 0] = True                     # empty -> top label
    # inc must be a prefix in sorted order: their while-loop stops at first failure
    inc = np.cumprod(inc, axis=1).astype(bool)
    keep = np.zeros_like(inc); np.put_along_axis(keep, order_t, inc, axis=1)
    return keep

def main():
    raw = {}
    for t in TASKS:
        d = json.load(open(f"{R}/data/{t}.json"))
        d = [x for i, x in enumerate(d) if i not in ids_to_remove]
        cal, test = train_test_split(d, train_size=0.5, random_state=42)
        raw[t] = (np.array([options.index(x["answer"]) for x in cal]),
                  np.array([options.index(x["answer"]) for x in test]),
                  [x["id"] for x in cal], [x["id"] for x in test])
    models = sorted({os.path.basename(f).split("_" + list(TASKS)[0])[0]
                     for f in glob.glob(f"{R}/outputs_base/*_{list(TASKS)[0]}_{PROMPT}_icl1.pkl")})
    rows = []
    for m in models:
        for t in TASKS:
            f = f"{R}/outputs_base/{m}_{t}_{PROMPT}_icl1.pkl"
            if not os.path.exists(f):
                continue
            L = pickle.load(open(f, "rb")); L = [x for i, x in enumerate(L) if i not in ids_to_remove]
            Lc, Lt = train_test_split(L, train_size=0.5, random_state=42)
            yc, yt, idc, idt = raw[t]
            assert [x["id"] for x in Lc] == idc and [x["id"] for x in Lt] == idt
            zc = np.array([x["logits_options"] for x in Lc], float)
            zt = np.array([x["logits_options"] for x in Lt], float)
            acc = float((zt.argmax(axis=1) == yt).mean())
            for T in TEMPS:
                pc, pt = softmax(zc / T), softmax(zt / T)
                for a in ALPHAS:
                    for name, fn in (("LAC", sets_lac), ("APS", sets_aps)):
                        K = fn(pc, yc, pt, a)
                        rows.append(dict(model=m, task=TASKS[t], T=T, alpha=a, score=name, acc=acc,
                                         cov=float(K[np.arange(len(yt)), yt].mean()),
                                         ss=float(K.sum(axis=1).mean())))
    import pandas as pd
    df = pd.DataFrame(rows); df.to_csv(f"ye_rankings_{PROMPT}.csv", index=False)
    # --- summaries ---
    base = df[(df["T"] == 1.0)]
    avg = base.groupby(["model", "task", "alpha"]).agg(acc=("acc", "first"), ss=("ss", "mean")).reset_index()
    print(f"prompt={PROMPT}  models={len(models)}")
    print("\n[1] Kendall tau between the SS ranking at alpha=0.1 and at other alphas (avg of LAC,APS), per task")
    for t in TASKS.values():
        r10 = avg[(avg.task == t) & (avg.alpha == 0.1)].set_index("model")["ss"]
        out = []
        for a in ALPHAS:
            ra = avg[(avg.task == t) & (avg.alpha == a)].set_index("model")["ss"].reindex(r10.index)
            tau = kendalltau(r10.values, ra.values).statistic
            flips = sum((r10[i] - r10[j]) * (ra[i] - ra[j]) < 0 for i, j in itertools.combinations(r10.index, 2))
            out.append(f"a={a}: tau={tau:.2f} flips={flips}/{len(r10)*(len(r10)-1)//2}")
        print(f"  {t:4s} " + "  ".join(out))
    print("\n[2] LAC vs APS SS rankings at alpha=0.1, per task")
    for t in TASKS.values():
        s = base[(base.task == t) & (base.alpha == 0.1)].pivot(index="model", columns="score", values="ss")
        tau = kendalltau(s["LAC"], s["APS"]).statistic
        flips = sum((s.LAC[i]-s.LAC[j])*(s.APS[i]-s.APS[j]) < 0 for i, j in itertools.combinations(s.index, 2))
        print(f"  {t:4s} tau={tau:.2f} flips={flips}/{len(s)*(len(s)-1)//2}")
    print("\n[3] Temperature: logits/T leaves every argmax (accuracy) unchanged; SS ranking at alpha=0.1 (avg LAC,APS)")
    for t in TASKS.values():
        sub = df[(df.task == t) & (df.alpha == 0.1)].groupby(["model", "T"]).ss.mean().unstack()
        r = sub.rank()
        moved = int((r[0.5] != r[2.0]).sum())
        tau = kendalltau(sub[0.5], sub[2.0]).statistic
        flips = sum((sub[0.5][i]-sub[0.5][j])*(sub[2.0][i]-sub[2.0][j]) < 0 for i, j in itertools.combinations(sub.index, 2))
        print(f"  {t:4s} models changing rank T=0.5 -> T=2: {moved}/{len(sub)}  tau={tau:.2f} pair flips={flips}")
    # a single-model example: SS across T for a fixed model, accuracy fixed
    ex = df[(df.model == "Yi-34B") & (df.alpha == 0.1)].groupby(["task", "T"]).ss.mean().unstack()
    print("  Yi-34B SS by T:"); print(ex.round(2).to_string())
    print("\n[4] Coverage check at alpha=0.1 (min/max over models, LAC and APS, T=1)")
    for t in TASKS.values():
        c = base[(base.task == t) & (base.alpha == 0.1)]["cov"]
        print(f"  {t:4s} {c.min():.3f}..{c.max():.3f}")
main()
