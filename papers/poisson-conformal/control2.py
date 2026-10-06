"""Corrected control. The earlier V was wrong.

The paper's convention is that the state absorbs the emission, so H_q(W)=1{r(W)<=q}
is a genuine indicator and chi carries the t=0 emission term. My regime-only chi
dropped it, so V missed the Bernoulli part and was far too small at low persistence.
The paper's own eq (5) has the right object:

    sigma^2_p = p(1-p) + 2 sum_j Cov(1{R_0<=q_p}, 1{R_j<=q_p})
              = p(1-p) + 2 pi_L pi_H d_p^2 lam/(1-lam)      (two-state, eq 13)

Arms, all on the lagged-state stratified scheme:
  naive    ordinary conformal rank, targets AVERAGE coverage
  exch     Freedman with V = p(1-p): honest but blind to dependence
  sigma2   Freedman with V = sigma^2_p: the paper's long-run variance
"""
import math, numpy as np
from compare_arms import model, inv, freedman

def sigma2(M):
    p, pi, lam = M["p"], M["pi"], M["lam"]
    qp = inv(M["F"], p); d = float(M["Fw"][1](qp) - M["Fw"][0](qp))
    return p*(1-p) + 2*pi[0]*pi[1]*d*d*lam/(1-lam) if lam < 1 else float("inf")

def run(pi_H, n, lam, eta=0.10, reps=4000, seed=0):
    M = model(pi_H, lam=lam); rng = np.random.default_rng(seed)
    p, ell, pi = M["p"], M["ell"], M["pi"]
    s2 = sigma2(M)
    out = {a: {"fail":0, "cov":[], "n":0} for a in ("naive","exch","sigma2")}
    for _ in range(reps):
        w = 0 if rng.random() < pi[0] else 1
        st = np.empty(n+ell, dtype=int)
        for t in range(n+ell):
            st[t] = w; w = 0 if rng.random() < M["P"][w,0] else 1
        cal = st[:n]
        sc = rng.exponential(np.where(cal==0, M["mu"][0], M["mu"][1]))
        wn = cal[-1]
        sub = np.sort(sc[np.where(cal[:-ell] == wn)[0] + ell]); N = len(sub)
        if N < 20: continue
        for arm in ("naive","exch","sigma2"):
            if arm == "naive":
                k = int(math.ceil((N+1)*p))
            else:
                V = p*(1-p) if arm == "exch" else s2
                k = int(N*(p + freedman(N, eta/2, 1.0, V))) + 1
            T = math.inf if k > N else sub[k-1]
            c = 1.0 if not math.isfinite(T) else float(M["law"](wn)(T))
            r = out[arm]; r["cov"].append(c); r["n"] += 1
            if c < p - 1e-12: r["fail"] += 1
    return {a:(r["fail"]/r["n"], float(np.mean(r["cov"]))) for a,r in out.items() if r["n"]}

print("=" * 94)
print("Corrected control. pi_H = 0.20, eta = 0.10, 4000 replicates.")
print("fail = share of calibration draws whose realized conditional coverage is below 0.90")
print()
for n in (1000, 4000):
    print(f"--- n = {n}")
    print(f"{'lambda':>7} {'sigma^2':>8} {'infl':>6} | {'naive':>7} {'exch':>7} {'sigma2':>7}"
          f" | {'naive cov':>10} {'exch cov':>9} {'sig cov':>8}")
    for lam in (0.0, 0.5, 0.8, 0.9, 0.95, 0.98):
        M = model(0.20, lam=lam); s2 = sigma2(M); p = M["p"]
        r = run(0.20, n, lam)
        print(f"{lam:>7.2f} {s2:>8.4f} {s2/(p*(1-p)):>6.2f} | {r['naive'][0]:>7.3f} {r['exch'][0]:>7.3f}"
              f" {r['sigma2'][0]:>7.3f} | {r['naive'][1]:>10.4f} {r['exch'][1]:>9.4f} {r['sigma2'][1]:>8.4f}")
    print()
