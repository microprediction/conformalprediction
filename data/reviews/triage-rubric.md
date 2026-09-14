# Rubric: which conformal claims a theorem can refute

You are triaging abstracts of conformal prediction papers. You are looking ONLY for claims that are
provably wrong or provably vacuous, not for papers you merely dislike, and not for weak experiments.
Most of these papers are fine. Be conservative. A false positive wastes a week of work.

## The refuting results

**R1, no-go for functionals of the prediction sets.** Any statistic computed from the prediction sets
alone is a functional g of the law of C(X). Fix a joint law of (Y, C(X)) in which some set of size at
least two occurs with positive probability. Then two different joint laws of (Y, Yhat, C(X)) exist
with the same law of sets, the same class proportions, the same coverage, and the same value of g,
whose confusion matrices differ. So no statistic of the sets can recover which label the model ranked
first, per-class confusion, per-feature attribution, a causal contribution, or anything else the law
of the sets does not determine.
FLAG: papers computing Shapley values, feature importance, attributions, causal effects, individual
treatment effects, correlations, confusion matrices, or "explanations" FROM conformal sets or from
interval widths, and claiming the conformal guarantee carries over to that derived quantity.

**R2, marginal coverage is not conditional coverage.** Split conformal gives
1-a <= P(Y in C(X)) <= 1-a+1/(n+1), averaged over the calibration draw AND the test input. It
constrains nothing about P(Y in C(x) | X = x). For continuously distributed X, Barber, Candes, Ramdas
and Tibshirani (2021) show no distribution-free method controls the conditional quantity at a point
without intervals of infinite expected length.
FLAG: papers claiming per-input, per-instance, per-patient, instance-wise, individual or
object-conditional guarantees or certificates from a marginal calibration.
DO NOT FLAG these legitimate escape hatches: Mondrian, group-conditional or class-conditional
conformal (they guarantee a group average and say so); covariate-shift weighting with known or
estimated weights; training-conditional or PAC-style bounds; localized/kernel conformal that states
an approximation rather than a guarantee; papers whose contribution is *measuring* conditional
coverage empirically; papers that prove an impossibility.

**R3, exchangeability dies under data-dependent handling.** If the calibration set is selected,
screened, filtered, permuted or reused on the basis of the data, calibration and test are no longer
exchangeable and the coverage claim fails.
FLAG: papers that select, screen, permute or reuse calibration data and still assert the unmodified
guarantee. DO NOT FLAG papers that notice this and correct for it, e.g. by conditioning on the
selection event or by a proven FCR/selective-inference correction.

**R4, a long-run average is not a per-decision guarantee.** An online or time-averaged coverage
result constrains an average over the horizon and permits arbitrarily long runs of miscoverage.
FLAG: papers claiming per-decision safety, "provably safe" control, collision avoidance or risk
certificates that rest on a long-run average or on a marginal coverage statement.
DO NOT FLAG papers whose safety claim is explicitly probabilistic over the same distribution the
guarantee is stated for, or that state the averaging caveat themselves.

**R5, set size is not certified.** The guarantee constrains only the true label's inclusion rate.
Mean set size sums inclusion rates over all labels and the remaining terms are unconstrained. Size
moves with the score function, the logit scale and the amount of coverage overshoot.
FLAG: papers that rank, evaluate or compare models by conformal set size and call that rigorous,
certified or a measure of the model's uncertainty.

## What to output

For every abstract in your assigned range that you flag, output one block:

  ARXIV: <id>
  TITLE: <title>
  YEAR: <year>
  RESULT: R1 | R2 | R3 | R4 | R5  (more than one if it applies)
  CLAIM: "<the exact sentence from the abstract that is wrong, quoted verbatim>"
  WHY: <one or two sentences saying precisely what is wrong>
  CONFIDENCE: 1-5, where 5 means the abstract alone is enough to be sure the claim is false or
    vacuous, 3 means it depends on wording in the body, 1 means a hunch. Do not report below 3.

Then a final line: SCANNED <n> abstracts, FLAGGED <m>.

Report nothing else. No preamble, no summary of the field, no papers you did not flag.
