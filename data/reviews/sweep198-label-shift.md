<!-- Prior-art sweep for issue #198, 2026-10-04. Quotes were checked against the downloaded PDFs, which are not stored here; page numbers are PDF page indices. File names below refer to the working folder of the sweep. -->

# Prior-art sweep: arXiv 2609.27976 (issue #198, third paper)

Choi, S., "Conformal Bayes under Continuous Label Shift: Sensitivity Analysis and the Limits of Exact
Validity", arXiv:2609.27976v1 [stat.ML], 24 Aug 2026, 46 pp. Single author (CROID Research / aSSIST
University). PDF: `sweep198/ls.pdf`, text: `ls.txt` (layout) and `lsr.txt`. Page numbers below are
the PDF page numbers. (The first download, `paper.pdf`, was truncated. Ignore it.)

Prior-art PDFs downloaded and grepped (all in `sweep198/`): 1904.06019 (Tibshirani et al.), 2103.03323
(Podkopaev & Ramdas), 2006.06138 (Lei & Candès), 2111.12161 (Jin, Ren & Candès), 2112.03493 (Yin, Shi,
Wang & Blei), 2106.06137 (Fong & Holmes), 2202.13415 (Barber et al.), 2203.06126 (Qiu, Dobriban &
Tchetgen Tchetgen), 2310.12964 (Si et al., PAC label shift), 2605.02072 (Wang & Goel, weight
clipping), 2606.11865 / 2607.02173 / 2609.30886 (Choi), 2609.12386 (Lee et al.), 2608.17678 (Lee et
al., molecules), kim26a.pdf (Kim et al., COPA 2026, PMLR 329).

## (a) Exact claims

**Setting.** Split conformal. Training data D_tr is independent of the calibration data and the test
point. The calibration points are i.i.d. from P_s and the test point comes from P_t, with
p_s(x|y) = p_t(x|y). The response-marginal ratio is an exponential tilt,
w(y;β) = exp{βᵀφ(y) − A_s(β)}, with φ(y)=y (linear) or (y, y²) (quadratic). The score is the tilted
Bayesian predictive negative log density, S_β(x,y) = −log p_β(y|x, D_tr), so the same β sets both the
score and the weight ("joint score–weight coupling"). The uncertainty set B (B(κ) = [−κ/v_s², κ/v_s²]
in the linear case) is fixed independently of the calibration labels (Assumption 1, p.15).

1. **JTS-SCB (the method).** θ̂ = sup_{β∈B} q̂_β, where q̂_β is the calibration-only weighted (1−α)
   quantile. It drops the candidate (test) weight. Then C^prac(x) = ∪_β {y : S_β(x,y) ≤ θ̂} (eqs.
   19, 26, 29). Prop 1: this set contains the per-β union. Prop 2: the sets are pathwise nested in B.
   Prop 3: the Gaussian closed form has width 2h(x) + (β_hi − β_lo)σ̂²(x). **No coverage theorem.**
   Abstract: "its calibration-only construction does not inherit the exact finite-sample
   weighted-conformal guarantee."
2. **Corollary 1 (p.15).** The candidate-weighted union ∪_β {y : π_β(y) > α} has coverage ≥ 1−α
   whenever β* ∈ B. The paper says this is inherited from Tibshirani et al. Thm 2 plus the inclusion
   C_{β*} ⊆ union.
3. **Lemma 1 (p.16).** Once the candidate score exceeds every calibration score, the candidate is
   accepted iff W_{n+1}(y) > K_β = αC_β/(1−α), where C_β = Σ_i W_i. **Corollary 2:** a weight that
   tends to 0 in a tail means that tail is rejected; a weight that tends to ∞ means it is accepted.
4. **Proposition 4 (p.18).** For the Gaussian score and the linear tilt, any β ≠ 0 in B puts a whole
   half-line into the exact union. This holds for every x and every dataset, "regardless of the true
   target tilt β⋆", including β⋆ = 0. Remark 3 gives the onset y_W ≈ m_s + L/β + βv_s²/2 with
   L = log(αn/(1−α)).
5. **Corollary 3 (pp.20–21).** For a quadratic tilt, β₂ < 0 gives a bounded exact set (with an explicit
   envelope via the discriminant Δ_β), and so does a compact B ⊂ {β₂<0}. β₂ > 0 gives an unbounded set
   in both tails.
6. **Proposition 5 (p.23).** Clip the weights to [1/M, M] with M² ≤ αn/(1−α). Then the exact clipped
   union is bounded. It has coverage ≥ 1−α for the clipped surrogate target and ≥ 1−α−TV(P_t, P̃_t)
   for the true target.
7. **Experiments.** d=15 Gaussian linear model, BLR, n_cal=300, 60 trials, 1−α=0.9.
   - Table 3: Oracle-WT (calibration-only weights at the true β*) covers .900→.887 as β* goes .3→1.5.
     JTS-SCB covers .924–.963 at widths 2.00–2.51, against about 1.85 for the oracle.
   - Table 5: the self-consistent pseudo-label plug-in PL-tilt matches the oracle. JTS-SCB is "15–40%
     wider at higher coverage". The paper says: "Any claim that JTS-SCB is preferable in this regime
     would be unsupported."
   - JTS-SCB beats the plug-ins only under systematic predictive-mean bias (Tables 6, 7, 12, 13). The
     paper says the mechanism there is "anchoring plus width, not intelligent bias correction".
   - JTS-Q over-covers at .97–.98 (Table 14).
   - When label shift itself breaks (conditional-noise scale c=2), coverage falls to .516 (Table 15).

**What the paper concedes (it is unusually candid).**
- p.8: the exact set "is an application of standard weighted-conformal validity, rather than a new
  coverage result of this paper".
- p.16: "The reduction itself is simple."
- p.22, Remark 4: the practical interval "does not inherit the exact weighted-conformal theorem".
- p.29: Oracle-WT "is not exactly valid".
- p.39: "developing sharper finite-sample theory for the calibration-only weighted quantile used in
  practice" is listed as future work. So is closing the gap for tail-growing families.

## (b) Candidate points

**P1. The candidate weight produces infinite sets (Lemma 1 / Prop 4). The mechanism is ALREADY IN
PRINT, and the paper concedes the step is elementary.**
- Tibshirani et al. 2019, Corollary 1, eq. (8), p.4. The weighted set is
  "Quantile(1 − α; Σ p^w_i(x) δ_{V_i} + p^w_{n+1}(x) δ_∞)". It is the whole line whenever
  p^w_{n+1} > α.
- Lei & Candès 2021 (JRSSB), p.6: "if ŵ(x; Ztr) = ∞, we set p̂_i(x) = 0 … and p̂_∞(x) = 1, in which case
  step 5 gives Ĉ(x) = (−∞, ∞)".
- The exact label-shift threshold appears in the author group's own COPA 2026 paper: Kim, Lee,
  Jadamba, Choi & Shin, PMLR 329:101–132, published 30 Aug 2026, App. H, p.31. It reads: "using the
  realized label pushes more test points' weight past the threshold needed for a finite weighted
  quantile, w(y⋆) > α/(1−α) Σ_i w(y_i), and the resulting interval is unbounded". That is K_β of
  Lemma 1, for the same linear tilt. (Same group, essentially simultaneous.)
- Choi's companion paper 2609.30886 (25 Sep 2026, so after this one), p.9: "a linear response tilt
  H(y) = e^{r(x)+γy} … eventually exceeds this threshold throughout one response tail. Both score
  choices therefore produce sets of infinite total length".

What is new in this paper is only the packaging: the result holds for every x and is independent of
β*, plus the quadratic sign dichotomy. These are direct corollaries.

**P2. The practical set has no finite-sample guarantee. CONCEDED BY AUTHORS** (abstract; Remark 4,
p.22; p.29). The "asymptotically valid" reading is already in print from the same author, in Choi
2606.11865, Remark 1, p.3: "Equation (6) omits this test-point weight — the standard large-n_cal
approximation, asymptotically valid as n_cal → ∞." Our own repo dealt with the same omission in a
different demo (issue #205, closed: "NexCP omits the test-point mass").

**P3. Estimated weights and the TV/ℓ1 slack. ALREADY IN PRINT and not cited.**
- Lei & Candès 2021, Prop. 1, p.6: "set ∆w = (1/2)E|ŵ(X) − w(X)|. Then coverage is always lower bounded
  by 1 − α − ∆w". Prop 5's TV transfer bound (51) is the same device.
- Barber et al. 2023 cover the TV-type coverage gap for fixed weights (cited by the paper, but not
  for this point).

**P4. Ratio clipping as a repair. ALREADY IN PRINT for conformal under covariate shift; the paper
cites only Ionides (2008, importance sampling).**
- Wang & Goel, arXiv:2605.02072 (May 2026), abstract, p.1: "WCP can suffer from significant
  undercoverage when the density ratio between the distributions is unbounded … We provide the first
  theoretical guarantees for weight clipping in conformal inference". The clipping bias they quantify
  is ∆_1 = E[(w* − 1)_+] = TV(P, Q) (p.3).
- Tibshirani et al. 2019, p.7, clip estimated weights in practice ("Without clipping … resulting in an
  infinite weight").

What the paper adds is the deterministic boundedness condition M² ≤ αn/(1−α) for the label-shift
case.

**P5. Heavy-tailed weights and effective sample size. ALREADY IN PRINT; not cited for this point.**
- Tibshirani et al. 2019, p.6: "we are relying on a reduced 'effective sample size'"
  (n̂ = ‖w‖₁²/‖w‖₂²).
- Lei & Candès 2021, p.6: the upper coverage bound uses (E[w^r])^{1/r}.

The paper attributes Oracle-WT's dip only loosely to "small effective sample size" (p.29) and never
quantifies it.

**P6. Sensitivity-analysis conformal over a weight set. ALREADY IN PRINT, but the paper cites it
(Jin, Ren & Candès 2023; Yin et al. 2024) and positions itself against it.**
- Jin et al. Algorithm 1, eq. (8), p.7, keeps the test weight's upper bound û(X_{n+1}) in the
  denominator and so stays valid.
- Yin et al., p.14: "The union of such intervals becomes a valid predictive band".
- Si, Park, Lee, Dobriban & Bastani 2023/24 (arXiv:2310.12964, p.1) handle label-shift weight
  uncertainty with a guarantee: "uses these intervals [for importance weights] to construct prediction
  sets". This is for classification, and **the paper does not cite it**.

The contrast is that those methods keep a bound on the test weight, while JTS-SCB drops it. Under
label shift the test weight's bound is sup_y w(y) = ∞, which is exactly P1. That is an observation, not
new prior art.

**P7. "Conformal Bayes" (Fong & Holmes 2021). Not an issue.** The paper cites them correctly as a source
of Bayesian conformal scores and uses split, not full, conformal Bayes. No claim conflicts with them.

**P8. Is the "limit of exact validity" intrinsic, or only a property of this construction? NEW (a
targeted search found nothing), with the technique ALREADY IN PRINT.**
The paper shows only that *its* candidate-weighted construction is unbounded. It proves no lower bound
that applies to every method. A short argument gives one:
- Take a known tilt w(y) = e^{βy}/Z with β ≠ 0, and let X be independent of Y (label shift still holds).
- Put a source atom of mass ε at a far point y₀, with εe^{βy₀} held fixed so that the target mass at y₀
  exceeds α.
- As y₀ → ∞, the calibration sample sees y₀ with probability about nε → 0. So any method with exact
  distribution-free coverage under known w must cover every far y₀ with probability bounded below.
- By Fubini, E[Leb C] ≥ ∫_R^∞ P(y ∈ C) dy = ∞.

So once the ratio is unbounded in a tail, **every** exactly valid method has infinite expected length.
Bounded ratios (Cor 3 with β₂<0, and clipping) are exactly the cases where escape is possible.

The technique is in print for *unknown* covariate shift: Qiu, Dobriban & Tchetgen Tchetgen (JRSSB 2023,
arXiv:2203.06126), Lemma 1, p.7: "any PAC prediction set Ĉ in the target population under unknown
covariate shift is essentially uninformative since it will contain almost any possible outcome with a
nonzero probability". It also echoes the Vovk/Lei–Wasserman infinite-expected-length result quoted in
Tibshirani et al. 2019, p.14. Neither is cited by the paper. I found no statement for *known but
unbounded* label-shift ratios. The argument is sketched, not fully written out.

**P9. A finite-sample bound for the practical set. Probably folklore; NOT located in print; the paper
lists it as open.**
Let W_j = w(Y_j; β*) for j = 1, …, n+1. Then dropping the candidate weight costs at most
E[max_j W_j / Σ_j W_j]. The prefix-weight argument: the miscovering indices form a top-score prefix of
weight ≤ αT + max W. Hence

P(Y ∈ C^prac) ≥ 1 − α − E[max_{j≤n+1} W_j / Σ_{j≤n+1} W_j] whenever β* ∈ B,

because C^prac contains the calibration-only set at β*.

In the paper's Table 3 setting (n=300, v_s²=1.3), a 20,000-draw simulation gives slacks of .009, .020,
.041, .079 and .138 for β* = .3, .6, .9, 1.2 and 1.5. The observed Oracle-WT values (.900 → .887) sit
inside these slacks. This partly answers the paper's stated open problem (p.39), but I did not verify
that it is unpublished. Lei & Candès's and Barber et al.'s weighted-quantile bounds are close relatives.

**P10. The same group's COPA 2026 paper reports finite lengths for sets this paper implies are
infinite. NEW as an explicit observation, but the paper half-concedes it.**
- Kim et al. (TA-FCB) use candidate-wise weights w(y) = e^{β₁y} in full conformal Bayes and report
  finite lengths, e.g. 5.195 at |β₁| = 0.5 (Table 7, p.31).
- Their App. D, p.27, admits: "The relation between the selected numerical range and the unrestricted
  oracle acceptance set is outside this in-range discretization argument."
- This paper's p.27 says the unboundedness was "easy to miss numerically" and that the B = .1 width
  "looks finite, even though the true set is already unbounded". It does not name Kim et al.

Caveat: Prop 4 is proved for split conformal. Carrying it over to full conformal needs the candidate's
score to dominate in the tail, and I have not checked that.

**Our site.** `grep` over `*.html` and `papers/` finds no label-shift content. `literature.html` has one
weighted-conformal line ("you must know the weights"). `papers/marginally-useful` has one sentence
(l.508–510) on weighted CP and effective sample size. Issue #205 (closed) is about the omitted
test-point mass in a different demo. Nothing on the site addresses this paper's claims.

**External commentary.** No OpenReview entry, comment or citing paper found for 2609.27976.

## (c) Recommendation

A full rebuttal review is not worth writing. The paper concedes almost everything a careful reader would
raise:
- the practical method has no finite-sample guarantee;
- the exact set is "an application of standard weighted-conformal validity";
- the tail lemma is "simple";
- JTS-SCB loses to a good plug-in except under systematic bias, and wins there by "anchoring plus
  width".

The infinite-set mechanism is Tibshirani et al.'s δ_∞ atom, and the label-shift threshold already
appears in the group's own COPA paper. The clipping, TV-slack and effective-sample-size points are in
Wang & Goel 2026, Lei & Candès 2021 and Tibshirani 2019. The paper cites none of these for those points,
which is worth a short note.

A short note would add something only if it makes one point: **the "limit of exact validity" is
intrinsic, not an artifact of the construction.** With a known but tail-unbounded label-shift ratio,
every exactly valid method has infinite expected length. This follows from a Qiu–Dobriban–Tchetgen
Tchetgen-style Fubini argument (credit them). A bounded ratio is the exact dividing line, and the
paper's Cor 3 and Prop 5 are the two sides of it.

The natural companion is P9: the bounded practical set has explicit finite-sample slack
E[max W / ΣW], about .01–.14 in the paper's own grid. Before publishing, two checks are needed:
- search once more for a known-weight lower bound under covariate shift (Barber et al. 2021 "limits",
  Gupta et al. 2020);
- write out the P8 argument and the P9 inequality properly.

If either turns up in print, the note shrinks to a citation list, and it is not worth a page.
