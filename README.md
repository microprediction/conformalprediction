# Conformal Prediction

A practical, interactive guide to conformal prediction: how it works, what its guarantee
really means, where it is exactly the right tool, and the one thing it does not do. Live at
[conformalprediction.net](https://conformalprediction.net).

The premise is simple: to wield conformal prediction well, you have to understand what it
isn't. So the guide takes its time — it builds the method, reads the guarantee carefully,
shows where coverage is genuinely the goal, and is precise about what the guarantee does
not give you. The intent is to inform, not to oversell.

> Conformal prediction certifies the coverage of a set; it does not estimate a
> distribution. Use it whenever you need a coverage guarantee — just don't expect the
> certificate to make the forecast underneath it any sharper.

## The package

`pip install conformalguide` gives you a tiny, dependency-free split-conformal core.
The package is deliberately minimal; the guide is the main event.

```python
from conformalguide import predict_interval, conformal_quantile, coverage

# calibration residuals  y - mu_hat(x)
resid = [-1.0, 0.4, -0.3, 0.9, -0.7, 0.2, 1.1, -0.5]
lo, hi = predict_interval(point=2.0, residuals_cal=resid, alpha=0.2)
```

(With too few calibration points for the level you ask for, the correct answer is an
infinite interval: the finite-sample correction needs at least ⌈(n+1)(1−α)⌉ ≤ n.)

### Guard rails

The package also ships a distribution-free check for when coverage is conditionally
misleading, that is, when the marginal 90% is spread unevenly across the inputs.

```python
from conformalguide import coverage_dependence_test
p, info = coverage_dependence_test(residuals_cal, X_cal)   # small p: coverage is uneven across x
```

It tests whether the conformal rank of the residual is independent of the features, using
distance covariance with a permutation null. It detects, it does not certify. `CoverageAudited`
wraps any conformal estimator and warns after `fit`; `coverage_dependence_scorer` drops into
scikit-learn cross-validation. The reasoning is the companion note below.

## What's in the repository

A static site (vanilla HTML/CSS/ES-modules, no build step, no runtime dependencies except
MathJax from a CDN), a reproducible benchmark, and LaTeX write-ups (a paper and a companion
note).

```
conformalguide/             # the pip package: split-conformal core + coverage guard rails
index.html                  # the guide
css/ js/                    # styling and the demo modules (one per demonstration)
demos/                      # sixteen interactive demonstrations
benchmark/                  # reproducible MAPIE / crepes comparison
paper/                      # LaTeX sources: the paper, and the de Finetti–Feynman note
papers/                     # the papers as served on the site (landing pages + PDFs)
.claude/skills/, SKILL.md   # a Claude skill that reviews conformal code and runs the check
```

## The demonstrations

| # | Demo | The point |
|---|------|-----------|
| 01 | How split conformal works | The method is sound; coverage tracks 1−α. |
| 02 | Marginal vs. conditional coverage | 90% on average, ~100% where easy, well under target where hard. |
| 03 | The fence is the horizon | A deliberately useless predictor still hits 90%. Validity is not quality. |
| 04 | Coverage ⊥ log-score | Pin coverage at 90%; move the log-score arbitrarily. They are independent. |
| 05 | Exchangeability & time series | Drift breaks the guarantee; the adaptive patches restore only a long-run average. |
| 06 | Conformal vs. recalibration | For a calibrated forecast, recalibration improves the score and returns a density. |
| 07 | The price of conditional coverage | No-go: chasing per-x coverage forces interval length to infinity (Lei & Wasserman 2014). |
| 08 | Subgroup coverage buys only a wider band | No-go: distribution-free subgroup coverage is an inflated flat band (Barber et al. 2021). |
| 09 | Adaptive prediction sets | Where it shines: set size adapts to difficulty while coverage stays guaranteed. |
| 10 | Calibrated anomaly detection | Where it shines: conformal p-values give exact distribution-free Type-I error control. |
| 11 | Guaranteed recall | Where it shines: one conformal threshold certifies recall for screening and retrieval. |
| 12 | A certified safety envelope | Where it shines: a conformal safety tube for containment in robotics and control. |
| 13 | The coverage–score plane | Synthesis: conformalizing moves a model horizontally to nominal coverage; only conditioning lifts it toward the oracle. The gap is I(R;X). |
| 14 | One number, five pictures | The information gap read five ways: false pooling, an average log Bayes factor, non-uniform conformal ranks, a projection, a Kelly betting rent. |
| 15 | de Finetti, and where it goes negative | Exchangeable laws as mixtures of i.i.d. ones; push the correlation negative and the mixing measure turns signed. |
| 16 | A Thurstone contest at the −1/n floor | Marginal coverage holds while per-case coverage fans: the conformal error at the negative-association floor. |

## Running the site locally

ES modules must be served over HTTP, so use any static server:

```bash
python3 -m http.server 8731     # then open http://localhost:8731/index.html
```

## Building the paper

```bash
cd paper && tectonic marginally-useful.tex
```

Any standard TeX distribution works too (`pdflatex → bibtex → pdflatex → pdflatex`). The
companion note needs only `pdflatex` (it has no external bib):

```bash
cd paper/definetti-feynman && pdflatex signed-definetti-and-conformal.tex
```

## The paper, in three results

The paper is mostly expository, with three small results for a fixed location predictor
and a residual score:

1. *Orthogonality* (Prop. 1): the conformal set is a function of the nonconformity scores
   alone, so marginal coverage places no constraint on an accompanying density's log-score
   — coverage can be pinned while the log-score diverges.
2. *The residual-information gap* (Props. 2–3): a single-shape conformal predictive
   system's log-score regret to the oracle is the mutual information I(R;X) between residual
   and input, which no recalibration that ignores X can reduce. Within its class the system
   is log-score optimal; the cost is the class, not the calibration step.
3. *The coverage–score plane* (§6): a diagnostic in which conformalizing a fixed model is a
   horizontal move — toward zero coverage error, never toward a better score.

A no-go lemma collects the impossibility results of Lei & Wasserman (2014) and Foygel
Barber et al. (2021), each coordinate of which appears as a finite-sample fact in the demos.

## The companion note

A short follow-up, *A Feynman–Wigner Diagnostic for Conformal Prediction via Signed de Finetti
Representations* (`paper/definetti-feynman/`), reads conformal coverage through the sign of the
finite de Finetti mixing measure. Positive, extendable mixtures leave coverage conditionally
adaptive; the signed corner, where constrained or ranked scores live, makes it anti-adaptive,
while the marginal guarantee is unchanged. The note also states the runnable detector behind the
guard rails: distance covariance between the conformal rank and the features is the
energy-statistics sibling of the gap I(R;X), and it is the thing you can test on data
(`check_dcov.py`, `check_sign.py`).

## A check for your own code

There is a Claude skill in `.claude/skills/`, also served at
[conformalprediction.net/SKILL.md](https://conformalprediction.net/SKILL.md). Point your
assistant at it and it will review conformal code for the usual misuses and run the coverage
check. The bootstrap line is the same one at the foot of every page on the site:

> Read https://conformalprediction.net/SKILL.md and create a project skill from it.

## When conformal prediction is exactly right

There is a clean litmus test: is your loss a function of *whether* the truth lands in a
region, or of *where* it lands? When the answer is "whether," coverage is the objective and
conformal prediction is hard to beat — selective prediction, anomaly detection as a
distribution-free test, retrieval with a recall guarantee, and compliance certificates.

## License

MIT — see [LICENSE](LICENSE).
