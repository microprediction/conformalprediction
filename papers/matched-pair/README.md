# The matched pair: two worlds split conformal cannot tell apart

Working notes, 2026-08-20. Not a paper yet.

## The construction

Fix nu. Two data-generating processes for the residual R:

- **World A.** R independent of X, R ~ t_nu.
- **World B.** sigma^2(X) ~ InvGamma(nu/2, nu/2), R = sigma(X) * eps with eps ~ N(0,1).
  Marginally R ~ t_nu, by the scale-mixture representation of the t.

The pooled residual law is **identical**, so the calibration scores, the conformal
quantile q-hat, the prediction sets and the marginal coverage are identical in law.
Split conformal has no output that distinguishes the two worlds.

The information gap is 0 in World A and, in World B,

    I(R;X) = h(t_nu) - (1/2)[log(nu/2) - psi(nu/2)] - (1/2)log(2 pi e)

using h(N(0,s^2)) = log s + (1/2)log(2 pi e) and E[log sigma^2] = log(nu/2) - psi(nu/2).

## Verified numerically

`verify_gap_closed_form.py` checks the closed form against numerical integration of
h(t_nu) and against Monte Carlo estimation of E[log r(R|X) - log rbar(R)].
Agreement to six decimals / within MC standard error for nu in [2.5, 100].

    nu     gap (nats)
    2.5    0.2035
    3      0.1701
    5      0.1020
    8      0.0635
    30     0.0168

`verify_matched_pair.py` checks that conformal cannot see the difference: with nu=3,
n=500, alpha=0.10, the q-hat laws are statistically indistinguishable and marginal
coverage is 0.90 in both worlds, while conditional coverage has sd 0.013 in World A
and 0.147 in World B, 5th-95th percentile [0.567, 1.000].

## Why it matters

It is the constructive twin of the orthogonality remark. That remark says coverage
*cannot* constrain the log score. This exhibits two processes where it does not, with
the loss in closed form and one parameter controlling it.

nu = 3 is a realistic tail index for daily financial returns, and 0.17 nats is roughly
four times the E-vs-D0 margin measured in the transform-grammar campaign.

## Where it goes next

1. Pure scale mixtures: the normalized score |y - muhat|/sigmahat closes the gap
   completely, so plain split conformal pays I(R;X) for nothing. Theorem-shaped.
2. Shape mixtures, R | X ~ t_{nu(X)}: no affine rung helps, so only a full monotone
   transform homogenizes. This is the regime that would separate the gaussianize
   operator from a self-normalizing scale rung, which the FRED ablation could not do
   because economic series vary mostly in scale.
