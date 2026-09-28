# Prior art for the in-expectation price, swept 2026-09-27

One agent, web search, with PDFs extracted where marked. "Verified" means read from the paper's
own text. Everything else is from an abstract, a search listing or an automated summary and should
be re-read before it is cited.

## Verdict

The rate `n^{-s/(s+d)}` for the expected excess width of a pointwise prediction threshold under
in-expectation coverage was NOT found in print. But the lower bound is close to a corollary.

What is already published:

- **The inequality.** `(E_P X - E_Q X)^2 <= chi^2(Q,P) Var_P(X)` is Lemma 2.1 / eq. (4) of
  Derumigny and Schmidt-Hieber (2023). Cite it. Do not present it as a device.
- **The trade-off.** Their Theorem 3.1(i), Gaussian white noise, `d = 1`, Holder ball:
  `sup|Bias|^{1/beta} * sup Var >= gamma / n`. Put `Var <= B / kappa` in and get
  `B >= c n^{-beta/(beta+1)}`. Low (1995) Theorem 2 is the exact version in terms of the modulus.
- **The arithmetic.** Calonico, Cattaneo, Farrell (2022) say the coverage-optimal bandwidth
  "balances the variance and bias of the point estimator, instead of the squared bias", and their
  minimax coverage-error exponent matches ours at `d = 1`. That is for confidence intervals for the
  regression function, coverage error not width, Wald-type intervals only.

What was not found, so is ours to claim if the proofs hold:

1. The lemma that in-expectation coverage plus curvature of `F` forces
   `E[T] - q >= kappa E[(T - q)^2]`, as a constraint in a nonparametric class. Parametric
   ancestors to check: Barndorff-Nielsen and Cox (1996), Beran (1990).
2. The application to prediction sets.
3. Random design, general `F_theta`, `d > 1`, and the constant `L^{d/(s+d)}`.
4. The price list: each guarantee with its width cost under smoothness. Lei-Wasserman, Barber et
   al. and Gibbs et al. lay out the hierarchy without prices.

## The framing a referee will expect

Beta-expectation versus beta-content tolerance intervals (Wilks 1941, Paulson 1943, Guttman 1970).
That is in-expectation versus high-probability in the parametric case, with width costs `1/n`
against `n^{-1/2}`. The candidate is the nonparametric-regression version of that old distinction.
Not verified online; from the agent's memory.

## Sources

| Source | What it proves | Difference | Verified |
| --- | --- | --- | --- |
| Derumigny, Schmidt-Hieber (2023), Ann. Stat. 51(4), arXiv:2006.00278 | change-of-expectation inequalities; Thm 3.1 bias-variance lower bound | no coverage or prediction-set application | yes |
| Low (1995), Ann. Stat. 23(3), 824-835 | exact minimal variance under a bias bound, via the modulus | estimation only | restated in D-SH only |
| Calonico, Cattaneo, Farrell (2022), Bernoulli 28(4), arXiv:1808.01398 | coverage error `max{(nh)^{-1}, n h^{1+2z}, h^z}`; minimax coverage-error rate | confidence intervals, coverage error, Wald class | yes |
| Lei, Wasserman (2014), JRSS-B 76(1) | Lemma 1 impossibility; minimax rate for symmetric difference to the oracle band | estimation loss, `s/(2s+d)` type | yes |
| Gyorfi, Walk (2019/2020) | `E|cond. coverage - (1-alpha)|` rate for kNN conformal | absolute deviation, no lower bound | yes (report) |
| Conrad et al. (2026), arXiv:2608.06206 | high-probability bounds for localized conformal | no lower bound | summary |
| Min, Peng, Zou (2026), arXiv:2605.11602 | conditional miscoverage table, LCP/RLCP | upper bounds | summary |
| Barber et al. (2021), arXiv:1903.04684 | distribution-free conditional limits | no smoothness | summary |
| Hore, Barber (2025), arXiv:2310.07850 | randomized local weights | no width rate | summary |
| Armstrong, Kolesar (2018), arXiv:1511.06028 | optimal one-sided CIs over convex classes | high-probability coverage of a parameter | snippets |

## A preprint reporting a different exponent

Halkiewicz (2026), arXiv:2605.08422, Theorem 4, gives `T^{-beta/(2beta+1)}` for the coverage error
of rolling-origin conformal under Holder drift, with coverage averaged over calibration data. The
analogue of the present result would be `T^{-beta/(beta+1)}`. The two settings differ and we have
not worked through that paper. To be read before this note is circulated.

Also: D-SH Theorem 4.1 on support-boundary recovery has the same exponent `beta/(beta+1)`. Expect
to be asked whether the two are connected.
