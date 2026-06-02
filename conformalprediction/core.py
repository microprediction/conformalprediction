"""Minimal, dependency-free split conformal prediction.

Just enough to be useful and correct. The point of the project is the guide at
https://conformalprediction.net, not this module; richer functionality may follow.
"""
from __future__ import annotations

import math
from typing import Iterable, List, Sequence, Tuple, Union

Number = Union[int, float]


def conformal_quantile(scores: Iterable[Number], alpha: float) -> float:
    """The split-conformal quantile of nonconformity ``scores`` at miscoverage ``alpha``.

    Returns the ``ceil((n+1)(1-alpha))``-th smallest score (the finite-sample correction),
    or ``+inf`` when that rank exceeds ``n`` (the honest "infinite interval" case, when the
    calibration set is too small for the requested level).
    """
    if not 0.0 < alpha < 1.0:
        raise ValueError("alpha must be in (0, 1)")
    s = sorted(float(x) for x in scores)
    n = len(s)
    if n == 0:
        raise ValueError("need at least one calibration score")
    k = math.ceil((n + 1) * (1.0 - alpha))
    return math.inf if k > n else s[k - 1]


def predict_interval(
    point: Union[Number, Sequence[Number]],
    residuals_cal: Iterable[Number],
    alpha: float = 0.1,
) -> Union[Tuple[float, float], List[Tuple[float, float]]]:
    """Symmetric split-conformal interval(s) around a point prediction.

    ``residuals_cal`` are calibration residuals ``y - mu_hat(x)``; the band half-width is
    the conformal quantile of their absolute values. ``point`` may be a scalar (returns one
    ``(lo, hi)``) or a sequence (returns a list of ``(lo, hi)``). Marginal coverage of the
    resulting interval is at least ``1 - alpha`` under exchangeability.
    """
    q = conformal_quantile((abs(float(r)) for r in residuals_cal), alpha)
    try:
        return [(float(p) - q, float(p) + q) for p in point]  # type: ignore[union-attr]
    except TypeError:
        p = float(point)  # type: ignore[arg-type]
        return (p - q, p + q)


def coverage(
    intervals: Sequence[Tuple[Number, Number]],
    y: Sequence[Number],
) -> float:
    """Empirical coverage: the fraction of ``y[i]`` falling within ``intervals[i]``."""
    if len(intervals) != len(y):
        raise ValueError("intervals and y must have the same length")
    if not y:
        raise ValueError("need at least one observation")
    hits = sum(1 for (lo, hi), yi in zip(intervals, y) if lo <= yi <= hi)
    return hits / len(y)
