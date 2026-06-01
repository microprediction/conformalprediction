"""Shared synthetic data generators and proper-scoring metrics for the
Marginally Useful conformal benchmark.

Everything is synthetic with KNOWN ground truth so we can measure not just
marginal coverage but *conditional* coverage (against the true sigma) and the
*oracle* CRPS that no method can beat.
"""
from __future__ import annotations
import numpy as np
from scipy.stats import norm

# --------------------------------------------------------------------------
# Data generators (known conditional law => oracle is computable)
# --------------------------------------------------------------------------

def make_tabular(n=6000, seed=0, heavy_tail=False):
    """1-D heteroscedastic regression with known mean f(x) and sd s(x).

    y = f(x) + s(x) * eps,  eps ~ N(0,1) (or standardized Student-t).
    Returns dict with X (n,1), y, f (true mean), s (true sd).
    """
    rng = np.random.default_rng(seed)
    x = rng.uniform(0, 4, size=n)
    f = np.sin(1.3 * x) * 2 + 3
    s = 0.15 + 0.7 * x                      # sd grows with x: the hard region is large x
    if heavy_tail:
        df = 4
        eps = rng.standard_t(df, size=n) / np.sqrt(df / (df - 2))  # unit variance
    else:
        eps = rng.standard_normal(n)
    y = f + s * eps
    return dict(X=x.reshape(-1, 1), y=y, f=f, s=s, eps_kind="t4" if heavy_tail else "normal")


def make_timeseries(T=3000, seed=0, heavy_tail=False):
    """Nonstationary series with KNOWN one-step conditional law N(level_t, sigma_t^2).

    level_t: piecewise-linear trend (slope breaks) + seasonal sine + AR(1) wobble.
    sigma_t: low baseline, a smooth volatility ramp, and a high-vol regime block
             (vol clustering), all known exactly.
    Returns dict with y, level (true cond. mean), sigma (true cond. sd), t.
    """
    rng = np.random.default_rng(seed)
    t = np.arange(T)

    # piecewise-linear trend with slope breaks
    slope = np.zeros(T)
    breaks = [0, int(0.35 * T), int(0.6 * T), int(0.8 * T), T]
    slopes = [0.004, -0.002, 0.010, -0.001]
    for (a, b), m in zip(zip(breaks[:-1], breaks[1:]), slopes):
        slope[a:b] = m
    trend = np.cumsum(slope)
    season = 1.2 * np.sin(2 * np.pi * t / 80.0) + 0.5 * np.sin(2 * np.pi * t / 19.0)

    # time-varying volatility, known exactly
    sigma = np.full(T, 0.35)
    ramp = np.clip((t - 0.45 * T) / (0.15 * T), 0, 1)         # smooth ramp up
    sigma += 0.9 * ramp
    hi_a, hi_b = int(0.6 * T), int(0.72 * T)
    sigma[hi_a:hi_b] += 1.6                                    # high-vol regime block
    sigma += 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 47.0))  # mild vol seasonality

    level = trend + season
    # AR(1) wobble folded into the *known* mean so conditional law stays N(level, sigma)
    if heavy_tail:
        df = 5
        eps = rng.standard_t(df, size=T) / np.sqrt(df / (df - 2))
    else:
        eps = rng.standard_normal(T)
    y = level + sigma * eps
    return dict(y=y, level=level, sigma=sigma, t=t,
                eps_kind="t5" if heavy_tail else "normal")


def lag_features(y, n_lags=10):
    """Build AR design matrix X[t] = (y[t-1],...,y[t-n_lags]); rows aligned to y[n_lags:]."""
    T = len(y)
    X = np.empty((T - n_lags, n_lags))
    for k in range(1, n_lags + 1):
        X[:, k - 1] = y[n_lags - k: T - k]
    return X, y[n_lags:], n_lags

# --------------------------------------------------------------------------
# Proper scoring rules and coverage diagnostics
# --------------------------------------------------------------------------

def coverage(lo, hi, y):
    lo, hi, y = np.asarray(lo), np.asarray(hi), np.asarray(y)
    return float(np.mean((y >= lo) & (y <= hi)))


def mean_width(lo, hi):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    w = hi - lo
    finite = np.isfinite(w)
    return float(np.mean(w[finite])) if finite.any() else np.inf


def frac_infinite(lo, hi):
    w = np.asarray(hi, float) - np.asarray(lo, float)
    return float(np.mean(~np.isfinite(w)))


def interval_score(lo, hi, y, alpha):
    """Winkler / interval score for a central (1-alpha) interval. Proper; lower=better.
    Infinite intervals are penalized by capping width contribution? No: we keep them
    +inf so a method that resorts to (-inf,inf) is correctly scored as useless."""
    lo, hi, y = np.asarray(lo, float), np.asarray(hi, float), np.asarray(y, float)
    width = hi - lo
    # use np.where to avoid 0*inf -> nan when an interval is (-inf, inf)
    pen_lo = np.where(y < lo, lo - y, 0.0)
    pen_hi = np.where(y > hi, y - hi, 0.0)
    s = width + (2.0 / alpha) * (pen_lo + pen_hi)
    return float(np.mean(s))


def pinball(y, q, tau):
    y, q = np.asarray(y, float), np.asarray(q, float)
    d = y - q
    return float(np.mean(np.maximum(tau * d, (tau - 1) * d)))


def crps_gaussian(mu, sigma, y):
    """Closed-form CRPS for Gaussian forecasts. Lower=better."""
    mu, sigma, y = np.asarray(mu, float), np.asarray(sigma, float), np.asarray(y, float)
    sigma = np.maximum(sigma, 1e-12)
    z = (y - mu) / sigma
    return float(np.mean(sigma * (z * (2 * norm.cdf(z) - 1) + 2 * norm.pdf(z) - 1 / np.sqrt(np.pi))))


def crps_samples(samples, y):
    """Sample-based CRPS estimator (energy form). samples: (n, m); y: (n,)."""
    samples = np.asarray(samples, float)
    y = np.asarray(y, float)
    n, m = samples.shape
    term1 = np.mean(np.abs(samples - y[:, None]), axis=1)
    s = np.sort(samples, axis=1)
    # E|X-X'| via sorted order statistics: (2/m^2) sum_i (2i-m+1) s_i  (i from 0)
    idx = (2 * np.arange(1, m + 1) - m - 1)
    term2 = (2.0 / (m * m)) * np.sum(idx[None, :] * s, axis=1)
    return float(np.mean(term1 - 0.5 * term2))


def log_score_gaussian(mu, sigma, y):
    mu, sigma, y = np.asarray(mu, float), np.asarray(sigma, float), np.asarray(y, float)
    sigma = np.maximum(sigma, 1e-12)
    return float(np.mean(norm.logpdf(y, mu, sigma)))


def rolling_coverage(lo, hi, y, window=50):
    lo, hi, y = np.asarray(lo, float), np.asarray(hi, float), np.asarray(y, float)
    hit = ((y >= lo) & (y <= hi)).astype(float)
    if len(hit) < window:
        return np.array([hit.mean()])
    c = np.convolve(hit, np.ones(window) / window, mode="valid")
    return c


def worst_window_coverage(lo, hi, y, window=50):
    rc = rolling_coverage(lo, hi, y, window)
    return float(np.min(rc)) if len(rc) else np.nan


def coverage_by_stratum(lo, hi, y, strat, n_bins=4):
    """Conditional coverage within quantile bins of `strat` (e.g. true sigma)."""
    lo, hi, y, strat = map(lambda a: np.asarray(a, float), (lo, hi, y, strat))
    edges = np.quantile(strat, np.linspace(0, 1, n_bins + 1))
    edges[-1] += 1e-9
    out = []
    for b in range(n_bins):
        m = (strat >= edges[b]) & (strat < edges[b + 1])
        out.append(coverage(lo[m], hi[m], y[m]) if m.any() else np.nan)
    return np.array(out)


def gaussian_interval(mu, sigma, alpha):
    z = norm.ppf(1 - alpha / 2)
    mu, sigma = np.asarray(mu, float), np.asarray(sigma, float)
    return mu - z * sigma, mu + z * sigma
