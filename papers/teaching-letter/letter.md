# Stop teaching conformal prediction as an alternative to statistics

*Draft 1. Venue-agnostic; trim to the chosen format. Bracketed slots take docket
quotes and final citations.*

---

Conformal prediction has arrived in the classroom, and it has arrived wearing a
costume. It is taught as an alternative to statistical prediction: a way to attach
uncertainty to any model that is described, with striking frequency, as more
rigorous than the statistics it displaces. I want to argue that teaching it this
way does more harm than good, and that the repair is simple.

## The rigor claim

The claim appears at the journal level and floods the layer beneath: tutorials,
books, course notes, vendor documentation. [DOCKET QUOTES: two or three, one per
stratum.] The word is nearly always "rigorous," sometimes "guaranteed," and the
implication is always the same: model-based uncertainty is wishful, conformal
uncertainty is proven.

The implication is flatly refuted by an equally rigorous statement. When a
forecaster pools model residuals into one law, the expected log-score regret
against the conditional oracle is exactly the mutual information between the
residuals and the inputs being ignored. This is an identity, not a bound from an
idealization. It is proved with the same tools, holds in the same generality, and
prices precisely the step that the conformal pattern performs. One rigorous theorem
says the ranks are calibrated on average. An equally rigorous theorem says what
that calibration costs, permanently, and no amount of data reduces it. A curriculum
that teaches the first theorem and not the second is not teaching rigor. It is
teaching half a ledger.

## The bundle

Split conformal prediction is a bundle: fit a model, take a scalar residual, apply
the fence-post rank map, read off the set. The interesting member of the bundle is
the rank map, a univariate transform, and a step function in need of one repair,
interpolation, after which it is an ordinary invertible map with a certificate at
its output.

Because the bundle is taught whole, a remarkable cultural fact has gone unremarked:
as far as I can determine, not a single paper in the conformal literature fits a
model to the transform's output. The map's image is a stream in friendly
coordinates, approximately uniform, approximately independent under the very
hypothesis the method assumes, and the literature stops at it, every time. Wrappers
recalibrate other systems and stop. Time-series variants model the score stream and
still emit a terminal set. Nothing continues. Had the steps been taught separately,
as a transform in a toolbox beside location, scale, and autoregression, no such
uniformity of practice could have arisen. A profound bias toward premature stopping
was created by nothing more than packaging.

## The bias is measurable

On 572 economic series, forecasting one step ahead and scoring properly, refitting
a serial model on the transform's output beats stopping at it on average, and the
same comparison run on iid null streams shows the expected estimation cost and
nothing else: the corpus margin is signal, not artifact. More striking, inserting
the transform into a chain that continues outperforms the identical chain without
it by a wide margin under both the log score and CRPS, because the transform's real
service is coordinate reshaping, a service the stopping convention throws away.
[CITE: grammar paper campaign; frontier paper.] The stop is not a neutral default.
It is a measurable forfeiture, made invisible by the fact that the certificate
holds either way.

## What the guarantee does not say

That last clause is the mechanism of the harm. The conformal guarantee is marginal:
ranks are uniform on average over everything. It therefore holds whether or not the
residuals were whitened, whether or not the model finished its work, whether or not
anything about tonight resembles the average night. The guarantee is methodologically
silent on exactly the conditions under which the method would deserve its
advertised adjective, and silence, in a classroom, reads as absolution. Students
learn that the certificate arrives regardless, and so it does. What does not arrive
regardless is predictive value, and the curriculum contains no theorem about that,
though one exists.

## An older, better lesson

Unbundled, the rank map is not new, and the honest lesson is a century of
statistics. Its knot probabilities are Weibull's plotting positions. Ranks to
normal scores is van der Waerden. Meteorology has run the normal quantile transform
inside predictive systems for decades. Copula econometrics estimates the same
empirical marginal, models dependence on the transformed scale, and inverts, which
is precisely the continue-past-the-stop architecture the conformal literature
lacks. The transform was even reintroduced, in 2022, as a data-preprocessing tool,
with no conformal vocabulary at all. Taught this way, as the empirical distribution
doing what the empirical distribution has always done, the student inherits the
whole lineage and one genuinely new fact: at this position in a chain, on
exchangeable input, the map's output carries a finite-sample certificate. That fact
is worth a lecture. It is not worth a paradigm.

## The inconsistency

Here is the epistemological core, and it fits in three sentences. Conformal
prediction as taught is normative about residuals: model them unconditionally, by
the empirical law, full stop. Nobody would teach that norm for the observable
itself, because for the base model it is a priori absurd; conditional structure is
the entire subject. A method cannot coherently hold that modeling is essential
below the residual line and forbidden above it, and no invocation of coverage
dissolves the incoherence, because coverage is indifferent to it.

The dissolution is instead trivial. Put an empirical whitening transform in the
ordinary toolbox, next to differencing and standardization, with its certificate
noted at its position. Then residual modeling is neither mandatory nor forbidden.
It is a modeling decision, judged the way every modeling decision is judged, by a
proper score on held-out data, and free to continue past the conformal
ribbon-cutting ceremony whenever anything remains to be found.

## What to teach instead

Teach the empirical distribution and its plotting positions. Teach the transform,
its interpolation, and its certificate, stated exactly: finite-sample, marginal, at
one position, silent downstream. Teach the information gap beside it, stated
exactly: the permanent log-score price of every unconditional stop, equal to the
information ignored. Then let students discover, on data, that the two theorems
together imply neither stopping nor continuing but measuring. That is statistics.
It is what conformal prediction was before the packaging, and it is a better
subject than the costume.

---

*[Author note, disclosures, and citations per venue format. Supporting technical
papers: the information gap identity and measurements; the transform-grammar paper
and its 572-series campaign; interactive demonstrations at conformalprediction.net.]*
