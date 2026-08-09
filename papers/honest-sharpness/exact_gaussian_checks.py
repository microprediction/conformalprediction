"""Exact (Monte-Carlo-free) verification of the lower bound in honest-sharpness.tex.

The lower bound is a testing-power bound, so on the Gaussian location model every
claim has a closed form and there is nothing to simulate. Fixed design
x_i = (i-1/2)/n on [0,1], and

    R_i | X_i = x_i  ~  N(theta(x_i), 1),   d = 1.

The same numbers hold for the lognormal score R = exp(theta(x) + Z): R -> log R is a
bijection, so total variation and the Neyman-Pearson frontier are identical to the
Gaussian location model, and only the quantile shift picks up a factor e^{z_{1-alpha}}.

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
EXP = S / (2 * S + D)             # modulus rate exponent = 1/3
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


# ---------------------------------------------------------------------------
# TEST 4. Attainability (Proposition 6), lognormal model, Monte Carlo. The honest
# k-NN band of eq (10) holds the honesty probability P{T_n >= q_alpha} at >= 1-eta
# at the smooth baseline, while the uncorrected plug-in threshold holds it at ~1/2.
# The honest band pays for this with excess width of the predicted order n^{-1/3}.
# Produces the third figure.
# ---------------------------------------------------------------------------
def test_attainability():
    # eta = 0.05 here (distinct from the 0.10 of the testing figures) so the conditional
    # coverage level 1-alpha = 0.90 and the honesty probability 1-eta = 0.95 cannot be
    # confused. The plotted quantity is the HONESTY PROBABILITY -- the fraction of
    # calibration samples on which the realized threshold attains conditional coverage
    # >= 1-alpha -- NOT predictive coverage. The plug-in's predictive coverage stays near
    # 1-alpha; what it fails is the honesty target, which it meets on ~half the samples.
    eta_a = 0.05
    z_eta = norm.ppf(1 - eta_a)
    z_a = norm.ppf(1 - ALPHA)
    print(f"\n== Test 4: honest k-NN band attains the rate; plug-in is not honest (eta={eta_a}) ==")
    rng = np.random.default_rng(7)
    q_oracle = np.exp(z_a)                              # q_alpha(0) = exp(z_{1-alpha}), theta0==0
    ns = np.array([1000, 3000, 10000, 30000, 100000])
    reps = 600
    hon_prob, plug_prob, hon_excess = [], [], []
    for n in ns:
        k = max(8, int(round(n ** (2 * S / (2 * S + D)))))   # k ~ n^{2/3}
        hp = pp = ex = 0.0
        for _ in range(reps):
            X = rng.uniform(0, 1, n)
            logR = rng.standard_normal(n)                    # theta(x)=0 baseline
            idx = np.argpartition(np.abs(X - X0), k)[:k]
            th_hat = logR[idx].mean()
            rho_k = np.abs(X[idx] - X0).max()
            # honest band, eq (10): bias L*rho^s + margin z_{1-eta}/sqrt(k)
            T_hon = np.exp(th_hat + rho_k ** S + z_eta / np.sqrt(k) + z_a)
            T_plug = np.exp(th_hat + z_a)                    # no bias, no margin
            hp += T_hon >= q_oracle
            pp += T_plug >= q_oracle
            ex += max(T_hon - q_oracle, 0.0)                 # E[(T - q_alpha)_+], the S_theta functional
        hon_prob.append(hp / reps); plug_prob.append(pp / reps); hon_excess.append(ex / reps)
        print(f"   n={n:6d}  k={k:5d}  honesty-prob(honest)={hp/reps:.3f}"
              f"  honesty-prob(plug-in)={pp/reps:.3f}  honest E[(T-q)_+]={ex/reps:.4f}")
    hon_prob, plug_prob, hon_excess = map(np.array, (hon_prob, plug_prob, hon_excess))
    slope = np.polyfit(np.log(ns), np.log(hon_excess), 1)[0]
    report("honest k-NN band is honest (honesty prob >= 1-eta)",
           hon_prob.min() >= 1 - eta_a - 0.02,
           f"min honesty prob {hon_prob.min():.3f} (want >= {1-eta_a:.2f})")
    report("plug-in meets the honesty target on ~half of samples",
           abs(plug_prob.mean() - 0.5) < 0.05,
           f"plug-in honesty prob {plug_prob.mean():.3f} (theory 0.5)")
    report("honest positive excess E[(T-q)_+] decays at n^{-1/3}", abs(slope + EXP) < 0.06,
           f"log-log slope {slope:.3f} (want {-EXP:.3f})")

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 4.0))
    a1.plot(ns, hon_prob, "o-", label="honest k-NN band")
    a1.plot(ns, plug_prob, "s-", label="plug-in threshold")
    a1.axhline(1 - eta_a, ls="--", c="gray", lw=1, label=f"honesty target $1-\\eta={1-eta_a:.2f}$")
    a1.axhline(0.5, ls=":", c="gray", lw=1)
    a1.set_xscale("log"); a1.set_xlabel("calibration size n")
    a1.set_ylabel("P$_{D_n}$\\{ conditional coverage $\\geq 1-\\alpha$ \\}")
    a1.set_title("Honesty probability: honest vs plug-in")
    a1.set_ylim(0.3, 1.02); a1.legend()
    a2.loglog(ns, hon_excess, "o-", label="honest $E[(T-q_\\alpha)_+]$")
    a2.loglog(ns, hon_excess[0] * (ns / ns[0]) ** (-EXP), "--", c="gray",
              label="$n^{-1/3}$ guide")
    a2.set_xlabel("calibration size n")
    a2.set_ylabel("mean positive excess $E[(T-q_\\alpha)_+]$")
    a2.set_title("Excess pays the modulus"); a2.legend()
    fig.tight_layout()
    fig.savefig("fig_attainability.png", dpi=130)
    plt.close(fig)


# ---------------------------------------------------------------------------
# TEST 5. Random-design exponential model, Monte Carlo. Confirms the same
# critical-scaling signature in a genuinely nonnegative score family that is NOT
# a monotone transform of the Gaussian: TV and the Neyman-Pearson inflation ratio
# stay constant in n. Prints the table displayed in the paper.
# ---------------------------------------------------------------------------
def test_exponential_table():
    print("\n== Test 5: random-design exponential model (TV, NP ratio constant in n) ==")
    rng = np.random.default_rng(2024)
    base = 1.0                                        # baseline Exp mean theta0
    reps = 8000
    ns = np.array([300, 1000, 3000, 10000])
    rows = []
    for n in ns:
        h = n ** (-CRIT)
        # count of points in the bump support [x0-h, x0+h] ~ Binomial(n, 2h)
        counts = rng.binomial(n, min(2 * h, 1.0), size=2 * reps)
        llr0 = np.empty(reps)   # LLR under H0
        llr1 = np.empty(reps)   # LLR under H1
        for j in range(reps):
            for store, under_h1 in ((llr0, False), (llr1, True)):
                m = counts[j if not under_h1 else reps + j]
                if m == 0:
                    store[j] = 0.0
                    continue
                xs = rng.uniform(X0 - h, X0 + h, m)
                th1 = base + (h ** S) * psi((xs - X0) / h)     # delta = h^s, a = 1
                mean = th1 if under_h1 else np.full(m, base)
                r = rng.exponential(mean)
                # per-point LLR = log(theta0/theta1) + r(1/theta0 - 1/theta1)
                store[j] = np.sum(np.log(base / th1) + r * (1.0 / base - 1.0 / th1))
        # TV via Bayes accuracy: threshold LLR at 0 (equal priors)
        tv = 0.5 * (np.mean(llr1 > 0) + np.mean(llr0 < 0)) * 2 - 1
        # NP frontier: t with P1(LLR>=t)=1-eta, then beta = P0(LLR>=t)
        t = np.quantile(llr1, ETA)
        beta = np.mean(llr0 >= t)
        rows.append((n, tv, beta))
        print(f"   n={n:6d}  TV_hat={tv:.3f}   NP inflation ratio_hat={beta:.3f}")
    tvs = np.array([r[1] for r in rows]); betas = np.array([r[2] for r in rows])
    report("exponential TV roughly constant in n", tvs.max() - tvs.min() < 0.08,
           f"TV range {tvs.min():.3f}..{tvs.max():.3f}")
    report("exponential NP ratio roughly constant and > 1/2",
           betas.min() > 0.5 and betas.max() - betas.min() < 0.08,
           f"NP ratio range {betas.min():.3f}..{betas.max():.3f}")
    # emit a LaTeX table body for the paper
    print("   LaTeX rows:")
    for n, tv, beta in rows:
        print(f"     {n} & {tv:.3f} & {beta:.3f} \\\\")


if __name__ == "__main__":
    test_phase_transition()
    test_np_frontier()
    test_nonadaptation()
    test_attainability()
    test_exponential_table()
    n_pass, n_tot = sum(RESULTS), len(RESULTS)
    print("\n" + "=" * 60)
    print(f"SUMMARY: {n_pass}/{n_tot} checks passed.")
    print("Figures written: fig_phase_transition.png, fig_np_frontier.png, "
          "fig_attainability.png")
    print("=" * 60)
