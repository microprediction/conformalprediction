# Status: adjudicated 2026-09-13, tightenings applied. Ready for a read.

**Verdict: strongest and substantially correct. Still not linked from the site.**

Ranked first for present publishability of the four notes in this programme. It correctly repairs
the conceptual error that killed `papers/smoothing-validity/`, by distinguishing marginal conformal
coverage from high-probability, fixed-`x_0`, training-conditional honesty.

## What checks out

The testing reduction in Lemma 2 is correct. The localized bump has KL divergence `n L^2 h^{2s+d}`,
and critical scaling gives `h ~ (L^2 n g(x_0))^{-1/(2s+d)}` and
`r_n ~ L^{d/(2s+d)} (n g(x_0))^{-s/(2s+d)}`. Theorem 3 genuinely forces inflation at the `r_n` scale
at a smooth baseline on more than half the calibration samples. The lognormal k-nearest-neighbour
construction attains the same rate for fixed `eta > 0`, and the `eta = 0` argument via mutual
absolute continuity is good. The nonadaptation result is the correct Low / Cai-Low phenomenon.
`numerical_checks.py` passes 9 of 9, before and after the edits below.

## The four tightenings: DONE 2026-09-13

1. **Theorem 6 positioned as a specialization.** The paragraph after the proof now says plainly that
   it is not a new principle, attributes the honesty-adaptation obstruction to Low and Cai-Low,
   notes that Theorem 3's engine is Le Cam two-point testing, and states the actual contribution:
   the honesty-sharpness boundary for prediction sets, and the separation of marginal conformal
   validity, fixed-`x_0` honesty, and calibration-sample confidence.
2. **Guan added** at both places localized conformal is invoked, with the mechanism named: proximity
   weighting keeps exact finite-sample marginal validity by adjusting the quantile level rather than
   using the nominal one. Biometrika 110(1), 33-50, DOI verified.
3. **Proposition 4 conditioning made explicit.** A new paragraph states that honesty holds
   conditional on the design, exactly and at every n, while the sharpness bound averages over the
   random design through `E rho_k^s`, so a design with an unusually distant kth neighbour carries a
   larger excess. Nothing claims a design-conditional rate.
4. **Plug-in claim de-escalated.** The abstract now says a plug-in estimate can be *narrower*, not
   sharper, and adds that whether narrower is better depends on the score being optimized. The
   adaptation section makes the same retreat. The closing section already had it.

## Remaining risk

Novelty, not correctness. A skeptical referee will say this is classical modulus-of-continuity theory
translated to a conditional quantile threshold. Tightening 1 meets that head on rather than hoping
it is not raised, which is the right posture, but it does not make the objection go away.
