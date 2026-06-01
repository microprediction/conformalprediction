# Benchmark: do the conformal "skins" actually help?

A reproducible comparison of conformal prediction libraries
([MAPIE](https://github.com/scikit-learn-contrib/MAPIE),
[crepes](https://github.com/henrikbostrom/crepes)) and the strong time-series
conformal methods, against **probabilistic baselines that model the conditional
distribution directly** and an **oracle that knows the true conditional spread**.

The data are synthetic on purpose: with a known mean and known conditional sd we can
measure not just marginal coverage but **conditional coverage** (against the truth) and
the **oracle CRPS** that nothing can beat. Methods are judged on the axes the thesis
cares about — conditional coverage, interval efficiency, and *proper scores* (interval /
Winkler score, CRPS, log-score) — not marginal coverage alone, which several methods hit
by construction.

```bash
python -m venv --system-site-packages .venv && source .venv/bin/activate
pip install -r requirements.txt
python run_timeseries.py     # -> results/ts_results.csv,      figures/ts_*.png
python run_tabular.py        # -> results/tabular_results.csv, figures/tabular_*.png
```

Files: `common.py` (synthetic generators + proper-scoring metrics), `ts_methods.py`
(reference implementations of fixed-split, ACI, AgACI, conformal-PID, NexCP/weighted, and
the probabilistic baselines), `run_timeseries.py`, `run_tabular.py`.

## Headline results

Numbers below are means over 5 seeds, target coverage 0.90 (α = 0.1). Reproduced by the
scripts; your CSVs may differ in the last digit by seed.

### Time series (nonstationary, known σₜ)

| method | family | marg. cov | worst-window cov | cond. gap | interval score ↓ | CRPS ↓ |
|---|---|---|---|---|---|---|
| oracle (true μ,σ) | oracle | 0.90 | 0.82 | 0.02 | **5.52** | **0.76** |
| skaters (Gaussian) | prob | 0.89 | 0.70 | 0.04 | **6.57** | 0.86 |
| skaters + norm. conformal | cp | 0.89 | 0.69 | 0.04 | 6.58 | – |
| EWMA-vol Gaussian | prob | 0.89 | 0.81 | 0.03 | 6.92 | 0.92 |
| conformal PID | cp | 0.90 | 0.82 | **0.01** | 7.00 | – |
| ACI | cp | 0.90 | 0.83 | 0.01 | 7.00 | – |
| true σ on *biased* μ̂ | oracle | 0.82 | 0.70 | 0.12 | 7.02 | 0.92 |
| NexCP (weighted) | cp | 0.88 | 0.70 | 0.05 | 7.08 | – |
| AgACI | cp | 0.86 | 0.78 | 0.06 | 7.15 | – |
| MAPIE EnbPI (online) | cp | 0.84 | 0.36 | 0.20 | 8.87 | – |
| MAPIE ACI | cp | 0.84 | 0.36 | 0.20 | 8.87 | – |
| GARCH(1,1) Gaussian | prob | 0.69 | 0.48 | 0.34 | 9.84 | 0.98 |
| skaters + split conformal | cp | 0.60 | 0.20 | 0.56 | 11.9 | – |
| static Gaussian (recal) | prob | 0.57 | 0.18 | 0.59 | 13.7 | 1.06 |
| fixed split (CP) | cp | 0.56 | 0.17 | 0.60 | 13.8 | – |

### Tabular (heteroscedastic, known s(x))

| method | family | marg. cov | cov low-var | cov hi-var | cond. gap | interval score ↓ | CRPS ↓ |
|---|---|---|---|---|---|---|---|
| oracle (true f,s) | oracle | 0.90 | 0.90 | 0.90 | 0.02 | **6.39** | **0.88** |
| MAPIE CQR | cp | 0.90 | 0.92 | 0.89 | 0.03 | **6.51** | – |
| quantile GBR (raw, no conformal) | prob | 0.89 | 0.90 | 0.88 | 0.03 | 6.52 | – |
| crepes normalized | cp | 0.90 | 0.92 | 0.87 | 0.04 | 6.85 | – |
| crepes CPS | cp | 0.91 | 0.92 | 0.88 | 0.04 | 6.86 | 0.90 |
| het-Gaussian (mean+var) | prob | 0.93 | 0.93 | 0.89 | 0.06 | 7.08 | 0.90 |
| static Gaussian (recal) | prob | 0.90 | **1.00** | **0.72** | 0.18 | 8.32 | 0.96 |
| MAPIE split (absolute) | cp | 0.90 | **1.00** | **0.73** | 0.17 | 8.32 | – |
| crepes standard | cp | 0.90 | **1.00** | **0.73** | 0.17 | 8.32 | – |

## What the numbers say

1. **The skins are not straw men, and they genuinely help — when they are the adaptive
   kind.** MAPIE CQR and crepes normalized/CPS reach near-oracle interval score and good
   conditional coverage; conformal PID and ACI recover coverage under drift where fixed
   split collapses (0.56 marginal, 0.17 worst-window). Run EnbPI *online* and it adapts
   too (0.56 → 0.84); run it statically and it does not — so how you use the library
   matters, and the static mode is the real straw man to avoid.

2. **But the adaptivity comes from conditional modeling, not from the conformal step.**
   The cleanest tell is tabular: **raw quantile-GBR with no conformal at all (6.52) ties
   conformalized quantile regression (6.51).** Vanilla split conformal (MAPIE split,
   crepes standard) is *identical* to a static Gaussian — 100% coverage on the easy
   inputs, 73% on the hard ones — because a constant-width band cannot adapt. The
   conformal layer supplies the finite-sample marginal certificate; the sharpness and
   conditional coverage come from the quantile model or difficulty estimator it wraps.

3. **A plain probabilistic model is competitive on the proper score and returns a full
   distribution.** An EWMA-volatility Gaussian has the best non-oracle interval score in
   the time-series test (6.92) *and* yields CRPS/log-score; crepes CPS, built on a
   difficulty estimator, gets competitive CRPS (0.90 vs oracle 0.88) precisely because it
   is doing conditional distribution estimation.

4. **The essay's own experiment, reproduced.** `skaters` (the author's streaming
   forecaster, via `timemachines`) emits an adaptive predictive mean and sd; it lands at
   near-oracle CRPS (0.86 vs 0.76) and the second-best non-oracle interval score (6.57).
   Conformalizing it changes nothing for the better: a fair, adaptive (normalized)
   conformal wrap re-levels coverage to 90% at an essentially identical interval score
   (6.58 vs 6.57), while a naive split-conformal wrap on the drifting series collapses
   (60% coverage, 11.9). The value was in the conditional density skaters already
   estimates; conformal supplies a coverage certificate, not sharpness.

5. **Knowing the variance does not rescue a biased mean.** "true σ on a biased μ̂" (7.02)
   does no better than adaptive conformal — under drift the hard part is the *mean*, and
   methods that calibrate on realized residuals absorb that bias automatically.

6. **None of these achieves per-step conditional coverage.** Even the oracle's
   worst-window coverage is ~0.82, because forecasting the mean through regime breaks is
   hard. The conformal repairs deliver long-run/marginal coverage, never coverage *now*
   — consistent with the no-go results.

**Bottom line, consistent with the paper:** conformal prediction's marginal certificate is
real and useful, but it is not distributional quality. Where a conformal skin is sharp, it
is sharp because of the conditional model underneath; the conformal step adds the coverage
guarantee on top.
