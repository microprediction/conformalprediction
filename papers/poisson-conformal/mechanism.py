"""Does stratification SUBSTITUTE for the dependence correction?

The claim needs the contrast the earlier runs never made. Compare the two margins
in BOTH schemes:

  pooled      all n calibration scores, target = coverage under the invariant law
  stratified  scores whose lagged state equals the current one, target = the
              l-step-ahead law from that state

  iid margin     Freedman with V = p(1-p)
  sigma^2 margin Freedman with V = sigma^2_p, the paper's long-run variance

If the iid margin fails in POOLED and holds in STRATIFIED at the same persistence,
the inversion is real: conditioning on the state is what removes the dependence.
If it holds in both, the correction is simply slack in Freedman and stratification
has nothing to do with it.
"""
import math, numpy as np
from compare_arms import inv, freedman
from stress import build, s2_of

def run(M, n, eta, reps=6000, seed=2):
    rng = np.random.default_rng(seed); p, ell, pi = M["p"], M["ell"], M["pi"]
    s2 = s2_of(M); qF = inv(M["F"], p)
    out = {(s,m): {"fail":0,"n":0,"cov":[]} for s in ("pooled","strat") for m in ("iid","sig")}
    for _ in range(reps):
        w = 0 if rng.random()<pi[0] else 1
        st = np.empty(n+ell,dtype=int)
        for t in range(n+ell):
            st[t]=w; w = 0 if rng.random()<M["P"][w,0] else 1
        cal = st[:n]
        sc  = rng.exponential(np.where(cal==0,M["mu"][0],M["mu"][1]))
        wn  = cal[-1]
        pool = np.sort(sc)
        sub  = np.sort(sc[np.where(cal[:-ell]==wn)[0]+ell])
        for scheme, arr, target in (("pooled", pool, M["F"]), ("strat", sub, M["law"](wn))):
            N = len(arr)
            if N < 20: continue
            for mar in ("iid","sig"):
                V = p*(1-p) if mar=="iid" else s2
                k = int(N*(p + freedman(N, eta/2, 1.0, V))) + 1
                T = math.inf if k>N else arr[k-1]
                c = 1.0 if not math.isfinite(T) else float(target(T))
                r = out[(scheme,mar)]; r["cov"].append(c); r["n"]+=1
                if c < p-1e-12: r["fail"]+=1
    return {kk:(r["fail"]/r["n"], float(np.mean(r["cov"]))) for kk,r in out.items() if r["n"]}

print("="*98)
print("Does stratification substitute for the dependence correction?")
print("Each cell: share of calibration draws below target. pi_H = 0.5, n = 800, eta = 0.05.")
print("POOLED target = invariant law. STRATIFIED target = l-step law from the current state.")
print()
print(f"{'lambda':>7} {'infl':>7} | {'pooled iid':>11} {'pooled sig':>11} | {'strat iid':>10} {'strat sig':>10}"
      f" | {'pool-iid cov':>13} {'strat-iid cov':>14}")
for lam in (0.0, 0.8, 0.95, 0.99, 0.995, 0.998):
    M = build(0.5, lam, 0.99, 0.20); s2 = s2_of(M); p = M["p"]
    r = run(M, 800, 0.05)
    print(f"{lam:>7.3f} {s2/(p*(1-p)):>7.1f} | {r[('pooled','iid')][0]:>11.3f} {r[('pooled','sig')][0]:>11.3f}"
          f" | {r[('strat','iid')][0]:>10.3f} {r[('strat','sig')][0]:>10.3f}"
          f" | {r[('pooled','iid')][1]:>13.4f} {r[('strat','iid')][1]:>14.4f}")
print()
print("nominal eta = 0.05")
