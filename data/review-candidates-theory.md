# Candidates refutable by a theorem

A triage of the 686-abstract frame in `papers/grammar/survey/frame_abstracts.csv`, run 2026-09-13
against five results the site already establishes. Three agents read every abstract and flagged 29,
about 4%. Every flag is a claim a theorem contradicts, not a weak experiment.

**The rubric is at `data/reviews/triage-rubric.md`.** It lists, for each result, what to flag and
what not to flag. The "do not flag" lists matter: Mondrian
and class-conditional conformal, covariate-shift weighting, training-conditional bounds and papers
that prove impossibilities are all legitimate and were excluded by hand.

## The five results

- **R1, no-go for functionals of the sets.** A statistic computed from the prediction sets alone is a
  functional of the law of C(X). Two joint laws of (Y, Yhat, C(X)) can share the law of sets, the
  class proportions, the coverage and the value of that functional, and differ in their confusion
  matrices. So nothing read off the sets recovers which label was ranked first, per-class confusion,
  per-feature attribution or a causal contribution. (Theorem 1 of *Conformal Correlation
  Counterexamples*.)
- **R2, marginal is not conditional.** Split conformal bounds the coverage averaged over the
  calibration draw and the test input, and constrains nothing at a point.
- **R3, exchangeability dies under data-dependent handling.** Selecting, screening, permuting or
  reusing calibration data on the basis of the data voids the guarantee.
- **R4, a long-run average is not a per-decision guarantee.** Online and time-averaged coverage
  permits arbitrarily long runs of miscoverage.
- **R5, set size is not certified.** The guarantee constrains the true label's inclusion rate only.

## What the triage actually found: the flags cluster

| Result | Flags | Where they live |
| --- | ---: | --- |
| R4, safety from a long-run average | 9 | robotics, control, autonomous systems, networking |
| R2, per-input from a marginal guarantee | 8 | medicine, criminal justice, chemistry, multi-user systems |
| R3, exchangeability broken by a data-dependent step | 6 | test-time adaptation, abstention, planning |
| R5, set size as a certified uncertainty | 5 | applied classification, LLM judging, materials |
| R1, a quantity recovered from the sets | 4 | attribution, explanation, continual learning |

**The recommendation that follows from this is to stop writing one review per paper.** Each cluster
is one theorem plus a counterexample plus a list of instances. That is the shape of the CCC paper and
it is far more efficient than five review pages. Two clusters are worth writing up:

**1. "Verified" control from a distributional average (R4, plus two R2 cases).** Nine papers, and two
of them state the trade outright. CP-NCBF (arXiv:2503.17395) proposes "split-conformal prediction to
generate formally verified neural CBFs with probabilistic guarantees", and CPED-NCBFs
(arXiv:2507.15022) uses conformal "to verify the learned NCBF from the expert demonstrations", in
both cases replacing SMT solvers, mixed-integer programming or Lipschitz bound propagation. Those
methods give worst-case guarantees over a state space. Split conformal gives an average over a
sampling distribution. The advertised gain, larger and less conservative safe sets, is exactly the
guarantee that was dropped. A note stating that, with the oscillating-allocation counterexample for
the adaptive-conformal variants, covers the cluster.

**2. Per-subject guarantees in high-stakes domains (R2).** Two of the eight are worth naming on their
own. A brain-age paper (arXiv:2302.05304) claims "statistical guarantees with respect to
single-subject uncertainty estimates" and that those guarantees "indeed hold for every participant",
which is a marginal rate reported as a per-participant guarantee. A criminal justice risk assessment
(arXiv:2008.11664) promises "fair forecasts for individual offenders coupled with valid probability
guarantees that the forecasted outcome is the true outcome", which makes two errors at once: the
guarantee is not per-offender, and it bounds the rate at which the truth lies in the set, not the
probability that the point forecast is right.

## The flags

Confidence is the triage agent's, 3 to 5, where 5 means the abstract alone settles it. **Everything
at 3 needs the body checked before any of it is written up.** Citation counts were mostly
unavailable: Semantic Scholar rate-limited the sweep, and 390 of the 686 papers are from 2025 or
2026, so the corpus is recency-biased and thin on well-cited targets by construction.

| arXiv | Year | Result | Conf | Short |
| --- | --- | --- | ---: | --- |
| 2507.15022 | 2025 | R2 R4 | 4 | CPED-NCBFs, conformal replacing SMT/MIP verification |
| 2505.13118 | 2025 | R1 | 4 | Shapley attribution of conformal interval width |
| 2404.13002 | 2024 | R5 | 4 | Ferrous scrap, models ranked "more reliable" by set size |
| 2302.05304 | 2023 | R2 | 4 | Brain age, "guarantees ... for every participant" |
| 2008.11664 | 2020 | R2 | 4 | Criminal justice, "valid probability guarantees" per offender |
| 2306.00876 | 2023 | R1 R5 | 4 | Karimi and Samavi (reviewed, see conformal-uncertainty-bounds.html) |
| 2608.09612 | 2026 | R2 R3 | 3 | Individual causal effects, localized plus synthetic calibration |
| 2604.15302 | 2026 | R5 | 3 | LLM judge reliability from set width |
| 2602.04821 | 2026 | R4 | 3 | Urban traffic control, "end-to-end theoretical guarantees" |
| 2512.02893 | 2025 | R3 | 3 | Genetic search over calibration strata |
| 2511.18170 | 2025 | R4 | 3 | Quantile tuned for plan feasibility |
| 2510.15233 | 2025 | R2 | 3 | TESSERA, "per-sample ... coverage guarantee" |
| 2509.25692 | 2025 | R3 | 3 | Active test-time adaptation, pseudo-labeled calibration |
| 2508.14266 | 2025 | R5 | 3 | Augmentation compared by set size |
| 2505.22496 | 2025 | R4 | 3 | Catheter placement, "zero high-risk mispredictions" |
| 2505.22326 | 2025 | R1 R2 | 3 | Counterfactuals from interval width |
| 2505.10677 | 2025 | R1 | 3 | Catastrophic forgetting measured from sets |
| 2505.09427 | 2025 | R4 | 3 | SafePath, coverage of a set read as safety of the chosen element |
| 2503.17678 | 2025 | R4 | 3 | Safe RL, ACP radii in CBF constraints |
| 2503.17395 | 2025 | R2 R4 | 3 | CP-NCBF, "formally verified" from a marginal bound |
| 2502.07255 | 2025 | R3 | 3 | Abstention threshold tuned by ROC on the same data |
| 2502.06631 | 2025 | R3 | 3 | Temperature tuned on the calibration scores |
| 2501.07185 | 2025 | R2 | 3 | Weeding, class-conditional recall from a marginal bound |
| 2407.03569 | 2024 | R4 | 3 | Per-step safety from adaptive conformal |
| 2405.02634 | 2024 | R5 | 3 | Out-of-calibration detection from mean set size |
| 2404.15557 | 2024 | R4 | 3 | Safe POMDP planning from ACP |
| 2403.10368 | 2024 | R2 R3 | 3 | "Conformal safety set", conditional error rate on a data-selected region |
| 2312.05195 | 2023 | R2 | 3 | Multi-user, conformal offered as a per-prediction guarantee |
| 2302.07675 | 2023 | R4 | 3 | URLLC, per-frame reliability from a time average |

## Allies, to cite rather than review

- **arXiv:2509.05826**, conformal set size against human annotator disagreement across three methods,
  eight models and four datasets: "the vast majority of the conformal prediction outputs show a very
  weak to weak correlation with human annotations". Already cited on the set-size review.
- **arXiv:2603.20000**, conformal set size against Bayesian predictive entropy on radio galaxies:
  "only a weak correlation between the measures".
- **arXiv:2503.16809**, *Online Selective Conformal Prediction: Errors and Solutions*, refutes CAP
  (arXiv:2403.07728): "despite the claims of Bao et al. (2024a), we demonstrate that the proposed
  method does not, in fact, guarantee selection-conditional coverage."

## Lane note

The R3 lane is already policed. The selective-inference community finds and publishes these errors,
as the CAP refutation shows, so R3 candidates are likely to be pre-empted. R1 and R5 are the lanes
where the site's own results bite and where the sweeps found little prior criticism. Check prior art
before writing, per `UPDATE_ME_CLAUDE.md`.
