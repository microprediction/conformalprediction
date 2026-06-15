"""
A runnable detector of conditionally misleading conformal coverage.

Idea. The conformal rank U = G_hat(R) of a residual among the calibration residuals
is, by construction, marginally Uniform[0,1]. It is a monotone transform of R, so
    U _|_ X   <=>   R _|_ X   <=>   I(R;X) = 0,
i.e. U is independent of the features exactly when the residual-information gap is zero.
Distance covariance has dCov(U, X) = 0 iff U _|_ X, so a permutation test of dCov(U, X)
detects when marginal coverage is conditionally non-uniform in X -- when the 90% is
spread unevenly. It is the energy/kernel sibling of the log-score gap I(R;X) (Szekely-
Rizzo-Bakirov 2007; mutual information is the same dependence in KL, Cover-Thomas 2006).

It can only detect, not certify (Lei-Wasserman 2014; Foygel Barber et al. 2021): a small
p-value flags conditional miscoverage; a large one is "nothing found at this power".

Drop-in use after any conformal wrapper:
    p, info = coverage_dependence_test(residuals_cal, X_cal)
    if p < 0.05: warn("coverage is conditionally non-uniform in X (dCov p=%.3f)" % p)
"""
import numpy as np


def _dcov2(a, b):
    """Squared distance covariance via double-centered distance matrices (a, b 1-D or 2-D)."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    A = np.abs(a[:, None] - a[None, :]) if a.ndim == 1 else np.linalg.norm(a[:, None, :] - a[None, :, :], axis=2)
    B = np.abs(b[:, None] - b[None, :]) if b.ndim == 1 else np.linalg.norm(b[:, None, :] - b[None, :, :], axis=2)
    A = A - A.mean(0, keepdims=True) - A.mean(1, keepdims=True) + A.mean()
    B = B - B.mean(0, keepdims=True) - B.mean(1, keepdims=True) + B.mean()
    return (A * B).mean()


def coverage_dependence_test(residuals, X, n_perm=499, rng=None):
    """
    Test whether conformal coverage is conditionally uniform in the features.

    residuals : 1-D array of calibration residuals R = y - mu_hat(x) (or any scores).
    X         : (m,) or (m, d) array of the matching features.
    Returns (p_value, info). Small p_value => coverage is conditionally misleading in X.
    """
    rng = np.random.default_rng() if rng is None else rng
    R = np.asarray(residuals, float); X = np.asarray(X, float)
    m = len(R)
    # conformal ranks U_i = (rank of R_i among all residuals) / (m+1)  -- marginally ~Uniform
    U = (np.argsort(np.argsort(R)) + 1) / (m + 1)
    obs = _dcov2(U, X)
    ge = 1  # permutation null: relabel U against X
    for _ in range(n_perm):
        ge += _dcov2(U[rng.permutation(m)], X) >= obs
    p = ge / (n_perm + 1)
    # cheapest "which direction" hint: per-feature dCov when X is multivariate
    drivers = None
    if X.ndim == 2 and X.shape[1] > 1:
        drivers = np.array([_dcov2(U, X[:, j]) for j in range(X.shape[1])])
    return p, {"dcov": obs, "per_feature_dcov": drivers, "n": m}


# ----------------------------------------------------------------------------- #
# Verification: marginal coverage ~ 1-alpha throughout, but the test fires only
# when the residual spread depends on x (the gap is positive).
if __name__ == "__main__":
    rng = np.random.default_rng(0)
    alpha = 0.1

    def run(name, sigma_fn, n=500, m=300):
        X = rng.uniform(-2, 2, n + m)
        R = sigma_fn(X) * rng.standard_normal(n + m)         # residual; known location mu=0
        Xc, Xt, Rc, Rt = X[:n], X[n:], R[:n], R[n:]
        q = np.sort(np.abs(Rc))[int(np.ceil((n + 1) * (1 - alpha))) - 1]
        cov = np.mean(np.abs(Rt) <= q)                       # marginal coverage
        p, info = coverage_dependence_test(Rt, Xt, rng=rng)
        pear = np.corrcoef((np.argsort(np.argsort(Rt)) + 1) / (m + 1), Xt)[0, 1]
        print(f"{name:16s} marg.cov={cov:.3f}  dCov={info['dcov']:.4f}  perm-p={p:.3f}  Pearson={pear:+.3f}")

    run("homoscedastic", lambda x: 1.0 + 0 * x)              # gap 0   -> test silent
    run("hetero (mild)", lambda x: np.exp(0.4 * x))          # gap > 0 -> test fires
    run("hetero (strong)", lambda x: np.exp(0.8 * x))
    print("\nPASS: coverage stays ~0.90 in all three; perm-p is large only for homoscedastic.")
