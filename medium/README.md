# Medium post packet

Everything needed to publish **“It’s an order statistic, not a model”** on Medium.

## Files
- `its-an-order-statistic-not-a-model.md` — the article, with absolute `conformalprediction.net` links and inline image markers.
- `images/` — raster PNGs (Medium does not accept PDFs; these are rendered from the paper figures at 200 dpi).

## How to publish on Medium
Medium does **not** render raw Markdown on paste, and images must be **uploaded manually** (Medium re-hosts them — you cannot hotlink the repo). Two reliable routes:

1. **Paste + fix headings (fastest).** Paste the Markdown body into a new Medium story. Re-apply the title (Big T) and section headings (Medium’s heading tool), then at each `![...]` marker, drag in the matching PNG from `images/` and use the caption text from inside the brackets.
2. **Render then copy (cleanest formatting).** Open the `.md` in any Markdown previewer, copy the *rendered* output, and paste into Medium — bold/links/lists survive. Then drop the images in at the markers as above.

Links in the article are already absolute, so they work as-is once pasted.

## Image placement (in article order)
| Marker in article | File | Caption (already in the alt text) |
|---|---|---|
| “What ‘cannot substitute’ means” | `images/fig_sharpness_gap.png` | the residual-information gap I(R;X) |
| same section | `images/fig_orthogonality.png` | coverage and log-score are orthogonal |
| two-coordinate plane | `images/fig_plane.png` | coverage (free) vs proper score (earned) |
| “modern methods are sharp” | `images/fig_marginal_conditional.png` | marginal ≠ conditional coverage |
| “moving the goalposts” | `images/fig_timeseries.png` | coverage now, not on average |

Two extra figures are in `images/` if you want them: `fig_nogo.png` (impossibility of distribution-free conditional coverage) and `fig_subgroup.png` (subgroup coverage). Not referenced in the current draft.

## Demo links used (all absolute)
- 01 how conformal works — https://conformalprediction.net/demos/01-how-conformal-works.html
- 02 marginal vs conditional — https://conformalprediction.net/demos/02-marginal-vs-conditional.html
- 04 coverage vs log-score — https://conformalprediction.net/demos/04-coverage-vs-logscore.html
- 05 exchangeability & time series — https://conformalprediction.net/demos/05-exchangeability-timeseries.html
- 10 anomaly p-values — https://conformalprediction.net/demos/10-anomaly-pvalues.html
- 11 guaranteed recall — https://conformalprediction.net/demos/11-guaranteed-recall.html
- 12 safety envelope — https://conformalprediction.net/demos/12-safety-envelope.html
- 13 coverage–score plane — https://conformalprediction.net/demos/13-coverage-score-plane.html
- 14 one number, five pictures — https://conformalprediction.net/demos/14-four-readings.html
- the lottery paradox (betting/KL reading; face 5 of the gap) — https://www.youtube.com/watch?v=13IgveD2IN4

## Note on the paper
This post is the gloves-off version of the TMLR paper’s argument. Keep the sharp tone here; the paper (and its review thread) stays measured. The on-site twin of this post is `notes.html` at the repo root.
