# Status: rewritten as technical notes 2026-09-14. Not a contributions paper.

**Not linked from the site.** 13 pages. Builds clean, all scripts run.

## What it now claims

One reading and one identity, nothing more.

**The reading.** Pooling calibration residuals averages a fast variable over its invariant law,
which is the averaged limit of homogenization. Split conformal is therefore correct to leading order
exactly when the fast variable is fast relative to the forecast horizon, and the gap is a corrector.

**The identity.** For a Markov chain that corrector has an exact Poisson representation, and the
same solution family supplies the calibration variance, so state bias and effective-sample-size loss
are two readings of one spectrum. Checked numerically to machine precision.

**The illustration.** GARCH(1,1) at the persistence fitted to daily equities: the marginal guarantee
holds exactly while conditional coverage runs 98% in the calmest volatility decile to 74% in the most
volatile. The spread is the corrector and it vanishes as mixing speeds up.

## What it explicitly does not claim

Section 11, "Four attempts that failed", records every procedure tried and what killed it. This is
the most useful part of the document and the reason to keep it.

1. Indexing the calibration level by the observed state: dominated by plain lagged-state
   stratification, which needs no Poisson solution.
2. The sample-size advantage over stratifying: an artefact of assuming the kernel, against minimax
   lower bounds of order sqrt(d/n).
3. Stratifying removes the need for the correction: true only in the two-state cartoon, where the
   single non-unit mode is the state. On a continuous state, coarse binning fails on 24% of draws.
4. Clustering of stratum visits explains the residual: wrong. Kac's lemma forces equal mean return
   times, and the within-stratum variance varies by orders of magnitude while the gap statistics
   vary by 3%. The correct object is the long-run indicator covariance.

## Prior art, stated in the paper

Effective sample size for autocorrelated data is Bayley and Hammersley (1946), in the title. Mean
return time is Kac (1947). The clustering measure is the index of dispersion, Cox and Lewis (1966).
And the conformal application is Ramos, Graziadei and Cabezas, *Conformal Prediction via Transported
Beta Laws* (arXiv:2605.19024), which the paper already cited: 33 pages on calibration-conditional
coverage under stationary mixing, with clustered calibration, effective sample size, a long-run
variance and AR(1) simulations. That is the paper a reader should be sent to.

## What might still be unclaimed

The exact Poisson representation of realized history-conditional coverage, and the observation that
one solution family gives both the corrector and the variance. **Nobody has searched the Markov
chain literature for the identity itself.** Assume it exists until someone does.

## If this is ever circulated

It is notes. Do not submit it as a results paper. The honest framing is a technical note recording a
reading, one identity, one illustration, and four dead ends, offered so the next person does not
repeat them.
