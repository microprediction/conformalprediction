# Referee report, 2026-09-13: the central result does not hold

**Status: withdrawn from the site. Do not circulate this version as a theorem paper.**
The PDF is still in this directory and still reachable at its URL, but nothing on the site links
it and the landing page has been removed. The claim "exact validity forces uniform pooling" should
be withdrawn rather than softened.

## The blocking errors

**1. The total-variation estimation rate in (2) is impossible.** The estimator
`mu_hat_w = sum_i w_i delta_{R_i}` is finitely supported. If `mu_{x_0}` is nonatomic, take
`A = {R_1, ..., R_n}`. Then almost surely `mu_hat_w(A) = 1` and `mu_{x_0}(A) = 0`, so
`d_TV(mu_hat_w, mu_{x_0}) = 1` for every n and every bandwidth. The displayed rate
`E d_TV ~ n^{-s/(2s+d)}` cannot hold. What the argument actually bounds is the bias of the mean
measure, `d_TV(E[mu_hat_w | X], mu_{x_0})`, which is a different object. There is also a
bias-variance mismatch: the stated variance is `1/(n h^d)` but the unsquared risk follows from
balancing `h^s` against `1/sqrt(n h^d)`.

**2. Lemma 1 is false, with an explicit counterexample.** The cited theorem of Barber, Candes,
Ramdas and Tibshirani charges `d_TV(R(Z), R(Z^i))`, the distance between the whole residual vector
and its transposed version. It does not reduce to `d_TV(mu_{X_i}, mu_{x_0})`.

Take n = 1, alpha = 1/2, equal weights, `R_1 ~ N(0,1)`, `R_0 ~ N(1,1)`. Then

| quantity | value |
| --- | --- |
| actual coverage `P(R_0 <= R_1)` | 0.23975 |
| the note's Lemma 1 lower bound | 0.30854 |
| the correct Barber bound | 0.23975 (sharp) |

The claimed bound exceeds the truth, so the lemma fails outright. Verified numerically.

**3. Proposition 2 is algebraically backwards.** A lower bound `coverage >= 1 - alpha - D` does not
imply that attaining `1 - alpha` requires `D = 0`; a sufficient bound need not be necessary. Worse,
`D = sum_i w_i d_TV(mu_{X_i}, mu_{x_0})` vanishes exactly when every positively weighted point has
`mu_{X_i} = mu_{x_0}`. Making the weights constant across points with different residual laws does
not zero D, it gives those positive distances positive weight. Uniform pooling generally increases
the discrepancy. The proposition states close to the opposite of what its own formula says.

**4. The proof switches between conditional and marginal validity.** Conditional on the covariates,
heterogeneous residuals are not exchangeable and uniform pooling is not exactly valid. Marginally
over iid covariates the pairs are exchangeable and ordinary conformal is exactly valid. The argument
uses the conditional laws to penalize localization and then invokes unconditional exchangeability to
declare pooling exact. The right side of (3) is random unless the probability is conditional on all
covariates, and once that conditioning is stated the claimed exactness of pooling disappears. This is
the conceptual source of error 3.

**5. Theorem 3 fails independently of the above.** Assumption 1 gives only an upper bound, so the
localization term is O(h^s) and not Theta(h^s). Global heterogeneity does not imply variation near
`x_0`. Heterogeneity does not lower-bound the bias of a pooled mixture, since different conditional
laws can mix exactly to `mu_{x_0}`. A coverage-gap upper bound cannot establish undercoverage; the
procedure may overcover. Both the bias bound and the coverage bound increase with h, so there is no
tradeoff of the claimed form. The "product of the two deficits" is never defined. The small-m claims
extrapolate a large-m rate into a regime where it exceeds the maximum possible TV loss. "Well below a
thousand" has no constants, design assumptions or experiments behind it.

**6. The headline claim is already refuted in the literature.** Guan, *Localized Conformal
Prediction*, uses test-centred weights and retains finite-sample marginal validity by adjusting the
quantile level, with randomized variants attaining exact coverage; it also shows that using the
nominal level naively can fail badly, which is the defensible kernel of this note. Lei and Wasserman,
*Distribution Free Prediction Bands*, combine nonparametric conditional density estimation with
finite-sample conformal validity and minimax oracle-band convergence. Together these refute the prose
claim that local conditional estimation and an exact marginal conformal wrapper are inherently
incompatible.

## What is salvageable

One true and much narrower statement: a naive test-centred weighted residual quantile, used at the
nominal conformal level without symmetrization or level adjustment, generally loses exact marginal
rank validity.

Rebuild around conditional CDF loss rather than TV,

    sup_t |F_hat_h(t | x_0) - F_{x_0}(t)| = O_p(h^s + n_eff^{-1/2}),

and separate three constructions: naive local weighting, efficient but not exactly marginally valid;
adjusted or symmetrized localized conformal, exactly valid but possibly conservative at small
effective sample size; and global conformal with locally adaptive scores, exactly valid without
pretending the pooled empirical law estimates `mu_{x_0}`. Sections 2 to 4 need replacing, not
patching, and Guan and Lei-Wasserman need adding.

## Note on the other stranded papers

The same conditional-versus-marginal switch is the failure mode here, so `frozen-floor`,
`honest-sharpness` and `poisson-conformal` should each be proof-checked before any of them is
published or linked. `honest-sharpness` opens by distinguishing the two explicitly, which is a good
sign, but that is not a check.
