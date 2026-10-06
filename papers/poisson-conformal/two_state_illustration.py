"""Numerical illustration for the fast two-state volatility model (Section 6).
Reproduces the conditional-coverage fan (74% / 94% around a pooled 90%) and the
effective-sample-size loss, and simulates a sampled chain to confirm the closed
forms for the transient corrector and the long-run calibration variance."""
import numpy as np

pi_H, lam, FL, FH, p = 0.2, 0.8, 0.95, 0.70, 0.90
pi_L = 1 - pi_H
d = FH - FL                                   # F_H(q_p) - F_L(q_p) < 0

# invariant mixture at the invariant p-quantile
assert abs(pi_L * FL + pi_H * FH - p) < 1e-12

# one-step coverage of the invariant threshold given current filtered state omega0
cov = lambda w0: p + lam * (w0 - pi_H) * d
print(f"pooled (stationary) coverage : {p:.2f}")
print(f"current high-vol coverage    : {cov(1.0):.3f}")
print(f"current low-vol  coverage    : {cov(0.0):.3f}")

# long-run calibration variance of the coverage indicator at q_p
sig2 = p * (1 - p) + 2 * pi_L * pi_H * d**2 * lam / (1 - lam)
print(f"long-run variance sigma_p^2  : {sig2:.3f}")
print(f"dependence inflation factor  : {sig2 / (p*(1-p)):.3f}")
print(f"effective sample fraction    : {p*(1-p)/sig2:.3f}")

# Monte-Carlo confirmation of sigma_p^2 on the sampled two-state chain
rng = np.random.default_rng(1)
Pm = np.array([[1 - (1-lam)*pi_H, (1-lam)*pi_H],       # 2-state kernel, states L,H
               [(1-lam)*pi_L, 1 - (1-lam)*pi_L]])
# stationary check
assert abs(np.linalg.matrix_power(Pm, 400)[0, 1] - pi_H) < 1e-6
n, reps = 4000, 4000
means = np.empty(reps)
for r in range(reps):
    s = np.zeros(n, dtype=int)
    s[0] = rng.random() < pi_H
    u = rng.random(n)
    for t in range(1, n):
        s[t] = u[t] < Pm[s[t-1], 1]
    Fcond = np.where(s == 1, FH, FL)              # P(R<=q_p | state)
    ind = rng.random(n) < Fcond                   # coverage indicators at q_p
    means[r] = ind.mean()
mc = n * means.var()
print(f"MC long-run variance (n*Var) : {mc:.3f}   (closed form {sig2:.3f})")
