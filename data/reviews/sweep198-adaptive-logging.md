<!-- Prior-art sweep for issue #198, 2026-10-04. Quotes were checked against the downloaded PDFs, which are not stored here; page numbers are PDF page indices. File names below refer to the working folder of the sweep. -->

# Prior-art sweep: arXiv 2609.30811 (issue #198)

"Counterfactual Online Conformal Prediction Under Adaptive Logging", Qiao, Lin, Ji, Wang, Yao (SJTU / Alibaba), v1 25 Sep 2026, NeurIPS 2026 style file. 29 pp.

Files in this directory: `paper.pdf` / `plain.txt` (v1; note that the first download came back truncated, so re-fetch from `/pdf/2609.30811v1` if it fails to open), `src/` (LaTeX source), prior-art PDFs `<arxiv-id>.pdf/.txt`, `pg.py` (page-located grep), `sim2.py` / `sim2.out` (check simulation, below).

All quotes below were grepped from the downloaded PDFs. Page numbers are PDF page indices.

---

## (a) Exact claims

**Setup (Sec. 2, p2).** Finite actions, |A| = K. Each round: X_t is revealed. The learner outputs one set per action, C_t(a) = {y : s(X_t,y;a) <= q̂_t(a)}. **The threshold q̂_t(a) depends on the action only, not on x.** Then a_t ~ π_t(·|X_t,H_{t-1}) is drawn and only Y_t(a_t) is revealed.
- Assumption 2.1: sequential ignorability. Assumption 2.2: positivity, π_t >= π_min > 0. Remark 2.3: the regime π_min → 0 (UCB, Thompson without forced exploration) "is excluded".
- Targets (Def. 2.4): MCov_T (realized played-action coverage), ACov_T(a) (coverage on the rounds where a was played), and **CCov_T(a) = (1/T) Σ_t 1{Y_t(a) ∈ C_t(a)}**, which averages over the *marginal* context law.
- Endogeneity coefficient (Def. 2.5, p3): ρ = sup_x max_{a≠a'} TV(P(·|x,a), P(·|x,a')). Claim: "The case ρ = 0 recovers exchangeable online CP."

**Thm 3.1 (p3).** This is ACI's pathwise bound |MCov_T − (1−α)| <= (max{α_1,1−α_1}+γ)/(γT), credited to Gibbs–Candès [9].

**Thm 3.2 (p4), the impossibility result.** There exists a two-context, two-action Gaussian instance with endogeneity ρ on which any per-action threshold sequence that tracks the logged quantile q_a^log has E max_a |CCov_T(a) − (1−α)| >= c(α)ρ − L ε_T.
- Proof (App. D.2, p17–18): X uniform on {L,H}, π(0|L) = π(1|H) = 3/4, and Y(a) ~ N(5, 1 or r²) with variance swapped across contexts. The score is |y−5|.
- The gap comes from the logged mix of contexts for arm 0 (3/4, 1/4) versus the marginal mix (1/2, 1/2): F_log = ¾F(q)+¼F(q/r) and F_cf = ½F(q)+½F(q/r).

**PW-OCP (Alg. 1, eq. 13, p4–5).** Per-arm ACI recursion α_{t+1}(a) = α_t(a) + γ(α − Z_t(a)), with Z_t(a) = 1{a_t=a}/π_t · 1{Y_t ∉ C_t(a)}. The threshold is the empirical quantile of the logged scores for arm a. Lemma 4.2: the signal is unbiased (Horvitz–Thompson).

**DR-OCP (Def. 4.3, eq. 15, p5–6).** Z^DR = μ̂ + 1{a_t=a}/π̂ · (1{miss} − μ̂).

**Thm 5.1 (p6).** max_a |CCov_T(a) − (1−α)| = O(√(log(KT/δ)/(T π_min))) with γ* ≍ √(π_min/T).

**Thm 5.2.** DR bound with a product term ε_μ ε_π / π̂_min. Remark 5.3: the bound is conditional on the realized nuisance errors, with no cross-fitting rate.

**Thm 5.4 (p7).** Lower bound c(α) min{1, √(log K/(T π_min))} over "context-free Gaussian potential-outcome instances with fixed logging policies". Corollary 5.5: "PW-OCP is therefore minimax-optimal within the predictable score-threshold class."

**App. C.** Sharpness rate (T π_min)^{−1/4} under stationarity (Thm C.3). Coverage–regret trade-off (Thm C.4). Regret decomposition (Thm C.5); its bound contains linear terms αBT and εTΔ_max.

**Experiments (Sec. 6, App. F).** α = 0.1, T = 20,000, 10 seeds.
- Synthetic: mean shift, where **the score is |y| and ignores context** (App. F.1, p26); variance shift with score |y−μ̂(x,a)|; multi-arm with K contexts; propensity misspecification.
- Semi-synthetic Open Bandit (four aggregated contexts, Gaussian potential outcomes from estimated click rates) and DJIA with momentum logging.
- Table 1, mean shift: ACI 0.252, Online COPP 0.027, PW-OCP 0.017, DR-OCP 0.018.
- Table 1, real data: ACI 0.023/0.025/0.024 vs PW-OCP 0.023/0.028/0.019. **ACI is as good as PW-OCP on the real data.**
- Regret vs ACI: Online COPP +94.9%, PW-OCP +91.1%, DR-OCP +93.5%.
- Fig. 4 (p28): logged MCov is **0.992 for PW-OCP and 0.995 for Oracle** on the mean shift, against a 0.90 target.

---

## (b) Candidate points

### 1. The failure is covariate shift in X | a. ρ is the wrong index. **Verdict: NEW as a critique of this paper; the underlying fact is ALREADY IN PRINT.**

The paper attributes the gap to "action-induced shift in the outcome law" (ρ). Its own construction tells a different story. The gap comes from the logger making the context mix on arm a's rounds differ from the marginal context law, combined with a threshold that ignores x on a score whose law varies with x.

Consequences:
- **Gap at ρ = 0.** Take the D.2 instance but give both arms the same law in each context: Y(0), Y(1) ~ N(5,1) in L and N(5,(1+Δ)²) in H. The logger is unchanged. Then ρ = 0 exactly and the logged and counterfactual CDFs are the same mixtures as in D.2, so the gap is identical. Our `sim2.py` (T = 20,000, Δ = 2, ε-greedy 0.05) gives a per-arm logged-quantile CCov gap of **0.235 at ρ = 0**, the same as the 0.235 at ρ > 0 in the variance-shift case.
- **No gap at ρ = 1.** If π(a|x) does not depend on x, logged and counterfactual laws coincide whatever ρ is.

So the following statements are false:
- "The case ρ = 0 recovers exchangeable online CP" (p3).
- The related-work claim that partial-feedback CP methods "assume per-action outcome laws are exogenous, i.e., ρ = 0, so per-arm calibration on the logged subset is already unbiased" (p9).

Thm 3.2 is an existence statement, so it is not technically wrong, but "Ω(ρ)" in the abstract and contributions misnames the cause. The paper never uses the phrase "covariate shift", and it does not cite Tibshirani et al. 2019. Yet its own related work describes the method as decoupling "the calibration target from the logged context distribution" (p9).

Already in print (general fact):
- Lei & Candès 2021 (arXiv 2006.06138, p5, Sec. 3.1 "Counterfactuals and covariate shift"): the target Q_X × P_{Y(1)|X} and the sample P_{X|T=1} × P_{Y(1)|X} "share the same conditional distribution P_{Y(1)|X} of the outcome but otherwise differ in the distribution of the covariates."
- Taufiq et al. 2022 COPP (2206.04405, p3, Sec. 2.2) frames off-policy CP as Tibshirani covariate-shift weighting.
- Zheng & Jin 2026 (2607.02206, p12): "Due to sampling under the behavior policy, there is a covariate shift from I'_calib and the test point … adjusted by the importance weights … w_i := π(â(X_i)|X_i)^{-1}."

### 2. A propensity-free fix: condition on context. **Verdict: NEW applied to this paper; the principle is ALREADY IN PRINT.**

CCov_T(a) averages over P_X, and the shift is in X. Calibrating per (context cell, action), i.e. Mondrian or group-conditional online CP, therefore gives counterfactual coverage with **no propensities, no positivity weights and no IPW variance**. It also keeps played-action coverage at nominal.

Every benchmark in the paper uses a handful of discrete contexts: 2, K, and 4 aggregated contexts for Open Bandit.

`sim2.out` (T = 20,000; max-arm CCov gap and logged MCov):

| instance | per-arm logged quantile | per-arm IPW-weighted quantile (≈ Online COPP) | per-(x,a) quantile, no propensities |
|---|---|---|---|
| mean shift, Δ=2, score \|y\| | 0.256 / MCov 0.898 | 0.027 / **0.988** | 0.025 / 0.899 |
| variance shift, Δ=2 | 0.235 / 0.900 | 0.008 / **0.996** | 0.016 / 0.900 |
| ρ = 0 variant | 0.235 / 0.900 | 0.008 / 0.903 | 0.016 / 0.900 |

The IPW MCov of 0.99 reproduces the paper's own Fig. 4 (PW-OCP 0.992, Oracle 0.995). Because the counterfactual-marginal threshold is x-blind, the set for the action actually played overcovers badly. "Without sacrificing prediction-set sharpness" holds only relative to the oracle x-blind quantile.

Already in print (general): Gibbs, Cherian & Candès 2023 (2305.12616, p1, abstract): "We motivate these problems by reformulating conditional coverage as coverage over a class of covariate shifts … given a collection of subgroups, our prediction sets guarantee coverage over each group." Group-conditional coverage on context cells implies coverage under any reweighting of those cells. That includes the reweighting from P(X|a) to P(X).

Caveat: with continuous X, the propensity-free route needs a conditionally calibrated score (CQR) or a GCC-style function class, and that is not free. The point has full force on the paper's experiments and partial force in general.

### 3. Positivity, and IPW variance blow-up for rarely chosen actions. **Verdict: CONCEDED BY AUTHORS; also standard.**
- p2, Remark 2.3: "The regime π_min → 0 (e.g., UCB, Thompson sampling without forced exploration) is excluded."
- p5, Sec. 4.3: "The IPW signal Z_t(a) has conditional variance controlled by the inverse propensity floor and therefore becomes noisy when π_min is small."
- p9, Limitations: "Positivity is essential … the exploration floor may be costly."

The rate (Tπ_min)^{-1/2} is in the theorem itself.

### 4. Known versus estimated propensities. **Verdict: CONCEDED BY AUTHORS.**
- Sec. 4.3 (p5): the IPW signal "also requires the true logging propensity."
- Remark 5.3 (p7): DR is "conditional on the realized nuisance errors … We do not claim a general cross-fitting rate."
- Table 1: PW-OCP collapses to the ACI gap under a uniform propensity model.

DR conformal under covariate shift with a product-bias property is ALREADY IN PRINT and **uncited**: Yang, Kuchibhotla & Tchetgen Tchetgen (2203.01761, p1, abstract): "the product bias form of our proposal which implies correct coverage if either the propensity score or the conditional distribution of the response is estimated sufficiently well." Lei & Candès (2006.06138, p1) also state a DR coverage property.

### 5. The IPW error signal inside an online ACI-type recursion. **Verdict: ALREADY IN PRINT, uncited.**

Wang, Zecchin & Simeone, "Mirror Online Conformal Prediction with Intermittent Feedback" (2503.10345):
- p2: "feedback is available with probability p_t at round t"
- p1: IM-OCP incorporates "an importance weighting strategy … to handle intermittent feedback"
- p6: the proof runs the recursion on η_t (E_t − α) obs_t / p_t.

PW-OCP is this recursion run per arm, with obs_t = 1{a_t = a} and p_t = π_t(a|X_t,H). The new ingredient is that p_t depends on x and history, so the weighted signal targets a shifted law. The online telescoping with an importance-weighted miss indicator is not new.

### 6. Relation to COPP (Taufiq et al. 2022; Zhang, Shi & Luo 2023). **Verdict: CONCEDED BY AUTHORS (cited, and their own baseline is essentially as good).**

The paper's own "Online COPP" (a sliding-window IPW quantile) gets CCov 0.027/0.018/0.079 against PW-OCP's 0.017/0.013/0.074. It gets the best regret (+94.9%), which the authors concede on p9: "Online COPP gives the largest reduction." The recursion adds little over weighted conformal applied online.

### 7. Weighted conformal under covariate shift (Tibshirani et al. 2019), and feedback covariate shift. **Verdict: ALREADY IN PRINT, uncited.**
- Tibshirani, Barber, Candès & Ramdas 2019 (1904.06019) is not in the bibliography.
- Fannjiang et al. 2022 (2202.03613, p1) is not cited either, although it studies the same loop: "outputs of that model are used to choose what data to consider next." Our site already lists it (literature.html, map.html).

### 8. "Marginal coverage is the wrong target; per-action counterfactual coverage is the right one." **Verdict: ALREADY IN PRINT, and the second half is disputed in print.**
- Counterfactual per-action coverage under P_X is Lei & Candès's criterion (2.4), which the paper cites.
- Zheng & Jin (2607.02206, July 2026, **uncited**) argue on p6 that this same per-action target is *insufficient* for decisions: "the per-action coverage which constrains each set in isolation appears insufficient for decision-making: it does not by itself determine whether the set for the chosen action covers the realized outcome." They propose policy-coupled coverage. On p4 they note prior counterfactual CP validity "is often per-action or per-potential-outcome".

### 9. Online ACI under feedback and performative prediction. **Verdict: cited, not engaged.**
- Perdomo et al. [18] and Wang & Ning [29] are cited only in a closing list on p9 ("address other forms of robustness").
- Nothing in print engages this paper (it is 9 days old). Web searches for the title, "PW-OCP" and "DR-OCP" found only aggregator copies and no comments, OpenReview thread or GitHub issue.

### 10. Minor issues. **Verdict: NEW, small.**
- **Thm 5.4 lower bound.** It is proved on *context-free* instances with a fixed logger. There, logged and counterfactual laws coincide, so plain per-arm ACI (no IPW) is unbiased. The bound is just the rare-arm sample-size limit and says nothing about the price of debiasing. "Minimax-optimal" does not separate PW-OCP from unweighted per-arm calibration.
- **Thm C.4 text (p15).** It says tightening coverage "at most doubles the worst-case regret", but (EC.6) δ·Regret >= c is a lower bound, so the wording should be "at least".
- **Thm C.5.** The bound contains αBT and εTΔ_max, so it is linear in T.
- **Mean-shift benchmark.** It uses the context-blind score |y| (p26) where the paper's own "standard choice" (p2) is |y − μ̂(x,a)|. With a correct μ̂(x,a) and homoscedastic noise, the headline Fig. 1/2 failure would vanish.

### 11. Our own site. **Verdict: no overlap.**
- No page analyses propensity, off-policy or counterfactual online CP.
- Hits are bibliography only: applications.html §8 (Lei–Candès, Fannjiang), literature.html (Fannjiang, Lei–Candès, Chernozhukov et al.) and map.html (Fannjiang node).
- papers/: only survey CSV rows (papers/grammar/survey/frame_screened.csv: 2510.26026, 2409.20412, 2407.03094). Not in data/review-candidates.md.
- Thematic link: the site's I(R;X) line. Miscoverage that is predictable from X is exactly what conditioning on X removes.

---

## (c) Recommendation

A short review is worth writing, with one point that is not in print for this paper:

**The "endogeneity" failure is ordinary covariate shift in X | a, not action-induced outcome shift.**
- The paper's own Thm 3.2 construction has the same gap with ρ = 0 (0.235 in our simulation). The gap vanishes for any ρ when the logger ignores x.
- So conditioning the calibration on context fixes it with no propensities at all: per-(context, action) online quantiles, the GCC subgroup-equals-shift equivalence. On the paper's own discrete-context benchmarks this matches PW-OCP's counterfactual gap (0.025 vs 0.027; 0.016 vs 0.008) while keeping played-action coverage at 0.90 instead of PW-OCP's 0.99.

Credit the underlying facts to Lei & Candès 2021 (p5) and Gibbs–Cherian–Candès 2023 (p1).

Note in passing, without belabouring, the uncited prior art:
- Tibshirani et al. 2019
- Fannjiang et al. 2022
- Yang–Kuchibhotla–Tchetgen Tchetgen (DR)
- Wang–Zecchin–Simeone (IPW-weighted online recursion)
- Zheng & Jin 2026, who already argue that per-action counterfactual coverage is the wrong decision target.

The concessions to leave alone are positivity/variance, known propensities, Online COPP being as good, and no gain on the real data. Before writing, rerun `sim2.py` with ACI-style updates and 10 seeds, and add a continuous-X case to state honestly where the propensity-free route stops being free.
