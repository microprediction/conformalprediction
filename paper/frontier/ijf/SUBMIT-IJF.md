# IJF submission kit

Submit at Editorial Manager: https://www.editorialmanager.com/ijf/
Article type: full-length research paper.

## Files in this directory

| Editorial Manager item | file |
|---|---|
| Manuscript (anonymized) | `manuscript-anon.pdf` (32 pp, double-blind) |
| Title page (separate, with author details) | `title-page.pdf` |
| Cover letter | `COVER-LETTER.md` (paste or upload) |
| Highlights | `HIGHLIGHTS.txt` (5 bullets, each under 85 characters) |

## Metadata to paste

- Title: `An Empirical Study of the Conformal Information Gap`
- Abstract: as in the manuscript (also in `../SUBMIT.md` §1 in plain text).
- Keywords: conformal prediction; probabilistic forecasting; proper scoring rules;
  mutual information; residual pooling; CRPS; online learning; distributional time series
- Declarations: no competing interests; no external funding; FRED public data;
  code links withheld from the anonymized version (all on the title page).

## Notes

- The anonymized PDF was regenerated from the same source as the public version via the
  `\ifanon` flag (`../frontier-anon.tex`): author block stripped, companion self-citation
  blinded, code URLs withheld. The skaters library citation remains third person, which
  double-blind convention permits for public software.
- Disclosure of the TAS companion is in the cover letter and on the title page.
- If the form asks for a data statement: all series from FRED; scripts open source,
  links restored on acceptance.
- After the SSRN abstract IDs arrive, no change is needed here: the anonymized version
  intentionally carries no SSRN links.
