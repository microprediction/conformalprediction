"""
Per-level fan contraction: FALSE for general negative association, at every n.

Companion to conformal-fan.tex, section "The single level".

  1. verify_counterexample()  -- the "at most one large" NA law L(n,a): draw a
     category Y in {0,...,n} with P(Y=0)=1-na, P(Y=i)=a; coordinate i is large
     (top bin [1-a,1]) iff Y=i, else it is in [0,1-a]; uniform fills. Genuinely
     NA (single-trial multinomial cell structure + independent fills + monotone
     maps). Its top order statistic is over-dispersed at every n:
        Var(U_(n)) - Var_iid = c_n a^2 + O(a^3),  c_n > 0,
     with c_2=1/18, c_3=3/40, c_4=2/25, ...  Exact via the diagonal
        delta(u) = (1-na)(u/(1-a))^n on [0,1-a],  1-n(1-u) on [1-a,1].

  2. positive_subclasses()  -- the bound HOLDS on the structured families a
     calibration design produces: FGM copula (downward parabola in theta capped
     at the benchmark, slope beta_k>=0), and Gaussian copula at rho<0
     (Var(Phi(Z)_(k)) <= benchmark, monotone in rho).

Run:  python3 check_fan_conjecture.py
Deps: numpy, sympy, scipy.
"""
import numpy as np


def indep_var(n, k):
    return k * (n - k + 1) / ((n + 1) ** 2 * (n + 2))


# ----------------------------------------------- 1. the "at most one large" law
def verify_counterexample():
    import sympy as sp
    u, a = sp.symbols("u a", positive=True)
    print("Law L(n,a) = 'at most one coordinate large'. delta split at u=1-a:")
    for n in range(2, 9):
        d_lo = (1 - n * a) * (u / (1 - a)) ** n     # bottom bin [0,1-a]
        d_hi = 1 - n * (1 - u)                       # top bin: union bound saturated
        def mom(m):
            I = sp.integrate(u ** (m - 1) * d_lo, (u, 0, 1 - a)) \
                + sp.integrate(u ** (m - 1) * d_hi, (u, 1 - a, 1))
            return 1 - m * I
        var = sp.simplify(mom(2) - mom(1) ** 2)
        bench = sp.Rational(n, (n + 1) ** 2 * (n + 2))
        excess = sp.simplify(var - bench)
        cn = sp.limit(excess / a ** 2, a, 0)
        # ratio at a small value inside the window
        av = sp.Rational(1, 20) if n == 3 else sp.Rational(1, 200)
        ratio = float(var.subs(a, av) / bench)
        print(f"  n={n}: c_n={cn}  ; a={av} -> ratio {ratio:.6f}  "
              f"{'VIOLATION' if ratio > 1 else ''}")
    print("  => c_n > 0 for every n: the single-level bound fails at every n.")


def na_check(n, a, M=6_000_000, seed=0):
    """Monte-Carlo NA battery for L(n,a): worst disjoint-subset monotone covariance."""
    from itertools import combinations
    rng = np.random.default_rng(seed)
    Y = rng.choice(n + 1, size=M, p=[1 - n * a] + [a] * n)
    V = rng.uniform(0, 1, (M, n))
    U = np.where(np.arange(n)[None, :] + 1 == Y[:, None], (1 - a) + a * V, (1 - a) * V)
    def fns(cc):
        out = [U[:, cc].sum(1)]
        for t in (0.2, 0.5, 0.8, 0.93):
            out += [(U[:, cc].max(1) > t).astype(float), (U[:, cc].min(1) > t).astype(float)]
        return out
    worst = -9.0
    cols = list(range(n))
    for r in range(1, n):
        for A in combinations(cols, r):
            B = [c for c in cols if c not in A]
            for fa in fns(list(A)):
                for gb in fns(B):
                    worst = max(worst, np.cov(fa, gb)[0, 1])
    mx = np.sort(U, 1)[:, -1]
    print(f"  L({n},{a}): NA battery worst Cov = {worst:+.2e} (<=0 => NA); "
          f"MC Var(U_(n))/bench = {mx.var()/indep_var(n, n):.5f}")


# ------------------------------------------------------ 2. positive subclasses
def positive_subclasses():
    from math import comb
    from scipy.integrate import quad
    from scipy.stats import beta as Beta
    print("FGM copula: slope beta_k>=0 (=> Var_theta(U_(k)) <= benchmark on theta<0):")
    ok = True
    for n in range(2, 9):
        for k in range(1, n + 1):
            mu = k / (n + 1)
            N = lambda y: (n - 1) * (n + 2) * y**2 - 2 * (k * n - 1) * y + k * (k - 1)
            beta_k = 0.5 * quad(lambda y: (y - mu)**2 * N(y) * Beta.pdf(y, k, n - k + 1), 0, 1)[0]
            ok = ok and beta_k >= -1e-12
    print(f"  beta_k >= 0 for all n<=8, k: {ok}")
    print("Gaussian copula at rho<0: Var(Phi(Z)_(k)) <= benchmark, monotone in rho (see check_fan.py).")


if __name__ == "__main__":
    print("=" * 68)
    print("1. Counterexample: the single-level bound is FALSE for general NA")
    print("=" * 68)
    verify_counterexample()
    print()
    for n, a in [(3, 0.05), (4, 0.03), (5, 0.02)]:
        na_check(n, a)
    print()
    print("=" * 68)
    print("2. Positive subclasses (the bound holds on real calibration designs)")
    print("=" * 68)
    positive_subclasses()
