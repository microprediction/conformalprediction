# Status: adjudicated 2026-09-13. Highest ceiling, most work.

**Verdict: most original of the four, less mature. Develop seriously. Not yet linked from the site.**

Ranked second for present publishability and first for intellectual upside, because it advances the
constructive programme, extracting operational residual corrections from dynamics, rather than
restating a limitation of conformal prediction.

## What checks out

The identity `P^l (H_q - F(q)) = (P^l - P^{l+1}) chi_q` is exact. The additive-functional martingale
decomposition is correct, the long-run variance `sigma^2(q) = pi[chi_q^2 - (P chi_q)^2]` is correct,
the reversible spectral formulas are correct, and the discrete-to-continuous Poisson and cell-problem
limit is correct. The bundled scripts reproduce these identities and the two-state calculation.

The attractive insight is genuine: one potential `chi_q` describes both the surviving current-state
information and the effective-sample-size loss caused by persistence. The nearest current work
separates test-side transport from calibration dependence, or gets Markov mixing bounds, but does not
appear to formulate this through a shared Poisson potential. Treat that as plausibly novel rather
than an established priority claim.

## Where it stops short of its own contribution

Theorem 1 is elegant but is essentially standard Poisson-equation algebra. Theorem 5 is a useful
honest bound but uses worst-case `u*`, `B`, `V` rather than the advertised observed-state correction.
The state-adaptive procedure that would be the real result is only sketched, and Section 12 concedes
that the proposed transform is dynamic PIT recalibration rather than an honest conformal procedure.

**To make this the best paper:** prove a state-adaptive Theorem 5 with an estimable lower confidence
envelope for `b_{l,W_n}(q) = (P^l - P^{l+1}) chi_q(W_n)`, then show it beats the worst-state
correction while keeping the claimed honesty probability.

## Technical repairs

1. Use the filtering distribution consistently when `W_n` is latent.
2. Ensure the defining property holds at the infimum `u*`, or use `u* + epsilon`.
3. Add the regularity needed for the differentiated Bahadur expansion.
4. Restrict Proposition 2 to finite or pure-point spectrum, or state it with spectral measures.
5. Ramos et al. and Dai et al. years corrected from 2024 to 2026. **Done 2026-09-13.**
