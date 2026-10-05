"""Review check for Qiao et al. 2026, "Counterfactual Online Conformal Prediction Under
Adaptive Logging" (arXiv 2609.30811).

Claim under test: the counterfactual-coverage failure of per-arm online CP is driven by the
endogeneity coefficient rho (action-induced outcome shift, the paper's Definition 2.5). We
check whether it is instead covariate shift in X | a: the logger changes which contexts each
arm is observed in, and the threshold ignores x on a score whose law varies with x.

Instances follow the paper's Appendix F: two contexts, two actions, eps-greedy logging with
eps = 0.05 (pi_min = 0.025), T = 20,000, alpha = 0.1.
  mean    Y(a) ~ N(mean, 1), the favoured arm has mean 0, the other mean Delta = 2; score |y|.
  var     Y(a) ~ N(5, sd), sd = (1, 1+Delta) in L, swapped in H; risk-averse logger; score |y-5|.
  rho0    as var, but both arms share the context's law: sd = 1 in L, 1+Delta in H, so the
          paper's rho is exactly 0. The logger still favours one arm per context.
  freelog as var (rho > 0), but the logger ignores the context (uniform over arms).
  cont    continuous context X ~ U(0,1), sd_0(x) = 1 + 2x, sd_1(x) = 3 - 2x, score |y|,
          risk-averse eps-greedy logger.

Methods, all online with the ACI recursion of Gibbs and Candes (2021):
  aci      per-arm ACI on the logged rounds (the paper's failing baseline), gamma = 0.005.
  pwocp    the paper's PW-OCP (Algorithm 1, eq. 13): every round, Z = 1{a_t=a}/pi * miss,
           gamma = sqrt(pi_min / T), threshold = empirical quantile of the logged scores,
           iterate clipped to [-0.5, 1.5] as in the paper's experiments (App. F.1).
  cell     per-(context cell, arm) ACI on the logged rounds, gamma = 0.005, no propensities.
           For 'cont' the cells are B equal-width bins of x.
  norm     (cont only) per-arm ACI on the normalized score |y| / sd_a(x) with the true sd: a
           conditionally pivotal score, the limiting case of a learned scale model.

Reported per method, averaged over seeds: counterfactual gap max_a |CCov_T(a) - 0.9|, played-
action coverage MCov_T, the median finite threshold of the played action's set (score units),
and the fraction of rounds on which the set for some action is the whole line (alpha_t <= 0
gives Q(1 - alpha_t) = +inf under the paper's boundary convention, eq. 6). The paper's
set-quality metric is restricted to rounds with non-degenerate sets (App. F.1).

    python adlog_sim.py            # 10 seeds, all instances
"""
import bisect
import numpy as np

ALPHA, T, EPS, SEEDS, DELTA = 0.1, 20000, 0.05, 10, 2.0


def draw(inst, rng):
    if inst == "cont":
        X = rng.random(T)
        sd = np.stack([1 + 2 * X, 3 - 2 * X], 1)
        S = np.abs(rng.normal(0, sd))
        fav = np.argmin(sd, 1)
        cell = X
        return X, S, sd, fav, cell
    X = rng.integers(2, size=T)
    if inst == "mean":
        mu = np.where(X[:, None] == 0, [0, DELTA], [DELTA, 0])
        S = np.abs(rng.normal(mu, 1.0))
        sd = np.ones((T, 2))
        fav = X
    else:
        if inst == "rho0":
            sd = np.where(X == 0, 1.0, 1 + DELTA)[:, None] * np.ones(2)
            fav = X                       # still favours one arm per context
        else:
            sd = np.where(X[:, None] == 0, [1, 1 + DELTA], [1 + DELTA, 1])
            fav = np.argmin(sd, 1)
        S = np.abs(rng.normal(0, sd))
    return X, S, sd, fav, X


def logger(fav, rng, inst):
    if inst == "freelog":
        A = rng.integers(2, size=T)
        return A, np.full(T, 0.5)
    explore = rng.random(T) < EPS
    A = np.where(explore, rng.integers(2, size=T), fav)
    P = np.where(A == fav, 1 - EPS / 2, EPS / 2)
    return A, P


def quant(sorted_scores, level):
    """Empirical quantile at level in [0, 1]; +inf above 1, -inf below 0."""
    n = len(sorted_scores)
    if level >= 1 or n == 0:
        return np.inf
    if level <= 0:
        return -np.inf
    k = int(np.ceil(level * (n + 1))) - 1
    return sorted_scores[min(max(k, 0), n - 1)] if k < n else np.inf


def run(inst, method, seed, bins=5):
    rng = np.random.default_rng(seed)
    X, S, sd, fav, cellvar = draw(inst, rng)
    A, P = logger(fav, rng, inst)
    if method == "norm":
        S = S / sd
    if method == "cell":
        key = (np.minimum((cellvar * bins).astype(int), bins - 1) if inst == "cont"
               else cellvar.astype(int))
    else:
        key = np.zeros(T, int)
    pmin = EPS / 2 if inst != "freelog" else 0.5
    gamma = np.sqrt(pmin / T) if method == "pwocp" else 0.005
    store, alpha = {}, {}
    cov = np.zeros((T, 2), bool)
    thr = np.zeros(T)
    inf_any = np.zeros(T, bool)
    for t in range(T):
        for a in range(2):
            k = (int(key[t]), a)
            q = quant(store.get(k, []), 1 - alpha.get(k, ALPHA))
            cov[t, a] = S[t, a] <= q
            inf_any[t] |= np.isinf(q) and q > 0
            if a == A[t]:
                thr[t] = q
        for a in range(2):
            k = (int(key[t]), a)
            al = alpha.get(k, ALPHA)
            if method == "pwocp":
                z = (A[t] == a) / P[t] * (not cov[t, a])
                alpha[k] = min(max(al + gamma * (ALPHA - z), -0.5), 1.5)
            elif A[t] == a:
                alpha[k] = al + gamma * (ALPHA - (not cov[t, a]))
        k = (int(key[t]), int(A[t]))
        bisect.insort(store.setdefault(k, []), S[t, A[t]])
    burn = 500
    c = cov[burn:]
    gap = float(np.max(np.abs(c.mean(0) - (1 - ALPHA))))
    mcov = float(c[np.arange(T - burn), A[burn:]].mean())
    fin = np.isfinite(thr[burn:])
    return gap, mcov, float(np.median(thr[burn:][fin])), float(inf_any[burn:].mean())


def main():
    plan = [("mean", ["aci", "pwocp", "cell"]), ("var", ["aci", "pwocp", "cell"]),
            ("rho0", ["aci", "pwocp", "cell"]), ("freelog", ["aci", "pwocp", "cell"]),
            ("cont", ["aci", "pwocp", "cell", "norm"])]
    print(f"{'instance':8s} {'method':6s} {'CCov gap':>16s} {'MCov':>14s} {'median thr':>11s} {'whole line':>10s}")
    for inst, methods in plan:
        for m in methods:
            r = np.array([run(inst, m, s) for s in range(SEEDS)])
            mu, se = r.mean(0), r.std(0, ddof=1) / np.sqrt(SEEDS)
            print(f"{inst:8s} {m:6s} {mu[0]:7.3f} +/- {se[0]:.3f}  {mu[1]:6.3f} +/- {se[1]:.3f} "
                  f"{mu[2]:10.2f} {mu[3]:6.3f}")


if __name__ == "__main__":
    main()
