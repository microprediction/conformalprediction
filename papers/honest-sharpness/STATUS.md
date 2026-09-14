# Status: adjudicated 2026-09-13. Finish this one first.

**Verdict: strongest and substantially correct. Not yet linked from the site.**

Ranked first for present publishability of the four notes in this programme. It correctly repairs
the conceptual error that killed `papers/smoothing-validity/`, by distinguishing marginal conformal
coverage from high-probability, fixed-`x_0`, training-conditional honesty.

## What checks out

The testing reduction in Lemma 2 is correct. The localized bump has KL divergence `n L^2 h^{2s+d}`,
and critical scaling gives `h ~ (L^2 n g(x_0))^{-1/(2s+d)}` and
`r_n ~ L^{d/(2s+d)} (n g(x_0))^{-s/(2s+d)}`. Theorem 3 genuinely forces inflation at the `r_n` scale
at a smooth baseline on more than half the calibration samples. The lognormal k-nearest-neighbour
construction attains the same rate for fixed `eta > 0`, and the `eta = 0` argument via mutual
absolute continuity is good. The nonadaptation result is the correct Low / Cai-Low phenomenon: a
rough indistinguishable alternative forces the rough rate even at a smooth baseline. The bundled
`numerical_checks.py` supports these calculations and passes 9 of 9.

## The weakness is novelty, not correctness

A skeptical referee will say this is classical modulus-of-continuity theory for honest nonparametric
confidence intervals, translated to a conditional quantile threshold, and that Cai and Low's
adaptation theory already supplies the machinery. That is survivable if the paper says so plainly:
the contribution is not a new Le Cam principle, it is the precise honesty-sharpness boundary for
prediction sets, including the distinction between marginal conformal validity, fixed-`x` honesty,
and calibration-sample confidence.

## Four things to tighten before circulating

1. Position Theorem 6 explicitly as an application or specialization of Low and Cai-Low.
2. Add Guan, *Localized Conformal Prediction*, wherever exactly marginally valid localized conformal
   prediction is mentioned.
3. Clarify that the exact honesty statement in Proposition 4 is conditional on the design, while the
   sharpness rate also averages over random design.
4. Do not imply the plug-in estimator is always decision-theoretically better. The paper already
   retreats from this near the end; make the retreat explicit.
