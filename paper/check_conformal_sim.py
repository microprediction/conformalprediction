"""IID simulation: raw vs normalized split conformal where validity applies.

Y = sigma(X) eps, X~U(0,1), sigma(x)=0.5+2x, eps~N(0,1), known zero mean. A
scale proportional to sigma (the regression estimates sqrt(2/pi) sigma; the
constant cancels) is fit on a training split. Both methods use the same
calibration set and the same rank index. Reported per method: marginal
coverage, coverage in all four sigma-quartiles, mean width, and mean interval
(Winkler) score at alpha=0.1, with Monte Carlo standard errors, over 400
replications of 20,000 test points each.
"""
import numpy as np

rng = np.random.default_rng(7)
ALPHA = 0.1
NTR, NCAL, NTE, REPS = 1000, 500, 20000, 400

def sigma(x): return 0.5 + 2.0 * x

res = {m: {k: [] for k in ("cov", "q1", "q2", "q3", "q4", "w", "ws")}
       for m in ("raw", "norm")}
for _ in range(REPS):
    xtr = rng.uniform(0, 1, NTR); ytr = sigma(xtr) * rng.standard_normal(NTR)
    xc = rng.uniform(0, 1, NCAL); yc = sigma(xc) * rng.standard_normal(NCAL)
    xt = rng.uniform(0, 1, NTE);  yt = sigma(xt) * rng.standard_normal(NTE)
    A = np.vstack([np.ones_like(xtr), xtr]).T
    b = np.linalg.lstsq(A, np.abs(ytr), rcond=None)[0]
    sh = lambda x: np.maximum(1e-3, b[0] + b[1] * x)
    k = int(np.ceil((NCAL + 1) * (1 - ALPHA)))
    q_raw = np.sort(np.abs(yc))[k - 1]
    q_nrm = np.sort(np.abs(yc) / sh(xc))[k - 1]
    for m, half in (("raw", np.full(NTE, q_raw)), ("norm", q_nrm * sh(xt))):
        cov = np.abs(yt) <= half
        miss = np.maximum(np.abs(yt) - half, 0.0)
        res[m]["cov"].append(cov.mean())
        for i, (lo, hi) in enumerate([(0, .25), (.25, .5), (.5, .75), (.75, 1.0)]):
            sel = (xt >= lo) & (xt < hi)
            res[m][f"q{i+1}"].append(cov[sel].mean())
        res[m]["w"].append(2 * half.mean())
        res[m]["ws"].append((2 * half + (2 / ALPHA) * miss).mean())

for m in ("raw", "norm"):
    r = res[m]
    line = f"{m:5s}"
    for k in ("cov", "q1", "q2", "q3", "q4", "w", "ws"):
        arr = np.array(r[k])
        line += f"  {k}={arr.mean():.3f}(se {arr.std(ddof=1)/np.sqrt(REPS):.4f})"
    print(line)
