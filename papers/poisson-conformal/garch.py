"""Conformal prediction as the homogenized limit, and GARCH as the case that breaks it.

Pooling calibration residuals averages the fast volatility variable over its invariant
law. That is exactly the averaged (naive homogenized) limit. It is correct to leading
order when the fast variable is FAST relative to the forecast horizon, and the error is
the homogenization corrector, which is O(1) inside the boundary layer.

GARCH is the adversarial case because its volatility is not fast: persistence
alpha+beta is typically 0.99 on daily returns, a relaxation time of order 100 days,
so the horizon is deep inside the boundary layer and the averaged limit is simply wrong.

  r_t = sigma_t eps_t,  sigma_t^2 = omega + alpha r_{t-1}^2 + beta sigma_{t-1}^2
  omega = 1 - alpha - beta   so the stationary variance is 1.

sigma_{t+1} is known at time t, so the conditional coverage of a threshold T is exactly
2*Phi(T/sigma_{t+1}) - 1. No estimation, no simulation error in the target.
"""
import math, numpy as np
from scipy.special import ndtr

P = 0.90

def garch(n, alpha, beta, rng, burn=5000):
    omega = 1 - alpha - beta
    s2 = 1.0; out_r = np.empty(n+burn); out_s = np.empty(n+burn)
    for t in range(n+burn):
        out_s[t] = math.sqrt(s2)
        e = rng.normal()
        r = out_s[t]*e
        out_r[t] = r
        s2 = omega + alpha*r*r + beta*s2
    return out_r[burn:], out_s[burn:]

def study(alpha, beta, n=2000, reps=400, seed=0):
    """Pooled split conformal on |r|. Conditional coverage by decile of the KNOWN next sigma."""
    rng = np.random.default_rng(seed)
    dec = [[] for _ in range(10)]
    marg = []
    for _ in range(reps):
        r, s = garch(n+1, alpha, beta, rng)
        cal = np.abs(r[:n])
        k = int(math.ceil((n+1)*P))
        T = np.sort(cal)[k-1]
        snext = s[n]                       # known one step ahead
        cov = 2*ndtr(T/snext) - 1
        marg.append(cov)
        q = np.searchsorted(np.quantile(s[:n], np.linspace(0.1,0.9,9)), snext)
        dec[q].append(cov)
    return np.array([np.mean(d) if d else np.nan for d in dec]), float(np.mean(marg))

print("="*94)
print("Pooled split conformal on GARCH(1,1). Nominal conditional coverage 0.90.")
print("Columns are deciles of the current volatility state, lowest to highest.")
print()
print(f"{'alpha+beta':>11} {'half-life':>10} | " + " ".join(f"{i+1:>5}" for i in range(10)) + f" | {'mean':>6}")
for alpha, beta in ((0.05,0.75),(0.05,0.85),(0.06,0.90),(0.05,0.94),(0.04,0.957),(0.03,0.969)):
    per = alpha+beta
    hl = math.log(0.5)/math.log(per)
    d, m = study(alpha, beta)
    print(f"{per:>11.3f} {hl:>10.1f} | " + " ".join(f"{x:>5.2f}" for x in d) + f" | {m:>6.3f}")
print()
print("Read the spread across a row: the same interval is far too wide in calm states")
print("and far too narrow in volatile ones, while averaging to roughly nominal.")
