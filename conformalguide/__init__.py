"""conformalguide: a tiny core, and a guide.

This package accompanies the guide at https://conformalprediction.net, which explains what
conformal prediction's coverage guarantee does and does not tell you. The code here is a
minimal, dependency-free split-conformal utility; the guide is the main event.

    >>> from conformalguide import predict_interval
    >>> lo, hi = predict_interval(2.0, residuals_cal=[-1, 0.5, -0.3, 0.9, -0.7], alpha=0.2)

See https://conformalprediction.net and the companion paper for the conceptual content.
"""
from .core import conformal_quantile, predict_interval, coverage
from .guardrails import coverage_dependence_test, CoverageAudited, coverage_dependence_scorer

__version__ = "0.0.1"
__all__ = [
    "conformal_quantile", "predict_interval", "coverage",
    "coverage_dependence_test", "CoverageAudited", "coverage_dependence_scorer",
    "__version__",
]
