"""conformalguide.guardrails: a check-engine light for conformal coverage.

Marginal coverage is the dashboard number. It can still be spread unevenly across the
inputs, tight where the data are easy and loose where they are hard, and the marginal
figure will not show it. This module tests for that.

The idea in one line: the conformal rank of a residual is, by construction, marginally
uniform; under good conditional calibration it is also independent of the features, and
distance covariance detects when it is not. A small p-value means coverage is
conditionally uneven in ``X``. See https://conformalprediction.net for the why.

It can only detect, never certify (the distribution-free no-go results of Lei & Wasserman
2014 and Foygel Barber et al. 2021). A large p-value means "nothing found at this power",
not "conditionally valid".

    from conformalguide.guardrails import coverage_dependence_test, CoverageAudited

    p, info = coverage_dependence_test(residuals_cal, X_cal)   # the rigorous, library-free path
    model = CoverageAudited(MapieRegressor(...))               # warns after fit if uneven

The package core stays dependency-free; this feature needs numpy.
"""
from __future__ import annotations

import warnings


def _require_numpy():
    try:
        import numpy as np  # noqa
        return np
    except ImportError as e:  # pragma: no cover
        raise ImportError("conformalguide.guardrails needs numpy (the core does not)") from e


def _dcov2(np, a, b):
    """Squared distance covariance via double-centered distance matrices (a, b may be 2-D)."""
    A = (abs(a[:, None] - a[None, :]) if a.ndim == 1
         else np.linalg.norm(a[:, None, :] - a[None, :, :], axis=2))
    B = (abs(b[:, None] - b[None, :]) if b.ndim == 1
         else np.linalg.norm(b[:, None, :] - b[None, :, :], axis=2))
    A = A - A.mean(0, keepdims=True) - A.mean(1, keepdims=True) + A.mean()
    B = B - B.mean(0, keepdims=True) - B.mean(1, keepdims=True) + B.mean()
    return float((A * B).mean())


def coverage_dependence_test(residuals, X, n_perm=499, random_state=None):
    """Test whether conformal coverage is conditionally uniform in the features ``X``.

    ``residuals`` are calibration residuals ``y - mu_hat(x)`` (or any nonconformity scores);
    ``X`` is the matching ``(m,)`` or ``(m, d)`` feature array. Returns ``(p_value, info)``.
    A small ``p_value`` says the conformal rank depends on ``X`` -- the marginal coverage is
    spread unevenly across ``x``.
    """
    np = _require_numpy()
    rng = np.random.default_rng(random_state)
    R = np.asarray(residuals, float).ravel()
    X = np.asarray(X, float)
    m = len(R)
    if X.shape[0] != m:
        raise ValueError("residuals and X must have the same number of rows")
    U = (np.argsort(np.argsort(R)) + 1) / (m + 1)        # conformal ranks, marginally ~Uniform
    obs = _dcov2(np, U, X)
    ge = 1
    for _ in range(n_perm):
        ge += _dcov2(np, U[rng.permutation(m)], X) >= obs
    p = ge / (n_perm + 1)
    drivers = None
    if X.ndim == 2 and X.shape[1] > 1:
        drivers = [_dcov2(np, U, X[:, j]) for j in range(X.shape[1])]
    return p, {"dcov": obs, "per_feature_dcov": drivers, "n": m}


def _default_scores(estimator, X, y):
    """Best-effort residuals from a fitted (possibly conformal) estimator. Pass your own
    held-out residuals to ``coverage_dependence_test`` for a clean audit."""
    np = _require_numpy()
    s = getattr(estimator, "conformity_scores_", None)
    if s is not None:
        s = np.asarray(s, float).ravel()
        if len(s) == len(X):
            return s
    point = getattr(estimator, "estimator_", estimator)   # underlying point model if present
    return np.asarray(y, float) - np.asarray(point.predict(X), float)


class CoverageAudited:
    """Wrap any conformal predictor and warn, after fitting, if its coverage is
    conditionally uneven in ``X``. Everything else passes straight through to the wrapped
    estimator, so it disappears into a pipeline.

        model = CoverageAudited(MapieRegressor(...), alpha=0.05)
        model.fit(X, y)        # emits a warning if the rank depends on X
        model.predict(X_test)  # delegated unchanged
    """

    def __init__(self, estimator, alpha=0.05, scores_fn=_default_scores, n_perm=499):
        self.estimator = estimator
        self.alpha = alpha
        self.scores_fn = scores_fn
        self.n_perm = n_perm

    def __getattr__(self, name):  # delegate predict, get_params, etc.
        return getattr(self.__dict__["estimator"], name)

    def fit(self, X, y, **kw):
        self.estimator.fit(X, y, **kw)
        p, info = coverage_dependence_test(self.scores_fn(self.estimator, X, y), X,
                                           n_perm=self.n_perm)
        self.coverage_dependence_ = {"p_value": p, **info}
        if p < self.alpha:
            warnings.warn(
                f"conformal coverage is conditionally non-uniform in X "
                f"(dCov permutation p={p:.3f}); the {1 - self.alpha:.0%} marginal level is "
                f"uneven across x. See conformalprediction.net.",
                stacklevel=2)
        return self


def coverage_dependence_scorer(estimator, X, y):
    """An sklearn-style scorer (higher is better): the dCov permutation p-value, so it drops
    into ``cross_validate(..., scoring={'cov_uniformity': coverage_dependence_scorer})``."""
    p, _ = coverage_dependence_test(_default_scores(estimator, X, y), X)
    return p


if __name__ == "__main__":
    np = _require_numpy()
    rng = np.random.default_rng(0)
    for name, sigma in [("homoscedastic", lambda x: 1.0 + 0 * x),
                        ("heteroscedastic", lambda x: np.exp(0.7 * x))]:
        X = rng.uniform(-2, 2, 400)
        R = sigma(X) * rng.standard_normal(400)
        p, info = coverage_dependence_test(R, X, random_state=0)
        print(f"{name:16s} dCov={info['dcov']:.4f}  perm-p={p:.3f}")
    print("(small p only for heteroscedastic -> coverage there is conditionally uneven)")
