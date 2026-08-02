# Submission packet — "An Empirical Study of the Conformal Information Gap"

Primary route: SSRN (accepts the PDF outright, no moderation friction, Elsevier-owned so
it pairs cleanly with IJF), then IJF. The arXiv packet in `arxiv/` remains ready if wanted
later; given past moderation, q-fin.ST is the likelier accepting category than stat.ME. The companion note "Marginally Useful" is under
double-blind review at The American Statistician; this paper cites it as
`cotton2026marginally` and the IJF cover letter discloses it (see §3).

---

## 1. arXiv (optional, packet ready)

**Upload** the contents of `paper/frontier/arxiv/`: `frontier.tex`, `frontier.bbl`,
`fig_ladder.pdf`, `fig_sharpness_gap.pdf`. (Do not upload `references.bib` or
`frontier.pdf`; arXiv compiles from source and uses the `.bbl`.) The directory builds
standalone with zero errors and zero overfull boxes.

**Title**
```
An Empirical Study of the Conformal Information Gap
```

**Abstract** (plain text for the metadata box)
```
Every forecasting architecture restricts the information available to its predictive law.
Under logarithmic loss the irreducible cost of replacing the full input by a retained
representation is exactly the conditional mutual information between outcome and input
given the representation. Following a companion note, we call it the information gap. For a single pooled residual law
the gap is the mutual information between residual and input, and pooling after any
invertible state-dependent change of coordinates has the analogous gap in the transformed
coordinates. Conformal calibration can improve estimation and provide a coverage
certificate, but it cannot recover predictive information excluded by the retained
representation. We apply the decomposition to a nested grammar of online transformations on
701 economic series. Conditional scale is the largest and most reliable component of the
measured architecture gain, and, holding the point predictor fixed, scale-normalized
empirical pooling beats raw pooling on 87 percent of the series under a quantile
approximation to CRPS. The value of residual pooling depends jointly on the coordinates,
the residual-law estimator, and the scoring rule.
```

**Categories**: primary `stat.ME`; cross-list `stat.ML` (optional second cross-list:
`econ.EM`, defensible given the FRED corpus).

**Comments field**: `32 pages, 2 figures. Code at github.com/microprediction/skaters`
(adjust the repo URL to taste).

**License**: the default arXiv non-exclusive license. It keeps every journal option open
(IJF/Elsevier permits arXiv preprints). Do not pick CC BY unless you want to preclude
nothing; the non-exclusive license is the conservative choice.

**Steps**: arxiv.org → Submit → new submission → upload the four files → check the
compiled preview page count (32) → paste title/abstract/categories/comments → submit.
First-time submitters to stat.ME may need endorsement; the request screen tells you.

---

## 2. SSRN (primary preprint route)

Upload `paper/frontier/arxiv/frontier.pdf` (32 pp, title page already carries author,
email, and date).

**Keywords**
```
conformal prediction; probabilistic forecasting; proper scoring rules; mutual information;
value of information; residual pooling; distributional time series; CRPS; online learning;
information bottleneck
```

**JEL codes**: C53 (Forecasting and Prediction Methods), C14 (Semiparametric and
Nonparametric Methods), C18 (Methodological Issues), optional C10.

**eJournals**: CompSciRN Machine Learning; ERN Econometric Modeling: Statistical Methods;
ERN Forecasting eJournal if offered; Decision-Making under Risk & Uncertainty (optional).

Author metadata as in the fan-note packet (Peter Cotton, peter.cotton@microprediction.com).
Moderation is 1-2 business days.

---

## 3. IJF (International Journal of Forecasting)

**Where**: Editorial Manager for IJF (Elsevier). Check the current Guide for Authors
before submitting; IJF uses double-blind review, so an anonymized manuscript version is
needed (say the word and I'll generate `frontier-anon.tex`: strip author block, cite the
companion and skaters in the third person, move the code link to a "available from the
authors" note).

**Cover letter disclosure sentence** (include verbatim or near it):
```
A short companion note, "Marginally Useful: Formalizing the Information Gap in Conformal
Prediction," which proves the single-pool special case of the identity used here, is
currently under review at The American Statistician. The present paper does not depend on
that note's acceptance: it generalizes the identity to arbitrary retained representations,
proves the transform-pooling theorem, and contributes the 701-series measurement study,
none of which appear in the companion.
```

**Suggested pitch line for the letter**: the paper gives forecasting practice an exact
price for a common shortcut (pooling residuals before conditional structure is removed)
and measures that price prequentially on 701 series under proper scores, in the
sharpness-subject-to-calibration tradition.

**Timing**: nothing blocks submitting now. Dual-submission rules bar the same manuscript
being under consideration twice; the two papers have different theorems and different
evidence, and the letter discloses the relationship.

---

## 4. Sequencing: skaters paper first

Upload the skaters paper (`skaters/papers/skaters-jss.pdf`, "Transforms All the Way Down",
24 pp) to SSRN before this one. Once it has an SSRN number, update the `cotton_skaters`
entry in `paper/references.bib` to cite the paper with its SSRN URL (repo link stays as a
secondary URL), rebuild, and this paper then cites a stable dated document rather than a
bare repository. Then upload this paper.

## 5. Before hitting submit (either venue)

- Commit and tag the current state of both repos so the arXiv v1 matches a commit
  (`git tag arxiv-v1` in conformalprediction, plus a skaters tag for the benchmark code).
- Optional: mint a Zenodo DOI for the skaters release and cite it in "Code and data
  availability" instead of the bare GitHub URL.
