# Experiments on the state-adaptive claim, 2026-09-14

Four scripts, run after Theorem 9 was written. They are adversarial: each was designed to
break the claim rather than support it, and three of them succeeded.

Run order: `state_adaptive.py`, `compare_arms.py`, `control2.py`, `stress.py`, `mechanism.py`.
(`decisive.py` and `control.py` are superseded, see the variance bug below.)

## Finding 1. Theorem 9 is dominated by stratifying on the lagged state

Pair each calibration score with the state `ell` steps earlier and take an ordinary quantile
within each stratum. No Poisson equation needed. Population thresholds, two-state model,
lambda = 0.8, p = 0.9:

| pi_H | worst case | Theorem 9, L | Theorem 9, H | lagged-state, L | lagged-state, H | E[Thm 9] | E[lagged] |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.02 | 1.740 | 0.789 | 1.740 | 0.773 | 1.740 | 0.808 | 0.792 |
| 0.10 | 1.756 | 0.876 | 1.756 | 0.789 | 1.756 | 0.964 | 0.885 |
| 0.20 | 1.774 | 1.000 | 1.774 | 0.810 | 1.774 | 1.155 | 1.002 |
| 0.40 | 1.811 | 1.270 | 1.811 | 0.853 | 1.811 | 1.487 | 1.236 |

Stratifying dominates at every rarity, and it hits the target exactly (0.9000) where Theorem 9
over-covers (0.9400 at pi_H = 0.20). The reason is structural: Theorem 9 can only slide along the
quantile function of the *invariant* law, so in a state that already over-covers the level cannot
go below p and the construction stops. Stratifying estimates the right law directly. The finite
sample comparison at n in {500, 2000, 8000} does not reverse this, so the sample-splitting cost
never recovers what the wrong target loses.

## Finding 2. A variance bug in the first verification

`control.py` used `Vexact` computed on the regime-only chain. The paper's convention is that the
state absorbs the emission, so `chi` carries the t = 0 emission term, which is the dominant part
of the variance. Dropping it made V far too small: at lambda = 0 it gave 0.01 against the correct
p(1-p) = 0.09, and the resulting margin failed 19.8% of the time against a nominal 10%. The
paper's own equation (5) has the right object and `control2.py` uses it. Anyone rerunning this
should use `sigma^2_p`, not a potential computed on a coarser state.

## Finding 3. The naive failure is about honesty, not dependence

Ordinary stratified conformal misses the target on about 47% of calibration draws. That holds at
**lambda = 0**, where the chain is i.i.d. So it is not a dependence effect. The ordinary rank
targets average coverage, and you land below target roughly half the time by symmetry. Any framing
that says dependence breaks stratified conformal is wrong, including the one this note's author
wrote before running the control.

## Finding 4. The dependence correction never binds

Two margins on the same stratified scheme: Freedman with the i.i.d. variance p(1-p), and Freedman
with the paper's long-run variance sigma^2. Failure rates against nominal eta:

| pi_H | lambda | inflation | n | eta | i.i.d. margin fails | sigma^2 margin fails | i.i.d. coverage | sigma^2 coverage |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.20 | 0.98 | 38.8 | 400 | 0.10 | 0.000 | 0.000 | 0.960 | 1.000 |
| 0.50 | 0.995 | 45.2 | 400 | 0.05 | 0.000 | 0.000 | 0.965 | 1.000 |
| 0.50 | 0.998 | 111.9 | 800 | 0.05 | 0.001 | 0.000 | 0.946 | 1.000 |
| 0.50 | 0.999 | 223.0 | 2000 | 0.05 | 0.001 | 0.000 | 0.929 | 1.000 |

The i.i.d. margin could not be broken at a variance inflation of 223, and the corrected margin is
so conservative there that realized coverage is 1.0000, meaning the interval is effectively
infinite. The dependence correction costs width and buys nothing in this model family.

**The mechanism, which is the useful part.** Stratifying by the lagged state is itself the
dependence correction. Conditioning on the state is what decorrelates the scores, so the residual
dependence within a stratum is second order and the concentration slack absorbs it.

## Finding 5. The mechanism, tested rather than asserted

Findings 3 and 4 were both measured inside the stratified scheme, so "stratification substitutes
for the correction" was a hypothesis explaining them, not a measurement. `mechanism.py` makes the
contrast the earlier runs never made: both margins, in both schemes, across the persistence range.
pi_H = 0.5, n = 800, nominal eta = 0.05, entries are the share of draws below target.

| lambda | inflation | pooled, iid margin | pooled, sigma^2 margin | stratified, iid margin |
| ---: | ---: | ---: | ---: | ---: |
| 0.00 | 1.0 | 0.001 | 0.001 | 0.000 |
| 0.80 | 1.9 | 0.006 | 0.001 | 0.000 |
| 0.95 | 5.2 | **0.074** | 0.000 | 0.000 |
| 0.99 | 23.0 | **0.266** | 0.000 | 0.000 |
| 0.995 | 45.2 | **0.336** | 0.000 | 0.000 |
| 0.998 | 111.9 | **0.413** | 0.001 | 0.001 |

Pooled with the independent margin fails, and the failure grows monotonically with the inflation,
reaching eight times the nominal rate. Pooled with the long-run variance holds everywhere. So the
correction is both necessary and sufficient for a pooled block. Stratified holds without any
correction at all. The substitution is real and it is now measured.

The spectral explanation: at high persistence both the corrector and the variance inflation are
dominated by the slow mode, whose eigenfunction is a function of the state, so conditioning on the
lagged state removes what the correction was compensating. In the two-state model there is exactly
one non-unit mode and it is the state, which is why the removal is essentially complete.

## Finding 6. Exact stratification was a degenerate case

Every earlier run used a two-state chain, where there is one non-unit mode and it *is* the state,
so stratifying removes the dependence by construction. `attack_continuous.py` repeats the contrast
on an AR(1) log-volatility model, where the state is continuous and stratification must bin.
n = 1500, nominal eta = 0.05, target is the l-step law from the realized state.

| phi | pooled inflation | bins | stratified, i.i.d. margin | stratified, sigma^2 margin |
| ---: | ---: | ---: | ---: | ---: |
| 0.90 | 6.5 | 2 | **0.240** | 0.026 |
| 0.90 | 6.5 | 5 | **0.037** | 0.000 |
| 0.90 | 6.5 | 10 | 0.001 | 0.000 |
| 0.98 | 32.2 | 2 | **0.240** | 0.000 |
| 0.98 | 32.2 | 5 | **0.091** | 0.000 |
| 0.98 | 32.2 | 10 | 0.007 | 0.000 |

Coarse stratification fails badly without the correction and the correction repairs it. So
Finding 4 was too strong: stratification substitutes for the correction only when it is fine enough
to resolve the state. (The pooled columns in that script are not a fair reading of Theorem 5,
since they use the nominal level rather than the worst-state protected one. The stratified
comparison is the clean one.)

## Finding 7. Three separable mechanisms, and thinning is the biggest

Members of a lagged-state stratum sit about M steps apart in time, so their correlation is
`phi^M`, not `phi`. Stratifying therefore does two things at once, and `attack_thinning.py`
separates them by adding an arm that thins by M with no conditioning at all. Variance inflation
over the i.i.d. baseline:

| phi | M | pooled | thinned only | stratified | ratio strat/thin |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.90 | 8 | 6.02 | 1.48 | 1.03 | 0.70 |
| 0.90 | 20 | 6.02 | 0.90 | 0.72 | 0.80 |
| 0.98 | 8 | 26.79 | 4.54 | 1.51 | 0.33 |
| 0.98 | 20 | 26.79 | 2.07 | 0.80 | 0.39 |

Three readings, all new.

**Thinning does most of the work, and conditioning does the rest.** At phi = 0.98, M = 8, thinning
alone takes 26.8 down to 4.5 and conditioning takes it from 4.5 to 1.5. At low persistence thinning
does almost everything and conditioning adds little; at high persistence conditioning is the larger
factor. The split is a function of the persistence.

**Thinning alone never reaches the i.i.d. baseline.** At phi = 0.98 even M = 40 leaves thinning at
1.81. Only conditioning gets there.

**Conditioning overshoots below the baseline.** The stratified inflation settles at 0.71 to 0.80,
under 1. That is the law of total variance: conditioning on the state removes the state-driven part
of the *marginal* variance as well as the serial dependence, so a within-stratum margin can be
smaller than an i.i.d. margin, not merely equal to it.

## Finding 8. There is an optimal granularity, set by starvation not by dependence

`attack_optimal_M.py` measures the within-stratum variance directly and uses it in the margin. The
width-minimising valid bin count is 5 at phi = 0.90 and 8 at phi = 0.98, on n = 1500. The binding
constraint at large M is not the margin size but stratum exhaustion: the rank stops existing and the
set goes vacuous on 95% of draws at M = 20. A clean `1/M^2` quantiser prediction for the residual
inflation is wrong; measured decay is about `M^{-1.2}`, consistent with the two mechanisms of
Finding 7 operating at different rates.

## Finding 9. The decomposition, derived from the spectrum

For the AR(1) log-volatility state the transition operator is Ornstein-Uhlenbeck: eigenvalues
`phi^k` with Hermite eigenfunctions. Expanding the state-measurable part of the centred coverage
indicator as `g(x) = F_x(q_p) - p = sum_k b_k He_k(x)/sqrt(k!)`, with emissions conditionally
independent given the state, everything follows without fitting:

    sigma^2_strat(M) = p(1-p)
                     - sum_k b_k^2 rho_k(M)                                  [conditioning]
                     + 2 sum_k b_k^2 (1 - rho_k(M)) E[r_k^tau] / (1 - E[r_k^tau])   [thinning]

where `rho_k(M)` is the fraction of Hermite mode k resolved by M quantile bins, computed by
quadrature, and `tau` is the return time to a stratum with `r_k = phi^k`.

**Thinning alone is exact.** For evenly spaced sampling the rate is `phi^{kM}` and the predicted
inflation matches measurement to within a few percent at every M and both persistences
(`spectral_theory.py`).

**The conditioning limit is exact.** Perfect conditioning leaves `p(1-p) - sum_k b_k^2`, which is
`0.63` in these units. Measured stratified inflation approaches `0.71` to `0.74` from above at
M = 40. This is why the stratified variance sits *below* the i.i.d. baseline: conditioning removes
the state-explained share of the marginal variance, not just the serial dependence.

## Finding 10. Stratifying is not thinning, and the gap is Jensen

The first version of the formula used `phi^{kM}` for the stratified arm and underpredicted by 30 to
40%. The reason is that stratum members do not arrive every M steps. They arrive at return times to
the bin, whose mean is M but whose distribution is badly skewed under persistence:

| phi | M | mean gap | P(gap = 1) | median gap | E[phi^tau] | phi^M |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.90 | 8 | 7.99 | 0.280 | 3 | 0.595 | 0.430 |
| 0.98 | 8 | 7.83 | **0.536** | **1** | 0.897 | 0.851 |
| 0.98 | 20 | 19.57 | 0.247 | 5 | 0.781 | 0.668 |

At phi = 0.98 with eight bins, more than half of consecutive stratum members are *adjacent in
time* and the median gap is one. Since `phi^tau` is convex in tau, Jensen gives

    E[phi^tau]  >=  phi^{E[tau]}  =  phi^M

strictly. **Stratifying costs a factor M in sample size but buys strictly less than a factor M in
decorrelation**, and the shortfall grows with persistence. Substituting the measured `E[phi^{k tau}]`
for `phi^{kM}` roughly halves the model error, to about 15% (`spectral_theory3.py`). The residual is
presumably the correlation between gap lengths and the coverage indicators themselves, which the
renewal approximation ignores.

This is a general statement about stratified calibration under dependence, not a property of this
model: any scheme that conditions on a persistent state samples that state in clusters.

## Consequence

The paper's practical proposals do not survive. Theorem 9 is dominated, and the dependence-corrected
margin never binds. What survives is the mathematics: the exact corrector identity, the long-run
variance, the spectral reading, and the observation that one Poisson solution governs both the
transient bias and the variance inflation.

The finding worth writing up is the inversion. Not "dependent calibration needs a Poisson
correction," but "stratifying on the state substitutes for the correction, and the Poisson solution
says why and by how much." That is a statement about when the correction is unnecessary, which is
more useful than a correction nobody needs.

**Superseded 2026-09-14 by Findings 6 to 8.** The substitution is conditional, not absolute, and
the mechanism is two effects rather than one. The paper is rewritten around the earlier version and
needs a second pass.

**Done 2026-09-14.** The paper is rewritten around this. Theorem 9 is cut to
Remark 11, which records why indexing the level of a pooled block is dominated. Remark 12 states
plainly that the apparent sample-size advantage over stratification is an artefact of assuming the
kernel, since minimax lower bounds for conditional conformal coverage scale as sqrt(d/n) and a
procedure estimating the same levels would pay the same price. The abstract and conclusion now lead
with the substitution.
