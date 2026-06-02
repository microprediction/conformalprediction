# UPDATE_ME_CLAUDE.md — how to refresh this site later

Written 2026-06-01. Intended reader: a future Claude (or human) asked to bring
**conformalprediction.net** up to date, e.g. ~6 months on, with new papers and methods.
Read this first, then keep the house style.

## What this project is

A balanced, interactive *guide* to conformal prediction at conformalprediction.net, plus a
reproducible benchmark, a LaTeX paper ("Marginally Useful?"), and a tiny `conformalguide`
PyPI package. It explains what the coverage guarantee does and does not tell you, where the
method is the right tool, and how to apply it well. The tone is clear, measured, and
informative; the guiding principle is *inform, not oversell*.

## Repo map

```
index.html              guide landing (sections: how it works -> limits -> what it won't do
                        -> time series -> benchmark -> applications -> FAQ)
applications.html       deep dive: domains where coverage is genuinely the goal; this is
                        the home for the curated APPLICATION papers (annotated, by domain)
patterns.html           sound-patterns / anti-patterns taxonomy + the sampled misuse rate
theory.html             "Theory" in the nav: the curated METHODS & THEORY reading list
                        (renamed from reading.html; application papers live in applications.html)
benchmark.html          results page (figures + tables) from benchmark/
demos/ js/ css/         12 interactive demos (vanilla JS, no build); 09-12 are the
                        positive "where it shines" demos (sets, anomaly, recall, safety)
faq.html                objections & FAQ (its own page; linked from the global nav)
benchmark/              reproducible study (run_timeseries.py, run_tabular.py, common.py,
                        ts_methods.py, skater_shootout.py); .venv is gitignored
paper/                  marginally-useful.tex, references.bib, figures.py, figures/*.pdf
conformalguide/         the pip package (minimal split-conformal core)
data/cp_papers_labeled.tsv   wheat/chaff labels from the patterns study
```

## Adding new papers (the usual refresh)

1. Pull the latest bibliography and look for entries newer than the last refresh:
   `curl -s https://raw.githubusercontent.com/valeman/awesome-conformal-prediction/master/README.md`
   (and/or an arXiv search for recent `conformal prediction` papers).
2. Classify each candidate with the **rubric in `patterns.html`** (sound patterns P1–P6,
   anti-patterns A1–A7; label wheat / borderline / chaff / unclear). For a batch, dispatch
   parallel agents the way the original study did (see `data/cp_papers_labeled.tsv` for the
   schema: `url, short_title, label, code, confidence, rationale, evidence`). Be fair and
   conservative — default to "sound" unless a claim is clearly overstated.
3. Add only **wheat** (sound) papers, and put each where it belongs: methods/theory papers
   go in `theory.html` (right category); application exemplars go in `applications.html`
   (right domain section, with a one-line annotation). Keep the two from duplicating each
   other. **Skip promotional / overselling material** — that filter is the point.
4. Append new labels to `data/cp_papers_labeled.tsv`; if you re-sample, update the
   percentages and counts in `patterns.html` (and keep the caveats honest).

## Regenerating figures and the benchmark

```bash
cd benchmark
python -m venv --system-site-packages .venv && source .venv/bin/activate
pip install -r requirements.txt            # mapie, crepes, arch, timemachines, adjustText, ...
python run_timeseries.py                   # -> results/ts_results.csv, figures/ts_*.png
python run_tabular.py                      # -> results/tabular_results.csv, figures/tabular_*.png
cd ../paper && python figures.py           # -> paper/figures/*.pdf  (uses ../benchmark code)
tectonic marginally-useful.tex             # -> marginally-useful.pdf
```
If you change benchmark numbers, update them everywhere they are quoted: `benchmark.html`,
`benchmark/README.md`, and paper §7.

## House style — keep it, and keep the AI tells out

This was cleaned once; do not reintroduce the tells.
- **No bold lead-ins** on paragraphs or list items (`**Term.** explanation` / `<strong>Term.</strong> …`). Write flowing prose.
- **Em-dashes sparingly.** The paper has none; the site uses few. Prefer commas, colons, periods.
- **Banned words:** "honest/honestly," "delve," "leverage," "realm," "tapestry," "seamless,"
  "in conclusion," "it's worth noting," and similar. Don't use rule-of-three filler.
- Preserve the existing voice and phrasing; keep new text in the same plain, measured register.
- Keep the paper title **"Marginally Useful?"** (the question mark matters) and the kicker
  restraint on the landing page (no badge).

## Verifying before you ship

```bash
python3 -m http.server 8731    # open http://localhost:8731/index.html
```
Then load each page headless (Chrome DevTools / CDP) and confirm: no JS console errors,
canvases sized, MathJax renders, no broken internal links. Recompile the paper and check it
has no undefined references. (The original build did all of this; match it.)

## Hosting (already set up — don't break it)

- GitHub Pages: Settings → Pages → Deploy from a branch, `main` / `(root)`. Custom domain
  `conformalprediction.net` via the `CNAME` file; `.nojekyll` keeps subfolders intact.
- `origin` = the public repo `microprediction/conformalprediction`; `private` = the old
  `marginally-useful` repo. Push to `origin main`; Pages redeploys automatically.

## The PyPI package

Minimal on purpose (`conformalguide/core.py`). The PyPI project is named `conformalguide`
because `conformalprediction` (and its `-`/`_` variants) was blocked by PyPI's
name-similarity filter. To release a new version: bump `version` in **both**
`pyproject.toml` and `conformalguide/__init__.py`, then
`gh workflow run publish.yml` (the workflow builds and uploads with the `PYPI_USERNAME` /
`PYPI_PASSWORD` repo secrets — `PYPI_USERNAME` must be `__token__` and `PYPI_PASSWORD` a
PyPI API token). You cannot reuse a version number.

## Don't

- Keep the balance: applications and methods deserve as much depth as the limitations.
- Don't add papers you haven't actually checked, and don't name-and-shame specific papers as
  "misuse" on the public pages — keep per-paper judgements in `data/`.
- Don't commit `benchmark/.venv/`, `dist/`, or build artifacts (they're gitignored).
