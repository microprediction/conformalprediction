# Status: adjudicated 2026-09-13. State-adaptive theorem added, repairs done.

**Verdict: most original of the four. Still not linked from the site.**

Ranked second for present publishability and first for intellectual upside, because it advances the
constructive programme, extracting operational residual corrections from dynamics, rather than
restating a limitation of conformal prediction.

## What checks out

The identity `P^l (H_q - F(q)) = (P^l - P^{l+1}) chi_q` is exact. The additive-functional martingale
decomposition is correct, the long-run variance `sigma^2(q) = pi[chi_q^2 - (P chi_q)^2]` is correct,
the reversible spectral formulas are correct, and the discrete-to-continuous cell-problem limit is
correct. The bundled scripts reproduce these to machine precision.

The insight is genuine: one potential `chi_q` describes both the surviving current-state information
and the effective-sample-size loss from persistence. The nearest current work separates test-side
transport from calibration dependence, or gets Markov mixing bounds, but does not appear to
formulate this through a shared Poisson potential. Treat that as plausibly novel, not an established
priority claim.

## The missing theorem: WRITTEN 2026-09-13

The adjudication's main complaint was that Theorem 5 protects against the worst state rather than
the observed one, so the state corrector the paper builds is never actually used. New Section 10.1
adds it.

**Theorem 9 (state-adaptive honest correction).** With `W_n` observed and a finite state space of
size M, define the state-specific level `u*(w)` by dropping the infimum over states from `u*`. Apply
Freedman at each of the M levels with failure probability `eta/M` and union bound. The resulting
event does not depend on which state is realized, which is what makes the random rank admissible.
Then the data-dependent rank `k(W_n) = floor(n(u*(W_n) + delta_{n,eta/M})) + 1` keeps the same
class-uniform honesty guarantee at level `1 - eta`, and is never larger than the worst-case rank.

Corollary 10 gives the condition for strict improvement: `u* - u*(w) > delta_{n,eta/M} -
delta_{n,eta}`, the right side being `O(sqrt(V log M / n))` against a constant on the left, so
adapting wins off the worst state once `n >~ V log M / (u* - u*(w))^2`.

**Verified on the two-state model** by `state_adaptive.py`, which reproduces the paper's own
illustration first: `u*(L) = 0.9000`, `u*(H) = u* = 0.9724`. The low state needs no correction at
all. In threshold units the adaptive procedure calibrates at 1.000 against the worst case's 1.774,
a 44% narrower set, in the state the chain occupies 80% of the time. Crossover near n = 55.
Simulated failure rates at eta = 0.10 are 0.000 adaptive and 0.000 to 0.002 worst-case, both inside
nominal, Freedman being conservative.

The sharpest version: at n = 1000 the worst-case level exceeds one, so its set is vacuous, while the
adaptive set is finite. Adapting is what makes the guarantee usable at that sample size.

## The five technical repairs: ALL DONE 2026-09-13

1. **Filtering distribution when `W_n` is latent.** New Remark 11 states plainly that Theorem 9 does
   not apply, since indexing by a point of the simplex puts the union bound over a continuum, and
   gives the two honest options: index by the support of the filter, or pre-partition the simplex
   into cells and pay `log(cells)`.
2. **Infimum attainment.** New Assumption 8 requires the defining property to hold at `u*(w)`, notes
   it follows from right continuity, and gives the `u*(w) + epsilon` substitution otherwise. Applied
   to `u*` in Theorem 5 as well.
3. **Regularity for the differentiated Bahadur expansion.** The expansion differentiates the
   corrector in the threshold, which the cited representation does not supply. Added: uniform
   continuous differentiability of `q -> b_{l,w}(q)` near `q_p`, continuous differentiability of `F`
   with `f` bounded away from zero, and consistency of the order statistic, with the note that for a
   finite chain the first reduces to smoothness of each `F_w`.
4. **Proposition 2 spectrum.** Restricted to pure-point spectrum with an `L^2_0(pi)` eigenbasis,
   with the continuous-spectrum case handled by replacing sums with spectral-measure integrals.
5. **Citation years.** Ramos et al. and Dai et al. corrected from 2024 to 2026.

Also fixed a pre-existing duplicate `eq:omega` label. The paper builds clean with no warnings.

## What is still open

The state-adaptive theorem is state-adaptive but not model-adaptive. The map `w -> u*(w)` remains a
class constant computed before seeing data. If `P`, `F` and `chi` are estimated from the same
calibration block, finite-sample validity is not automatic, and the paper says so. Closing that gap
is the next piece of work, and it needs either deterministic uniform class bounds, a simultaneous
confidence set for the dynamics, or a separate estimation block.
