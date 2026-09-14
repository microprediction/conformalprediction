"""Temperature-scale each model's logits on the calibration half (minimise NLL,
which changes no argmax), then recompute conformal set sizes on the test half.
Compares raw and temperature-matched SS rankings, base vs chat, and model scale."""
import pickle, json, os, glob, sys, itertools
import numpy as np
from sklearn.model_selection import train_test_split
from scipy.optimize import minimize_scalar
from scipy.stats import kendalltau
from ye_rankings import softmax, sets_lac, sets_aps, options, ids_to_remove, TASKS, R
PROMPT = "base"; ALPHA = 0.1
SETS = {"base": "outputs_base", "chat": "outputs_chat_v1"}

def load(dirname, m, t, yc_ids, yt_ids):
    f = f"{R}/{dirname}/{m}_{t}_{PROMPT}_icl1.pkl"
    if not os.path.exists(f):
        return None
    L = pickle.load(open(f, "rb")); L = [x for i, x in enumerate(L) if i not in ids_to_remove]
    Lc, Lt = train_test_split(L, train_size=0.5, random_state=42)
    assert [x["id"] for x in Lc] == yc_ids and [x["id"] for x in Lt] == yt_ids
    return (np.array([x["logits_options"] for x in Lc], float),
            np.array([x["logits_options"] for x in Lt], float))

def fit_T(zc, yc):
    def nll(logT):
        p = softmax(zc / np.exp(logT)); return -np.log(p[np.arange(len(yc)), yc] + 1e-12).mean()
    r = minimize_scalar(nll, bounds=(-3, 3), method="bounded"); return float(np.exp(r.x))

def main():
    raw = {}
    for t in TASKS:
        d = json.load(open(f"{R}/data/{t}.json")); d = [x for i, x in enumerate(d) if i not in ids_to_remove]
        cal, test = train_test_split(d, train_size=0.5, random_state=42)
        raw[t] = (np.array([options.index(x["answer"]) for x in cal]),
                  np.array([options.index(x["answer"]) for x in test]),
                  [x["id"] for x in cal], [x["id"] for x in test])
    rows = []
    for kind, dirname in SETS.items():
        models = sorted({os.path.basename(f).split("_mmlu_10k")[0]
                         for f in glob.glob(f"{R}/{dirname}/*_mmlu_10k_{PROMPT}_icl1.pkl")})
        for m in models:
            for t, tn in TASKS.items():
                yc, yt, idc, idt = raw[t]
                z = load(dirname, m, t, idc, idt)
                if z is None:
                    continue
                zc, zt = z
                T = fit_T(zc, yc)
                acc = float((zt.argmax(1) == yt).mean())
                out = dict(kind=kind, model=m, task=tn, T=T, acc=acc)
                for tag, TT in (("raw", 1.0), ("ts", T)):
                    pc, pt = softmax(zc / TT), softmax(zt / TT)
                    ss = []; cov = []
                    for fn in (sets_lac, sets_aps):
                        K = fn(pc, yc, pt, ALPHA); ss.append(K.sum(1).mean()); cov.append(K[np.arange(len(yt)), yt].mean())
                    out[f"ss_{tag}"] = float(np.mean(ss)); out[f"cov_{tag}"] = float(np.mean(cov))
                    out[f"ss_lac_{tag}"] = float(ss[0]); out[f"ss_aps_{tag}"] = float(ss[1])
                rows.append(out)
    import pandas as pd
    df = pd.DataFrame(rows); df.to_csv("ye_temperature.csv", index=False)
    print("fitted temperatures (median over tasks): base models then chat models")
    print(df.groupby(["kind", "model"]).T.median().round(2).to_string())
    print("\n[A] rank agreement raw SS vs temperature-scaled SS, base models, per task")
    b = df[df.kind == "base"]
    for tn in TASKS.values():
        s = b[b.task == tn]
        tau = kendalltau(s.ss_raw, s.ss_ts).statistic
        flips = sum((s.ss_raw.iloc[i]-s.ss_raw.iloc[j])*(s.ss_ts.iloc[i]-s.ss_ts.iloc[j]) < 0 for i, j in itertools.combinations(range(len(s)), 2))
        print(f"  {tn:4s} tau={tau:.2f} pair flips={flips}/{len(s)*(len(s)-1)//2}")
    print("\n[B] finding III, 'instruction-finetuning tends to increase uncertainty': base vs chat SS, raw and temperature-scaled")
    pairs = [("Llama-2-7b-hf", "Llama-2-7b-chat-hf"), ("Llama-2-13b-hf", "Llama-2-13b-chat-hf"),
             ("Llama-2-70b-hf", "Llama-2-70b-chat-hf"), ("Yi-34B", "Yi-34B-Chat"),
             ("deepseek-llm-7b-base", "deepseek-llm-7b-chat"), ("deepseek-llm-67b-base", "deepseek-llm-67b-chat"),
             ("falcon-7b", "falcon-7b-instruct"), ("falcon-40b", "falcon-40b-instruct"),
             ("Qwen-7B", "Qwen-7B-Chat"), ("Qwen-14B", "Qwen-14B-Chat"), ("Qwen-72B", "Qwen-72B-Chat"),
             ("Mistral-7B-v0.1", "Mistral-7B-Instruct-v0.1"), ("internlm-7b", "internlm-chat-7b"), ("mpt-7b", "mpt-7b-instruct")]
    avg = df.groupby(["kind", "model"])[["acc", "ss_raw", "ss_ts", "T", "cov_raw", "cov_ts"]].mean()
    n_up_raw = n_up_ts = n = 0
    for bm, cm in pairs:
        if ("base", bm) in avg.index and ("chat", cm) in avg.index:
            a, c = avg.loc[("base", bm)], avg.loc[("chat", cm)]; n += 1
            n_up_raw += c.ss_raw > a.ss_raw; n_up_ts += c.ss_ts > a.ss_ts
            print(f"  {bm:22s} acc {a.acc:.3f} T {a['T']:.2f} SS raw {a.ss_raw:.2f} ts {a.ss_ts:.2f} | "
                  f"{cm:26s} acc {c.acc:.3f} T {c['T']:.2f} SS raw {c.ss_raw:.2f} ts {c.ss_ts:.2f}")
    print(f"  chat SS > base SS: raw {n_up_raw}/{n}, after temperature scaling {n_up_ts}/{n}")
    print("\n[C] finding II, 'larger models may display greater uncertainty': within-family, raw vs temperature-scaled (avg over tasks)")
    fams = [["Qwen-1_8B", "Qwen-7B", "Qwen-14B", "Qwen-72B"], ["Llama-2-7b-hf", "Llama-2-13b-hf", "Llama-2-70b-hf"],
            ["Yi-6B", "Yi-34B"], ["deepseek-llm-7b-base", "deepseek-llm-67b-base"], ["falcon-7b", "falcon-40b"]]
    for fam in fams:
        print("  " + " -> ".join(f"{m}: SS raw {avg.loc[('base', m)].ss_raw:.2f} ts {avg.loc[('base', m)].ss_ts:.2f} (T {avg.loc[('base', m)]['T']:.2f})" for m in fam if ("base", m) in avg.index))
    print("\n[D] realized coverage at alpha=0.1, raw vs ts (min..max over base models and tasks)")
    print(f"  raw {b.cov_raw.min():.3f}..{b.cov_raw.max():.3f}   ts {b.cov_ts.min():.3f}..{b.cov_ts.max():.3f}")
main()
