---
name: conformal-coverage-check
description: Guard rails for conformal prediction. Use when a user writes, fits, calibrates, reviews, or chooses between conformal / split-conformal models (conformalguide, MAPIE, crepes, puncc, TorchCP, or hand-rolled), reports or targets a coverage level, or asks whether their coverage is reliable, conditional, per-case, or trustworthy. Two jobs: review the code for common misuses of conformal prediction, and run the conformalguide.guardrails distance-covariance check for conditionally uneven coverage.
---

# Conformal prediction guard rails

Conformal prediction gives a real, distribution-free, finite-sample guarantee of marginal coverage. The trouble is always in the reading of it. The marginal `1 - alpha` is an average over inputs, it is not forecast quality, and it can hold while coverage is uneven across `x`. This skill does two things: it reviews conformal code for the usual misuses, and it runs a cheap check for conditionally uneven coverage.

## Job 1: review for misuse

When the user is writing or reviewing conformal code, scan for these. For each that applies, say what it is, why it bites, and the fix, pointed at their actual code.

- Conformalizing to make a forecast better. If a conformal wrapper is added hoping for sharper or better-calibrated predictions, flag it. Conformal certifies coverage and cannot improve a proper score. Sharpness comes from the model. Conformalize last.
- Coverage used as a quality metric. If coverage is the only number reported, or is used to argue a model is good, flag it. The same `1 - alpha` attaches to an excellent model and to a useless one. Report a proper score (log-score or CRPS) alongside coverage.
- In-sample or training residuals. If calibration residuals are computed on data the point model was trained on, flag it. Use out-of-fold or a held-out calibration set. In-sample residuals are over-optimistic and not exchangeable.
- Expecting conditional coverage from the marginal guarantee. If the user assumes the level holds per-`x` or per-subgroup, flag it. Marginal coverage can sit near 100% on easy inputs and well below target on hard ones. Run the check (Job 2); if it fires, the fix is modelling the conditional spread, not the conformal step.
- Constrained or batch-relative scores. If scores are de-meaned, ranked, percentile-within-batch, compositional, or contest / one-winner, flag it. These are negatively associated, so per-case coverage fans even though the marginal holds. Run the check and expect it to fire.
- Non-exchangeable data. If the data are a time series, under covariate or label shift, or otherwise dependent across rows, flag it. The marginal guarantee needs exchangeability. Use adaptive methods (ACI, conformal PID, EnbPI), and note they recover a long-run average, not coverage for the next step.
- Chasing conditional coverage by localizing. If the user shrinks per-`x` calibration cells to force conditional coverage, flag it. Distribution-free, the intervals diverge to the whole line (the no-go result).
- Choosing a conformal method by coverage. If methods are compared on marginal coverage, flag it. They are all about `1 - alpha` by construction. Compare on a proper score plus a conditional-coverage check.
- Tightening the conformal step to fix uneven coverage. If the attempted fix is changing the quantile or `alpha`, flag it. Conformal cannot reduce the conditional gap; condition on `x` in the model (heteroscedastic noise, conformalized quantile regression, Mondrian / binned conformal).
- Reading nested intervals as a density. If absolute-residual intervals are swept over `alpha` and treated as a predictive distribution, note the single-shape and symmetrization caveats.

## Job 2: run the check

It tests whether the conformal rank of the residual is independent of the features. Under good conditional calibration it is; distance covariance flags when it is not. A small p-value means coverage is conditionally uneven in `X`. A large p-value means nothing was found at this power, which is not conditional validity.

    pip install conformalguide

Pick the surface that fits the user's code.

```python
from conformalguide import coverage_dependence_test
residuals_cal = y_cal - point_model.predict(X_cal)
p, info = coverage_dependence_test(residuals_cal, X_cal)        # rigorous, library-free
```

```python
from conformalguide import CoverageAudited
model = CoverageAudited(MapieRegressor(...), alpha=0.05).fit(X, y)   # warns after fit
```

```python
from conformalguide import coverage_dependence_scorer
cross_validate(est, X, y, scoring={"cov_uniformity": coverage_dependence_scorer})
```

Getting residuals and features:
- conformalguide or hand-rolled: `residuals = y_cal - mu_hat(X_cal)`, features `= X_cal`.
- MAPIE: `residuals = y - estimator.estimator_.predict(X)`; the wrapper also tries `estimator.conformity_scores_`.
- crepes: the underlying learner's residuals on the calibration set, with the calibration `X`.
- Prefer out-of-fold or held-out residuals over in-sample ones.

Reading the result:
- `p >= 0.05`: not detected at this power. Report it as "not detected", not "conditionally valid".
- `p < 0.05`: coverage is conditionally uneven in `X`. If `info["per_feature_dcov"]` is present, the largest entries name the features driving it. Fix upstream by modelling the conditional spread, not by tightening the conformal step.

## The caveat to state every time

This detects, it does not certify. By the distribution-free no-go results (Lei and Wasserman 2014; Foygel Barber, Candes, Ramdas and Tibshirani 2021), no test can prove conditional coverage. A clean result means "no problem found here", nothing stronger.

## Background

See conformalprediction.net and the note "A Feynman-Wigner Diagnostic for Conformal Prediction via Signed de Finetti Representations". The check is its runnable result; the quantity it measures is the companion paper's residual-information gap `I(R;X)`.
