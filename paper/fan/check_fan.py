"""Numerical checks for "The Width of the Conformal Fan".

Reproduces the table and the two exact claims:
  - the realized (calibration-conditional) coverage variance vs the iid Beta fan,
    across dependence structures (negative association narrows it, positive widens it,
    the contest floor zeroes it);
  - the de Finetti / law-of-total-variance decomposition for positive dependence
    (Theorem 2): Var(c) = E[Var(c|Q)] + Var(E[c|Q]), with the second term the inflation.

Dependencies: numpy, scipy. One run; seeded.
"""
import numpy as np
from scipy.stats import norm

rng = np.random.default_rng(1)
n, alpha = 20, 0.10
k = int(np.ceil((n+1)*(1-alpha)))
beta_var = k*(n-k+1)/((n+1)**2*(n+2))
T = 60000


def realized_coverage(Z_sampler):
    """c = U_(k) on the PIT scale, Z -> uniform via the Gaussian copula."""
    c = np.empty(T)
    for t in range(T):
        c[t] = np.sort(norm.cdf(Z_sampler()))[k-1]
    return c.mean(), c.var()


def iid():        return rng.standard_normal(n)
def exch_neg():                                            # exchangeable rho = -1/(n-1)
    e = rng.standard_normal(n); z = e - e.mean(); return z/z.std()
def ma_neg():                                              # MA(1), lag-1 corr -1/2 (non-exch NA)
    e = rng.standard_normal(n+1); return (e[1:] - e[:-1])/np.sqrt(2)
def block_neg():                                           # random negatively-paired blocks (non-exch NA)
    out = rng.standard_normal(n)
    L = np.array([[1, 0], [-0.6, np.sqrt(1-0.36)]])
    for a, b in rng.permutation(n).reshape(-1, 2):
        out[a], out[b] = L @ rng.standard_normal(2)
    return out
def contest():                                             # max NA: permutation of a fixed grid
    return norm.ppf(rng.permutation(np.arange(1, n+1))/(n+1))   # -> exact grid after copula
def pos():                                                 # one-factor, rho = +0.2
    return np.sqrt(0.2)*rng.standard_normal() + np.sqrt(0.8)*rng.standard_normal(n)


if __name__ == "__main__":
    print(f"n={n}, alpha={alpha}, k={k}, target={k/(n+1):.4f}")
    print(f"iid Beta fan variance = {beta_var:.4e}\n")
    print(f"{'calibration dependence':30s} {'E[c]':>7s} {'Var(c)':>11s} {'ratio':>7s}")
    for name, samp in [("independent", iid),
                       ("exchangeable -1/(n-1)", exch_neg),
                       ("MA(1) corr -1/2", ma_neg),
                       ("negatively-paired blocks", block_neg),
                       ("contest / without-replace", contest),
                       ("one-factor +0.2", pos)]:
        m, v = realized_coverage(samp)
        print(f"{name:30s} {m:7.4f} {v:11.4e} {v/beta_var:7.2f}")

    # Theorem 2: law-of-total-variance decomposition for the positive (extendable) case.
    print("\nTheorem 2 (positive dependence), one-factor rho=0.2:")
    rho = 0.20
    c = np.empty(T); W = np.empty(T)
    for t in range(T):
        w = rng.standard_normal()
        c[t] = np.sort(norm.cdf(np.sqrt(rho)*w + np.sqrt(1-rho)*rng.standard_normal(n)))[k-1]
        W[t] = w
    cb = c[np.argsort(W)]
    parts = np.array_split(cb, 40)
    within = sum(p.var()*len(p) for p in parts)/T
    between = np.average([(p.mean()-c.mean())**2 for p in parts],
                         weights=[len(p) for p in parts])
    print(f"  Var(c) total        = {c.var():.4e}")
    print(f"  E[Var(c|Q)] within  = {within:.4e}")
    print(f"  Var(E[c|Q]) between = {between:.4e}  (absent under independence)")
    print(f"  within + between    = {within+between:.4e}  (= total)")
