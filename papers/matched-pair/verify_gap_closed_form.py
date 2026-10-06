import numpy as np
from scipy import stats, integrate, special

def h_t_closed(nu):
    # differential entropy of Student-t_nu
    return ((nu+1)/2)*(special.digamma((nu+1)/2) - special.digamma(nu/2)) \
           + np.log(np.sqrt(nu)*special.beta(nu/2, 0.5))

def h_t_numeric(nu):
    f = lambda x: stats.t.pdf(x, nu)
    g = lambda x: -f(x)*np.log(f(x)) if f(x) > 1e-300 else 0.0
    val, _ = integrate.quad(g, -np.inf, np.inf, limit=400)
    return val

def gap_closed(nu):
    # I(R;X) = h(t_nu) - (1/2)E[log sigma^2] - (1/2)log(2 pi e),  sigma^2 ~ InvGamma(nu/2, nu/2)
    E_log_s2 = np.log(nu/2) - special.digamma(nu/2)
    return h_t_closed(nu) - 0.5*E_log_s2 - 0.5*np.log(2*np.pi*np.e)

def gap_mc(nu, n=4_000_000, seed=0):
    rng = np.random.default_rng(seed)
    s2 = stats.invgamma.rvs(a=nu/2, scale=nu/2, size=n, random_state=rng)
    R  = rng.normal(0.0, np.sqrt(s2))
    log_cond = stats.norm.logpdf(R, 0.0, np.sqrt(s2))   # log r(R | X)
    log_marg = stats.t.logpdf(R, nu)                     # log rbar(R)
    d = log_cond - log_marg
    return d.mean(), d.std()/np.sqrt(n)

print(f"{'nu':>5} {'h_t closed':>11} {'h_t numeric':>12} {'gap closed':>11} {'gap MC':>11} {'MC se':>8}")
for nu in [2.5, 3, 4, 5, 8, 15, 30, 100]:
    hc, hn = h_t_closed(nu), h_t_numeric(nu)
    gc = gap_closed(nu)
    gm, se = gap_mc(nu, n=1_500_000, seed=int(nu*7))
    print(f"{nu:>5} {hc:>11.6f} {hn:>12.6f} {gc:>11.6f} {gm:>11.6f} {se:>8.5f}")
