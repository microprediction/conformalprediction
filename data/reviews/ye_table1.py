import pandas as pd, numpy as np, itertools
from scipy.stats import kendalltau
df = pd.concat([pd.read_csv(f"ye_rankings_{p}.csv").assign(prompt=p) for p in ("base", "shared", "task")])
b = df[(df["T"] == 1.0) & (df.alpha == 0.1)]
tasks = ["QA", "RC", "CI", "DRS", "DS"]
# --- reproduce Table 1 (avg over LAC/APS and three prompts) ---
agg = b.groupby(["model", "task"]).agg(acc=("acc", "mean"), ss=("ss", "mean"), cov=("cov", "mean")).reset_index()
paper = {"Qwen-14B": (64.25, 2.80), "Yi-6B": (57.57, 3.20), "Mistral-7B-v0.1": (60.44, 2.80), "Llama-2-13b-hf": (52.52, 3.06),
         "Qwen-7B": (55.21, 3.26), "internlm-7b": (48.37, 3.49), "Llama-2-7b-hf": (45.60, 3.20), "deepseek-llm-7b-base": (45.65, 3.34),
         "mpt-7b": (29.49, 3.53), "falcon-7b": (23.75, 3.90)}
print("Table 1 reproduction, QA column (paper acc, SS | ours):")
for m, (pa, ps) in paper.items():
    r = agg[(agg.model == m) & (agg.task == "QA")].iloc[0]
    print(f"  {m:22s} paper {pa:5.2f} {ps:.2f} | ours {100*r.acc:5.2f} {r.ss:.2f}")
# --- the four headline pairs, decomposed by score function ---
sc = b.groupby(["model", "task", "score"]).agg(acc=("acc", "mean"), ss=("ss", "mean"), cov=("cov", "mean")).reset_index()
pairs = [("DRS", "internlm-7b", "mpt-7b"), ("QA", "Qwen-7B", "Llama-2-7b-hf"), ("CI", "Qwen-14B", "Yi-6B"), ("DS", "internlm-7b", "falcon-7b")]
print("\nSection 6.3's four examples (higher-accuracy model listed first), averaged over prompts:")
for t, hi, lo in pairs:
    for m in (hi, lo):
        r = sc[(sc.model == m) & (sc.task == t)].set_index("score")
        print(f"  {t:3s} {m:16s} acc {100*r.acc.iloc[0]:5.2f}  avg SS {r.ss.mean():.2f} | LAC SS {r.loc['LAC','ss']:.2f} (cov {r.loc['LAC','cov']:.3f})  APS SS {r.loc['APS','ss']:.2f} (cov {r.loc['APS','cov']:.3f})")
# --- count inversions (acc higher but SS higher) under avg, LAC, APS ---
print("\nModel pairs within a task where the more accurate model has the LARGER set size:")
for name, frame in (("avg LAC+APS (paper)", agg), ("LAC only", sc[sc.score == "LAC"]), ("APS only", sc[sc.score == "APS"])):
    tot = inv = 0
    for t in tasks:
        s = frame[frame.task == t].set_index("model")
        for i, j in itertools.combinations(s.index, 2):
            if s.acc[i] != s.acc[j]:
                tot += 1; inv += (s.acc[i] - s.acc[j]) * (s.ss[i] - s.ss[j]) > 0
    print(f"  {name:20s} {inv}/{tot}")
print("\nRealized coverage at nominal 90%, averaged over prompts (min..max over models), by score and task:")
for t in tasks:
    s = sc[sc.task == t]
    print(f"  {t:3s} LAC {s[s.score=='LAC']['cov'].min():.3f}..{s[s.score=='LAC']['cov'].max():.3f}   APS {s[s.score=='APS']['cov'].min():.3f}..{s[s.score=='APS']['cov'].max():.3f}")
print("\nSpearman(acc, SS) across models per task: avg / LAC / APS")
for t in tasks:
    r = [f[f.task == t][["acc", "ss"]].corr("spearman").iloc[0, 1] for f in (agg, sc[sc.score == "LAC"], sc[sc.score == "APS"])]
    print(f"  {t:3s} " + " / ".join(f"{x:+.2f}" for x in r))
print("\nKendall tau between LAC-only and APS-only SS rankings (avg over prompts):")
for t in tasks:
    s = sc[sc.task == t].pivot(index="model", columns="score", values="ss")
    print(f"  {t:3s} tau={kendalltau(s.LAC, s.APS).statistic:.2f}")
