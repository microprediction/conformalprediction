# Stop teaching conformal prediction as an alternative to statistics

*Draft 4. Post hostile-review, fact-checked, survey installed (seed 42, pool 990,
CSV in this directory). Quotes verbatim-confirmed per fact-check 2026-08-06.*

---

Conformal prediction has arrived in the classroom, and it has arrived wearing a
costume. It is taught as an alternative to statistical prediction: a way to attach
uncertainty to any model that is described, with striking frequency, as more
rigorous than the statistics around it. I want to argue that teaching it this way
does more harm than good, and that the repair is simple.

## The rigor claim

The claim appears at the journal level and floods the layer beneath. The field's
canonical tutorial promises "statistically rigorous uncertainty sets" that are
"guaranteed to contain the ground truth with a user-specified probability." A
Nature-family paper calls conformal prediction "essentially the only way to achieve
valid prediction regions." One rung down, the most popular community resource list
offers guarantees "regardless of the model or the data distribution," and one
vendor's documentation ranks forecasting methods in a table on which conformal
prediction is the only row with a full check for "calibration guarantee."

To be fair at the top: the careful sources are careful. The 2018 JASA paper that
anchors the modern method puts the word "marginal" in its abstract. The canonical
tutorial's own body warns that a bad score gives useless sets under perfectly valid
coverage, and calls adaptivity "non-negotiable." Berkeley's lecture notes spell out
what the coverage probability averages over, and even exhibit the trivial predictor
that achieves exact coverage while saying nothing at all. Even the exclusivity
claim has a theorem behind it, about validity alone. Which is the point: "valid" is
doing the marketing work, the qualifications live in the bodies of documents, the
abstracts travel without them, and the layer most students actually read quotes
only the abstracts. The implication that survives the descent is always the same:
model-based uncertainty is wishful, conformal uncertainty is proven.

The implication is refuted by an equally elementary theorem, one the curriculum
never mentions. When a forecaster pools model residuals into one law, the expected
penalty under the standard scoring rule of density forecasting is exactly the
mutual information between the residuals and the information being ignored. In
plain words: the forecaster pays, on average and for as long as the model is held
fixed, precisely the value of what pooling threw away. The identity is classical
in its parts, Shannon's currency and the forecast-verification literature's
decomposition; what is new is only the observation that it prices the conformal
stop, and the measurement of that price on real data. One rigorous theorem says
the ranks are calibrated on average. An equally rigorous theorem says what the
calibration costs. A curriculum built on the first alone teaches half a ledger.

## The bundle

Split conformal prediction is a bundle: fit a model, take a scalar residual, rank
the new residual among the old ones, read off the answer. The interesting member of
the bundle is the ranking, a univariate transform, and a step function in need of
one repair, interpolation, after which it is an ordinary invertible map with a
certificate at its output.

Because the bundle is taught whole, a remarkable cultural fact has gone largely
unremarked. Papers that touch the transform's output exist: copula couplings knit
transformed scores across targets, "scorecasters" forecast the score stream, and
conformal predictive systems emit whole distribution functions. But each stops at
a recalibrated set or a terminal distribution. To check that this is culture rather
than my imagination, I drew a seed-fixed random sample of one hundred conformal
papers from an arXiv pool of nearly a thousand. Ninety-three treat the conformal
step as strictly terminal. Seven route its output onward as a filter or a feature.
None fits a further predictive model on the transform's output and carries the
fitted law forward as the forecast, the routine move in copula econometrics, where
estimating an empirical margin, modeling dependence on the transformed scale, and
inverting has been standard practice for twenty years. Had
the steps been taught separately, as a transform in a toolbox beside location,
scale, and autoregression, no such uniformity of practice could have arisen. A
bias toward stopping was created by nothing more than packaging.

## The bias is measurable

The stop has a measurable price, and measuring it does not involve scoring sets by
alien metrics: the comparison is between two forecasters both built from the same
transform, one quoting the law at its output, one continuing to model, judged by
the scoring rules both sides share. On 572 economic series, forecasting one step
ahead, continuing beats stopping on average, and the same comparison run on
streams constructed to contain no signal shows the opposite sign, the ordinary
cost of estimating nothing, which is what certifies the corpus margin as signal.
Inserting the transform into a chain that continues also beats the identical chain
without it, decisively, because the transform's real service is coordinate
reshaping, a service the stopping convention discards. The stop is not a neutral
default. It is a forfeiture, made invisible by the fact that the certificate
arrives either way.

## What the certificate does not say

That last clause is the mechanism of the harm, and the fault is the certificate's
indifference, not the field's. The guarantee is marginal: ranks are uniform on
average over everything. It therefore arrives whether or not the residuals were
whitened, whether the model finished its work or never started. The field knows
this, and its efficiency literature, normalized scores, quantile scores,
group-conditional variants, exists precisely because everyone knows it. But the
certificate itself is silent on the matter, and in a classroom silence reads as
absolution. What the curriculum lacks is the theorem that prices the indifference,
and the theorem exists.

The price is not even fixed. The gap is the value of the structure your residuals
still carry, so a better model shrinks it, which is exactly why it belongs in the
curriculum: it is the theorem that tells a student what a better model is worth,
in the same units the certificate declines to discuss.

## An older, better lesson

Unbundled, the rank map is not new, and the honest lesson is a century of
statistics. Its knot probabilities are Weibull's plotting positions. Ranks to
normal scores is van der Waerden. Meteorology has run the normal quantile
transform inside predictive systems for decades. Copula econometrics estimates the
same empirical margin, models dependence on the transformed scale, and inverts.
The transform was even reintroduced, in 2022, as a data-preprocessing tool with no
conformal vocabulary at all. Taught this way, as the empirical distribution doing
what the empirical distribution has always done, the student inherits the whole
lineage plus one genuinely new fact: at this position in a chain, on exchangeable
input, the map's output carries a finite-sample certificate. That fact is worth a
lecture. It is not worth a paradigm.

## The inconsistency

Here is the epistemological core. Conformal prediction as taught is normative
about residuals: model them unconditionally, by the empirical law. Nobody teaches
that norm for the observable itself, because for the base model it is a priori
absurd; conditional structure is the entire subject. So the curriculum holds that
modeling is essential below the residual line and optional above it, with only the
mandatory step certified, and no invocation of coverage dissolves the asymmetry,
because coverage is indifferent to it.

The dissolution is trivial. Put the empirical whitening transform in the ordinary
toolbox, next to differencing and standardization, with its certificate noted at
its position. Then residual modeling is neither mandatory nor forbidden. It is a
modeling decision, judged the way every modeling decision is judged, by a proper
score on held-out data, and free to continue past the conformal ribbon-cutting
ceremony whenever anything remains to be found.

I am not the first to notice trouble. It has been observed, sharply, that the
guarantee's indifference to model quality means conformal prediction "almost
invites you to use garbage prediction functions," and the impossibility of
distribution-free conditional coverage has been in the journals for years. But the
critiques have aimed at the guarantee, and the guarantee, at its own position, is
fine. The harm is in the packaging: the stop taught as principle, the transform
taught as paradigm, and the ledger taught with one page missing.

## What to teach instead

Teach the empirical distribution and its plotting positions. Teach the transform,
its interpolation, and its certificate, stated exactly: finite-sample, marginal,
at one position, silent downstream. Teach the information gap beside it, stated
exactly: the average price of every unconditional stop, equal to the value of the
information ignored, shrinking as the model improves. Then let students discover,
on data, that the two theorems together imply neither stopping nor continuing but
measuring. That is statistics. It is what conformal prediction was before the
packaging, and it is a better subject than the costume.

---

*Further reading (5): Lei, G'Sell, Rinaldo, Tibshirani & Wasserman, JASA 2018 (the
guarantee, stated carefully); Foygel Barber, Candes, Ramdas & Tibshirani,
Information and Inference 2021 (the conditional impossibility); Recht, "Cover
Songs," argmin.net 2024 (an independent critique); Cotton, "An Empirical Study of
the Conformal Information Gap," SSRN 7220538 (the identity, measured); Cotton, the
transform-grammar paper, the survey sample and classifications, and interactive
demonstrations, all at conformalprediction.net.*
