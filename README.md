# Marginally Useful

**An educational, interactive account of what conformal prediction actually guarantees — and what it does not.**

Conformal prediction is correct mathematics with a real guarantee. The trouble is the
guarantee — *marginal coverage* — is usually not the thing people reach for it to
provide. This project explains the method honestly, builds it up from scratch with
runnable demonstrations, and then shows, interactively, why marginal coverage is rarely
the object you actually wanted. The companion paper states the same facts precisely,
with citations and three small contributions.

> **The one-sentence thesis.** Conformal prediction certifies the coverage of a *set*;
> it does not estimate a *distribution*. Confusing the two is a category error.

## What's here

A static site (vanilla HTML/CSS/ES-modules, **no build step, no runtime dependencies**
except MathJax from a CDN) plus a LaTeX paper.

```
marginally-useful/
├── index.html                 # landing page + thesis + demo index
├── css/style.css
├── js/
│   ├── lib/
│   │   ├── stats.js           # RNG, normal dist, polyfit, conformal quantile, log-score …
│   │   ├── plot.js            # tiny dependency-free canvas plotting
│   │   └── ui.js              # sliders / readouts / buttons
│   └── demo01.js … demo08.js  # one module per demonstration
├── demos/                     # one HTML page per demonstration
└── paper/
    ├── marginally-useful.tex  # the companion paper
    ├── references.bib
    └── index.html             # paper landing page
```

## The demonstrations

| # | Demo | The point |
|---|------|-----------|
| 01 | How split conformal works | The method is sound; coverage tracks 1−α. Hold that thought. |
| 02 | Marginal vs. conditional coverage | 90% on average, ~100% where easy, well under target where hard. |
| 03 | The fence is the horizon | A deliberately useless predictor still hits 90%. Validity ≠ quality. |
| 04 | Coverage ⊥ log-score | Pin coverage at 90%; move the log-score arbitrarily. They're orthogonal. |
| 05 | Exchangeability & time series | Drift breaks the guarantee; the adaptive patch restores only a long-run *average*. |
| 06 | Conformal vs. recalibration | If you wanted a calibrated forecast, recalibration improves the score and returns a density. |
| 07 | The price of conditional coverage | **No-go:** chasing per-x coverage forces interval length to infinity (Lei & Wasserman 2014). |
| 08 | Subgroup coverage buys only a wider band | **No-go:** distribution-free subgroup coverage = inflated flat band, never adaptivity (Barber et al. 2021). |

Every quantitative claim is something you can move a slider and verify.

## Running locally

ES modules must be served over HTTP (not `file://`), so use any static server:

```bash
cd marginally-useful
python3 -m http.server 8731
# open http://localhost:8731/index.html
```

## Building the paper

With [Tectonic](https://tectonic-typesetting.github.io/) (recommended — fetches packages
and runs BibTeX for you):

```bash
cd paper
tectonic marginally-useful.tex
```

Or with any TeX distribution: `pdflatex → bibtex → pdflatex → pdflatex`.

## Contributions in the paper

1. **Orthogonality** (Prop. 1): the conformal set is a function of the nonconformity
   scores alone, so coverage is statistically independent of sharpness — constructively,
   coverage can be pinned while the log-score diverges.
2. **The sharpness gap** (Props. 2–3): the conformal predictive system's log-score regret
   to the oracle equals the expected KL of the conditional residual law from its marginal —
   invariant to any marginal recalibration. Within its own class the conformal system is
   log-score optimal; the cost is the class, not the calibration step.
3. **The coverage–sharpness plane** (§6): a diagnostic in which conformalization is a
   horizontal projection — left, never up.

A formal no-go lemma collects the impossibility results, each coordinate of which is
realized as a finite-sample fact in Demos 7 and 8.

## Honesty flags

This project is skeptical, not dismissive. The mathematics of conformal prediction is
correct, and there is a clean litmus for when it is exactly the right tool (selective
prediction, retrieval shortlists, anomaly detection as a distribution-free test,
compliance certificates): *is your loss a function of **whether** the truth lands in a
region, or of **where** it lands?* If the former, coverage is the native object. See
Demo 06 and §7 of the paper for the steelman.

## License

MIT — see [LICENSE](LICENSE).
