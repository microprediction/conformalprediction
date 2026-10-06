# As submitted to The American Statistician, 2026-06-11 — do not edit

Frozen copy of the exact manuscript submitted to TAS via ScholarOne
(Taylor & Francis), article type *General*, on 2026-06-11. Extracted
verbatim from commit `90fa225` ("TAS: editorial formatting fixes —
double-spacing + ASA references").

TAS is double-blind, so two PDFs went up:

| File | What it is |
| --- | --- |
| `marginallyuseful.pdf` | Author details: Peter Cotton, Global Strategic Minerals Corp |
| `marginallyusefulanon.pdf` | Blinded copy |
| `marginally-useful.tex` | Source for both; `\ifanon` toggle switches the author block |
| `marginally-useful-anon.tex` | Thin wrapper that sets `\anonymous` and inputs the above |
| `references.bib` | Bibliography as submitted |

Figures and `asa-authoryear.bst` are not duplicated here; they are
unchanged in the parent directory and also recoverable from `90fa225`.

Editing happens in the parent directory, not here:

- `../marginally-useful.tex` — the live manuscript
- `../marginally-useful-peter.tex` — Peter's editing copy

The paper is also public as [arXiv:2608.07479](https://arxiv.org/abs/2608.07479),
which carries the earlier, shorter text (no Related Work section).
