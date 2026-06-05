# TMLR submission packet

## Where to submit
- Submission site (OpenReview): **https://openreview.net/group?id=TMLR**  (use the "Submit" button)
- Author guide: https://jmlr.org/tmlr/author-guide.html
- Prerequisite: every author needs a complete, active OpenReview profile.

## What to upload (both files are in this folder)
1. **`marginally-useful.pdf`** — the anonymized paper (required). Generated with the official TMLR style.
2. **`supplementary_material.zip`** — optional, encouraged (`check_gap.py`, the numerical verification of Prop 3).

Do NOT upload source at submission; TMLR takes the PDF. Source/camera-ready handled on acceptance (see `CAMERA_READY.md`).

## Form fields

**Title**
```
Marginally Useful: Formalizing the Information Gap in Conformal Prediction
```

**Authors:** Peter Cotton (entered via OpenReview profile; hidden from reviewers during review)

**Abstract**
```
Conformal prediction gives finite-sample, distribution-free marginal coverage for a set. The guarantee is real, and it is often misread as evidence of forecast quality. We separate the two with one decomposition, the residual-information gap: for a fixed location predictor and a single-shape residual predictive system, the log-score regret relative to the oracle is exactly the mutual information I(R;X) between the residual and the input. Conformalization re-levels coverage but cannot touch this quantity, because it is a property of the predictor's shape class and not of calibration; no recalibration that ignores X reduces it within that class. The familiar cautions about conformal prediction follow as context: marginal coverage is not conditional, validity is insensitive to sharpness, and the guarantee needs exchangeability.
```

**Keywords**
```
conformal prediction; uncertainty quantification; calibration; proper scoring rules; mutual information; predictive distributions
```

**Declarations to complete in OpenReview**
- Suggested action editor: someone in conformal prediction / uncertainty quantification / proper scoring (pick from the list shown).
- Conflicts of interest: as applicable.
- Funding: as applicable.
- Human subjects / IRB: not applicable.
- Broader Impact Statement: already included in the PDF.

## Optional comment to the action editor (paste into the submission note)

This is a short, clarification-style paper with one exact result. For a fixed location predictor and a single-shape residual predictive system, the expected log-score regret to the conditional oracle equals the mutual information I(R;X) between the residual and the input (Proposition 3), with an additional symmetrization term for absolute-residual intervals. The aim is to make precise, rather than merely assert, the common observation that conformalization re-levels coverage without improving a proper score.

On novelty and scope, we are explicit about what is and is not new. The no-go results we cite are due to Lei and Wasserman and to Foygel Barber et al.; the re-leveling object is Vovk's conformal predictive system; the calibration/sharpness decomposition of a proper score is standard. The contribution is their combination into the exact identity above, five equivalent readings of it (a false-pooling cost, an average log Bayes factor, the conditional non-uniformity of conformal ranks, a KL projection, and a Kelly betting rent), and the resulting two-coordinate diagnostic. All claims are scoped to the single-shape residual class, and we discuss how modern conditional methods (CQR, Mondrian/CRPS-binned CPS, conformal training) deliberately leave that class.

We suggest TMLR because the contribution is exact and clarifying rather than novel in the conference sense, which matches TMLR's stated acceptance criterion of correctness and interest over novelty and impact. The identity is verified numerically to machine precision by the included check_gap.py.

A non-anonymized preprint and an interactive companion exist; per the double-blind policy, all identifying links have been removed from the submission.
