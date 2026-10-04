# Reading rubric: what does the paper do with the empirical map?

You are coding one arXiv paper whose title contains "conformal prediction". Read its extracted
text in `text/<arxiv_id>.txt`: the abstract, the method section(s), and any algorithm box.
Skim experiments only if the method section is ambiguous. Code the paper's **own proposed
method**, not methods it cites or compares against.

## The object

The **empirical map** is the fence-post empirical distribution function of calibration
scores, E_n(r) = (1 + #{i <= n : R_i <= r}) / (n + 1), or any equivalent step that turns the
multiset of held-out scores into a quantile, p-value, interval, set, or predictive
distribution. Weighted versions (weights on calibration scores) are still the empirical map.

## Primary label (exactly one)

- **STOP**: the output of the empirical map (a quantile, p-value, interval, set, or conformal
  predictive distribution) is the method's answer. This includes normalized scores, CQR,
  Mondrian/class-conditional/stratified calibration, distributional conformal prediction,
  learned or richer scores, and any conditioning done *before* the map. Applying standard
  conformal prediction to a new domain is STOP.
- **REPLACE**: the method substitutes a conditional estimate for the pooled quantile or pooled
  law (e.g. SPCI fits a quantile regression to recent residuals; localized weighting that
  makes the calibration law depend on the test point).
- **TUNE**: keeps the map and adapts its level online (ACI, conformal PID, level updating).
- **CONSUME**: the conformal output is fed into *another procedure* rather than being the answer
  (training on pseudo-labels it filtered, selection among candidates, active learning, a
  downstream optimiser). If the conformal output *is* the delivered decision rule (a set, an
  interval, a p-value, a risk-controlling threshold), the label is STOP, not CONSUME.
- **COMPOSE**: keeps the empirical map and **fits a model to its output** (the transformed
  score stream or the ranks), then carries the fitted law back as the forecast. This is the
  only label that refutes the paper's claim. Reweighting the empirical law, conditioning
  upstream, and adapting the level do NOT count as COMPOSE.
- **NA**: the paper proposes no method (survey, tutorial, position paper, pure theory about
  existing methods with no new procedure).

When a paper does more than one thing, label its main proposed method. Mark `second_label`
if a secondary contribution clearly falls elsewhere.

## Pooling axis (exactly one)

- **POOLED**: one empirical law of calibration scores for every test point.
- **STRATIFIED**: pooling within fixed strata (Mondrian, class-conditional, binned, group).
- **SMOOTH**: weights on calibration scores depend on the test point. This includes kernel or
  similarity weighting of the calibration step, covariate-shift likelihood-ratio weights, and
  weights from a sampling design, since in each case the test point's weight enters the
  calibration. A smooth or learned *score* is not SMOOTH.

## Output (one CSV row per paper)

`arxiv_id, label, second_label, pooling, claims_exact, confidence, evidence, where`

- `claims_exact`: yes if the paper claims exact or distribution-free finite-sample validity.
- `confidence`: high / medium / low. Use low whenever the text is garbled, truncated, or
  the method section does not settle the label.
- `evidence`: a verbatim sentence (at most 40 words) from the paper that places it.
- `where`: section name or page where the evidence is.

Quote, do not paraphrase. Some text files begin with `ABSTRACT ONLY`: code them from the
abstract, set confidence to low, and write `abstract only` in `where`. If a text file is
unreadable, write label `UNREAD`.
