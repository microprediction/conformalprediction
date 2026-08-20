# IJF resubmission requirements

Manuscript IJF-D-26-00978, "An Empirical Study of the Conformal
Information Gap". Returned before peer review on 2026-08-20 by Tilmann
Gneiting (Editor, International Journal of Forecasting). Not a
rejection on merit — he calls the paper "of potential relevance and
interest" — but it must be resubmitted, and it will then be treated as
a **new submission**, screened again before any review.

## Blocking: the companion note — RESOLVED 2026-08-20

The cover letter and abstract refer to a "companion note" (Marginally
Useful), which editors and referees could not see.

Now public, which is the editor's preferred of the two fixes:
**arXiv:2608.07479** (v1, 3 June 2026, q-fin.ST),
<https://arxiv.org/abs/2608.07479>. Cite that link in the cover letter.

Two things still to do with it:

- **State the status alongside the link.** He was explicit that the
  status must be specified — "submitted to The American Statistician"
  as of this writing. The bib entry now carries exactly that in its
  `note` field.
- The alternative he offered (uploading an anonymized copy as a
  supplementary file) is no longer needed, though note the arXiv
  posting is under Peter's name, so it de-anonymizes authorship to any
  referee who follows the link. That is unavoidable once the preprint
  is public and is the route the editor preferred anyway.

Done already: `cotton2026marginally` in all three `references.bib`
copies (`paper/`, `papers/frontier/`, `papers/frontier/arxiv/`) now
points at the arXiv eprint with the status note, and the site links it
from `papers/index.html` and the note's landing page.

Generalized instruction, which applies beyond this one note: cite all
closely relevant literature, and specifically **all submitted or
recently (pre)published work of our own** related to this manuscript,
including conference proceedings. Anything not publicly available gets
uploaded as a (possibly anonymized) supplementary file. Worth an audit
of the whole conformal series against this rule — several of those
papers are unpublished and mutually citing.

## Blocking: substantial human rewrite

He states the manuscript "shows signs of overuse of generative AI
tools" and "requires a complete, substantial rewrite (by a human, or by
humans), with utmost attention to readability (by a human target
audience)."

The tells he lists, each of which is a concrete editing target:

- overly technical or complex jargon, often unexplained and frequently
  unnecessary;
- insufficient specification of mathematical notation;
- lack of rigor in technical statements;
- lack of coherence and coordination between parts of the manuscript;
- unnecessary negative statements (his example of the genre: "These
  results are not meant to ...");
- grandiose formulation of statements and descriptions.

His worked example is the opening of Section 12 (Conclusion), currently
`frontier.tex:1617`:

> "The exact result is a decomposition." … "The empirical result is an
> attribution."

Both sentences are too abrupt and their referents are undefined —
*which* exact result, *which* decomposition, and what does "attribution"
mean here? He says he could list many more such examples, so the fix is
not to patch these two lines but to rewrite throughout: name the thing
before characterizing it, and let each section open by saying what it
does in plain words.

## Minor, but required before resubmission

- **Table legends.** Every table needs a number and a legend. Missing
  on pages 8, 11, 13, 14, 15, 23, 29 of the submitted version.
  Confirmed in source: `frontier.tex` has 10 `tabular` environments but
  only 2 `table` floats and 4 captions, so roughly eight tables are
  bare.
- **Subsection numbering.** Some subsections are numbered (e.g. 3.2),
  many are not. Confirmed in source: 14 `\subsection{}` against 4
  `\subsection*{}`. Unify (numbering all of them is the safer choice).

## Required with the resubmission

- **Four to six suggested referees**, names and email addresses, free
  of conflicts of interest.

## On acceptance (plan for it now)

Data and code sharing is **mandatory** unless justified to the
Editor-in-Chief (ijf@forecasters.org). Decide the hosting route in
advance — GitHub plus an archived Zenodo DOI is the clean answer, and
`check_gap.py` / `check_conformal_sim.py` / `fig_ladder.py` already sit
beside the paper, so this is mostly packaging and a README.

## Suggested order of work

1. Rewrite (the long pole). Do it before anything else, since the
   table legends and section numbering will move around during it.
2. Resolve the companion-note status: post it publicly if that is
   acceptable given TAS double-blind review, else prepare the
   anonymized supplementary copy with an explicit status line.
3. Audit self-citations across the conformal series; prepare
   supplementary uploads for anything unpublished.
4. Fix table floats/legends and subsection numbering; rebuild.
5. Draft the referee list (4–6, with emails).
6. Prepare the data/code archive and mention it in the cover letter.
