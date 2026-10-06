"""Numerical checks of every step of pointwise-price.tex, exponential-scale model.

d = s = 1, L = 1, uniform design on [0,1] (g = 1), x0 = 1/2, alpha = 0.1, u0 = 0.
Bump profile b(z) = (1 - |z|)_+, amplitude a = 1, so theta_1 is Lipschitz with constant L.
Each check prints PASS or FAIL.
"""
import numpy as np
from scipy import integrate

alpha = 0.1
ell = np.log(1 / alpha)
K, c_q, C_q = 3.0, ell, ell * (np.exp(0.5) - 1) / 0.5
fbar, kappa, rho = alpha, alpha * np.exp(-2), np.exp(0.5)
C1 = 1 + 3 * fbar / (kappa * rho)
b2 = 2.0 / 3.0
A1 = c_q * 1.0 / (2 * C1)
A2 = kappa * c_q**2 / (8 * fbar * K * b2)
ok = True


def report(name, passed, detail=""):
    global ok
    ok &= bool(passed)
    print(f"{'PASS' if passed else 'FAIL'}  {name}  {detail}")


# 1. phi(z) = z - 1 + exp(-z) >= min(z^2, |z|) / e
z = np.concatenate([np.linspace(-30, 0, 200001), np.linspace(0, 200, 400001)])
with np.errstate(over="ignore"):
    phi = z - 1 + np.exp(-z)
slack = phi - np.minimum(z**2, np.abs(z)) / np.e
report("1. phi(z) >= min(z^2,|z|)/e", slack.min() >= -1e-12, f"min slack {slack.min():.3e}")

# 2. tangent-gap inequality (c) for u in [0, 1/2], t >= 0
worst = np.inf
for u in np.linspace(0, 0.5, 51):
    m = np.exp(u)
    q = ell * m
    t = np.linspace(0, 60, 600001)
    F = 1 - np.exp(-t / m)
    e = t - q
    rhs = 1 - alpha + (alpha / m) * e - kappa * np.minimum(e**2, rho * np.abs(e))
    worst = min(worst, (rhs - F).min())
report("2. tangent gap (c)", worst >= -1e-12, f"min slack {worst:.3e}")

# 3. chi-square closed form against quadrature, and K
worstK, maxerr = 0, 0
for u in np.linspace(0.01, 0.5, 50):
    m = np.exp(u)
    val, _ = integrate.quad(lambda t: np.exp(-2 * t / m + t) / m**2, 0, np.inf)
    closed = (m - 1) ** 2 / (m * (2 - m))
    maxerr = max(maxerr, abs(val - 1 - closed))
    worstK = max(worstK, closed / u**2)
report("3. chi^2 closed form", np.isfinite(maxerr) and 0 < maxerr < 1e-7, f"max err {maxerr:.2e}")
report("3b. chi^2 <= K u^2", worstK <= K, f"sup ratio {worstK:.4f} vs K={K}")

# 4. quantile bounds (b)
u = np.linspace(1e-6, 0.5, 1000)
dq = ell * (np.exp(u) - 1)
report("4. quantile bounds (b)", np.all(dq >= c_q * u - 1e-12) and np.all(dq <= C_q * u + 1e-12))


# 5. The two-point bound against a searched family of procedures.
#    Family: T = lam * (mean of k nearest scores), constants lam > 0, k >= 1, fixed design.
#    Coverage and excess are exact. Find the valid member minimizing max(Delta_0, Delta_1)
#    and compare with the bound from Theorem 1 at each admissible h.
def design(n):
    x = (np.arange(n) + 0.5) / n
    return np.sort(np.abs(x - 0.5))


def bump(dist, h):
    return h * np.maximum(1 - dist / h, 0)          # delta = a L h^s = h


def exact(lam, th, th0):
    k = len(th)
    cov = 1 - np.prod(1 / (1 + lam * np.exp(th - th0) / k))
    excess = lam * np.exp(th).mean() - ell * np.exp(th0)
    return cov, excess


def min_lam(th, th0):
    lo, hi = 0.0, 50.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if exact(mid, th, th0)[0] >= 1 - alpha:
            hi = mid
        else:
            lo = mid
    return hi


print("\n5. two-point bound vs best member of the scaled-kNN family")
print(f"{'n':>8} {'h':>8} {'I':>7} {'bound':>10} {'best max(D0,D1)':>16} {'k':>6}")
all5 = True
for n in [10**3, 10**4, 10**5]:
    d = design(n)
    for mult in [0.5, 1.0, 2.0, 4.0]:
        h = mult * n ** -0.5
        delta = h
        I = n * K * 1.0 * b2 * delta**2 * h
        if not (delta <= 0.5 and C_q * delta <= rho / 2 and I <= 1):
            continue
        bound = min(A1 * h, A2 / (n * h))
        best, bestk = np.inf, None
        for k in np.unique(np.round(np.logspace(0, np.log10(n / 2), 120)).astype(int)):
            th0 = np.zeros(k)
            th1 = bump(d[:k], h)
            lam = max(min_lam(th0, 0.0), min_lam(th1, delta))   # valid under both fields
            D0 = exact(lam, th0, 0.0)[1]
            D1 = exact(lam, th1, delta)[1]
            if max(D0, D1) < best:
                best, bestk = max(D0, D1), k
        all5 &= best >= bound
        print(f"{n:>8} {h:>8.4f} {I:>7.3f} {bound:>10.6f} {best:>16.6f} {bestk:>6}")
report("5. bound holds on the family", all5)

# 6. Lemma 1 and the chi-square step by Monte Carlo on one procedure
rng = np.random.default_rng(1)
n, k = 2000, 40
d = design(n)
h = n ** -0.5
delta = h
th1_all = bump(d, h)
lam = max(min_lam(np.zeros(k), 0.0), min_lam(th1_all[:k], delta))
M = 400000
R0 = rng.exponential(1.0, size=(M, k))
T0 = lam * R0.mean(axis=1)
q0, q1 = ell, ell * np.exp(delta)
psi = lambda e: np.minimum(e**2, rho * np.abs(e))
D0 = T0.mean() - q0
lhs = psi(T0 - q0).mean()
report("6a. Lemma 1: E psi <= (fbar/kappa) Delta", lhs <= fbar / kappa * D0,
       f"{lhs:.5f} <= {fbar / kappa * D0:.5f}")
R1 = rng.exponential(np.exp(th1_all[:k]), size=(M, k))
T1 = lam * R1.mean(axis=1)
Y0 = np.clip(T0 - q0, -rho, rho)
Y1 = np.clip(T1 - q0, -rho, rho)
# exact chi-square for the n-sample, fixed design (only the k nearest matter to T, but the
# divergence of the full sample is the quantity in the proof)
r = np.exp(th1_all[th1_all > 0])
chi2 = np.prod(1 / (r * (2 - r))) - 1
gap2 = (Y1.mean() - Y0.mean()) ** 2
report("6b. change of expectation", gap2 <= chi2 * Y0.var(),
       f"{gap2:.3e} <= {chi2 * Y0.var():.3e}")

print("\nconstants: C1=%.3f A1=%.4f A2=%.4f" % (C1, A1, A2))
print("ALL PASS" if ok else "SOME CHECKS FAILED")
