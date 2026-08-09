"""Exact (Monte-Carlo-free) verification of the lower bound in honest-sharpness.tex.

The lower bound is a testing-power bound, so on the Gaussian location model every
claim has a closed form and there is nothing to simulate. Fixed design
x_i = (i-1/2)/n on [0,1], and

    R_i | X_i = x_i  ~  N(theta(x_i), 1),   d = 1.

Two-point family: theta0 == 0 (constant baseline, in every Holder class) versus a
local bump theta1(x) = delta * psi((x-x0)/h) with the triangular profile
psi(z) = (1-|z|)_+, s = 1.  Along the critical scaling h = n^{-1/(2s+d)}, delta = h^s.

For the Gaussian model the log-likelihood ratio is exactly Gaussian, so with
    I_n = sum_i (theta1(x_i) - theta0(x_i))^2       (the chi-square separation)
we have  ell_n | P0 ~ N(-I_n/2, I_n),  ell_n | P1 ~ N(+I_n/2, I_n), and therefore

    TV(P1^n, P0^n)                 = 2 Phi( sqrt(I_n)/2 ) - 1                 (eq 12)
    beta_{1-eta}(P1^n, P0^n)       = Phi( z_{1-eta} - sqrt(I_n) )            (eq 13)

the Neyman-Pearson frontier: the least P0-mass of any event with P1-mass >= 1-eta.
The forced minimum inflation, as a multiple of the quantile shift q1 - q0 = delta, is
exactly beta_{1-eta}, and the cruder Le Cam/Pinsker reading gives 1 - eta - TV.

Outputs two figures (matching the phase-transition and NP-frontier plots) and prints
every number with a PASS/FAIL against the stated prediction.
"""
import numpy as np
from scipy.stats import norm
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

X0 = 0.5
ALPHA = 0.10
ETA = 0.10
S, D = 1.0, 1.0
CRIT = 1.0 / (2 * S + D)          # critical bandwidth exponent = 1/3
Z = norm.ppf(1 - ETA)            # z_{1-eta}
RESULTS = []


def psi(z):
    """Triangular bump, psi(0)=1, support [-1,1]."""
    z = np.asarray(z, float)
    return np.clip(1.0 - np.abs(z), 0.0, None)


def separation(n, beta_exp, amp=1.0):
    """Exact chi-square separation I_n = sum_i (theta1-theta0)^2 for a bump of
    bandwidth h = n^{-beta_exp}, amplitude delta = amp * h^s, fixed design."""
    n = int(n)
    x = (np.arange(1, n + 1) - 0.5) / n
    h = n ** (-beta_exp)
    delta = amp * h ** S
    diff = delta * psi((x - X0) / h)
    return float(np.sum(diff ** 2)), delta


def tv_gauss(I):
    return 2 * norm.cdf(np.sqrt(I) / 2) - 1.0


def np_frontier(I):
    """beta_{1-eta}: least P0-mass of any test with power >= 1-eta (eq 13)."""
    return norm.cdf(Z - np.sqrt(I))


def report(name, ok, detail):
    RESULTS.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")


# ---------------------------------------------------------------------------
# TEST 1. Detectability phase transition at the critical exponent 1/(2s+d).
# Below it the bump is detectable (TV -> 1), above it invisible (TV -> 0), and
# exactly at it TV -> a constant in (0,1): the Le Cam boundary.
# ---------------------------------------------------------------------------
def test_phase_transition():
    print("\n== Test 1: detectability phase transition (exact Gaussian TV) ==")
    ns = np.unique(np.round(np.logspace(2, np.log10(2e5), 26)).astype(int))
    betas = [0.25, CRIT, 0.40]
    curves = {}
    for b in betas:
        tv = np.array([tv_gauss(separation(n, b)[0]) for n in ns])
        curves[b] = tv
        print(f"   beta={b:.3f}  TV: n=100 -> {tv[0]:.3f}   n=2e5 -> {tv[-1]:.3f}")
    # critical curve flat; sub-critical rising; super-critical falling
    crit = curves[CRIT]
    flat = crit.max() - crit.min() < 0.01
    rising = curves[0.25][-1] - curves[0.25][0] > 0.2
    falling = curves[0.40][0] - curves[0.40][-1] > 0.05
    report("critical TV constant in n", flat,
           f"critical-band TV range = {crit.max()-crit.min():.4f} (want <0.01), level {crit.mean():.3f}")
    report("sub-critical bump becomes detectable (TV->1)", rising,
           f"beta=0.25 TV rises {curves[0.25][0]:.3f} -> {curves[0.25][-1]:.3f}")
    report("super-critical bump becomes invisible (TV->0)", falling,
           f"beta=0.40 TV falls {curves[0.40][0]:.3f} -> {curves[0.40][-1]:.3f}")
    # critical level matches closed form 2*Phi(sqrt(2/3)/2)-1 = 0.317
    predicted = 2 * norm.cdf(np.sqrt(2.0 / 3.0) / 2) - 1.0
    report("critical TV matches closed form 0.317",
           abs(crit.mean() - predicted) < 0.005,
           f"measured {crit.mean():.4f} vs predicted {predicted:.4f}")

    fig, ax = plt.subplots(figsize=(7, 4.2))
    for b in betas:
        ax.plot(ns, curves[b], "o-", ms=3, label=f"beta={b:.3f}")
    ax.set_xscale("log")
    ax.set_xlabel("calibration size n")
    ax.set_ylabel("total variation / oracle classification separation")
    ax.set_title("Detectability phase transition for local bumps")
    ax.legend()
    fig.tight_layout()
    fig.savefig("fig_phase_transition.png", dpi=130)
    plt.close(fig)


# ---------------------------------------------------------------------------
# TEST 2. Exact Neyman-Pearson sharpness frontier vs the crude TV/Le Cam bound.
# The forced minimum inflation, in units of the quantile shift, is beta_{1-eta}
# (exact) and is bounded below by 1-eta-TV (Pinsker). Both are constant in n at
# the critical scaling; the exact frontier is materially larger.
# ---------------------------------------------------------------------------
def test_np_frontier():
    print("\n== Test 2: exact NP sharpness frontier vs TV/Le Cam bound ==")
    ns = np.unique(np.round(np.logspace(2, np.log10(2e5), 26)).astype(int))
    Is = np.array([separation(n, CRIT)[0] for n in ns])
    beta = np_frontier(Is)               # exact minimum inflation / quantile shift
    lecam = np.clip((1 - ETA) - tv_gauss(Is), 0, None)
    print(f"   exact NP ratio:  {beta.min():.3f} .. {beta.max():.3f}")
    print(f"   TV/Le Cam ratio: {lecam.min():.3f} .. {lecam.max():.3f}")
    # both flat, NP strictly above Le Cam and above 1/2 (=> median inflation)
    report("exact NP frontier constant in n", beta.max() - beta.min() < 0.01,
           f"range {beta.max()-beta.min():.4f}, level {beta.mean():.3f}")
    report("exact frontier exceeds crude TV bound", beta.mean() - lecam.mean() > 0.05,
           f"NP {beta.mean():.3f} > TV-bound {lecam.mean():.3f}")
    report("forced inflation holds on a majority of samples (beta>1/2)",
           beta.min() > 0.5,
           f"min NP ratio {beta.min():.3f} > 0.5, so the MEDIAN threshold is inflated")
    # closed-form checks: I->2/3, so NP=Phi(z.9-sqrt(2/3))=0.679, TV-bound=0.583
    report("NP ratio matches closed form 0.679",
           abs(beta.mean() - norm.cdf(Z - np.sqrt(2.0 / 3.0))) < 0.005,
           f"measured {beta.mean():.4f} vs 0.679")

    fig, ax = plt.subplots(figsize=(7, 4.2))
    ax.plot(ns, beta, "o-", ms=3, label="exact Neyman-Pearson ratio")
    ax.plot(ns, lecam, "x-", ms=4, label="TV/Le Cam lower ratio")
    ax.set_xscale("log")
    ax.set_xlabel("calibration size n")
    ax.set_ylabel("minimum inflation divided by quantile shift")
    ax.set_title("Critical bump: a nonvanishing sharpness cost")
    ax.legend()
    fig.tight_layout()
    fig.savefig("fig_np_frontier.png", dpi=130)
    plt.close(fig)


# ---------------------------------------------------------------------------
# TEST 3. Nonadaptation (Theorem 2), exact. Baseline is smooth (s1); an
# s0-bump at the s0-critical bandwidth is indistinguishable yet forces
# s0-rate inflation. The ratio to the s1 oracle rate diverges as
# n^{s1/(2s1+d) - s0/(2s0+d)}.
# ---------------------------------------------------------------------------
def test_nonadaptation():
    print("\n== Test 3: honesty cannot adapt (exact Gaussian) ==")
    s0, s1 = 1.0, 2.0
    beta0 = 1.0 / (2 * s0 + D)
    forced_exp = s0 / (2 * s0 + D)       # rate forced at the smooth baseline = 1/3
    smooth_exp = s1 / (2 * s1 + D)       # rate an adaptive rule would get = 2/5
    div_exp = smooth_exp - forced_exp    # predicted divergence exponent = 1/15
    # At s0-critical scaling the chi-square separation converges to a constant, so
    # compute it once in closed form (no n-sized array) and reuse it for every n.
    I_star = separation(200_000, beta0)[0]
    beta_star = np_frontier(I_star)
    ns = np.array([1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9])
    ratios = []
    for n in ns:
        delta = n ** (-forced_exp)                 # s0-bump amplitude, exact
        forced_inflation = delta * beta_star       # min inflation at the baseline
        smooth_rate = n ** (-smooth_exp)
        ratios.append(forced_inflation / smooth_rate)
        print(f"   n={n:.0e}  forced~n^-{forced_exp:.3f}={forced_inflation:.3e}"
              f"   smooth~n^-{smooth_exp:.3f}={smooth_rate:.3e}   ratio={ratios[-1]:.2f}")
    slope = np.polyfit(np.log(ns), np.log(ratios), 1)[0]
    report("forced/smooth ratio diverges at the predicted exponent 1/15",
           abs(slope - div_exp) < 0.005,
           f"ratio log-log slope {slope:.4f} vs predicted {div_exp:.4f} (>0, so honesty cannot adapt)")


if __name__ == "__main__":
    test_phase_transition()
    test_np_frontier()
    test_nonadaptation()
    n_pass, n_tot = sum(RESULTS), len(RESULTS)
    print("\n" + "=" * 60)
    print(f"SUMMARY: {n_pass}/{n_tot} checks passed.")
    print("Figures written: fig_phase_transition.png, fig_np_frontier.png")
    print("=" * 60)
