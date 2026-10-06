"""Isolate WHAT the Poisson margin is buying. Three margins, same stratified scheme.

  naive        ordinary conformal rank ceil((N+1)p): targets AVERAGE coverage
  exch         Freedman margin with the i.i.d. variance V = p(1-p): ignores dependence
  poisson      Freedman margin with the true long-run variance from (I-P)chi = H-F

Control: lambda = 0 makes the chain i.i.d. If 'naive' still fails ~50% there, the
failure is about honesty, not dependence, and the dependence correction is only
about the SIZE of the margin.
"""
import math, numpy as np
from compare_arms import model, inv, freedman, chi, Vexact

def run(pi_H, n, lam, eta=0.10, reps=4000, seed=0):
    M = model(pi_H, lam=lam); rng = np.random.default_rng(seed)
    p, ell, pi = M["p"], M["ell"], M["pi"]
    qp = inv(M["F"], p)
    B_p = max(abs(chi(M, qp, w)) for w in (0,1)); V_p = Vexact(M, qp)
    B_e, V_e = 1.0, p*(1-p)
    out = {a: {"fail": 0, "cov": [], "n": 0} for a in ("naive","exch","poisson")}
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
        for arm in ("naive","exch","poisson"):
            if arm == "naive":
                k = int(math.ceil((N+1)*p))
            else:
                B, V = (B_e, V_e) if arm == "exch" else (B_p, V_p)
                k = int(N*(p + freedman(N, eta/2, B, V))) + 1
            T = math.inf if k > N else sub[k-1]
            c = 1.0 if not math.isfinite(T) else float(M["law"](wn)(T))
            r = out[arm]; r["cov"].append(c); r["n"] += 1
            if c < p - 1e-12: r["fail"] += 1
    return {a: (r["fail"]/r["n"], float(np.mean(r["cov"]))) for a, r in out.items() if r["n"]}

print("=" * 88)
print("Failure rate = share of calibration draws with realized conditional coverage < 0.90")
print("Nominal eta = 0.10.  pi_H = 0.20, n = 4000, 4000 replicates")
print()
print(f"{'lambda':>8} {'sigma^2/p(1-p)':>15} | {'naive fail':>11} {'exch fail':>10} {'poisson fail':>13}"
      f" | {'naive cov':>10} {'exch cov':>9} {'pois cov':>9}")
for lam in (0.0, 0.3, 0.6, 0.8, 0.9, 0.95):
    M = model(0.20, lam=lam); p = M["p"]; qp = inv(M["F"], p)
    d_p = float(M["Fw"][1](qp) - M["Fw"][0](qp))
    infl = (p*(1-p) + 2*M["pi"][0]*M["pi"][1]*d_p**2*lam/(1-lam))/(p*(1-p)) if lam < 1 else float("inf")
    r = run(0.20, 4000, lam)
    print(f"{lam:>8.2f} {infl:>15.2f} | {r['naive'][0]:>11.3f} {r['exch'][0]:>10.3f} {r['poisson'][0]:>13.3f}"
          f" | {r['naive'][1]:>10.4f} {r['exch'][1]:>9.4f} {r['poisson'][1]:>9.4f}")
print()
print("lambda = 0 is the i.i.d. control.")
