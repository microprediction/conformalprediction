# Review candidates: conformal prediction papers whose claims the site's results refute

Compiled 2026-09-13 from six search agents, each on one angle, after the review of Perlo et al.
(2026). Per-paper judgements stay in this file; nothing here is on a public page until a paper
gets its own review with a demo. Confidence is the scout's 1-5 that the central claim is wrong as
stated, not merely loose. "R" codes name the site result that does the refuting:

- R1 no-go: any statistic of the prediction sets is a functional of the law of the sets, blind to
  the label and the ranking; coverage constrains one scalar and transfers to nothing downstream.
- R2 pinning: correlations or co-occurrence of set-membership indicators are set by marginal
  inclusion rates, move with alpha, turn positive from difficulty; singleton sets identify rates.
- R3 marginal: split-conformal coverage is an average over exchangeable draws, not per input,
  class, client, patient or subgroup; ten clients at 100%...0% pool to a valid 90%.
- R4 information gap: pooling residuals costs exactly I(R;X) under the log score; wrappers do not
  improve proper scores; "more rigorous" is one-sided without a proper score.
- R5 set size: a coarsening of the score at one threshold; no guarantee attaches to it as a
  difficulty, importance or quality signal.
- R6 online: adaptive/online coverage is a long-run average that intervals oscillating between
  empty and infinite can satisfy.

## Shortlist: cleanest refutations first

| # | Paper | Venue, year | Claim (quoted where verified) | Refuted by | Counterexample | Conf |
|---|---|---|---|---|---|---|
| 1 | Karimi, Samavi, "Quantifying deep learning model uncertainty in conformal prediction", arXiv:2306.00876 | AAAI Summer Symposium 2023 | set size over K "is an indicator of the total model uncertainty"; Theorem 2 gives "certified boundaries" per input by plugging marginal coverage into that functional | R1, R5 | two classifiers with identical set sizes at every x and different accuracy | 5 |
| 2 | Il Idrissi, Fernandes Machado, Gallic, Charpentier, "Unveil sources of uncertainty: feature contribution to conformal prediction intervals", arXiv:2505.13118 | arXiv 2025 | interval width and bounds "serve as value functions to systematically attribute predictive uncertainty to input features" | R1, R4 | Y = X1 + X2 eps with absolute-residual split CP: width is constant, attribution goes to X1, which drives no conditional spread | 5 |
| 3 | Suresh, Revathi, Guerrero, "A non-parametric adaptive conformal inference based probabilistic hour-ahead solar PV power forecasting method" | Scientific Reports 16:11730, 2026 | ACI "provided the best trade-off" and "emerges as the most robust"; own table: CRPS 0.539 vs 0.360 for CatBoost quantile regression | R4, R7 | none needed; internal | 5 |
| 4 | Garcia-Ceja, Garcia-Banuelos, Jourdan, "Conformal prediction in multi-user settings: an evaluation", arXiv:2312.05195 | UMUAI 35(1), 2025 | "if two classes often appear together in the prediction set ... it is also likely that they will be confused by the non-conformal classifier" | R1, R2 | identical set laws, opposite confusion matrices (Example 1 of the CCC paper) | 4 |
| 5 | Stankeviciute, Alaa, van der Schaar, "Conformal time-series forecasting" | NeurIPS 2021 | Bayesian and quantile baselines dismissed because they "fail to achieve target coverage"; no proper score in the paper | R4, R7 | rerun with CRPS/log score; code public | 4 |
| 6 | Sun, Yu, "Copula conformal prediction for multi-step time series forecasting", arXiv:2212.03281 | ICLR 2024 | "more calibrated and sharp confidence intervals ... than existing techniques"; coverage and volume only | R4, R7 | rerun with CRPS or energy score | 4 |
| 7 | Sreenivasan et al., "Conformal prediction enables disease course prediction and allows individualized diagnostic uncertainty in multiple sclerosis" | npj Digital Medicine 8:224, 2025 | "conformal prediction was implemented at the individual patient level with a confidence of 93%" | R3, R6 | ten-subgroup pooling; repeated visits are dependent | 4 |
| 8 | Shen et al., "RR-CP: reliable-region-based conformal prediction for trustworthy medical image classification", arXiv:2309.04760 | UNSURE at MICCAI 2023 | "a set of predictions for a given test sample such that the prediction set almost always contains the true label (e.g., 99.5% of the time)" | R3 | ten-subgroup pooling | 4 |
| 9 | Cohen, Park, Simeone, Popovski, Shamai, "Guaranteed dynamic scheduling of ultra-reliable low-latency traffic via conformal prediction", arXiv:2302.07675 | IEEE Signal Processing Letters 30, 2023 | "formal guarantees on reliability and latency irrespective of the quality of the URLLC traffic predictor"; theorem is a time average | R6 | oscillating allocation meets the average, fails every requirement window | 4 |
| 10 | Kumar, Alam, Chakraborty, "TrustFed", arXiv:2603.21656 | arXiv 2026 | "only scalar thresholds are exchanged ... no calibration scores, embeddings, or labels are revealed"; per-class coverage from a max-over-neighbours threshold | R2, R3 | two clients with disjoint class supports | 4 |
| 11 | Alharbi, Kerim, Soriano Marcolino, Ni, "SD-CSFL" | WACV 2026 | false-positive rate of client rejection "does not exceed delta" assuming exchangeability among benign clients, in a non-IID setting | R1, R3 | two benign groups with shifted score laws | 4 |
| 12 | Sturm et al. (MELLODDY), "Conformal efficiency as a metric for comparative model assessment befitting federated learning" | AI in the Life Sciences 3, 2023 | efficiency "can be calculated even where no label is known" and is offered as an applicability-domain metric | R1, R5, R3 | a confidently wrong model maximizes efficiency | 4 |
| 13 | Mehdiyev, Majlatow, Fettke, "Integrating permutation feature importance with conformal prediction ..." | Engineering Applications of AI 149, 2025 | permutation importance defined on interval width and coverage | R1, R4 | same Y = X1 + X2 eps model; text not fully verified | 3 |
| 14 | Ye et al., "Benchmarking LLMs via uncertainty quantification", arXiv:2401.12794 | NeurIPS 2024 | models ranked by set size as "a statistically rigorous estimation of uncertainty" | R5, R1 | set-size ordering flips with alpha or a monotone rescoring | 3 |
| 15 | Lindemann, Cleaveland, Shim, Pappas, "Safe planning in dynamic environments using conformal prediction", arXiv:2210.10254 | IEEE RA-L 2023 | "the MPC is provably safe"; theorem is a frequency over pedestrian draws | R3 | ten-pedestrian-type pooling | 3 |
| 16 | Lekeufack, Angelopoulos, Bajcsy, Jordan, Malik, "Conformal decision theory", arXiv:2310.05921 | ICRA 2024 | "safe ... provable statistical guarantees of having low risk without any assumptions on the world model whatsoever" | R6 | oscillation | 3 |

## Second tier, same patterns, weaker wording or unverified text

- R4/R7 forecasting on coverage alone: Sabashvili 2026 (arXiv:2601.18509, benchmark ranking CP over ARIMA); Aich, Aich, Jain 2025 (arXiv:2507.05470, "distribution-free" vs GARCH); Hu et al. 2022 (Energy 248, CTCQRN, PICP/PINAW only); Matulin, Capuder, Plavsic 2023 (ICAE, CQR "higher coverage with shorter intervals"); Liang et al. 2024 (arXiv:2412.10459, CP "outperforms" dropout and ensembles with no score); Shahbazi, Baheri, Azadeh-Fard 2026 (arXiv:2601.01223, 20x wider intervals declared better); Jensen, Bianchi, Anfinsen 2022 (IEEE TNNLS, EnCQR).
- R3 stated per input or per class in applied venues: SafePath 2025 (arXiv:2505.09427); Mohri, Hashimoto ICML 2024 (correctness guarantees over the prompt distribution read per output); TRAQ NAACL 2024; Valle, Izbicki, Leite, RSE 2023 ("statistically rigorous pixel-level"); Conformal Triage medRxiv 2024; Lin et al., Frontiers Cardiovascular Medicine 2026 (per-patient doubleton = "uncertain", N = 297); Millar et al., MEDINFO 2023 (race stratification); Jeliazkova et al., Chem Res Toxicol 2026 (efficiency as applicability domain); Lou, Luo, Meng, Annals AAG 2025 (GeoConformal local width "proves" local error).
- R2/R3 federated privacy and per-client validity: Upadhyay, Dutta, Ramesh, Springer 2026 (FedCP, "valid coverage guarantees for non-IID clients" with an EMD slack); Nguyen, Wang, Ku 2026 (arXiv:2602.23296, FedWQ-CP, quantiles "privacy-preserving"); Li et al., Pattern Recognition 172, 2026 (FCP-Pro, prototypes "protect privacy"); Vejling et al. 2026 (arXiv:2606.00717); Akgul, Kannan, Prasanna 2024 (arXiv:2410.14010, raw scores shipped, DP on the VAE only).
- R1/R5 set outputs as data: Graham-Knight et al. 2024 (arXiv:2411.02281, loss reweighted by set size); Zhan et al., PLOS Comput Biol 2025 (p-value gap as mislabel score, no error rate); Shen, Liu 2025 (arXiv:2504.17721, set size as model-selection metric); Barrett et al., FIRCE 2026 and FADES, Electronics 2026 (low-credibility fraction as drift signal, "statistically grounded"); Maalej, Sonstrod, Johansson, COPA 2025 and IDA 2026 (counterfactuals that move a class across the global threshold); Adams et al. 2025 (arXiv:2505.22326, wide-interval regions as low-confidence regions); Azad et al. 2025 (arXiv:2509.13379, VLM set-size benchmark).

## Allied results, cite rather than review

- Hagos, Lundstrom, WACV 2026 (arXiv:2509.05826): set sizes show weak correlation with human ambiguity annotations. Supports R5.
- Asch, Rossellini, Hassanzadeh, Willett 2026 (arXiv:2606.19642): CRPS "almost unchanged" after conformalizing AI weather ensembles. R4(a) observed in the wild; its framing of coverage as "the ultimate measure" is the only quarrel.
- Chau, Zargarbashi, Sale, Caprio 2026 (arXiv:2602.01667): argues set size at fixed alpha does not quantify epistemic uncertainty.
- "When average calibration fails: site-conditional federated conformal risk control" (arXiv:2606.20115): pooled federated risk control violates per-site targets at 8 of 20 hospitals. R3 measured.
- GC-FCP (arXiv:2603.14198) and PRISM-FCP (arXiv:2602.18396) state explicitly that shared summaries carry no formal privacy guarantee. The careful version of what TrustFed and FedWQ-CP claim.

## Checked and excluded as correctly stated

RAPS (Angelopoulos et al. 2021), Federated CP (Lu et al. ICML 2023), Humbert et al. one-shot (ICML 2023), Plassier et al. DP-FedCP, Zhu et al. WFCP (IEEE TSP 2024), Conformal PID, ACI, EnbPI, Conformal Abstention (NeurIPS 2024), Gibbs and Cherian, KnowNo (CoRL 2023), Conformal Language Modeling (ICLR 2024), Watson et al. NeurIPS 2023 (conformal bands around Shapley values), Chandy et al. 2026, Alkhatib et al., Marandon et al. (FDR-controlled edge selection), Althoff et al. 2023 and Ye, Hijazi, Van Hentenryck 2025 (report CRPS), Jonkers et al. Applied Energy 2024 (conditional CPS beating pooled, consistent with R4).

## Searches that found nothing

No paper found that: derives class hierarchies or clusters from set co-membership beyond Garcia-Ceja; selects federated clients by set size other than Perlo; does data valuation or Shapley from sets; claims a conformal wrapper improved a proper score; uses conformal p-values as edge weights in biological networks; claims causal discovery from conformal sets; regresses set size on covariates as an association study.

## Suggested next reviews, in order

1. Karimi and Samavi 2023: the "certified boundaries" on set-size uncertainty are the no-go theorem's target stated as a theorem; a one-table counterexample and a demo with two classifiers of equal set sizes and different accuracy would do it.
2. Il Idrissi et al. 2025: the Y = X1 + X2 eps example is two lines and shows Shapley-of-width attributing uncertainty to the wrong variable; ties directly to the information gap.
3. Garcia-Ceja et al. 2025: already cited in the CCC paper as the co-occurrence precursor; Example 1 of that paper is the counterexample, so the review is mostly written.
4. Suresh et al. 2026: refuted by its own CRPS column; a short note, but Scientific Reports is a visible venue and the point is R4 exactly.
5. Stankeviciute et al. NeurIPS 2021: the prominent one; needs a rerun with CRPS on their public code, which is a demo and a table rather than a hand calculation.
