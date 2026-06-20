"""Numerical checks for "The Width of the Conformal Fan".

Reproduces the table and the two exact claims:
  - the realized (calibration-conditional) coverage variance vs the iid Beta fan,
    across dependence structures (negative association narrows it, positive widens it,
    the contest floor zeroes it);
  - the de Finetti / law-of-total-variance decomposition for positive dependence
    (Theorem 2): Var(c) = E[Var(c|Q)] + Var(E[c|Q]), with the second term the inflation.

Dependencies: numpy, scipy. One run; seeded.
"""
import numpy as np
from scipy.stats import norm

rng = np.random.default_rng(1)
n, alpha = 20, 0.10
k = int(np.ceil((n+1)*(1-alpha)))
beta_var = k*(n-k+1)/((n+1)**2*(n+2))
T = 60000


def realized_coverage(Z_sampler):
    """c = U_(k) on the PIT scale, Z -> uniform via the Gaussian copula."""
    c = np.empty(T)
    for t in range(T):
        c[t] = np.sort(norm.cdf(Z_sampler()))[k-1]
    return c.mean(), c.var()


def iid():        return rng.standard_normal(n)
def exch_neg():                                            # exchangeable rho = -1/(n-1)
    e = rng.standard_normal(n); z = e - e.mean(); return z/z.std()
def ma_neg():                                              # MA(1), lag-1 corr -1/2 (non-exch NA)
    e = rng.standard_normal(n+1); return (e[1:] - e[:-1])/np.sqrt(2)
def block_neg():                                           # random negatively-paired blocks (non-exch NA)
    out = rng.standard_normal(n)
    L = np.array([[1, 0], [-0.6, np.sqrt(1-0.36)]])
    for a, b in rng.permutation(n).reshape(-1, 2):
        out[a], out[b] = L @ rng.standard_normal(2)
    return out
def contest():                                             # max NA: permutation of a fixed grid
    return norm.ppf(rng.permutation(np.arange(1, n+1))/(n+1))   # -> exact grid after copula
def pos():                                                 # one-factor, rho = +0.2
    return np.sqrt(0.2)*rng.standard_normal() + np.sqrt(0.8)*rng.standard_normal(n)


if __name__ == "__main__":
    print(f"n={n}, alpha={alpha}, k={k}, target={k/(n+1):.4f}")
    print(f"iid Beta fan variance = {beta_var:.4e}\n")
    print(f"{'calibration dependence':30s} {'E[c]':>7s} {'Var(c)':>11s} {'ratio':>7s}")
    for name, samp in [("independent", iid),
                       ("exchangeable -1/(n-1)", exch_neg),
                       ("MA(1) corr -1/2", ma_neg),
                       ("negatively-paired blocks", block_neg),
                       ("contest / without-replace", contest),
                       ("one-factor +0.2", pos)]:
        m, v = realized_coverage(samp)
        print(f"{name:30s} {m:7.4f} {v:11.4e} {v/beta_var:7.2f}")

    # Theorem 2: law-of-total-variance decomposition for the positive (extendable) case.
    print("\nTheorem 2 (positive dependence), one-factor rho=0.2:")
    rho = 0.20
    c = np.empty(T); W = np.empty(T)
    for t in range(T):
        w = rng.standard_normal()
        c[t] = np.sort(norm.cdf(np.sqrt(rho)*w + np.sqrt(1-rho)*rng.standard_normal(n)))[k-1]
        W[t] = w
    cb = c[np.argsort(W)]
    parts = np.array_split(cb, 40)
    within = sum(p.var()*len(p) for p in parts)/T
    between = np.average([(p.mean()-c.mean())**2 for p in parts],
                         weights=[len(p) for p in parts])
    print(f"  Var(c) total        = {c.var():.4e}")
    print(f"  E[Var(c|Q)] within  = {within:.4e}")
    print(f"  Var(E[c|Q]) between = {between:.4e}  (absent under independence)")
    print(f"  within + between    = {within+between:.4e}  (= total)")

    # Conjecture 1: counterexample hunt across negatively-associated structures.
    # Random non-exchangeable all-negative-correlation Gaussian copulas, every k.
    print("\nConjecture 1 hunt: max Var(U_(k))/Beta over NA structures (>1.02 would be a violation):")
    def random_neg_corr(m):
        P = rng.uniform(0.2, 1.0, (m, m)); P = (P + P.T) / 2; np.fill_diagonal(P, 0.0)
        c0 = 0.95 / np.linalg.eigvalsh(P)[-1]
        S = np.eye(m) - c0 * P
        d = np.sqrt(np.diag(S))
        return S / np.outer(d, d)
    for m in [4, 5, 6, 8]:
        worst = 0.0
        cands = [(1 - r) * np.eye(m) + r * np.ones((m, m)) for r in (-0.5/(m-1), -0.9/(m-1), -0.999/(m-1))]
        cands += [random_neg_corr(m) for _ in range(8)]
        for C in cands:
            if (C - np.diag(np.diag(C))).max() > 1e-9 or np.linalg.eigvalsh(C)[0] < -1e-9:
                continue
            L = np.linalg.cholesky(C + 1e-12 * np.eye(m))
            Us = np.sort(norm.cdf(L @ rng.standard_normal((m, 80000))), axis=0)
            for kk in range(1, m + 1):
                bv = kk * (m - kk + 1) / ((m + 1) ** 2 * (m + 2))
                worst = max(worst, Us[kk - 1].var() / bv)
        print(f"  n={m}: max ratio = {worst:.3f}")
    print("  (all <= 1 => no counterexample; ratio is furthest below 1 at the contest floor.)")

    # Proposition (exact path): mix iid (1-t) and contest (t); both share mean k/(n+1),
    # so Var(c) = (1-t)*Beta exactly, the fan collapsing linearly to the floor.
    print("\nProposition (exact path) iid <-> contest: Var(c) should equal (1-t)*Beta:")
    grid = np.arange(1, n+1)/(n+1)
    for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
        cc = np.empty(T)
        for i in range(T):
            u = rng.permutation(grid) if rng.random() < t else rng.random(n)
            cc[i] = np.sort(u)[k-1]
        print(f"  t={t:.2f}: Var(c)={cc.var():.4e}  (1-t)*Beta={(1-t)*beta_var:.4e}  ratio={cc.var()/beta_var:.3f}")

    # Theorem (aggregate fan bound): sum_k Var(U_(k)) <= iid, via concavity of min(j,n-N) +
    # convex order. Needs EXACT uniform marginals; use jittered ranks (NA) and an MA(1) copula.
    print("\nTheorem (aggregate fan bound): sum_k Var(U_(k)) <= iid sum, every NA structure:")
    def jitrank(m): V = rng.random(); return np.sort((rng.permutation(m) + V) / m)
    def ma(m): e = rng.standard_normal(m + 1); return np.sort(norm.cdf((e[1:] - e[:-1]) / np.sqrt(2)))
    for m in [8, 12]:
        iid_sum = sum(kk * (m - kk + 1) / ((m + 1) ** 2 * (m + 2)) for kk in range(1, m + 1))
        for nm, fn in [("jitrank", jitrank), ("ma", ma)]:
            OS = np.array([fn(m) for _ in range(200000)])
            print(f"  n={m} {nm:8s}: sum Var={OS.var(0).sum():.4e}  iid sum={iid_sum:.4e}  "
                  f"<= ? {OS.var(0).sum() <= iid_sum + 2e-3}")

    # Proposition (equicorrelated normals): Var(Z_(k)) = v_k + rho*(1-v_k), exact & monotone;
    # under the Gaussian copula U=Phi(Z) the uniform-scale fan is monotone in rho and <= iid for rho<0.
    print("\nProposition (equicorrelated normals), n=10, k=8: Var(Z_(k)) = v_k + rho*(1-v_k);"
          " U-scale monotone:")
    nn, kk = 10, 8
    vk = np.sort(rng.standard_normal((300000, nn)), axis=1)[:, kk-1].var()
    bU = kk*(nn-kk+1)/((nn+1)**2*(nn+2))
    for rho in [-1/(nn-1), -0.05, 0.0, 0.2]:
        R = (1-rho)*np.eye(nn) + rho*np.ones((nn, nn))
        Z = (np.linalg.cholesky(R + 1e-12*np.eye(nn)) @ rng.standard_normal((nn, 600000))).T
        Zk = np.sort(Z, axis=1)[:, kk-1]
        print(f"  rho={rho:+.3f}: Var(Z_(k))={Zk.var():.4f} pred {vk+rho*(1-vk):.4f} | "
              f"Var(U_(k))/iid={norm.cdf(Zk).var()/bU:.3f}")

    # Dispersive-transfer check: U_(k)(rho)=Phi(Z_(k)) dispersively monotone in rho
    # (all quantile gaps grow with rho) => Var(U_(k)) monotone; the half-rigorous step.
    print("  dispersive monotonicity of U_(k) in rho (all quantile gaps grow):")
    qs = np.linspace(0.02, 0.98, 25); prev = None; mono = True
    for rho in [-1/(nn-1), -0.06, 0.0, 0.15]:
        R = (1-rho)*np.eye(nn) + rho*np.ones((nn, nn))
        Z = (np.linalg.cholesky(R + 1e-12*np.eye(nn)) @ rng.standard_normal((nn, 800000))).T
        Q = np.quantile(norm.cdf(np.sort(Z, axis=1)[:, kk-1]), qs)
        if prev is not None and not (np.abs(Q[:, None]-Q[None, :]) >= np.abs(prev[:, None]-prev[None, :]) - 2e-3).all():
            mono = False
        prev = Q
    print(f"    monotone? {mono}")

    # Lemma: D=(xi-xi_bar)_(k) is n/(n-1)-strongly-log-concave, (log g_D)'' <= -n/(n-1).
    print("  Lemma: D is n/(n-1)-strongly-log-concave (KDE estimate of max (log g_D)''):")
    from scipy.stats import gaussian_kde
    for (n2, k2) in [(8, 7), (10, 8), (16, 13)]:
        x = rng.standard_normal((4_000_000, n2)); x -= x.mean(1, keepdims=True)
        Dd = np.sort(x, axis=1)[:, k2-1]
        kde = gaussian_kde(Dd, bw_method=0.15)
        lo, hi = np.quantile(Dd, [0.04, 0.96]); t = np.linspace(lo, hi, 160)
        lg = np.log(kde(t)); d2 = (lg[2:]-2*lg[1:-1]+lg[:-2])/(t[1]-t[0])**2
        print(f"    n={n2} k={k2}: need <= -{n2/(n2-1):.3f}; core max (log g_D)'' = {d2.max():.2f}  "
              f"=> n/(n-1)-slc with margin? {d2.max() <= -n2/(n2-1)}")
