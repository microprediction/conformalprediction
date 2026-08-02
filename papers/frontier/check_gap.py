"""Numerical check of the residual-information gap (Proposition 3).

We verify, by deterministic grid integration (no Monte Carlo), that for a fixed location
predictor the expected log-score regret of the two single-shape conformal forecasters is

    (A) signed CPS:        E[log q*] - E[log r_bar]   =  I(R;X)
    (B) absolute interval: E[log q*] - E[log h_sym]   =  I(R;X) + KL(r_bar || h_sym)

where q*(.|x) = r(.|x) is the oracle conditional residual density, r_bar = E_X r(.|X) is the
marginal residual density (the signed-CPS shape), and h_sym(z) = (r_bar(z)+r_bar(-z))/2 is the
absolute-residual shape. I(R;X) and the skewness KL are computed *independently* from the
definitions, so agreement is a genuine check, not a tautology.

Run:  python check_gap.py
"""
import numpy as np

RHO = np.linspace(-14, 14, 8001)        # residual grid
DR = RHO[1] - RHO[0]
PHI = lambda z: np.exp(-0.5 * z * z) / np.sqrt(2 * np.pi)


def _norm(p):                            # renormalise a gridded density
    return p / (p.sum() * DR)


def integ(f):                            # integral over the grid
    return f.sum() * DR


def xlogx_ratio(p, q):                   # int p log(p/q), with 0 log 0 = 0
    m = p > 1e-300
    qc = np.clip(q, 1e-300, None)
    return np.sum(np.where(m, p * np.log(np.where(m, p, 1.0) / qc), 0.0)) * DR


def cross(p, q):                         # int p log q  (expected log-score of shape q under p)
    m = p > 1e-300
    return np.sum(np.where(m, p * np.log(np.clip(q, 1e-300, None)), 0.0)) * DR


def check(name, cond_densities):
    # cond_densities: (K, G) array, row k = r(.|x_k) on RHO, equal-weight x
    r = np.array([_norm(row) for row in cond_densities])      # (K,G)
    rbar = _norm(r.mean(axis=0))                              # marginal of R
    hsym = _norm(0.5 * (rbar + rbar[::-1]))                   # symmetrised (grid is symmetric)

    # expected log-scores, averaged over x (and over R|x)
    oracle = np.mean([cross(r[k], r[k]) for k in range(len(r))])     # E[log q*]
    signed = np.mean([cross(r[k], rbar) for k in range(len(r))])     # E[log r_bar(R)]
    absol  = np.mean([cross(r[k], hsym) for k in range(len(r))])     # E[log h_sym(R)]
    regret_A = oracle - signed
    regret_B = oracle - absol

    # right-hand sides, computed independently from the definitions
    I_RX = np.mean([xlogx_ratio(r[k], rbar) for k in range(len(r))])  # E_X KL(r(.|X)||rbar)
    KL_skew = xlogx_ratio(rbar, hsym)                                 # KL(rbar||h_sym)

    print(f"\n=== {name} ===")
    print(f"  I(R;X)                         = {I_RX:.6f}")
    print(f"  KL(r_bar || h_sym)             = {KL_skew:.6f}")
    print(f"  (A) regret signed CPS          = {regret_A:.6f}   vs I(R;X)            = {I_RX:.6f}"
          f"   | diff {abs(regret_A - I_RX):.2e}")
    print(f"  (B) regret absolute intervals  = {regret_B:.6f}   vs I(R;X)+KL_skew    = {I_RX + KL_skew:.6f}"
          f"   | diff {abs(regret_B - (I_RX + KL_skew)):.2e}")
    okA = abs(regret_A - I_RX) < 1e-4
    okB = abs(regret_B - (I_RX + KL_skew)) < 1e-4
    print(f"  (A) holds: {okA}    (B) holds: {okB}")
    return okA and okB


def gaussian_case(K=400):
    # r(.|x) = N(0, sigma(x)^2), sigma in [0.5, 2.5]: heteroscedastic, symmetric -> KL_skew = 0
    sig = np.linspace(0.5, 2.5, K)
    return np.stack([PHI(RHO / s) / s for s in sig])


def skewnormal_case(K=400, a=4.0):
    # mean-zero skew-normal with x-varying scale -> I(R;X)>0 AND asymmetric r_bar -> KL_skew>0
    d = a / np.sqrt(1 + a * a)
    om = np.linspace(0.6, 2.2, K)               # scale varies with x
    rows = []
    for w in om:
        xi = -w * d * np.sqrt(2 / np.pi)        # location so the mean is 0
        z = (RHO - xi) / w
        rows.append((2.0 / w) * PHI(z) * 0.5 * (1 + erf_(a * z / np.sqrt(2))))
    return np.stack(rows)


def erf_(x):                                    # vectorised erf via tanh-free series (numpy has none in base)
    # Abramowitz-Stegun 7.1.26
    t = 1.0 / (1.0 + 0.3275911 * np.abs(x))
    y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
             + 0.254829592) * t * np.exp(-x * x)
    return np.sign(x) * y


if __name__ == "__main__":
    ok1 = check("heteroscedastic Gaussian (symmetric: KL_skew should be 0)", gaussian_case())
    ok2 = check("mean-zero skew-normal (asymmetric: KL_skew > 0)", skewnormal_case())
    print(f"\nALL CHECKS PASS: {ok1 and ok2}")
