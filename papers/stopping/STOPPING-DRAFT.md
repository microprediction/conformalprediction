# The Price of Eschewing Smoothness and Stopping Early: A Theoretical and Empirical Analysis of Conformal Methods

*(working title, fixed by the author; previous working name "The Floor and the
Stop". The two prices in the title are the paper's two halves: eschewing
smoothness is §2–3, the floor and the theorem that protects it; stopping early is
§1 and §4, the count and the measured cost.)*

**Working draft, restructured 2026-08-25.** Four components, weighted deliberately:
the smoothness theorem is the paper's theoretical centre; the information-gap
identity is a proposition, stated and used, not belaboured; the count and the price
are the empirical core. Everything else is citation.

---

## The argument in one paragraph

Of 686 arXiv papers with "conformal prediction" in the title, 599 stop at the
empirical residual map, and one composes a model after it. We price that convention
on real series with the strongest online forecaster in our benchmark: stopping costs
0.44 nats of held-out log-likelihood, three times the cost of the pooling constraint
that the coverage guarantee actually requires (0.14, an empirical instance of the
information-gap identity). The natural repairs do not exist: adaptivity in time
recovers 0.075 of the 0.58, and the smoothness theorem shows that adaptivity in
state — local residual smoothing — is incompatible with exact distribution-free
validity, with the incompatibility maximal precisely where smoothing would help
most. Coverage cannot report any of this; the arm that loses the most information
has the best-looking calibration. The conclusion is not a better calibrator. Keep
the map, keep the certificate, and keep modelling past it.

---

## 1. The count (empirical, new)

686 arXiv papers with "conformal prediction" in the title, classified by what they
do to the fence-post empirical map `Eₙ`:

| move | what it does to `Eₙ` | n |
| --- | --- | --- |
| **stop** | quotes its output as the answer | **599** |
| consume | uses it downstream of something else | 38 |
| tune the level | keeps it, adapts α (ACI, conformal PID) | 28 |
| replace or reweight | swaps in a conditional estimate (SPCI, ResCP, LCP, HopCPT) | 16 |
| **compose after** | keeps it AND fits a model on its output | **1 candidate** |

The field already attacks the pooled quantile — SPCI, ResCP, LCP — and every attack
**replaces** the map. None keeps it and continues. The refutation criterion is
falsifiable and stated: retain the empirical rank transform, apply it to residuals,
fit a downstream model on the transformed stream. Reweighting does not count;
conditioning upstream does not count; adapting α does not count. Outside the
conformal banner the move is routine (normal quantile transform, meta-Gaussian
forecasting, copula time series), which makes this a fact about a community's habit,
not about the difficulty of the idea.

**The second count, for the title's other price.** Classified on the pooling axis
— where SMOOTH means test-point-dependent weights on the *calibration residuals*,
not a smooth score, which is a richer `A(x,·)` and still pooled — **646 of 686
(94%) never depart from residual pooling at any granularity**: 586 pool outright,
60 stratify (coarser granularity, still pooling, still exact). 40 depart, and §3
says each forfeits exact validity by doing so. **All nine SMOOTH-with-exact-claim papers were read in full, and none overclaims.**
Their claims resolve into exactly the trichotomy the theorem predicts: marginal
validity restored by recalibration or design (Guan's LCP, Hore & Barber's calLCP,
GraphLCP, network invariant selectors), a stated bound-with-gap (DS-CP), the known
covariate-shift tilt (weighted survival CP), or finite-sample local bounds bought by
assuming the smoothness class and giving up distribution-freeness
(Conrad–Moulines–Samsonov). Two were screen false positives — learned-score and
leverage-weighted CP smooth the *score*, which is a richer `A(x,·)` and still
pooled — so the corrected count is **648 of 686 (94.5%)**. Hore & Barber state the
boundary in the community's own words: for local coverage "there are no known
distribution-free theoretical results to guarantee this." The field's best
localization papers already respect the line the theorem draws; the theorem
explains why the line is where it is and prices crossing it.

*Open: abstract-based classification; full-text checks at 1 of 686 for COMPOSE; the SMOOTH-with-exact-claim cell is fully checked (9 of 9); the four near-misses need their placing
sentences quoted; conformal training not yet placed.*

## 2. The floor (proposition, classical in spirit, stated because it is used)

One pooled residual law costs exactly `I(R;X)` in expected log score — the
information-gap identity (*Marginally Useful*), extended in `frozen-floor` to
`I(W;X|κ)` for any frozen monotone reshaping of a stratum-pooled empirical law,
which every conformal scheme is. The companion proposition is the operative fact:
**no calibration choice — estimator, quantile convention, randomization, level —
reduces the excess below the floor.** Only the representation moves it.

Borderline classical, and that is its role here: it is the *reason* the price in §4
cannot be tuned away, not the paper's discovery. A proposition with a short proof,
cited lineage, and no fanfare. One remark from `frozen-floor` does belong in the
text, because it is the argument in a sentence: the floor is zero exactly when the
design is conditionally sufficient — when the modeling was already finished — and
conformal calibration is deployed precisely when one is unwilling to assume that.
"The method's stated reason for existing is its lower bound."

(`frontier`, though withdrawn from submission, remains the citable empirical home of
`I(R;X)` as SSRN 7220538, and `frozen-floor` cites it as such.)

## 3. The smoothness theorem (theoretical centre)

`smoothing-validity`. Assume only that the residual law varies Hölder-smoothly with
the input (in total variation) and is not input-free. Then:

**Theorem (small-sample separation).** No weighted residual predictor attains both
(a) exact distribution-free coverage for every law in the class and (b) the minimax
estimation rate for the local residual law, unless the sample is unbounded or the
residual law is input-free.

**Proposition (exact validity forces uniform pooling).** Exact validity for every
law in the class forces the localization term to zero: constant weights across
calibration points. Pooling is not an implementation choice. It is the guarantee.

**Corollary (the scarce-data regime).** The separation is monotone in effective
sample size and **maximal as m → 0**: where local smoothing most improves the
estimate is exactly where the exactly-valid predictor pays its full heterogeneity
constant.

This is the paper's theoretical teeth, for three reasons. First, it converts §2 from
an identity about one architecture into an impossibility about the whole repair
strategy: the floor cannot be undercut by smoothing without surrendering exactness.
Second, its assumptions are the mildest in the area — smoothness and heterogeneity,
nothing about shapes or rates. Third, the corollary inverts the field's intuition:
conformal's selling point is small samples, and small samples are where the
separation bites hardest.

**The fourth escape, also closed.** Refining the stratification toward sufficiency
(Vovk's universally consistent predictive systems) genuinely drives the floor to
zero — but the frozen-design assumption forbids the labels from steering the
refinement, so the scheme is a label-blind regressogram, minimax-suboptimal wherever
adaptation would help (`frozen-floor`, Corollary "Regressogram handicap"). Consistency
is real; efficiency is not.

Two scope conditions, stated because a referee will look for them. Known,
fixed covariate-shift tilts (Tibshirani et al. 2019) escape the uniform-pooling
proposition; the theorem concerns test-centred weights learned from position. And the
honest-sharpness inflation bound attaches **only to the fixed-point guarantee**:
`honest-sharpness` itself is explicit that marginal validity is compatible with
minimax-rate sharpness (Lei & Wasserman construct such bands), so it must never be
cited as "honesty forces inflation" without the local qualifier. Its machinery is
classical (Li 1989; Low 1997; Cai & Low 2004), re-targeted at prediction sets; the
mechanism is Le Cam testing power, not exchangeability.

Under dependence, the coverage error admits an exact Poisson-equation corrector
(`poisson-conformal`) — constructive, and information-neutral: it moves the threshold
to the right place and recovers nothing excluded by the representation.

## 4. The price (empirical, new)

The missing move from §1, implemented, on the strongest base available: `laplace`,
a likelihood-weighted pool over ~60 transform chains with multi-scale, GPD tail
splice, online PIT resolution. One empirical object — a 41-node quantile grid of the
base model's own recent residuals, KDE-smoothed. One thing varied: **position**.

212 FRED change series, ctx=1024, 12 rolling origins per series, h ∈ {1, 6, 12}.
Paired bootstrap clustered by series; win/draw/loss by per-series Diebold–Mariano.
Recency-weighted variants in both positions. iid control in three laws.

### 4.1 The decomposition

| | pooled shape | stops | cost, net of estimation |
| --- | --- | --- | --- |
| unconstrained | no | no | — |
| compose after | **yes** | no | **0.14 nats** |
| stop | **yes** | **yes** | **0.58 nats** |

The mapping to §2 must be stated carefully, because the two arms sit on opposite
sides of the theorem. The **stop** arm is a genuine frozen conformal object
(location score, one stratum), so the floor theorem applies to it and its floor is
the plain residual gap `I(R;X)`. The **compose-after** arm is *not* a conformal
scheme: its design is not frozen and it carries no certificate. It is exactly the
one move the floor proposition permits — a change of representation, `frozen-floor`'s
"ordinary conditional modeling", done after the map instead of before it. So the
0.44 gap between the arms is a *measured lower bound on how much of `I(R;X)` a
richer representation recovers*, and the 0.14 is the residual gap of that richer
representation plus its estimation cost — not the floor itself. **Three quarters of
the stop arm's information loss was never floor at all.** No theorem defends paying
it; §1 says 599 of 686 papers do.

### 4.2 CRPS flips sign across the position line

| arm | logpdf | ncrps |
| --- | --- | --- |
| stop, w=250 | −1.087 | −1.4% |
| stop, w=400 | −0.846 | **+4.9%** |
| stop, w=750 | −1.003 | **+4.9%** |
| **compose after, w=400** | **−0.268** | **−7.0%** |
| **compose after, adaptive** | **−0.275** | **−8.1%** |

Placed last, the empirical law makes CRPS ~5% worse than the parametric leaf it
replaced; placed early, 7–8% better. The strongest form of the claim, on the metric
conformal practice trusts most.

### 4.3 The adaptive reply, priced

Stop, flat: −0.846. Stop, adaptive (ewma half-life 150): −0.771. Compose after:
−0.268. **Adaptivity in time recovers 0.075; position recovers 0.58.**

Two theory notes sharpen this. Recency weights are non-uniform across calibration
points, so by §3's proposition the adaptive arm has *already surrendered exact
validity* — its guarantee is approximate with a gap of the weighted total-variation
order (Barber et al. 2023). It pays the exactness price and still recovers an order
of magnitude less than position. And level adaptation (ACI) is dispatched by the
floor proposition directly: "level adaptation and fold averaging are calibration
operations; the floor is a design quantity" (`frozen-floor`).

### 4.4 The control

On iid series (pooling correct, nothing to lose): stop still loses 0.20–0.27,
compose-after 0.06–0.13, the state-corrected reference ~0. So a third of the raw gap
is estimation cost — 41 empirical quantiles against a parametric scale — and the
headline must be the net numbers, which is what §4.1 reports. Belongs in the
abstract, not a footnote.

### 4.5 The certificate is blind to all of it

cov80, same rows: unconstrained 0.782 marginal; stop 0.819; compose-after 0.810 —
with the same conditional spread (~0.08) across volatility regimes. **The arm losing
0.85 nats has the best-looking coverage.** Conformal is not miscalibrated here, and
no claim of miscalibration should be made. `frozen-floor` states the reason in
advance: "the certificate is a statement about the marginal rank of the test score;
the floor is a statement about the conditional information the frozen score
discards. The two live on different axes." This table is that claim, verified: we
measured the axis the certificate lives on and it registered nothing.

---

## Conclusion

Everyone stops (§1). Stopping costs three times more than the guarantee's own
constraint (§4). The floor beneath the constraint is an identity (§2), and it cannot
be undercut by local smoothing without giving up exactness, least of all in the
small-sample regime that motivates conformal in the first place (§3). The
recommendation is not a better calibrator: keep the map, keep the certificate where
it is wanted, and keep modelling past it.

## What would sink it

- Survey classification is abstract-based (1 of 686 full-text checked).
- One base model, one corpus, plus an iid control.
- The compose-after arm has no coverage guarantee — that is the point, but it must
  never be sold as a better conformal method.
- Four theory sources have four assumption sets; the joint story must state their
  intersection explicitly.

## Reproduction

`python surrogate/bench/studies.py conformal` · `fill.sh conformal_null` first, then
`fill.sh conformal`. Rows tagged `forecast:CONF:ctx1024:<version>+<sha>/m6+<hash>`;
the hash covers harness sources, tracked diff and the compiled core.
