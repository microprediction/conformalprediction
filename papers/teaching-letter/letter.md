# Teach conformal prediction with both guarantees

Conformal prediction has entered the classroom. It is presented
not as a technique for calibrating prediction sets, which it is, but as an
alternative to ordinary statistical prediction: a model-agnostic route to
uncertainty, more rigorous than the model-based methods around it. That presentation
does more harm than good in a very specific manner: it teaches students to stop
modeling too early. And its claim to rigor, depending on the application, is at best one-sided and at worst 
refuted directly by a classical information identity.

## Rigor cuts both ways

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
conveying nothing at all.

That is the point. Words like "valid", "rigorous", "guarantee" are the headline and
the qualifications get buried. The layer most students read quotes only the abstracts. The contrast that
survives the descent is always the same: model-based uncertainty is wishful,
conformal uncertainty is proven.

Yet the rebuke is just as rigorous as the coverage guarantee, and I have not found it stated in the conformal literature. Under the logarithmic score, the expected penalty for forecasting a residual with its unconditional law rather than its conditional law is exactly the mutual information between the residual and the information left out.

This second, more unfortunate guarantee has a financial interpretation. It is the mean growth rate of the bankroll of an oracle who bets at the prices offered by someone using split conformal prediction. As unwelcome as that might sound, this side of the Faustian bargain should be presented alongside the average coverage guarantee.


## Students stop modeling too early, as do practitioners

The pedagogical danger: encouraging early stopping in the modeling pipeline. This is not a risk for
students or newcomers alone, but in fact for the profession as a whole who should know better.
Conformal prediction is presented as a package deal: several steps tied together that are sometimes
considered, in aggregate, to constitute an important new paradigm (or brand, dare I say).

This is manifestly nonsense. The empirical distribution is not a modeling panacea. The far more useful
 representation of the key idea, which is of course not new at all, is simply as a univariate transform motivated
 by the empirical distribution, one that can - and this is the key point - be
useful in the beginning, middle or end of a chain of transformations of the data.

Instead, split conformal prediction is taught as a bundle: fit a model, take a scalar
residual, rank the new residual against the calibration residuals, invert the
threshold to a set. The distinctive operation is the ranking in the middle, nothing more,
with handling for ties and discreteness. Some tidy univariate book-keeping for sure, but little beyond.

That "little" is valid, of course. The change of
coordinates can attach a finite-sample marginal certificate at one point in a
chain. But nothing in the mathematics makes that point the end of the process, and to the contrary,
an emphasis on coverage accounting on average can paper over poor modeling (the more common critique, that
we won't belabor).

The conformal convention makes this univariate change of variable the end anyway, and the convention is almost
unanimously followed. To test the impression rather than trust it, I drew a seed-fixed random sample of one hundred
papers from an archive of nearly a thousand conformal prediction papers. Ninety-three treat the conformal step as
terminal. Seven pass its output downstream as a filter or a feature.

Not a single one of those one hundred papers estimates the transform, fits a further predictive law on the transformed scale, and carries that law back through the inverse as its forecast, the move that has been routine in
copula econometrics for decades.

## Wiggling 

Two objections sharpen the case rather than blunt it. First, some conformal papers do
process the transformed scores: couplings knit them across targets, "scorecasters"
forecast the score sequence, predictive systems emit whole distribution functions. But
each terminates in a recalibrated set or a quoted law, never continuing the way a
forecaster continues, by fitting structure and carrying the fitted law onward.

Second, and this is the real tell, the field's own efficiency literature is
conditional modeling flying a conformal flag. Conformalized quantile regression fits a
conditional quantile model, then calibrates it. Normalized scores fit a conditional
model of the residual scale, then divide by it. Mondrian methods condition on a
partition of the inputs. Each is exactly the conditional modeling the "alternative to
statistics" framing calls unnecessary, performed and then tucked back under the
certificate. 

The discipline cannot help doing statistics; it simply does one step of
it, re-certifies, and halts. That it keeps reinventing conditional modeling under a new
name, and keeps stopping one step in, is the strongest evidence that the packaging, not
the mathematics, is doing the teaching.

The Vovk periodogram — the spectrum of the conformal p-value stream, which exchangeability requires to be flat — is almost a reductio ad absurdum. Look at it, and one of two things is true. It is flat, in which case the residuals were already white and the calibration certified nothing you did not already have for free. Or it has a peak, in which case exchangeability has failed, the ranks carry exploitable structure, and the certificate you just collected is a guarantee about the one axis that structure leaves untouched. Vovk himself supplies the instrument, in the same family as the test martingales that police online exchangeability, and its needle argues against stopping whichever way it falls. A method that ships with a built-in detector for its own inadequacy is not quite a contradiction. But it is close.

## The empirical finding

The early stopping has a measurable price when tested on economic time-series data. The relevant comparison is between two probabilistic forecasters built from the same transform, judged by a proper score. One quotes the unconditional law at
the transform's output, the other fits the remaining structure on the transformed
scale and carries the fitted law forward.

Across 701 economic series forecast one step ahead, continuing beats stopping on average. Repeated on synthetic streams built
to hold no signal, the sign flips, and continuing pays only the ordinary cost of
fitting structure that is not there. That negative control is what turns the economic
gain into a finding rather than a reward for extra flexibility.

A second comparison is as telling: a chain that contains the transform beats the identical chain without it,
because the transform's real service is coordinate reshaping, exposing structure in a
representation easier to model. The stop throws that service away, and the certificate
arrives either way. Stopping is not a neutral default. When structure remains it is a
forfeiture, and the decision to stop ought to be empirical instead.  

## The simple pedagogical solution

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
bad model leaves on the table.

Neither refutes the other, and only one is taught.

## Teaching the lineage

Unbundled, the rank operation belongs to a century of statistics. Its knot
probabilities are Weibull's plotting positions. Ranks to Gaussian scores is van der
Waerden. Meteorology has run the normal quantile transform inside predictive systems
for decades. Copula econometrics estimates an empirical margin, models dependence on
the transformed scale, and inverts.

Machine learning reintroduced the same transform in 2022 as a preprocessing device, with no conformal vocabulary at all. That is where
it should be taught: the empirical distribution as an estimator, the probability
transform as a change of coordinates, with plotting positions, ties, interpolation,
inversion, and the cost of estimating the transform.

Then the genuinely new contribution can be presented cleanly. Built through exchangeable ranks, the transform's output carries a
finite-sample marginal certificate at its position. That is worth a lecture. It is
not worth a paradigm.

## The philosophical asymmetry

The deepest inconsistency is methodological. For the observable, the
curriculum teaches that conditioning is the whole point: we model the conditional
law, not the marginal, because exploiting structure is what prediction is. Then a
base model produces a residual, and canonical practice replaces its conditional law
with its empirical marginal, full stop. 

Why would a highly normative procedure be appropriate for one problem and not the other? 

Sometimes the empirical distribution that is an excellent approximation for model residuals. Sometimes it is not, and the certificate cannot tell the cases apart. So modeling is
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

None of this attacks the guarantee. At its position the guarantee is correct and
useful. The harm is the packaging: a stopping convention taught as a principle, an
empirical transform sold as a paradigm, conditional modeling smuggled back in under
the certificate, and a very one-sided notion of "rigorous". Teach both rigorous results and the
lesson is neither always stop nor always continue. It is measure. That is the better
subject, and it can be taught honestly.

---

*Further reading: Lei, G'Sell, Rinaldo, Tibshirani and Wasserman (JASA, 2018), the
split-conformal guarantee stated carefully; Barber, Candes, Ramdas and Tibshirani
(Information and Inference, 2021), the limits of distribution-free conditional
coverage; Recht, "Cover Songs" (2024), an independent
critique; Berta, Holzm\"uller, Bach and Jordan, "CalArena" (2026), a large-scale
calibration benchmark that scores post-hoc methods by their improvement in a proper
scoring rule, from outside the conformal literature; Cotton, "An Empirical Study of
the Conformal Information Gap" (SSRN
7220538), the identity and its measurement; Cotton, "Conformal Prediction as a Transform
within a Grammar for Probabilistic Forecasting" (SSRN 7244778), the transform as one step in
a larger grammar of state-conditional bijections; and the literature sample and interactive
demonstrations at conformalprediction.net.*
