# paper/tas/ — the TAS submission record only

There is one live paper: **`papers/marginally-useful-short/holloway-gambit.tex`**, seven
pages. Decided 2026-08-20.

What remains here is the record of what The American Statistician actually has.
`submitted-2026-06-11/` is the frozen submission, both blind and non-blind PDFs plus
source, and `marginallyuseful.pdf` / `marginallyusefulanon.pdf` are the same two files in
the working directory. Do not edit any of them. `COVER_LETTER.md`, `references.bib`,
`figures/`, `check_gap.py` and `fig_plane_schematic.py` are the supporting material that
went with it.

The 26-page revision of 2026-08-20 was deleted from the working tree so that only one
paper exists on disk. It is in git at **`9215785`**, recoverable with

    git show 9215785:paper/tas/marginally-useful.tex > /tmp/long.tex

That version is the only place the following now lives, all of it dropped from the short
paper on purpose:

- three of the five readings of the identity: the log Bayes factor, the conditional
  non-uniformity of conformal ranks, and the information projection;
- case (B) of the re-leveling proposition in full, though the short paper keeps its
  identity in a footnote;
- the exchangeability and time-series section, and the coverage-as-objective section;
- five figures, including the two impossibility illustrations.
