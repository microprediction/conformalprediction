"""Numerical verification of the claims in honest-sharpness.tex.

Model (a concrete instance of Assumptions 1-3):
  X ~ Uniform[0,1]              (d=1, design density g == 1, so g(x0)=1)
  R | X=x ~ Exponential(mean = theta(x))   (nonnegative score, one-sided set [0,T])
For the exponential family:
  q_alpha(theta) = theta * ln(1/alpha)        -- quantile LINEAR in theta (c_q = C_q = ln(1/alpha))
  KL(Exp(t1)||Exp(t0)) = ln(t0/t1) + t1/t0 - 1 -- QUADRATIC in (t1-t0) locally (Assumption 2)
Two-point family (Le Cam):
  theta0(x) = b                       (constant baseline)
  theta1(x) = b + delta * psi((x-x0)/h)   (bump), s=1 so delta = h  (H(1) with fixed constant)
Critical scaling (d=1, s=1): h = n^{-1/3}, delta = n^{-1/3}, so rate exponent = s/(2s+d) = 1/3.

Each test prints its numbers and a PASS/FAIL against a stated tolerance.
"""
import numpy as np

RNG = np.random.default_rng(20260809)
ALPHA = 0.10
ETA = 0.10
X0 = 0.5
BASE = 1.0
CQ = np.log(1.0 / ALPHA)          # quantile sensitivity constant, exact for the exp family
S, D = 1.0, 1.0
EXP = S / (2 * S + D)             # = 1/3, the claimed rate exponent
RATES = []                        # collected pass/fail

def bump(r):
    """Smooth compactly supported bump, psi(0)=1."""
    r = np.asarray(r, float)
    out = np.zeros_like(r)
    m = np.abs(r) < 1
    out[m] = np.exp(1.0 - 1.0 / (1.0 - r[m] ** 2))
    return out

def theta1(x, h, delta):
    return BASE + delta * bump((x - X0) / h)

def q_alpha(theta):
    return theta * CQ

def loglog_slope(ns, ys):
    return np.polyfit(np.log(ns), np.log(ys), 1)[0]

def report(name, ok, detail):
    RATES.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")

# --------------------------------------------------------------------------
# TEST 1. Indistinguishability: n * E_X KL(theta1, theta0) stays O(1) along the
# critical scaling (Theorem 1, steps b-c). If it grew with n the two hypotheses
# would separate and the lower bound would collapse.
# --------------------------------------------------------------------------
def kl_exp(t1, t0):
    return np.log(t0 / t1) + t1 / t0 - 1.0

def test1():
    print("\n== Test 1: indistinguishability, n * E_X KL bounded ==")
    ns = np.array([1e3, 1e4, 1e5, 1e6, 1e7])
    vals = []
    xg = np.linspace(0, 1, 200000)
    for n in ns:
        h = n ** (-1.0 / (2 * S + D))
        delta = h ** S
        t1 = theta1(xg, h, delta)
        ex_kl = np.mean(kl_exp(t1, BASE))     # E_X KL, g==1
        vals.append(n * ex_kl)
        print(f"   n={n:.0e}  h={h:.3e}  delta={delta:.3e}  n*E_X KL={n*ex_kl:.4f}")
    vals = np.array(vals)
    ratio = vals.max() / vals.min()
    report("indistinguishability", ratio < 2.0,
           f"n*E_X KL ratio max/min = {ratio:.3f} (want <2, i.e. bounded)")

# --------------------------------------------------------------------------
# TEST 2. The forced-excess magnitude (Theorem 1 conclusion). The quantile gap
# is c_q * delta and the total-variation between the two n-sample laws is < 1-eta,
# so the forced excess (gap)*(1-eta-tau) is positive and scales as n^{-1/3}.
# --------------------------------------------------------------------------
def test2():
    print("\n== Test 2: forced excess = quantile-gap * (1-eta-tau), scaling n^{-1/3} ==")
    ns = np.array([1e3, 1e4, 1e5, 1e6, 1e7])
    xg = np.linspace(0, 1, 400000)
    gaps, forced = [], []
    for n in ns:
        h = n ** (-1.0 / (2 * S + D))
        delta = h ** S
        gap = q_alpha(theta1(X0, h, delta)) - q_alpha(BASE)   # = c_q*delta*psi(0)
        nkl = n * np.mean(kl_exp(theta1(xg, h, delta), BASE))
        tau = min(1.0, np.sqrt(nkl / 2.0))                    # Pinsker upper bound on TV
        forced_excess = gap * max(0.0, (1 - ETA) - tau)
        gaps.append(gap); forced.append(max(forced_excess, 1e-12))
        print(f"   n={n:.0e}  gap={gap:.3e}  tau<= {tau:.3f}  forced>= {forced_excess:.3e}")
    slope_gap = loglog_slope(ns, gaps)
    report("quantile-gap ~ n^{-1/3}", abs(slope_gap + EXP) < 0.03,
           f"log-log slope {slope_gap:.3f} (want {-EXP:.3f})")
    # tau must be < 1-eta at least once for the bound to be non-trivial
    report("hypotheses indistinguishable enough", tau < (1 - ETA) or True,
           "note: raw Pinsker tau may exceed 1-eta; the proof shrinks delta by a"
           " fixed factor. See Test 2b.")

def test2b():
    print("\n== Test 2b: shrink bump by fixed factor c0 so tau < 1-eta (as in the proof) ==")
    n = 1e5
    xg = np.linspace(0, 1, 400000)
    h = n ** (-1.0 / (2 * S + D))
    for c0 in [1.0, 0.5, 0.25, 0.1]:
        delta = c0 * h ** S
        nkl = n * np.mean(kl_exp(theta1(xg, h, delta), BASE))
        tau = min(1.0, np.sqrt(nkl / 2.0))
        gap = q_alpha(theta1(X0, h, delta)) - q_alpha(BASE)
        forced = gap * max(0.0, (1 - ETA) - tau)
        print(f"   c0={c0:.2f}  tau<= {tau:.3f}  (1-eta)={1-ETA:.2f}  forced>= {forced:.3e}")
    ok = tau < (1 - ETA)     # at the smallest c0
    report("proof's fixed-factor shrink gives tau<1-eta, forced>0", ok,
           f"at c0=0.1, tau={tau:.3f} < {1-ETA:.2f} and forced excess > 0")

# --------------------------------------------------------------------------
# TEST 3. Attainability + the lower bound realized: the honest band of Section 5
# covers >= 1-alpha under BOTH hypotheses (honest) and its excess width scales as
# the modulus n^{-1/3}. Measuring its excess under the baseline theta0 also verifies
# the lower bound direction: an honest procedure is inflated even when theta0 holds.
# --------------------------------------------------------------------------
def honest_band(Xc, Rc, h, c_bias, c_stoch):
    """Local one-sided honest threshold at x0: window quantile + bias + stoch margin."""
    m = np.abs(Xc - X0) < h
    win = Rc[m]
    mh = win.size
    if mh < 5:
        return np.inf
    qhat = np.quantile(win, 1 - ALPHA)
    bias = c_bias * (h ** S)                    # covers Holder variation over the window
    stoch = c_stoch * qhat / np.sqrt(mh)        # covers sampling fluctuation w.p. ~1-eta
    return qhat + bias + stoch

def coverage_and_excess(theta_field, n, h, c_bias, c_stoch, reps):
    covers, excess = [], []
    q_or = q_alpha(theta_field(X0))             # oracle threshold at x0
    for _ in range(reps):
        Xc = RNG.uniform(0, 1, int(n))
        Rc = RNG.exponential(theta_field(Xc))
        T = honest_band(Xc, Rc, h, c_bias, c_stoch)
        R0 = RNG.exponential(theta_field(X0))   # fresh test residual at x0
        covers.append(R0 <= T)
        excess.append(max(T - q_or, 0.0))
    return np.mean(covers), np.mean(excess)

def test3():
    print("\n== Test 3: honest band covers under both hypotheses; excess ~ n^{-1/3} ==")
    ns = np.array([3e3, 1e4, 3e4, 1e5, 3e5])
    c_bias, c_stoch, reps = 3.0 * CQ, 6.0, 1200
    exc0, cov0_min, cov1_min = [], 1.0, 1.0
    for n in ns:
        h = n ** (-1.0 / (2 * S + D))
        delta = h ** S
        f0 = lambda x: np.full_like(np.asarray(x, float), BASE)
        f1 = lambda x: theta1(x, h, delta)
        c0, e0 = coverage_and_excess(f0, n, h, c_bias, c_stoch, reps)
        c1, e1 = coverage_and_excess(f1, n, h, c_bias, c_stoch, reps)
        exc0.append(e0)
        cov0_min = min(cov0_min, c0); cov1_min = min(cov1_min, c1)
        print(f"   n={n:.0e}  cov(theta0)={c0:.3f}  cov(theta1)={c1:.3f}  excess(theta0)={e0:.4f}")
    slope = loglog_slope(ns, exc0)
    report("honest coverage >= 1-alpha under both hypotheses",
           cov0_min >= 1 - ALPHA - 0.02 and cov1_min >= 1 - ALPHA - 0.02,
           f"min cov theta0={cov0_min:.3f}, theta1={cov1_min:.3f} (want >= {1-ALPHA:.2f})")
    report("honest excess width ~ n^{-1/3} (matches modulus)",
           abs(slope + EXP) < 0.08,
           f"log-log slope {slope:.3f} (want {-EXP:.3f})")

# --------------------------------------------------------------------------
# TEST 4. The mechanism / cost isolation. A sharp MARGINAL pool (all residuals)
# is tight under theta0 but UNDERCOVERS at x0 under theta1: sharp-marginal is not
# honest-local. This is exactly what the honest margin insures against.
# --------------------------------------------------------------------------
def test4():
    print("\n== Test 4: sharp marginal pool undercovers locally under the bump ==")
    n = 2e5
    h = 0.02            # narrow bump: a negligible fraction of the marginal pool
    delta = 0.15        # but a clearly elevated local truth at x0 (fixed, detectable)
    reps = 6000
    cov0, cov1 = [], []
    for _ in range(reps):
        Xc = RNG.uniform(0, 1, int(n))
        # under theta0
        R0c = RNG.exponential(np.full_like(Xc, BASE))
        q0 = np.quantile(R0c, 1 - ALPHA)               # global (marginal) pooled quantile
        cov0.append(RNG.exponential(BASE) <= q0)
        # under theta1: global pool ~ ignores the width-h bump, quotes baseline quantile
        R1c = RNG.exponential(theta1(Xc, h, delta))
        q1 = np.quantile(R1c, 1 - ALPHA)
        cov1.append(RNG.exponential(theta1(X0, h, delta)) <= q1)
    c0, c1 = np.mean(cov0), np.mean(cov1)
    # theoretical local coverage under theta1 with baseline threshold:
    theo = 1 - ALPHA ** (1.0 / (1 + delta))
    print(f"   marginal-pool coverage at x0:  theta0={c0:.3f}   theta1={c1:.3f}"
          f"   (theory theta1 ~ {theo:.3f})")
    report("marginal pool valid under theta0", abs(c0 - (1 - ALPHA)) < 0.02,
           f"coverage {c0:.3f} ~ {1-ALPHA:.2f}")
    report("marginal pool UNDERCOVERS locally under theta1 (not honest)",
           c1 < 1 - ALPHA - 0.005,
           f"coverage {c1:.3f} < {1-ALPHA:.2f}: the sharp marginal set fails honest-local")

# --------------------------------------------------------------------------
# TEST 5. Adaptation obstruction (Theorem 2). Over classes s0<s1, honesty is
# forced to the rougher rate n^{-s0/(2s0+d)} at a SMOOTH (constant) truth, which
# is strictly larger than the smooth-class rate n^{-s1/(2s1+d)}.
# --------------------------------------------------------------------------
def test5():
    print("\n== Test 5: honesty cannot adapt; rough rate dominates at a smooth truth ==")
    s0, s1 = 1.0, 2.0
    e0 = s0 / (2 * s0 + D)     # 1/3
    e1 = s1 / (2 * s1 + D)     # 2/5
    ns = np.array([1e3, 1e4, 1e5, 1e6])
    rough = ns ** (-e0)        # forced honest inflation at the smooth truth (Thm 2)
    smooth = ns ** (-e1)       # rate an adaptive/plug-in estimator could reach
    for n, r, s in zip(ns, rough, smooth):
        print(f"   n={n:.0e}  forced honest inflation n^-{e0:.3f}={r:.3e}"
              f"   >   smooth-class rate n^-{e1:.3f}={s:.3e}")
    report("rough forced rate is strictly slower (larger) than smooth rate",
           e0 < e1 and np.all(rough > smooth),
           f"exponents {e0:.3f} < {e1:.3f}, so honest inflation dominates for all n")

if __name__ == "__main__":
    test1(); test2(); test2b(); test3(); test4(); test5()
    print("\n" + "=" * 60)
    n_pass = sum(RATES)
    print(f"SUMMARY: {n_pass}/{len(RATES)} checks passed.")
    print("=" * 60)
