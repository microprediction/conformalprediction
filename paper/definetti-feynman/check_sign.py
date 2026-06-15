"""
Numerical check for "A Feynman-Wigner-Style Diagnostic for the Efficacy of
Conformal Prediction via Signed de Finetti Representations".

Claim under test (Lemma 1 + its sign reading):
  * MARGINAL split-conformal coverage is invariant to the sign of cross-sample
    dependence -- it only needs exchangeability.
  * COVERAGE CONDITIONED ON THE CALIBRATION SAMPLE fans, and the direction of
    the fan is set by the sign of the dependence:
        positive (shared latent, de Finetti proper)  -> flat / adaptive
        independent                                  -> mild fan (Beta-law / estimation)
        negative (without replacement, signed corner)-> steep fan / anti-adaptive

We run three exchangeable worlds, all at target 1-alpha, and report marginal
coverage plus coverage binned by the realised calibration-score mean.
"""
import numpy as np

rng = np.random.default_rng(0)
n, alpha, T = 50, 0.1, 40000
k = int(np.ceil((n + 1) * (1 - alpha)))          # conformal order-statistic index

def covered(cal, test):                           # split-conformal coverage indicator
    return test <= np.sort(cal)[k - 1]

def summarize(name, cal_mean, cov):
    print(f"\n{name}")
    print(f"   marginal coverage = {cov.mean():.3f}   (target {1 - alpha:.2f})")
    q = np.quantile(cal_mean, np.linspace(0, 1, 6))
    for b in range(5):
        m = (cal_mean >= q[b]) & (cal_mean <= q[b + 1] if b == 4 else cal_mean < q[b + 1])
        print(f"   calib-mean Q{b + 1}: coverage = {cov[m].mean():.3f}")

cm = np.empty(T); cv = np.empty(T, bool)

# World 1 -- independent rows (Axis-1 trivial): expect a mild Beta-law fan
for t in range(T):
    R = np.abs(rng.standard_normal(n + 1)); cm[t] = R[:n].mean(); cv[t] = covered(R[:n], R[n])
summarize("INDEPENDENT rows", cm.copy(), cv.copy())

# World 2 -- positive shared latent (de Finetti proper): expect flat / adaptive
for t in range(T):
    s = np.exp(0.8 * rng.standard_normal())       # one shared scale per trial
    R = np.abs(s * rng.standard_normal(n + 1)); cm[t] = R[:n].mean(); cv[t] = covered(R[:n], R[n])
summarize("POSITIVE shared latent (rho>0)", cm.copy(), cv.copy())

# World 3 -- without replacement from a fixed spread pool (signed corner): expect steep fan
M = 60
pool = np.abs(rng.standard_normal(M)) * np.exp(0.8 * rng.standard_normal(M))   # frozen pool
for t in range(T):
    R = pool[rng.permutation(M)[:n + 1]]; cm[t] = R[:n].mean(); cv[t] = covered(R[:n], R[n])
summarize("NEGATIVE without-replacement (rho<0, signed)", cm.copy(), cv.copy())

print("\nPASS criteria: all three marginals ~= 0.90; Q1->Q5 flat for POSITIVE,"
      " mildly rising for INDEPENDENT, steeply rising for NEGATIVE.")
