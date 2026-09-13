# Submission package: Computer Communications (Elsevier, ISSN 0140-3664)

Facts gathered 2026-09-13 from the journal's Guide for Authors, editorial board page, Elsevier's
APC price list and OpenAlex. Verify at submission time.

## The journal

- Editor-in-Chief: Damla Turgut (University of Central Florida). Emeritus EiC: Marco Conti.
- Associate Editor-in-Chief: Carla Fabiana Chiasserini (Politecnico di Torino), the corresponding
  author of the paper this note answers. Francesco Malandrino, a co-author, sits on the Technical
  Committee. The Guide for Authors says editors are not involved in decisions about papers they
  wrote or that relate to their interests; the cover letter asks the EiC to apply that policy.
- Article types listed: "Original research articles" and "Review articles" only. There is no
  comment or letter type. The journal has nevertheless published "Comment on ..." pieces, most
  recently a two-page one in 2012 (doi:10.1016/j.comcom.2012.11.011), typed as an article.
  Submit as an original research article and say in the cover letter what it is.
- Peer review: single anonymized, at least one reviewer, editors decide. Appeals: one per paper.
- Fee: hybrid open access. APC USD 2,490 (EUR 2,270, GBP 1,990) for gold OA. Publishing under
  the subscription model costs nothing; choose that at the license step. Elsevier's policy:
  "Authors publishing in hybrid journals can publish under the subscription model at no cost."
- Preprints allowed and do not count as prior publication, so arXiv first is fine.
- Submission system: Editorial Manager, https://www.editorialmanager.com/comcom/

## What the journal requires at submission

- Editable source: the .tex, not only a PDF. Their LaTeX template (elsarticle) is encouraged,
  not required. Double-column is permitted only for LaTeX.
- Title page with full affiliation and postal address, corresponding author's e-mail.
- Abstract at most 250 words, no references. Ours is under the limit (checked).
- 1 to 7 keywords. Added to the tex after the abstract.
- Highlights: separate editable file named with "highlights", 3 to 5 bullets of at most 85
  characters each. See highlights.txt.
- Declaration of competing interests: completed in the online declarations tool, uploaded as
  .docx. Text in declarations.md.
- Funding statement, data availability statement, CRediT statement: text in declarations.md;
  the first two also appear as sections in the manuscript.
- Generative AI declaration: REQUIRED, as a section before the references. Added to the tex.
- Research data: Option C. Code is on GitHub; consider minting a Zenodo DOI for the release and
  citing it, which is what the guide prefers.
- References: any consistent style at submission; the journal restyles after acceptance.
- Figures as separate files: export Figure 1 (TikZ) as a standalone PDF at submission.

## Steps

1. Post to arXiv (stat.ML, cross-list cs.LG). Preprints are allowed.
2. Add postal affiliation to the tex title block.
3. Export figure 1 to a standalone PDF (see make_figure.sh).
4. Register or log in at Editorial Manager; article type "Research Paper" (or whatever the
   closest is); paste the cover letter; upload the tex, the figure, highlights.txt.
5. In the declarations tool select "I have nothing to declare"; upload the generated .docx.
6. Choose subscription publication at the license step to avoid the APC.
