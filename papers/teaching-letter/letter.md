# Teach conformal prediction without the costume

Conformal prediction has entered the classroom wearing a costume. It is presented
not as a technique for calibrating prediction sets, which it is, but as an
alternative to ordinary statistical prediction: a model-agnostic route to
uncertainty, more rigorous than the model-based methods around it. That presentation
does more harm than good, and the harm has a shape. It teaches students to stop
modeling one step too early, and it teaches them to call the last step of modeling by
another name.

## The rigour claim

The rhetoric starts qualified and loses its qualifications as it travels. A canonical
tutorial promises "statistically rigorous uncertainty sets" that are "guaranteed to
contain the ground truth with a user-specified probability." A Nature-family paper
calls conformal prediction "essentially the only way to achieve valid prediction
regions." One rung down, the most popular community resource list advertises
guarantees "regardless of the model or the data distribution," and one vendor's
documentation ranks forecasting methods in a table on which conformal prediction
alone earns a full mark for "calibration guarantee."

The careful sources are careful. The 2018 paper that anchors modern split conformal
prediction puts "marginal" in its abstract. The canonical tutorial's own body warns
that a poor score gives useless sets under perfectly valid coverage, and calls
adaptivity "non-negotiable." Course notes spell out what the coverage probability
averages over, and exhibit a trivial predictor that achieves exact coverage while
conveying nothing at all. That is the point. "Valid" does the rhetorical work, the
qualifications live in the bodies of documents, the abstracts travel without them,
and the layer most students read quotes only the abstracts. The contrast that
survives the descent is always the same: model-based uncertainty is wishful,
conformal uncertainty is proven.

It is a category error. A coverage theorem certifies coverage. It says nothing about
whether the conditioning information was used, whether the residuals were adequately
modeled, or whether the forecast is sharp. Those questions have their own theorems,
and one is elementary. Under the logarithmic score, the expected penalty for
forecasting a residual with its unconditional law rather than its conditional law is
exactly the mutual information between the residual and the information left out. The
average price of pooling residuals is exactly the information pooling throws away.
The ingredients are classical, Shannon's measure and the standard decomposition of
forecast loss; what is new is that the quantity prices the conformal stop, and that
the price has now been measured on real data. One theorem says the ranks are
calibrated on average. Another says what is forfeited when residual structure remains
and is ignored. Teach the first alone and you have shown half a ledger.

## The bundle, and the step nobody takes

Split conformal prediction is taught as a bundle: fit a model, take a scalar
residual, rank the new residual against the calibration residuals, invert the
threshold to a set. The distinctive operation is the ranking in the middle. Handled
for ties and discreteness, it is an empirical probability transform, a change of
coordinates that attaches a finite-sample marginal certificate at one point in a
chain. Nothing in the mathematics makes that point the end.

The convention makes it the end anyway, and the convention is nearly total. To test
the impression rather than trust it, I drew a seed-fixed random sample of one hundred
papers from an archive of nearly a thousand. Ninety-three treat the conformal step as
terminal. Seven pass its output downstream as a filter or a feature. None estimates
the transform, fits a further predictive law on the transformed scale, and carries
that law back through the inverse as its forecast, the move that has been routine in
copula econometrics for decades. This is not an impossibility theorem, and a
counterexample may lurk somewhere. It documents a convention that the mathematics
does not explain.

Two objections arrive here, and both sharpen the case. First, some conformal papers
do process the transformed scores: couplings knit them across targets, "scorecasters"
forecast the score sequence, predictive systems emit whole distribution functions.
But each terminates in a recalibrated set or a quoted law. None continues the way a
forecaster continues, by fitting structure and carrying the fitted law onward. The
cleverness goes into the last step before the stop, never past it.

Second, and this is the heart of it, the field's own efficiency literature is
conditional modeling flying a conformal flag. Conformalized quantile regression fits
a conditional quantile model, then calibrates it. Normalized and locally weighted
scores fit a conditional model of the residual scale, then divide by it. Mondrian and
group-conditional methods condition on a partition of the inputs. Every one of these
is precisely the conditional modeling that the "alternative to statistics" framing
calls unnecessary, performed and then tucked back under the certificate. The
discipline cannot help doing statistics. It simply does exactly one step of it,
re-certifies, and halts. That the field keeps reinventing conditional modeling under
a new name, and keeps stopping one step in, is the strongest evidence that the
packaging, not the mathematics, is doing the teaching.

## The cost of stopping

The stop has a measurable price, and measuring it does not score sets by a foreign
ruler. The comparison is between two probabilistic forecasters built from the same
transform, judged by a proper score both share: one quotes the unconditional law at
the transform's output, the other fits the remaining structure on the transformed
scale and carries the fitted law forward. Across 572 economic series forecast one
step ahead, continuing beats stopping on average. Repeated on synthetic streams built
to hold no signal, the sign flips, and continuing pays only the ordinary cost of
fitting structure that is not there. That negative control is what turns the economic
gain into a finding rather than a reward for extra flexibility. A second comparison is
as telling: a chain that contains the transform beats the identical chain without it,
because the transform's real service is coordinate reshaping, exposing structure in a
representation easier to model. The stop throws that service away, and the certificate
arrives either way. Stopping is not a neutral default. When structure remains it is a
forfeiture, and the decision to stop is empirical, not licensed by a certificate.

## What the certificate does not settle

The confusion has one source: the certificate is indifferent to model quality by
design. Under exchangeability the ranks are marginally valid whether the base model
is excellent or nearly useless, whether the residuals were whitened or are visibly
dependent. That robustness is real, and it is dangerous to teach without its
complement, because in a classroom silence about efficiency reads as absolution: once
coverage is certified, students infer that the modeling is finished.

The information gap supplies the missing lesson, and its value is constructive, not
merely critical. It tells a student what a better model is worth. If the base model
removes the conditional structure, the gap shrinks toward zero. If structure remains,
the value of continuing is exactly that gap, in the units the coverage theorem
declines to discuss. The two results are complementary. Conformal validity is the
calibration that survives a bad model; the information gap is the predictive value a
bad model leaves on the table. Neither refutes the other, and only one is taught.

## The older lineage

Unbundled, the rank operation belongs to a century of statistics. Its knot
probabilities are Weibull's plotting positions. Ranks to Gaussian scores is van der
Waerden. Meteorology has run the normal quantile transform inside predictive systems
for decades. Copula econometrics estimates an empirical margin, models dependence on
the transformed scale, and inverts. Machine learning reintroduced the same transform
in 2022 as a preprocessing device, with no conformal vocabulary at all. That is where
it should be taught: the empirical distribution as an estimator, the probability
transform as a change of coordinates, with plotting positions, ties, interpolation,
inversion, and the cost of estimating the transform. Then the genuinely new fact
lands cleanly. Built through exchangeable ranks, the transform's output carries a
finite-sample marginal certificate at its position. That is worth a lecture. It is
not worth a paradigm.

## The asymmetry

The deepest inconsistency is about conditional structure. For the observable, the
curriculum teaches that conditioning is the whole point: we model the conditional
law, not the marginal, because exploiting structure is what prediction is. Then a
base model produces a residual, and canonical practice replaces its conditional law
with its empirical marginal, full stop. Sometimes that is an excellent approximation.
Sometimes it is not, and the certificate cannot tell the cases apart. So modeling is
taught as essential below the residual line and presumptively finished above it, with
only the certified step mandatory and the rest made to look like embellishment.
Coverage cannot resolve the asymmetry, because coverage was built to ignore it.

The resolution is trivial. Put the empirical transform in the ordinary toolbox,
beside differencing, scaling, and whitening, and state its certificate exactly where
it holds. Then residual modeling is neither a conformal requirement nor a conformal
violation. It is a modeling decision, judged by proper scores on held-out data, free
to continue past the conformal ribbon-cutting whenever anything remains to be found.
Sometimes the evidence favors stopping. Sometimes continuing. The mathematics implies
neither universally, which is why the choice should be taught as a measurement, not a
rule.

## What to teach instead

Teach four things together. The empirical distribution, plotting positions,
randomized or interpolated ranks, and inverse transforms. The conformal certificate,
exactly: finite-sample, marginal, assumption-dependent, attached to one stage, silent
about efficiency. The information gap: under the log score, the cost of quoting a
residual's marginal in place of its conditional law is the information the marginal
discards, shrinking as the model improves. And a data exercise on both sides, where
students watch continuing hurt when no structure remains and help when it does, while
calibration stays valid either way.

None of this attacks the guarantee. At its position the guarantee is correct and
useful. The harm is the packaging: a stopping convention taught as a principle, an
empirical transform sold as a paradigm, conditional modeling smuggled back in under
the certificate, and a ledger shown with one page missing. Teach both pages and the
lesson is neither always stop nor always continue. It is measure. That is the better
subject, and it does not need the costume.

---

*Further reading: Lei, G'Sell, Rinaldo, Tibshirani and Wasserman (JASA, 2018), the
split-conformal guarantee stated carefully; Barber, Candes, Ramdas and Tibshirani
(Information and Inference, 2021), the limits of distribution-free conditional
coverage; Romano, Patterson and Candes (2019), conformalized quantile regression,
conditional modeling then calibration; Recht, "Cover Songs" (2024), an independent
critique; Cotton, "An Empirical Study of the Conformal Information Gap" (SSRN
7220538), the identity and its measurement; and Cotton's work on transform grammars,
the literature sample, and interactive demonstrations at conformalprediction.net.*
