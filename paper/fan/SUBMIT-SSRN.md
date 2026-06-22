# SSRN submission packet — "The Width of the Conformal Fan"

SSRN takes a finished **PDF** plus a metadata form. No LaTeX build, no source tarball
(unlike arXiv). Everything you need to paste is below.

---

## 0. File to upload

`paper/fan/conformal-fan.pdf` (13 pp). It already carries title, author, and abstract,
so it is submittable as-is. Optional polish before uploading — see §7.

---

## 1. Title

```
The Width of the Conformal Fan: Dependence and the Variance of Realized Coverage
```

## 2. Abstract (plain text — paste into the SSRN abstract box)

```
Fix a split-conformal calibration set and ask how often a fresh, independent draw from
the score marginal falls under the threshold U_(k), the k-th order statistic of the n
calibration scores. That realized coverage c = U_(k) is a random variable; for
independent calibration scores it follows the Beta(k, n-k+1) law, with variance of order
alpha(1-alpha)/n. We call this across-sample spread of realized coverage its dispersion,
and the family of laws the dependence sweeps out the "fan"; we study how dependence among
the calibration scores reshapes it. The organizing identity is that c is a functional of
the count process alone, so its variance is governed by the count's covariance kernel, and
negatively associated scores have a less variable count. Three results follow. (1) A
leading-order fan coefficient: in a Bahadur regime the variance is set by the variance of
the sub-threshold count, so the average pairwise covariance of the sub-threshold indicators
fixes the leading constant. (2) An exact aggregate bound: summed over all levels k, negative
association never widens the fan, via a convex-order contraction of the count against a
concave functional, plus majorization. (3) For equicorrelated normals the single level is
exact and monotone in the correlation, Var(Z_(k)) = v_k + rho(1 - v_k), and dispersively so
via strong log-concavity and Tweedie's formula. We keep c (coverage against an independent
test draw) distinct from conformal conditional coverage with an exchangeable test point:
under dependence the mean of c is not pinned, and the positive-dependence decomposition is
an exact identity that does not by itself order the fan against the independent one. The
general single-level negative-association contraction is left as a conjecture, supported
numerically. Constructive corollary: a pre-specified, exchangeability-preserving
(e.g. Latin-hypercube) calibration design lowers coverage dispersion from order 1/n to order
1/n^2 without disturbing the marginal coverage guarantee. The dispersion is a within-model
quantity: shrinking it by design improves reproducibility, not robustness to model
misspecification.
```

## 3. Keywords (comma-separated)

```
conformal prediction; training-conditional coverage; calibration-conditional coverage;
order statistics; negative association; coverage dispersion; copula; dispersive order;
variance reduction; distribution-free inference
```

## 4. JEL classification codes (SSRN asks; pick the closest)

- **C14** — Semiparametric and Nonparametric Methods: General
- **C53** — Forecasting and Prediction Methods
- **C18** — Econometric and Statistical Methods: Methodological Issues: General
- (optional) **C10** — Econometric and Statistical Methods and Methodology: General

## 5. Classifications / eJournals to request

SSRN will auto-suggest networks from the abstract; the best-fit destinations to add:

- **CompSciRN: Machine Learning eJournal** (Computer Science Research Network)
- **Econometrics: Mathematical Methods & Programming eJournal** (ERN)
- **Econometric Modeling: Statistical Methods eJournal** (ERN)
- (optional) **Decision-Making under Risk & Uncertainty eJournal**

## 6. Author metadata

| Field | Value |
|---|---|
| Author | Peter Cotton |
| Email | peter.cotton@microprediction.com |
| Affiliation | **[CONFIRM — e.g. Microprediction]** |
| Co-authors | none |
| Date written | **[today's date / your choice]** |

---

## 7. Optional PDF polish before upload

The current title page reads `Peter Cotton` / `Draft --- companion note`. For a standalone
SSRN posting you may want:
- drop "Draft", set a real date;
- add affiliation + email under the author line.

Say the word and I'll regenerate a clean submission PDF with a proper title block. (Leaves
the on-site companion-note version untouched.)

---

## 8. Submission steps (SSRN)

1. Sign in at **ssrn.com** → **User HQ** → **Submit a Paper** (papers.ssrn.com).
2. **Upload** `conformal-fan.pdf`.
3. Paste **Title** (§1), **Abstract** (§2), **Keywords** (§3).
4. Add **JEL codes** (§4) and **author/affiliation/email** (§6).
5. Choose **classifications/eJournals** (§5) — accept SSRN's suggestions and add the above.
6. Set **Date written** (§6).
7. Confirm you have the right to post (you do — own work, no prior exclusive transfer),
   agree to terms, **submit**.
8. It enters SSRN's moderation queue; approval is typically 1–2 business days, after which
   it gets a permanent SSRN URL and abstract-page DOI-like ID.

## 9. Notes

- SSRN hosts working papers freely; citing the (not-yet-public) companion notes is fine.
- No anonymization needed (SSRN is not double-blind).
- You can post revisions later; SSRN keeps a version history.
- Once it has an SSRN ID, add it to `papers/fan/index.html` and `CITATION.cff` if you want.
