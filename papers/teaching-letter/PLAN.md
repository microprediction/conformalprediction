# Opinion letter: teaching conformal prediction is doing more harm than good

Goal: a sharp, terse opinion letter to a statistics-education journal arguing that
teaching conformal prediction couched as an alternative to statistical prediction in
general does more harm than good. Local commits only until Peter says push.

## The charges (Peter's structure, keep this order)

(a) Claims exist, at journal level but mostly one rung below (tutorials, books,
    courses, blogs), that conformal prediction is a MORE RIGOROUS way to attach
    uncertainty to a model. Flatly refuted by the conformal information gap, which
    is equally rigorous.
(b) Conformal prediction is a bundle of steps, one being a univariate transform (the
    conformal re-ranking, in need of repair by interpolation).
    (bi) Empirically: not a single paper in the literature proceeds past this step.
    The bundling has created a cultural bias toward stopping prematurely that would
    never have arisen had the steps been presented separately.
(c) The bias is manifest in empirical data (the 572-series campaign: E vs D0, E vs F,
    the gap measurements).
(d) The conformal guarantee ENCOURAGES the early stop and is methodologically silent
    on whether the data is whitened, i.e., on the conditions under which the method
    would deserve the "more rigorous" label.
(e) If instead conformal prediction is broken apart and presented as an empirical
    distribution, it has an extensive heritage in many guises (Weibull plotting
    positions, van der Waerden normal scores, NQT/meta-Gaussian, Chen-Fan copula
    marginals, CPS, Redistributor).
(f) Conformal prediction as taught is manifestly inconsistent: it treats residual
    modeling in a highly normative (unconditional) manner while the same treatment
    of the base model would be a priori absurd. Including an empirical whitening
    transform in the ordinary toolbox dissolves the quandary, provided modeling can
    continue past the "conformal ribbon-cutting ceremony".

## Phases

1. VENUES: catalog statistics-education journals accepting opinion/commentary:
   JSDSE (Taylor & Francis, formerly J. Statistics Education), Teaching Statistics
   (Wiley), CHANCE, Significance, SERJ, Harvard Data Science Review (commentary),
   TAS Teacher's Corner (probably avoid, per standing venue advice). Read each
   venue's letter/opinion format and word limits. Deliverable: venues.md with
   recommendation.
2. DOCKET: collect quotable "more rigorous / distribution-free superior" claims
   from (i) journal papers, (ii) the tutorial literature (Angelopoulos-Bates gentle
   intro, Manokhin book, awesome-conformal-prediction), (iii) course materials and
   blogs. Verify the (bi) claim by fresh search (nobody proceeds past the step;
   grammar paper Section 5 is the base). Deliverable: docket.md with exact quotes
   and citations.
3. DRAFT: letter.tex (or venue format), sharp and terse, charges (a)-(f), Peter's
   voice (no AI tells, no meta-narration, short sentences, ~payoff first).
   Supporting citations: grammar paper, frontier paper, Marginally Useful, the
   heritage list, the campaign numbers.
4. REVIEW: adversarial agent pass (referee simulation), then Peter.

## Resources already in hand
- Grammar paper (papers/grammar/): Section 5 nesting review = evidence for (bi);
  intro inconsistency paragraph = (f); heritage = (e); campaign numbers = (c).
- Frontier paper + SSRN 7220538: the gap = (a) rebuttal; infogap table = (c).
- conformalprediction.net demos 29/30 for citable illustrations.

Status: Phase 1 beginning 2026-08-06. Local branch teaching-letter, commits local only.
