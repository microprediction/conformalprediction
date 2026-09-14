"""Attack: is the substitution result an artefact of a FINITE state space?

In a two-state chain there is one non-unit mode and it IS the state, so stratifying
on the state removes the dependence by construction. With a continuous state you
must BIN, and binning is approximate, so residual within-stratum dependence survives.

Model: stochastic volatility with an AR(1) log-scale.
    log s_t = phi log s_{t-1} + sqrt(1-phi^2) nu xi_t,   xi ~ N(0,1)
    R_t     = exp(log s_t) |eps_t|,                      eps ~ N(0,1)
so log s is stationary N(0, nu^2). The l-step-ahead score CDF from state x is
    G_l(r | x) = E_{u ~ N(phi^l x, nu^2 (1-phi^{2l}))} [ 2 Phi(r e^{-u}) - 1 ]
computed by Gauss-Hermite. Stratify by binning log s_{t-l} into M quantile bins.
"""
import math, numpy as np
from numpy.polynomial.hermite_e import hermegauss

NU, ELL, P = 1.0, 1, 0.90
GH_X, GH_W = hermegauss(40); GH_W = GH_W / GH_W.sum()

def G(r, mean, sd):
    """P(R <= r) when log s ~ N(mean, sd^2) and R = e^{log s}|eps|."""
    u = mean + sd*GH_X
    r = np.atleast_1d(np.asarray(r, float))[:, None]
    return float(np.sum(GH_W * (2*_Phi(r*np.exp(-u)) - 1), axis=1)[0])

def _Phi(z):
    from scipy.special import ndtr
    return ndtr(z)

def law_from(x, phi, ell=ELL):
    m, s = phi**ell * x, NU*math.sqrt(1-phi**(2*ell))
    return lambda r: G(r, m, s)

def invariant(phi):
    return lambda r: G(r, 0.0, NU)

def inv_of(f, target, lo=1e-9, hi=200.0):
    for _ in range(200):
        m = 0.5*(lo+hi)
        if f(m) < target: lo = m
        else: hi = m
    return 0.5*(lo+hi)

def freedman(n, eta, B, V):
    x = math.log(1/eta)
    return (2*B + math.sqrt(2*n*V*x))/n + 2*B*x/(3*n)

def sigma2_emp(phi, reps=200000, seed=7):
    """long-run variance of 1{R<=q_p} by simulation (the pooled correction needs it)."""
    rng = np.random.default_rng(seed)
    qp = inv_of(invariant(phi), P)
    x = rng.normal(0, NU)
    xs = np.empty(reps)
    for t in range(reps):
        x = phi*x + math.sqrt(1-phi*phi)*NU*rng.normal(); xs[t] = x
    R = np.exp(xs)*np.abs(rng.normal(size=reps))
    I = (R <= qp).astype(float); I -= I.mean()
    ac = [float(np.mean(I[:-j]*I[j:])) for j in range(1, 200)]
    return float(np.var(I) + 2*sum(ac))

def run(phi, n, M, eta=0.05, reps=2500, seed=0):
    rng = np.random.default_rng(seed)
    s2 = sigma2_emp(phi)
    edges = [NU*_ppf(i/M) for i in range(1, M)]          # quantile bins of N(0,nu^2)
    out = {k: {"fail":0,"n":0,"cov":[]} for k in ("pool_iid","pool_sig","strat_iid","strat_sig")}
    for _ in range(reps):
        x = rng.normal(0, NU)
        xs = np.empty(n+ELL)
        for t in range(n+ELL):
            xs[t] = x; x = phi*x + math.sqrt(1-phi*phi)*NU*rng.normal()
        R = np.exp(xs)*np.abs(rng.normal(size=n+ELL))
        cal, calx = R[:n], xs[:n]
        xn = calx[-1]
        bn = int(np.searchsorted(edges, xn))
        lab = np.searchsorted(edges, calx)
        pool = np.sort(cal)
        sub  = np.sort(cal[np.where(lab[:-ELL] == bn)[0] + ELL])
        target = law_from(xn, phi)
        for nm, arr, V in (("pool_iid",pool,P*(1-P)), ("pool_sig",pool,s2),
                           ("strat_iid",sub,P*(1-P)), ("strat_sig",sub,s2)):
            N = len(arr)
            if N < 20: continue
            k = int(N*(P + freedman(N, eta/2, 1.0, V))) + 1
            T = math.inf if k > N else arr[k-1]
            c = 1.0 if not math.isfinite(T) else target(T)
            r = out[nm]; r["cov"].append(c); r["n"] += 1
            if c < P - 1e-12: r["fail"] += 1
    return {k:(v["fail"]/v["n"], float(np.mean(v["cov"]))) for k,v in out.items() if v["n"]}

def _ppf(u):
    from scipy.special import ndtri
    return float(ndtri(u))

print("="*98)
print("Continuous state (AR(1) log-volatility). Stratification must BIN, so it is approximate.")
print("n = 1500, nominal eta = 0.05, 2500 replicates. Target: l-step law from the realized state.")
print()
print(f"{'phi':>6} {'sigma^2/p(1-p)':>15} {'M bins':>7} | {'pool iid':>9} {'pool sig':>9}"
      f" | {'strat iid':>10} {'strat sig':>10} | {'strat-iid cov':>14}")
for phi in (0.90, 0.98):
    s2 = sigma2_emp(phi)
    for M in (2, 5, 10):
        r = run(phi, 1500, M)
        print(f"{phi:>6.2f} {s2/(P*(1-P)):>15.1f} {M:>7} | {r['pool_iid'][0]:>9.3f} {r['pool_sig'][0]:>9.3f}"
              f" | {r['strat_iid'][0]:>10.3f} {r['strat_sig'][0]:>10.3f} | {r['strat_iid'][1]:>14.4f}")
