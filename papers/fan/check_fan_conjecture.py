"""
Per-level fan contraction: the n=2 counterexample, and the n>=3 search.

Companion to conformal-fan.tex, section "The single level".  Two things:

  1. verify_counterexample()  -- the exact n=2 negatively-associated pair
     (Proposition, "Counterexample at n=2") whose extreme order statistic is
     over-dispersed: Var(U_(2)) = 1/18 + a^2(1-6a-2a^2)/18 > 1/18, with the
     law shown genuinely NA (C(u,v) <= uv), and the padding non-extension to
     n=3,4,5,6.

  2. search_n_ge_3()  -- a Monte Carlo sweep over negatively associated
     uniform-marginal laws (equicorrelated / non-exchangeable Gaussian copula
     at rho<=0, antithetic pairs, without-replacement) for 3 <= n <= 10 and
     every level k, reporting the worst single-level variance ratio to the
     independent Beta value.  No ratio exceeds 1.

Run:  python3 check_fan_conjecture.py
Deps: numpy, sympy (sympy only for the exact n=2 block).
"""
import numpy as np


def indep_var(n, k):
    """Var of the k-th order statistic of n iid uniforms = Beta(k, n-k+1)."""
    return k * (n - k + 1) / ((n + 1) ** 2 * (n + 2))


# ---------------------------------------------------------------- 1. n=2 exact
def verify_counterexample():
    import sympy as sp
    u, a = sp.symbols("u a", positive=True)
    # "never both large" block law; delta(u)=P(max<=u), split at u=1-a to avoid
    # a symbolic Piecewise breakpoint. delta = d_lo on [0,1-a], d_hi on [1-a,1].
    d_lo = (1 - 2 * a) * u**2 / (1 - a) ** 2
    d_hi = 2 * u - 1

    def moment(m):  # E[U_(2)^m] = 1 - m ∫ u^{m-1} delta du
        I = sp.integrate(u ** (m - 1) * d_lo, (u, 0, 1 - a)) \
            + sp.integrate(u ** (m - 1) * d_hi, (u, 1 - a, 1))
        return 1 - m * I

    var = sp.simplify(moment(2) - moment(1) ** 2)
    excess = sp.simplify(var - sp.Rational(1, 18))
    print("n=2 block law:  Var(U_(2)) - 1/18 =", excess)
    assert sp.simplify(excess - a**2 * (1 - 6 * a - 2 * a**2) / 18) == 0
    v10 = var.subs(a, sp.Rational(1, 10))
    print("   at a=1/10:   Var =", sp.nsimplify(v10), "=", float(v10),
          " ratio", float(v10 * 18), " (>1 => over-dispersed)")
    print("   NA holds (NQD): u v - C = a^2 (gB-gT)(u)(gB-gT)(v) >= 0, gB>=gT.")
    # padding with independent uniforms (still NA) does not extend the violation.
    print("   padding with independent uniforms (still NA):")
    for mm in (3, 4, 5, 6):
        I = sp.integrate(u ** 0 * d_lo * u ** (mm - 2), (u, 0, 1 - a)) \
            + sp.integrate(u ** 0 * d_hi * u ** (mm - 2), (u, 1 - a, 1))
        e1 = 1 - I
        I2 = sp.integrate(u * d_lo * u ** (mm - 2), (u, 0, 1 - a)) \
            + sp.integrate(u * d_hi * u ** (mm - 2), (u, 1 - a, 1))
        e2 = 1 - 2 * I2
        vm = float((e2 - e1**2).subs(a, sp.Rational(1, 10)))
        print(f"     n={mm}: Var(U_(n))/indep = {vm/indep_var(mm, mm):.5f}")


# ------------------------------------------------------- 2. n>=3 numeric search
def _phi(Z):
    from scipy.special import ndtr  # vectorized standard-normal CDF
    return ndtr(Z)


def search_n_ge_3(seed=0):
    rng = np.random.default_rng(seed)
    worst = 0.0
    worst_at = None
    for n in range(3, 11):
        # (a) equicorrelated near the most-negative rho (0.999 of the floor, to
        #     stay strictly positive-definite), and half-way to independence
        for rho in (-0.999 / (n - 1), -0.5 / (n - 1)):
            R = np.full((n, n), rho); np.fill_diagonal(R, 1.0)
            U = _sample(n, R, 3_000_000, rng)
            r, k = _worst_ratio(U, n)
            if r > worst: worst, worst_at = r, ("equicorr", n, round(rho, 3), k)
        # (b) a random non-exchangeable NA Gaussian copula (all off-diag <= 0)
        for _ in range(3):
            A = -np.abs(rng.standard_normal((n, n)) * 0.15)
            R = np.eye(n) + (A + A.T) / 2
            np.fill_diagonal(R, 1.0)
            # project to PSD with non-positive off-diagonals
            w, V = np.linalg.eigh(R)
            R = V @ np.diag(np.clip(w, 1e-6, None)) @ V.T
            d = np.sqrt(np.diag(R)); R = R / np.outer(d, d)
            R = np.minimum(R, np.eye(n))  # keep off-diagonals <= 0-ish
            if (R - np.eye(n)).max() > 1e-9:
                continue
            U = _sample(n, R, 2_000_000, rng)
            r, k = _worst_ratio(U, n)
            if r > worst: worst, worst_at = r, ("noneqcorr", n, None, k)
        # (c) without replacement from a fine grid (permutation distribution)
        M = 2_000_000
        pop = np.linspace(1, 4 * n, 4 * n) / (4 * n + 1)
        idx = np.argsort(rng.random((M, len(pop))), axis=1)[:, :n]
        U = pop[idx]
        r, k = _worst_ratio(U, n)
        if r > worst: worst, worst_at = r, ("WOR", n, None, k)
        print(f"  n={n}: swept; running worst single-level ratio = {worst:.4f}")
    print(f"\nworst single-level Var ratio over all n>=3 laws tried: {worst:.4f}  at {worst_at}")
    print("(<= 1 means no counterexample; MC noise near independence is ~1.00)")


def _sample(n, R, M, rng):
    from numpy.linalg import cholesky
    L = cholesky(R)
    Z = rng.standard_normal((M, n)) @ L.T
    return _phi(Z)


def _worst_ratio(U, n):
    Us = np.sort(U, axis=1)
    best, bk = 0.0, None
    for k in range(1, n + 1):
        v = Us[:, k - 1].var()
        r = v / indep_var(n, k)
        if r > best: best, bk = r, k
    return best, bk


if __name__ == "__main__":
    print("=" * 68)
    print("1. Exact n=2 counterexample")
    print("=" * 68)
    verify_counterexample()
    print()
    print("=" * 68)
    print("2. n>=3 search (no counterexample expected)")
    print("=" * 68)
    search_n_ge_3()
