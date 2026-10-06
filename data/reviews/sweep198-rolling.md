<!-- Prior-art sweep for issue #198, 2026-10-04. Quotes were checked against the downloaded PDFs, which are not stored here; page numbers are PDF page indices. File names below refer to the working folder of the sweep. -->

# Prior-art sweep: Rolling Conformal Prediction (arXiv 2609.26951v1)

Cheng, Liang, Foygel Barber, "Rolling Conformal Prediction in Sequential Model Training", arXiv:2609.26951v1 [math.ST], 22 Sep 2026, 42 pp. Only v1 exists (arXiv API, checked 2026-10-04). Semantic Scholar was rate-limited and a web search for the ID found nothing, so as far as I can tell there are no citing papers or public comments yet. Code: github.com/Moriartycc/rolling-conformal (cloned and read).

Local files in this folder: `rolling.pdf` / `rolling.txt` / `rcp_plain.txt` (the paper), `rcp_feldman.pdf` (Feldman et al. 2205.09095), `rcp_jackplus.pdf` (jackknife+, 1905.02928), `rcp_vovkwang.pdf` (Vovk–Wang, 1212.4966), `rcp_crossconf.pdf` (Vovk, 1208.0806), `rcp_code/` (the authors' repo). Note that `plain.txt`, `paper.*`, `ls.*` and `html.html` in this folder belong to other agents and are not this paper.

---

## (a) What the paper claims

**Setup.** The paper starts from a stream Z_i = (X_i, Y_i). Score functions s_i(·; Z_{<i}) may depend on the past in any way: SGD iterates, refits, or LLM checkpoints. The prediction set is (eq. 4, p.3)

  C_n = { z : Σ_{i=1}^n 1{ s_i(z; Z_{<i}) > s_i(Z_i; Z_{<i}) } < (1−α)(n+1) }.

So the candidate z is compared with each Z_i under the model that existed just before Z_i arrived. Every point is used once for calibration and then for training. Nothing is held out for calibration alone.

**Theorem 1 (p.6).** Assume Z_1..Z_{n+1} are exchangeable, α in (0,1), and the score functions s_i are any sequence. Then P(Z_{n+1} ∈ C_n) ≥ 1 − 2α. Remark 1 (p.9) tightens this slightly to 1 − (2α − 1/(n+1))_+.

**Theorem 2 (p.9).** p_rolling = (1 + Σ 1{s_i(Z_i) ≥ s_i(Z_{n+1})})/(n+1) is dominated in decreasing-convex order by Unif{1/(n+1),…,1}. That makes it a p*-value in the sense of Wang (Bernoulli 2024), and a p*-value is valid up to a factor of 2. Theorem 1 follows from this.

**Proposition 1 (p.8, tightness).** For iid data from any nonatomic P, some sequence of score functions makes lim P(cover) take any value in (1−2α, 1]. The proof (App. A.4, p.30) uses scores that do not depend on the data at all. On odd steps s_i(z) = z. On even steps the interval [l, r] is reflected. Coverage is lost by mixing two rankings. Training plays no part.

**Theorem 3 (p.10, iid).** With probability at least 1−δ, the training-conditional miscoverage is at most 2α + sqrt(2 log(1/δ)/(α²(n+1))). A version uniform over n replaces log(1/δ) with log((n+1)²/δ) (eq. 7). The authors say this supports stopping at a data-chosen time.

**Theorem 4 (p.11, iid plus "score comparison stability", Assumption 1).** Assumption 1: after time m, s_i ranks a random pair (Z, Z') the same way as a fixed s⋆, except with average probability ν. Then coverage is at least 1 − α(n+1)/(n−m+2) − 2√ν, and if there are no ties, at most 1 − α + 2√ν + ((1−α)(m−1)+1)/(n−m+2). Proposition 2: L_q score stability plus a bounded score density implies Assumption 1. Theorem 6 (App. C.3) gives the training-conditional version, which tends to 1−α.

**Theorem 5 (App. C.1, independent but not identically distributed data).** Coverage is at least 1 − 2α − (2/n) Σ d_TV(P_i, P_{n+1}).

**Appendix C.2 (p.35–36).** Averaging the split-CP p-values from the n models gives the same 1−2α guarantee. The authors argue that rolling-CP weights the data points more evenly, so its effective sample size is larger.

**Experiments.**
- **Min-norm OLS** (d=200, n=40,000, 100 streams). Coverage is "extremely close to the nominal level". Against split-CP (n=5000, 400 streams), rolling-CP gives narrower sets at similar coverage. This holds both when split-CP trains on a fixed m=1000 (with rolling-CP given a burn-in of m) and when it trains on ⌊n/2⌋.
- **SGD multinomial logistic** (d=10, K=5, n=10,000). Coverage is roughly nominal for step-size exponents γ ∈ {0.6, 0.8, 1}.
- **One-pass LeNet on MNIST.** One trajectory, coverage measured on 1000 fixed test images. The authors say this is training-conditional, not marginal (p.19).

The only baseline is split-CP. There is no comparison with jackknife+, CV+, cross-conformal, ACI or Rolling RC, or with a running quantile of past one-step-ahead residuals.

---

## (b) Candidate points and verdicts

### 1. The 1−2α floor is the jackknife+/cross-conformal factor of two, and in practice coverage is about 1−α
**Verdict: ALREADY IN PRINT, and CONCEDED BY AUTHORS.**
- The paper's abstract calls it "a familiar universal factor-two guarantee". On p.8: "In practice, we expect the coverage of rolling-CP to be approximately the nominal level, 1 − α. However, the factor of two in Theorem 1 cannot be improved without further assumptions such as convergence of the algorithm or stability of the score functions."
- Barber, Candès, Ramdas, Tibshirani (2021), jackknife+, arXiv 1905.02928v3, p.7: "In practice, we generally expect to achieve the target level 1 − α with either version of the jackknife. A natural question is whether the factor of 2 appearing in the coverage guarantee for jackknife+ is real, or is merely an artifact of the proof." The same paper says cross-conformal has the 1−2α guarantee (§3.2, p.10).
- Vovk & Wang, "Combining p-values via averaging", arXiv 1212.4966v5, abstract p.1: "the p-values can be combined by scaling up their arithmetic mean by a factor of 2 (and no smaller factor is sufficient in general)."
- Wang (2024), p*-values. The paper cites this as [67] and builds its proof on it.

### 2. The worst case comes from pathological score sequences
**Verdict: CONCEDED BY AUTHORS.** The construction in App. A.4 uses data-independent scores that alternate between two rankings, and p.8 says the factor of two is removable under stability. Jackknife+ makes the same move: Theorem 2 there gives "explicit pathological examples" (p.7).

A small extra remark would be new: the counterexample involves no learning at all. The guarantee therefore only charges for mixing several rankings, and says nothing about whether the model is any good. This sharpens the authors' own framing more than it corrects anything.

### 3. Coverage is marginal over the training stream and the test point, not conditional on x
**Verdict: CONCEDED BY AUTHORS.** p.19: "It is also interesting to extend rolling-CP from marginal and training-conditional validity to test-conditional coverage … Exact, nontrivial, distribution-free test-conditional coverage is generally impossible without additional assumptions [59, 6, 4]." The impossibility result is in print (Vovk 2012; Barber et al. 2021, "limits of distribution-free conditional predictive inference"). Our site makes this point everywhere already, so a review would add nothing here.

### 4. Temporal dependence, i.e. time series
**Verdict: CONCEDED BY AUTHORS.** p.19: "Another potential direction is to study the performance of rolling-CP under temporally dependent data streams, where exchangeability no longer holds." They cite Barber–Pananjady (arXiv 2510.02471) and the leave-a-window-out jackknife (Jiang et al., arXiv 2605.30292). App. C.1 handles independent data with drift only through a total-variation term.

### 5. Relation to online and adaptive methods (ACI and its successors)
**Verdict: CONCEDED BY AUTHORS, with one missing citation.**
- p.5 says ACI-type methods target long-run average coverage "rather than marginal coverage at a fixed prediction time". Rolling-CP instead uses exchangeability to get a per-time guarantee. They cite Gibbs–Candès, Bhatnagar et al., Angelopoulos–Barber–Bates and conformal PID.
- **Not cited:** Feldman, Ringel, Bates, Romano, "Achieving Risk Control in Online Learning Settings" (TMLR 2023, arXiv 2205.09095). It works in the same setting: the model is updated online after each observation is calibrated. It also uses the word "rolling" for its method. p.2: "In this work, we introduce rolling risk control (Rolling RC): the first calibration procedure to form prediction sets in online settings that achieve any pre-specified risk level … without making any assumptions on the data distribution". p.4: "we obtain a new predictive model M_{t+1} by updating the previous M_t with the new labeled pair (X_t, Y_t), e.g., by applying a single gradient step".
- So the omission is a missing citation plus a clash of names. It is not a technical error, and it is too small to carry a review.

### 6. Full conformal, jackknife+ and CV+ as the efficient no-split alternatives
**Verdict: CONCEDED BY AUTHORS.** p.5 says full conformal is "computationally extremely expensive" and that cross-conformal and jackknife+/CV+ exist. It then argues: "none of these aforementioned methods are designed to be computationally efficient in the setting of sequential model training." The experiments still compare only against split-CP (see point 8).

### 7. Training-conditional bound: the 1/α² factor makes Theorem 3 nearly vacuous at practical n
**Verdict: NEW (as far as found).** The authors summarise Theorem 3 as "≥ 1 − 2α − O_P(n^{-1/2})" (p.10) and never give numbers. The deviation term is sqrt(2 log(1/δ)/(α²(n+1))), i.e. it scales like 1/(α√n). At δ = 0.05 the bound on miscoverage is:

| n | α | Rolling-CP, Theorem 3 bound | Split-CP with n calibration points (α + sqrt(log(1/δ)/2n), Vovk 2012) |
|---|---|---|---|
| 10,000 | 0.10 | 0.445 | 0.112 |
| 60,000 (the MNIST size) | 0.10 | 0.30 | 0.105 |
| 10,000 | 0.05 | 0.59 | 0.062 |
| 1,000 | 0.05 | 1.65 (vacuous) | 0.089 |

The uniform-in-time version (eq. 7) is weaker still. This is a real point, but it is about how loose the bound is, not about the method being wrong. The 1/α probably comes from the Markov step in Lemma 2.1 and A.3.

### 8. To form C_n at a new x you need every past model, or you need to know the test x in advance
**Verdict: NEW. Not conceded, and contradicted by the paper's own framing.**
- By eq. (4), evaluating C_n at a new candidate z = (x, y) requires s_i(z; Z_{<i}) for every i ≤ n. In practice that means storing all n checkpoints, or all n parameter vectors, and running x through each of them.
- The paper claims the method is "computationally lean and tuning-free … without requiring additional data splitting or repeated retraining" (p.19). It motivates the method with one-pass LLM training and continual fine-tuning (Example 2, p.4–5). There, n checkpoints of a language model, each evaluated at every candidate response, is far from lean.
- The paper never mentions storage or checkpoints as a cost. The only hits for "checkpoint" are in Example 2, where a checkpoint is just something the update may swap in.
- The authors' code avoids the problem in both experiments:
  - `rcp_code/one-pass-mnist/main.py`, header docstring: "all hold-out scores are evaluated using the network trained on Z_{<i}". The 1000 test images are fixed before training, and each one is scored by each iterate as training runs.
  - `rcp_code/linear-regression/main.py`, line 147: `predictable_thetas = np.empty((checkpoint_count, d))`. The whole θ path is stored.
- In deployment, the point to be predicted arrives after training, so neither shortcut is available. Split-CP and ACI-style methods need only the current model plus a list of scalar residuals.
- A special case does exist: the test point is known in advance (transductive or batch prediction), or a cheap closed form exists, as with recursive OLS. Even recursive OLS needs the θ path to evaluate a new x.
- I found nothing in print making this point. The paper is 12 days old.

### 9. No practical baseline: the running quantile of past one-step-ahead residuals under the current model
**Verdict: NEW as a criticism of this paper. The method itself is folklore and is also what the site's own tools do.**
- The obvious thing a practitioner does is take {z : s_{n+1}(z; Z_{≤n}) ≤ Quantile_{1−α}(s_i(Z_i; Z_{<i}))_{i≤n}}. This compares the test point under the current model with past one-step-ahead residuals.
- That method has no finite-sample guarantee. When models improve over time it tends to over-cover, because old residuals come from worse models. It needs only one model and n scalars.
- Rolling-CP gets its guarantee by giving up exactly this: it scores the test point under stale models.
- The paper compares only with split-CP. It never shows how wide rolling-CP's sets are compared with this one-model rule, or with ACI or Rolling RC run on the same SGD trajectory.
- The site's skaters and laplace forecasters work this one-step-ahead way (papers/grammar/grammar.tex: "Every forecaster runs prequentially…"), so we could run this comparison on the existing benchmarks without new data.

### 10. A burn-in is used in practice but not discussed as a tuning choice
**Verdict: NEW but minor.** p.15: "For rolling-CP, we treat the first m data points as a burn-in period". This is in the fixed-m comparison with split-CP. The paper also calls the method "tuning-free" (p.19). Discarding the comparisons from early models is valid if m is fixed in advance, but it is still a tuning parameter. The main runs (eq. 4) give the untrained early models full weight. The authors' Theorem 4 already quantifies how much the first m steps cost (the (m−1)/(n−m+2) term), so this is close to conceded.

### 11. Same guarantee as averaging the split-CP p-values from the n models
**Verdict: CONCEDED BY AUTHORS.** App. C.2, p.36: "This appears to be a very similar construction, and the same guarantee, as rolling-CP." They argue rolling-CP weights the data more evenly. They do not show in experiments that this makes the sets narrower.

### 12. Older prior art on online inductive conformal prediction (Vovk et al., ALRW 2005, ICP with update triggers)
**Verdict: NOT VERIFIED.** ALRW describes inductive conformal predictors run online that retrain at trigger times and calibrate on the points since the last retrain. That is a growing-split scheme, not the cross-model comparison of rolling-CP. I could not get the book text to quote it, so this should not be claimed. As remembered, it is not the same as rolling-CP. Treat it only as a lead.

---

## (c) Recommendation

The theory points a careful reader would raise first are already in print or conceded by the authors. These are the factor of two and its pathological worst case (jackknife+ 2021; Vovk–Wang; Wang's p*-values, which the authors cite), marginal versus conditional coverage, time series, ACI, and the equivalence with averaging p-values. A review of the "1−2α is weak" kind would add nothing.

The one point that adds something and is not in print is practical: **rolling-CP needs every past model in order to predict at a new point.** Eq. (4) evaluates the candidate under all n past score functions. The authors' own code gets around this either by fixing the test images before training (MNIST) or by storing the whole θ path (OLS). The paper still calls the method "computationally lean" and motivates it with one-pass LLM training, where n stored checkpoints is impractical.

A short review could make that single point and back it with one demo. The demo would put rolling-CP alongside the one-model rule (the running quantile of past one-step-ahead residuals, i.e. our skaters/laplace approach) on the paper's OLS or SGD setup. It would show:
- what the stored-model cost buys in interval width and coverage;
- how ACI and Rolling RC compare (Feldman et al. 2023, which shares the name and is uncited, should be credited).

The 1/α² looseness of Theorem 3 (0.30 bound on miscoverage at the MNIST size, α=0.1) could go in as a secondary remark. Tone: the theory is correct and the authors are candid. The review should be a practitioner's note on cost, not a refutation.
