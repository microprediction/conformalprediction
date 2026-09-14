"""Does Mondrian-on-lagged-state NEED the Poisson dependence margin?

Within a lagged-state stratum the scores are a subsequence of a dependent chain,
so they are NOT exchangeable and the ordinary conformal rank has no warrant.
Arms:
  MO-naive   stratum quantile at the ordinary conformal rank ceil((N+1)p)/N
  MO-poisson stratum quantile at level p + delta(N_w) from the Freedman/Poisson bound
Target: realized history-conditional coverage >= p, per state.
"""
import math, numpy as np
from compare_arms import model, inv, levels, freedman, chi, Vexact

def run(pi_H, n, lam=0.80, eta=0.10, reps=4000, seed=0):
    M = model(pi_H, lam=lam); rng = np.random.default_rng(seed)
    p, ell, pi = M["p"], M["ell"], M["pi"]
    B = abs(chi(M, inv(M["F"], p), 1))
    V = Vexact(M, inv(M["F"], p))
    res = {a: {w: {"cov": [], "fail": 0, "n": 0} for w in (0,1)} for a in ("naive","poisson")}
    for _ in range(reps):
        w = 0 if rng.random() < pi[0] else 1
        st = np.empty(n+ell, dtype=int)
        for t in range(n+ell):
            st[t] = w; w = 0 if rng.random() < M["P"][w,0] else 1
        cal = st[:n]
        sc = rng.exponential(np.where(cal==0, M["mu"][0], M["mu"][1]))
        wn = cal[-1]
        idx = np.where(cal[:-ell] == wn)[0] + ell
        sub = np.sort(sc[idx]); N = len(sub)
        if N < 20: continue
        for arm in ("naive","poisson"):
            lvl = p if arm == "naive" else p + freedman(N, eta/2, B, V)
            k = int(math.ceil((N+1)*lvl)) if arm == "naive" else int(N*lvl)+1
            T = math.inf if k > N else sub[k-1]
            c = 1.0 if not math.isfinite(T) else float(M["law"](wn)(T))
            r = res[arm][wn]; r["cov"].append(c); r["n"] += 1
            if c < p - 1e-12: r["fail"] += 1
    return res, M

print("=" * 96)
print("Does Mondrian on the lagged state need the dependence margin?  eta=0.10, target p=0.90")
print("fail = share of calibration draws whose REALIZED conditional coverage falls below 0.90")
print()
for lam in (0.80, 0.95):
    print(f"--- chain persistence lambda = {lam}")
    print(f"{'pi_H':>6} {'n':>7} | {'naive cov L':>12} {'fail L':>7} {'naive cov H':>12} {'fail H':>7}"
          f" | {'pois cov L':>11} {'fail L':>7} {'pois cov H':>11} {'fail H':>7}")
    for pi_H in (0.10, 0.20):
        for n in (500, 2000, 8000):
            res, M = run(pi_H, n, lam=lam)
            row = f"{pi_H:>6.2f} {n:>7} |"
            for arm in ("naive","poisson"):
                for w in (0,1):
                    r = res[arm][w]
                    cov = np.mean(r["cov"]) if r["n"] else float("nan")
                    fr  = r["fail"]/r["n"] if r["n"] else float("nan")
                    row += f" {cov:>12.4f} {fr:>7.3f}" if arm=="naive" else f" {cov:>11.4f} {fr:>7.3f}"
                if arm == "naive": row += " |"
            print(row)
    print()
