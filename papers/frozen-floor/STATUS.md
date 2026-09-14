# Status: adjudicated 2026-09-13. Cannibalize, do not publish as is.

**Verdict: a good population identity inside an invalid general characterization.**

## Keep this

A clean population theorem, worth preserving:

    inf_{Q_kappa} E KL( P_{W|X} || Q_{kappa(X)} ) = I(W; X | kappa),   optimizer Q_kappa = P_{W|kappa}

That is an information-projection formulation of the information gap. Reduce it to a two-page lemma
and fold it into *Marginally Useful* or a larger information-gap paper.

## Discard this

The surrounding characterization does not hold.

1. The empirical score law is discrete, so it has no density and `KL(G_kappa || G_hat_kappa) = infinity`
   for a continuous score law. `Delta_n -> 0` is false for the estimator actually defined.
2. Absolute-residual and CQR scores are not increasing bijections in `y`, so `G(A(x,y))` is not a
   predictive CDF.
3. Split prediction sets, predictive systems and full conformal cannot all be represented by
   Definition 1.
4. Full conformal's calibration scores depend on the candidate `y`, which Section 5 does not resolve.
5. Most importantly, conformal validity does not prohibit labels from choosing `A` or `kappa` on an
   independent training fold, so the claimed compulsory label-blind regressogram handicap is false.

As a standalone "mechanical characterization of every conformal scheme" it would be easily refuted.
