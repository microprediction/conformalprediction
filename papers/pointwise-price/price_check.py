"""Exact check of the in-expectation pointwise price, exponential-scale model.

Setup. Fixed design x_i = (i - 1/2)/n on [0,1], d = 1, x0 = 1/2.
R_i | x_i ~ Exponential(mean exp(theta(x_i))), theta Lipschitz (s = 1) with constant L.
Threshold T = c * exp(L rho_k) * mean of the k nearest scores, rho_k = distance to kth neighbour.

Coverage at x0, averaged over the calibration sample, is exact:
    P(R0 <= T) = 1 - prod_i (1 + c e^{L rho} e^{theta_i - theta_0} / k)^{-1}.
In-expectation validity: c = k (alpha^{-1/k} - 1).
High-probability validity (prob 1 - eta over the sample): c chosen so that
    P( c e^{L rho} mean >= q at worst case ) = 1 - eta, a Gamma quantile.
Excess is E[T] - q at the flat baseline theta = 0, where q = -log(alpha).
"""
import numpy as np
from scipy import stats

alpha, eta, L = 0.1, 0.1, 1.0
q0 = -np.log(alpha)


_cache = {}


def design(n):
    if n not in _cache:
        x = (np.arange(n) + 0.5) / n
        _cache.clear()
        _cache[n] = np.sort(np.abs(x - 0.5))
    return _cache[n]


def worst_theta(dist):
    # Lipschitz field that is as low as allowed near x0: theta(x) = -L |x - x0|, theta(x0) = 0
    return -L * dist


def expect_proc(n, k):
    d = design(n)[:k]
    rho = d[-1]
    c = k * (alpha ** (-1.0 / k) - 1.0)
    infl = c * np.exp(L * rho)
    excess = infl - q0                      # E[T] - q at flat baseline (E mean = 1)
    th = worst_theta(d)
    cov_worst = 1 - np.prod(1.0 / (1.0 + infl * np.exp(th) / k))
    cov_flat = 1 - (1.0 + infl / k) ** (-k)
    return excess, cov_worst, cov_flat


def highprob_proc(n, k):
    d = design(n)[:k]
    rho = d[-1]
    # worst case: all neighbours at the lowest allowed scale e^{-L rho}; mean ~ e^{-L rho} Gamma(k,1)/k
    g = stats.gamma.ppf(eta, a=k) / k       # P(mean_flat >= g) = 1 - eta
    infl = q0 / g * np.exp(L * rho)
    return infl - q0


print(f"{'n':>9} {'k*_exp':>7} {'excess_exp':>11} {'cov_worst':>10} {'cov_flat':>9} "
      f"{'k*_hp':>6} {'excess_hp':>10}")
ns = [10**3, 10**4, 10**5, 10**6, 10**7]
ee, eh = [], []
for n in ns:
    ks = np.unique(np.round(np.logspace(0.5, np.log10(n / 4), 400)).astype(int))
    ex = [(expect_proc(n, k)[0], k) for k in ks]
    e, k1 = min(ex)
    _, cw, cf = expect_proc(n, k1)
    hp = [(highprob_proc(n, k), k) for k in ks]
    h, k2 = min(hp)
    ee.append(e); eh.append(h)
    print(f"{n:>9} {k1:>7} {e:>11.5f} {cw:>10.5f} {cf:>9.5f} {k2:>6} {h:>10.5f}")

ln = np.log(ns)
s_e = np.polyfit(ln[1:], np.log(ee[1:]), 1)[0]
s_h = np.polyfit(ln[1:], np.log(eh[1:]), 1)[0]
print(f"\nslope, in-expectation excess : {s_e:.3f}   predicted -s/(s+d)  = -0.500")
print(f"slope, high-prob excess      : {s_h:.3f}   predicted -s/(2s+d) = -0.333")

# Monte Carlo confirmation of the exact coverage formula at one configuration
rng = np.random.default_rng(0)
n, k = 10**4, 60
d = design(n)[:k]
c = k * (alpha ** (-1.0 / k) - 1.0) * np.exp(L * d[-1])
th = worst_theta(d)
m = 400000
means = rng.exponential(np.exp(th), size=(m, k)).mean(axis=1)
r0 = rng.exponential(1.0, size=m)
print(f"\nMonte Carlo coverage, worst-case field, n={n}, k={k}: "
      f"{np.mean(r0 <= c * means):.4f}  (exact {expect_proc(n, k)[1]:.4f}, target {1 - alpha})")
