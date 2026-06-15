# Conformal Prediction and the Finite (Signed) de Finetti Representation

*A short note. Companion to "Marginally Useful: Formalizing the Information Gap in Conformal Prediction."*

Peter Cotton

---

## Summary

Conformal prediction needs only exchangeability, and exchangeability has a representation theorem: de Finetti's. This note connects the two — specifically the *finite* form of de Finetti, in which the mixing measure is allowed to be **signed** (Kerns and Székely, 2006). The link is modest but, as far as a literature search reveals, unstated: **the sign of the de Finetti mixing measure is the sign of the term that controls whether split conformal's coverage is conditionally adaptive or conditionally perverse**, while the marginal guarantee is untouched throughout. Positive (proper, extendable) de Finetti mixtures make conformal conditionally self-correcting; the signed, non-extendable corner — which is exactly the regime of constrained scores (de-meaned, ranked, compositional) — makes it anti-adaptive. None of this changes the marginal coverage number; it changes how much that number hides.

I claim no new theorem of consequence. The marginal-invariance is classical; the independence case of the lemma below is the well-known Beta law for calibration-conditional coverage; the dependence calculus is standard association theory. The only thing offered is the bridge: reading conformal's conditional behaviour through the *sign* of the finite de Finetti representation.

## 1. Setup

Split conformal. Scores $S_1,\dots,S_n$ (calibration) and $S_{n+1}$ (test) are jointly exchangeable with a continuous joint law (no ties). The conformal width is the order statistic $\hat q = S_{(k)}$ of the calibration scores, $k=\lceil(n+1)(1-\alpha)\rceil$, and a test point is covered when $S_{n+1}\le\hat q$.

Two kinds of dependence live in any such problem, and they should not be confused.

- **Within a row.** Inside a single $(x,y)$, does the residual's shape depend on $x$? This is the subject of the companion paper, where the log-score regret of a single-shape conformal system equals the mutual information $I(R;X)$. It is a property of one observation's law and is present even when the rows are i.i.d.
- **Across rows.** How do distinct observations relate to one another — independent, sharing a latent cause, or mutually constrained? This is the subject of de Finetti's theorem, and of this note.

The two axes are orthogonal. This note is entirely about the second.

## 2. Finite de Finetti and the sign of the mixture

de Finetti's theorem (infinite form) says an infinitely exchangeable sequence is a *positive* mixture of i.i.d. sequences: nature draws a parameter from a prior, then generates i.i.d. data. A one-line variance identity shows the cost of that "positive": a positive mixture of i.i.d. variables has $\operatorname{Cov}(S_i,S_j)=\operatorname{Var}\big(\mathbb E[S_i\mid\Theta]\big)\ge 0$, so **proper de Finetti mixtures force non-negative correlation**. Finite exchangeable sequences are not so constrained: exchangeability only forces $\rho\ge -1/(n-1)$ (Aldous, 1985), and the negative band is real — sampling without replacement sits at its floor.

The finite theory closes this gap in two ways. Diaconis and Freedman (1980) show a finite exchangeable sequence is *approximately* a positive i.i.d. mixture, within total variation $O(k/n)$. Kerns and Székely (2006) make it *exact* at the price of signing: **every finite exchangeable sequence is a mixture of i.i.d. product measures with a signed mixing measure.** Geometrically (this phrasing is the author's synthesis, not a quoted result): the i.i.d. product laws trace a curve; positive mixtures fill its convex hull (the extendable, $\rho\ge0$ laws); signed mixtures fill its affine span (everything). A signed representation is thus the signature of **non-extendability** — a finite exchangeable sequence that cannot be continued to an infinite one — and it is exactly the negative-correlation regime.

So the sign of the de Finetti mixing measure is a clean label: **positive** = extendable, non-negatively correlated, a genuine prior; **signed** = finite, negatively correlated, no genuine prior.

## 3. Marginal coverage ignores the sign

For continuous exchangeable scores the rank of $S_{n+1}$ among all $n+1$ is uniform, and $S_{n+1}\le S_{(k)}$ iff that rank is at most $k$, so
$$
\mathbb P\big(S_{n+1}\le\hat q\big)=\frac{k}{n+1}\ge 1-\alpha .
$$
This uses nothing but exchangeability. Positive or signed, the marginal number is the same. (This is the standard split-conformal guarantee; Vovk, Gammerman and Shafer, 2005.) The sign enters only when we ask what the certificate hides.

## 4. The conditional-coverage decomposition

Condition on the realised width. Write $H(s,q)=\mathbb P(S_{n+1}\le s\mid\hat q=q)$, so coverage conditional on the width is the diagonal $c(q)=H(q,q)$. Assuming a joint density for $(S_{n+1},\hat q)$,
$$
c'(q)=\underbrace{f_{S_{n+1}\mid\hat q}(q\mid q)}_{\text{(i) threshold }\ge 0}\;+\;\underbrace{\partial_q\,\mathbb P(S_{n+1}\le q\mid\hat q=q)}_{\text{(ii) dependence}} .
$$

- **Term (i)** is non-negative always: a wider interval covers more of any test variable. Under independence $S_{n+1}\perp\hat q$, term (ii) vanishes and $c(q)=F(q)$ with $F$ the test-score CDF. This independence case is not new: $F(\hat q)=F(S_{(k)})\sim\operatorname{Beta}(k,n-k+1)$ is the classical law of calibration-conditional coverage (Vovk, 2012; Marques F., 2024; Angelopoulos and Bates, 2023). It already fans — coverage rises with the realised width — purely from estimation.
- **Term (ii)** carries the sign of the dependence between the test score and the width. Its sign is what the finite de Finetti representation controls.

**Reading the sign.** The width $\hat q=S_{(k)}$ is a coordinatewise non-decreasing function of the calibration scores, and the test score is disjoint from them.

- A **positive** (proper) de Finetti mixture makes the score vector *associated* (Esary, Proschan and Walkup, 1967); association is preserved by monotone maps, so $(\hat q,S_{n+1})$ are positively dependent, term (ii) is $\le 0$, and it cancels against the threshold term. Conformal is **conditionally adaptive** — flatter than independence. Pooling the calibration residuals silently conditions you into the realised world.
- A **signed**, negatively-correlated law makes the vector *negatively associated* (Joag-Dev and Proschan, 1983), a property enjoyed by without-replacement samples, multinomials, permutation/rank laws, and Dirichlet/compositional vectors, and preserved under monotone maps of disjoint subsets. Then term (ii) is $\ge 0$ and adds to the threshold term: conformal is **conditionally anti-adaptive**. The calibration set anti-predicts the test, so coverage swings — over-covering when the calibration scores happened to be large, under-covering when small — even though the marginal stays pinned.

The discrete (order-statistic) version replaces the derivative by a difference and behaves identically; the density assumption is for readability only.

## 5. Why the signed corner is not exotic: constrained scores

The negative corner arises whenever the nonconformity score is defined *relative to the batch*, because a linear constraint forces it. De-meaning ($\sum_i s_i = 0$), differencing, ranks or percentiles-within-batch, and compositional or budgeted targets all impose such a constraint, and the constraint **is** the negative association (Joag-Dev and Proschan, 1983). For these scores conformal remains marginally valid (if the relativisation is symmetric across calibration and test, exchangeability is preserved), but its conditional coverage is the fanning, anti-adaptive kind of §4.

A caution worth stating: if the relativisation treats the test point asymmetrically — de-meaning by a training-only mean, say — exchangeability itself fails and even the marginal guarantee is no longer assured. This is the familiar reason split conformal uses out-of-fold rather than in-sample residuals (Lei et al., 2018); in-sample regression residuals are both constrained ($\sum_i e_i=0$) and heteroscedastic (variance $1-h_{ii}$), and so are not exchangeable to begin with.

## 6. Scope, and what is and is not new

The contribution is a viewpoint, not a theorem. To be explicit:

- *Classical, cited here:* marginal coverage under exchangeability (Vovk, Gammerman and Shafer, 2005); the Beta law of calibration-conditional coverage (Vovk, 2012; Marques F., 2024); training-conditional coverage as a studied object (Bian and Barber, 2023); coverage degradation under non-exchangeability bounded by total-variation/mixing magnitude (Barber et al., 2023; Oliveira et al., 2024); positive association and negative association (Esary, Proschan and Walkup, 1967; Joag-Dev and Proschan, 1983); finite and signed de Finetti (Diaconis and Freedman, 1980; Kerns and Székely, 2006; Leonetti, 2018).
- *Closest prior work:* Barber and Pananjady (2026) show conformal can both under- and over-cover under temporal dependence. That analysis is marginal and indexes departures by dependence *magnitude* (a switch coefficient / $\beta$-mixing), not by *sign*, and does not treat calibration-conditional behaviour. The present note is complementary: it is the sign, read through the de Finetti representation, and the conditional rather than marginal object.
- *Offered here:* the identification of the conditional-coverage dependence term's sign with the sign of the finite de Finetti mixing measure, and the consequent reading of constrained/relative scores (the signed corner) as the regime where conformal's marginal certificate is least informative about conditional reliability.

The link runs only one way and only so far. de Finetti is a representation of a law; conformal is a procedure run without knowing the law. A signed representation does not yield a usable predictor — to use any de Finetti measure one must estimate it, which is modelling, with no distribution-free finite-sample guarantee. So the note does not claim de Finetti "supersedes" or "contains" conformal; recent work even argues conformal is not a de Finetti/Bayesian conditional at all (Datta et al., 2025). The representation diagnoses conformal's conditional behaviour; it does not replace it.

## References

- Aldous, D. J. (1985). Exchangeability and related topics. *École d'Été de Probabilités de Saint-Flour XIII*, Lecture Notes in Mathematics 1117, Springer.
- Angelopoulos, A. N. and Bates, S. (2023). A gentle introduction to conformal prediction and distribution-free uncertainty quantification. *Foundations and Trends in Machine Learning*. arXiv:2107.07511.
- Barber, R. F., Candès, E. J., Ramdas, A. and Tibshirani, R. J. (2023). Conformal prediction beyond exchangeability. *The Annals of Statistics* 51(2):816–845.
- Barber, R. F. and Pananjady, A. (2026). Predictive inference for time series: why is split conformal effective despite temporal dependence? Preprint, arXiv:2510.02471.
- Bian, M. and Barber, R. F. (2023). Training-conditional coverage for distribution-free predictive inference. *Electronic Journal of Statistics* 17(2):2044–2066.
- Cotton, P. Marginally Useful: Formalizing the Information Gap in Conformal Prediction. Companion paper.
- Datta, J., Polson, N. G., Sokolov, V. and Zantedeschi, D. (2025). Conformal Prediction = Bayes? Preprint, arXiv:2512.23308.
- Diaconis, P. and Freedman, D. (1980). Finite exchangeable sequences. *The Annals of Probability* 8(4):745–764.
- Esary, J. D., Proschan, F. and Walkup, D. W. (1967). Association of random variables, with applications. *The Annals of Mathematical Statistics* 38(5):1466–1474.
- Joag-Dev, K. and Proschan, F. (1983). Negative association of random variables, with applications. *The Annals of Statistics* 11(1):286–295.
- Kerns, G. J. and Székely, G. J. (2006). De Finetti's theorem for abstract finite exchangeable sequences. *Journal of Theoretical Probability* 19(3):589–608.
- Leonetti, P. (2018). Finite partially exchangeable laws are signed mixtures of product laws. *Sankhyā A* 80(2):195–214.
- Lei, J., G'Sell, M., Rinaldo, A., Tibshirani, R. J. and Wasserman, L. (2018). Distribution-free predictive inference for regression. *Journal of the American Statistical Association* 113(523):1094–1111.
- Marques F., P. C. (2024). Universal distribution of the empirical coverage in split conformal prediction. Preprint, arXiv:2303.02770.
- Oliveira, R. I., Orenstein, P., Ramos, T. and Romano, J. V. (2024). Split conformal prediction and non-exchangeable data. *Journal of Machine Learning Research* 25.
- Vovk, V. (2012). Conditional validity of inductive conformal predictors. *Asian Conference on Machine Learning*, PMLR 25:475–490.
- Vovk, V., Gammerman, A. and Shafer, G. (2005). *Algorithmic Learning in a Random World*. Springer.
