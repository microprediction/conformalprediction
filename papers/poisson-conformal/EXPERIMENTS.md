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

## Consequence

The paper's practical proposals do not survive. Theorem 9 is dominated, and the dependence-corrected
margin never binds. What survives is the mathematics: the exact corrector identity, the long-run
variance, the spectral reading, and the observation that one Poisson solution governs both the
transient bias and the variance inflation.

The finding worth writing up is the inversion. Not "dependent calibration needs a Poisson
correction," but "stratifying on the state substitutes for the correction, and the Poisson solution
says why and by how much." That is a statement about when the correction is unnecessary, which is
more useful than a correction nobody needs.

**Done 2026-09-14.** The paper is rewritten around this. Theorem 9 is cut to
Remark 11, which records why indexing the level of a pooled block is dominated. Remark 12 states
plainly that the apparent sample-size advantage over stratification is an artefact of assuming the
kernel, since minimax lower bounds for conditional conformal coverage scale as sqrt(d/n) and a
procedure estimating the same levels would pay the same price. The abstract and conclusion now lead
with the substitution.
