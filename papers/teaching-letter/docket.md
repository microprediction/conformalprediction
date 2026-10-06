# Evidence docket (agent report, 2026-08-06)
# Spot-verify verbatim wording before final print citation.

## Top quotes by stratum

S1 JOURNAL LEVEL
- Angelopoulos & Bates (F&T ML 2023; arXiv:2107.07511): "statistically rigorous
  uncertainty sets/intervals"; "guaranteed to contain the ground truth with a
  user-specified probability"; abstract does NOT contain the word "marginal".
- Olsson et al., Nature Communications 13 (2022): CP is "essentially the only way
  to achieve valid prediction regions"; "guarantee the error rate is bounded".
- Shafer & Vovk, JMLR 9 (2008): "precise levels of confidence in new predictions".
- Lei et al., JASA 113:523 (2018): careful — says "finite-sample MARGINAL coverage"
  in the abstract. The honest baseline the lower strata degrade from.
- Kaiser & Herzog, AMPPS (SAGE) 2025: "mathematically proven guaranteed marginal
  coverage" + explicit conditional caveat (double-use).
- Boilerplate examples: arXiv:2512.23602, 2509.13717 ("rigorous, distribution free
  uncertainty quantification... mathematically guaranteed").

S2 TUTORIAL LAYER
- Manokhin (Medium 2023): "the best uncertainty quantification framework for the
  XXIst century".
- awesome-conformal-prediction README: "regardless of the model or the data
  distribution"; displayed endorsement "THE answer to UQ" (attr. M. Jordan).
- Nixtla statsforecast docs: literal superiority table, CP the only row with full
  "Calibration Guarantee" check vs "~" for bootstrap/quantile regression/ARIMA.
- MAPIE docs: "peer-reviewed algorithms with theoretical guarantees under minimal
  assumptions".
- Molnar book marketing: practical UQ approaches "don't provide any guarantee".

S3 COURSES/BLOGS
- Wikipedia: "statistically valid prediction regions... for any underlying point
  predictor".
- Tibshirani lecture notes (Berkeley 2024): honest about marginality AND contains
  the trivial-predictor example (all of Y w.p. 1-alpha "will always have exactly
  1-alpha coverage").
- Dataiku blog 2020: distribution-free framing + honest caveat.

COUNTER-VOICES
- Recht, argmin.net "Cover Songs" (2024): "Conformal prediction almost invites you
  to use garbage prediction functions"; "distribution-free" a misnomer; CP as "a
  different (and misleading) way of describing the estimation of empirical
  distributions of scalar residuals". Gelman blog discussion 2024-03-15.
- Barber-Candes-Ramdas-Tibshirani, Info & Inference 10(2) 2021: conditional
  impossibility.
- Vovk ACML 2012: "only known to control unconditional coverage probability".
- Stutz 2024 defense that concedes: "we get a marginal guarantee without any
  assumptions" — cheap, not conditional.

KEY DRAFTING FACT: the elision of "marginal" is a documented gradient down the
strata; the most-propagated sentence in the field (Gentle Introduction abstract)
omits the word.
