# The stopping claim: a precise statement and where it stands

Working note, 2026-08-20. The grammar paper's §5 asserts that no conformal variant continues past
the rank map. That claim is the most defensible empirical result in the corpus, because it is a
statement about published work rather than a benchmark number, so it deserves a protocol rather
than a search.

## The claim, stated so that near-misses do not touch it

Write the conformal pattern as a chain: model, residual, **fence-post empirical map** `E_n`,
inverse, interval.

> Every conformal variant in the literature does one of three things to `E_n`. It **stops** at it,
> **reweights or replaces** it, or **tunes its level**. None retains it and fits a model on its
> output.

The three moves, with the methods checked so far:

| move | what it does to `E_n` | methods |
| --- | --- | --- |
| **stop** | keeps it, quotes its output as the answer | split conformal; conformal predictive systems (Vovk 2019); conformal calibrators (Vovk 2020); CQR (Romano 2019); Mondrian / binned CPS (Boström 2021; Toccaceli); normalized scores (Lei 2018). Conditioning happens *upstream*; the map is terminal. |
| **reweight or replace** | substitutes a conditional estimate for the pooled quantile | SPCI (Xu & Xie 2023): "replaces the empirical quantile with an estimate by a conditional quantile estimator", a QRF fitted on the window of past residuals; ResCP (2025): reservoir-state similarity used to "adaptively reweight the observed residuals"; localized CP (Guan 2022) and its randomized version (Hore & Barber 2023); HopCPT (Auer 2023); EnbPI (Xu & Xie 2021). |
| **tune the level** | keeps the map, adapts alpha online | ACI (Gibbs & Candes 2021); conformal PID. |
| **compose after** | keeps the map and models its output | **nobody found** |

SPCI is the closest and it is instructive: it is a genuine model of the residual stream, but it
sits *in place of* the empirical step rather than after it. Same for ResCP and LCP. The literature
knows the pooled quantile is the weak point. Its answer is always to swap it out, never to keep it
and continue.

## Why the pattern is not exotic outside the banner

Transform-then-continue is standard elsewhere and predates conformal prediction: the normal
quantile transform and meta-Gaussian forecasting (Bogner 2012), Chen and Fan's copula time series
(2006), and autoregressive transformation models (Rügamer 2023). All apply an empirical marginal
map and then keep modelling in the transformed coordinates.

So the finding is sharper than an absence. **The move is well known in forecasting and absent from
conformal prediction**, which is what makes it a claim about a community's habit rather than about
an oversight.

## What would refute it

A paper that retains the empirical rank transform, applies it to residuals, and fits a downstream
model on the transformed stream, keeping the transform in the chain rather than replacing it.
Reweighting the empirical distribution does not count. Conditioning upstream does not count.
Adapting alpha does not count.

## What is still needed to make this bulletproof

The grammar paper currently records "verified by web search 2026-08-04", which no referee can
check. This should become a documented survey:

1. A stated protocol: databases, queries, date, inclusion rule.
2. The table above extended to every method in the conformal time-series and conditional-coverage
   literature, each with the sentence from the paper that places it in a category.
3. Explicit treatment of the four near-misses (SPCI, ResCP, LCP, conformal training), since those
   are what a referee will raise.

Conformal training (Stutz 2022) needs care and is not yet placed. It differentiates *through* the
conformalizer to train the base model, which is composition in the upstream direction. Argue it is
still not composition after the map, or concede it as a fourth move.

## The second axis: pooling granularity (added 2026-08-25, corrected same day)

The stopping claim is one of two. The smoothing-validity theorem prices the other:
exact validity forces uniform pooling within a pre-committed stratification, so a
paper either pools (at some granularity) and keeps exactness, or departs from
pooling and forfeits it. `classify.py` screens this axis too.

**Definition that matters:** SMOOTH means the weights on calibration residuals
depend on the test point. A smooth SCORE is not smooth pooling: a kernel or
normalized score is a richer `A(x,.)` and the shape is still one pooled object.
The first rule missed this distinction, matched bare "kernel/similarity", caught
base-model machinery, and inflated SMOOTH to 91. Corrected same day; the rule now
requires the smoothing word to bind to the calibration/residual step.

| pooling | meaning | n |
| --- | --- | --- |
| POOLED | one empirical law | 586 |
| STRATIFIED | pools within fixed strata (Mondrian, binned, group-conditional) | 60 |
| SMOOTH | test-point-dependent weights on calibration residuals | 40 |

**646 of 686 (94%) never depart from residual pooling at any granularity.** Of the
40 that do, **9 also claim exact or distribution-free validity in the abstract** --
by the theorem each is using a known covariate-shift tilt (legitimate), weakening
"exact" to a bound with a gap, or overclaiming. Nine full-text reads, priority.

Structure: REPLACE and SMOOTH nearly coincide (14 of 16 REPLACE are SMOOTH), as
they should -- replacing the pooled quantile with a conditional estimate IS the
smooth move. And 21 papers weight smoothly yet still STOP, paying both prices at
once.

## The nine reads (2026-08-25): zero overclaims

Every SMOOTH-with-exact-claim paper was read in full text. None contradicts the
smoothness theorem. The claims resolve into exactly the trichotomy the theorem
predicts, plus two screen false positives:

| escape | papers |
| --- | --- |
| marginal only, restored by recalibration or design | Guan (LCP, JRSS-B); Hore & Barber (calLCP); GraphLCP; network invariant selectors |
| bound-with-gap, stated as such | DS-CP (Barber-style gap for data-dependent weights) |
| known covariate-shift tilt | weighted survival CP |
| assumptions added, distribution-freeness given up | Conrad-Moulines-Samsonov (finite-sample LOCAL bounds under a smoothness class, n >= n2(h,delta,alpha)) |
| reclassified POOLED (score modification, not calibration weighting) | Learnable CP (learned score); Leverage-Weighted CP |

The Hore & Barber sentence is the community's own statement of the boundary: for
local coverage "there are no known distribution-free theoretical results to
guarantee this." The field's best localization papers respect the line the theorem
draws; they either retreat to marginal, state the gap, assume the class, or move
the smoothness into the score, which is pooling with a richer map.

Corrected counts after reclassification: POOLED 588, STRATIFIED 60, SMOOTH 38.
**648 of 686 (94.5%) never depart from residual pooling at any granularity.**
Verdicts with placing sentences: `survey/smooth_checks.csv`.
