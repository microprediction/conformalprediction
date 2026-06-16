---
name: conformal-coverage-check
description: Audit whether a conformal prediction model's coverage is conditionally trustworthy, not just marginally. Use when a user fits, calibrates, or uses split/conformal prediction (conformalguide, MAPIE, crepes, puncc, TorchCP, or hand-rolled), reports or targets a coverage level like "90% coverage", asks whether their coverage is reliable / conditional / per-case / uneven across inputs / calibrated across subgroups, or compares conformal methods by coverage. Adds the conformalguide.guardrails distance-covariance check and interprets it.
---

# Conformal coverage check

Marginal coverage, the headline `1 - alpha`, can hold while coverage is spread unevenly across the inputs: tight where the data are easy, loose where they are hard. The marginal number will not show it. This skill adds a cheap, distribution-free check that detects it, and tells the user what to do about it.

## When to use

The user is working with conformal prediction and any of these is true:
- they fit or calibrate a conformal model (conformalguide, MAPIE, crepes, puncc, TorchCP, or hand-rolled split conformal),
- they report or target a coverage level,
- they ask whether coverage is reliable, conditional, per-case, uneven across `x`, or valid on subgroups,
- they pick between conformal methods on the basis of coverage.

## The check, in one line

It tests whether the conformal rank of the residual is independent of the features. Under good conditional calibration it is; distance covariance flags when it is not. A small p-value means coverage is conditionally uneven in `X`. A large p-value means nothing was found at this power, which is not the same as conditional validity.

Install (numpy is the only extra dependency the check needs):

    pip install conformalguide

Pick the surface that fits the user's code.

1. Direct, the rigorous and library-agnostic path. The user supplies held-out calibration residuals and the matching features.

```python
from conformalguide import coverage_dependence_test
residuals_cal = y_cal - point_model.predict(X_cal)
p, info = coverage_dependence_test(residuals_cal, X_cal)
```

2. Wrapper, transparent over an existing conformal estimator. It warns after `fit` and delegates everything else, so it slots into a pipeline unchanged.

```python
from conformalguide import CoverageAudited
model = CoverageAudited(MapieRegressor(...), alpha=0.05).fit(X, y)
# model.predict(...) and the rest pass straight through; a warning fires if coverage is uneven
```

3. Scorer, for cross-validation. It shows up next to the usual metrics.

```python
from conformalguide import coverage_dependence_scorer
cross_validate(est, X, y, scoring={"cov_uniformity": coverage_dependence_scorer})
```

## Getting residuals and features from common libraries

- conformalguide or hand-rolled: `residuals = y_cal - mu_hat(X_cal)`, features `= X_cal`.
- MAPIE: the fitted point model is `estimator.estimator_`, so `residuals = y - estimator.estimator_.predict(X)`. The wrapper's default adapter also tries `estimator.conformity_scores_`.
- crepes: the underlying learner's residuals on the calibration set, with the calibration `X`.
- Always prefer out-of-fold or held-out residuals over in-sample ones. In-sample residuals are heteroscedastic by leverage and not exchangeable, which can trip the test for the wrong reason.

## Reading the result and acting on it

- `p >= 0.05`: no conditional dependence detected at this power. Report it as "not detected", never as "coverage is conditionally valid".
- `p < 0.05`: coverage is conditionally uneven in `X`. If `info["per_feature_dcov"]` is present, the largest entries point to the features driving it. The fix is upstream modelling of the conditional spread, a heteroscedastic noise model, conformalized quantile regression, or Mondrian/binned conformal. It is not tightening the conformal step, which cannot reduce the gap.

## Caveat to state every time

This detects, it does not certify. By the distribution-free no-go results (Lei and Wasserman 2014; Foygel Barber, Candes, Ramdas and Tibshirani 2021), no test can prove conditional coverage. A clean result means "no problem found here", nothing stronger.

## Background

See conformalprediction.net and the note "A Feynman-Wigner Diagnostic for Conformal Prediction via Signed de Finetti Representations". The check is its runnable result; the quantity it measures is the companion paper's residual-information gap `I(R;X)`.
