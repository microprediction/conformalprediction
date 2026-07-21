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


def verify_fullsupport_violator():
    """Exact check that a full-support, strictly-interior-NA law still violates.
    Loads fullsupport_na_violator.json (n=3, g=5 grid law, exact rationals), verifies
    uniform marginals + full support + NA (complete up-set procedure) + Var(U_(3)) > 3/80
    of its smeared continuous form -- all in exact arithmetic."""
    import json
    from fractions import Fraction as Fr
    from itertools import product
    d = json.load(open("fullsupport_na_violator.json"))
    n, g = d["n"], d["g"]
    law = {tuple(c): Fr(int(nu), int(de)) for c, nu, de in zip(d["cells"], d["num"], d["den"])}
    cellsall = list(product(range(g), repeat=n))
    get = lambda c: law.get(c, Fr(0))
    print(f"Full-support violator (n={n}, g={g}):")
    print(f"  full support: min cell prob = {float(min(get(c) for c in cellsall)):.4f} > 0 "
          f"(density floor {float(min(get(c) for c in cellsall))*g**n:.2f})")
    marg_ok = all(sum(get(c) for c in cellsall if c[ax] == j) == Fr(1, g)
                  for ax in range(n) for j in range(g))
    print(f"  marginals exactly uniform: {marg_ok}")
    # NA: worst covariance over non-trivial up-set pairs (singleton|singleton and pair|singleton)
    ups1 = [set(range(t, g)) for t in range(g + 1)]
    def ups2():
        out, ts = [], []
        def rec(i, prev):
            if i == g:
                out.append({(ii, jj) for ii, ti in enumerate(ts) for jj in range(ti, g)}); return
            for t in range(prev + 1):
                ts.append(t); rec(i + 1, t); ts.pop()
        rec(0, g); return out
    U2 = ups2()
    worst = Fr(-1)
    for (a0, a1) in [(0, 1), (0, 2), (1, 2)]:
        m = [[Fr(0)] * g for _ in range(g)]
        for c in cellsall: m[c[a0]][c[a1]] += get(c)
        for Sa in ups1[1:-1]:
            for Sb in ups1[1:-1]:
                EAB = sum(m[x][y] for x in Sa for y in Sb)
                EA = sum(m[x][y] for x in Sa for y in range(g))
                EB = sum(m[x][y] for x in range(g) for y in Sb)
                worst = max(worst, EAB - EA * EB)
    for (a0, a1, b) in [(0, 1, 2), (0, 2, 1), (1, 2, 0)]:
        for Sp in U2:
            if len(Sp) in (0, g * g): continue
            for Sb in ups1[1:-1]:
                EAB = EA = EB = Fr(0)
                for c in cellsall:
                    p = get(c)
                    inA = (c[a0], c[a1]) in Sp; inB = c[b] in Sb
                    if inA and inB: EAB += p
                    if inA: EA += p
                    if inB: EB += p
                worst = max(worst, EAB - EA * EB)
    print(f"  NA: worst non-trivial covariance = {float(worst):.3e} (<0 => strictly interior NA)")
    # smeared Var(U_(n)) exact
    def moment(r):
        tot = Fr(0)
        for cell, p in law.items():
            if p == 0: continue
            s = Fr(0)
            for j in range(g):
                if any(c > j for c in cell): continue
                poly = {0: Fr(1)}
                for c in cell:
                    if c == j:
                        np_ = {}
                        for pw, co in poly.items():
                            np_[pw + 1] = np_.get(pw + 1, Fr(0)) + co * g
                            np_[pw] = np_.get(pw, Fr(0)) - co * c
                        poly = np_
                lo, hi = Fr(j, g), Fr(j + 1, g)
                for pw, co in poly.items():
                    e = pw + r
                    s += co * (hi ** e - lo ** e) / e
            tot += p * s
        return 1 - r * tot
    var = moment(2) - moment(1) ** 2
    bench = Fr(n, (n + 1) ** 2 * (n + 2))
    print(f"  smeared Var(U_(n)) = {float(var):.7f}  vs benchmark {float(bench):.7f}  "
          f"ratio {float(var / bench):.5f}  {'VIOLATES' if var > bench else ''}")


if __name__ == "__main__":
    print("=" * 68)
    print("1. Counterexample: the single-level bound is FALSE for general NA")
    print("=" * 68)
    verify_counterexample()
    print()
    print("=" * 68)
    print("1b. Full support does NOT rescue it (exact certificate)")
    print("=" * 68)
    verify_fullsupport_violator()
    print()
    for n, a in [(3, 0.05), (4, 0.03), (5, 0.02)]:
        na_check(n, a)
    print()
    print("=" * 68)
    print("2. Positive subclasses (the bound holds on real calibration designs)")
    print("=" * 68)
    positive_subclasses()
