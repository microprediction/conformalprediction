"""Time-series prediction-interval methods, online (one step ahead).

Two families:
  * Conformal-for-time-series. Reference implementations of the methods the
    libraries omit (AgACI, conformal-PID, NexCP/weighted) plus fixed split and
    plain ACI. MAPIE's own EnbPI/ACI are run separately in run_timeseries.py so
    we also test the actual library.
  * Probabilistic baselines that model the conditional distribution directly
    (the yardstick): an oracle that knows sigma_t, EWMA volatility, GARCH(1,1),
    and a non-adaptive recalibrated Gaussian.

Every method returns arrays (lo, hi) over the test stream, and the
distributional baselines additionally return (mu, sigma) so CRPS/log-score are
available. Methods consume the SAME point forecast mu_hat so differences are
purely in the uncertainty layer.
"""
from __future__ import annotations
import numpy as np
from scipy.stats import norm
from common import gaussian_interval

Z = lambda a: norm.ppf(1 - a / 2)


def _wquantile(vals, weights, q):
    """Weighted quantile (q in [0,1])."""
    order = np.argsort(vals)
    v = vals[order]; w = weights[order]
    cw = np.cumsum(w)
    if cw[-1] <= 0:
        return np.quantile(vals, q)
    cw = cw / cw[-1]
    return float(np.interp(q, cw, v))


# ---------------- Conformal-for-time-series ----------------

def fixed_split(mu_hat, resid_cal, y, alpha, **_):
    """Straw-man reference: constant width from an initial calibration block."""
    n = len(resid_cal)
    k = int(np.ceil((n + 1) * (1 - alpha)))
    q = np.inf if k > n else np.sort(np.abs(resid_cal))[k - 1]
    lo = mu_hat - q; hi = mu_hat + q
    return lo, hi


def aci(mu_hat, y, alpha, gamma=0.03, window=250, warm=None, **_):
    """Adaptive Conformal Inference (Gibbs & Candes 2021). Online alpha_t, width
    from a trailing window of recent absolute residuals."""
    T = len(y)
    lo = np.empty(T); hi = np.empty(T)
    a_t = alpha
    hist = list(np.abs(warm)) if warm is not None else []
    for t in range(T):
        if len(hist) >= 10 and 0 < a_t < 1:
            q = np.quantile(hist[-window:], 1 - a_t)
        elif a_t <= 0:
            q = np.inf
        elif a_t >= 1:
            q = 0.0
        else:
            q = np.quantile(hist, 0.9) if hist else 0.0
        lo[t] = mu_hat[t] - q; hi[t] = mu_hat[t] + q
        err = 0.0 if (lo[t] <= y[t] <= hi[t]) else 1.0
        # floor/cap alpha_t to (0,1): without this ACI occasionally emits an
        # infinite interval (a known wart); we keep it finite and note it in text.
        a_t = min(1 - 1e-3, max(1e-3, a_t + gamma * (alpha - err)))
        hist.append(abs(y[t] - mu_hat[t]))
    return lo, hi


def agaci(mu_hat, y, alpha, gammas=(0.005, 0.02, 0.05, 0.1, 0.2), window=250,
          eta=2.0, warm=None, **_):
    """Aggregated ACI (Zaffran et al. 2022): a Hedge aggregation over ACI experts
    with different learning rates, weights updated by their interval-score loss."""
    T = len(y); K = len(gammas)
    a = np.full(K, alpha)
    w = np.ones(K) / K
    hist = list(np.abs(warm)) if warm is not None else []
    lo = np.empty(T); hi = np.empty(T)
    for t in range(T):
        radii = np.empty(K)
        for k in range(K):
            if len(hist) >= 10 and 0 < a[k] < 1:
                radii[k] = np.quantile(hist[-window:], 1 - a[k])
            elif a[k] <= 0:
                radii[k] = np.inf
            else:
                radii[k] = 0.0
        finite = np.isfinite(radii)
        r = (np.sum(w[finite] * radii[finite]) / np.sum(w[finite])) if finite.any() else np.inf
        lo[t] = mu_hat[t] - r; hi[t] = mu_hat[t] + r
        # per-expert interval-score loss for this step
        e = abs(y[t] - mu_hat[t])
        for k in range(K):
            rk = radii[k]
            if np.isfinite(rk):
                loss = 2 * rk + (2 / alpha) * max(0.0, e - rk)
            else:
                loss = 1e6
            w[k] *= np.exp(-eta * loss / (1 + e))   # normalized loss for stability
            err = 0.0 if e <= rk else 1.0
            a[k] = min(1.0, max(0.0, a[k] + gammas[k] * (alpha - err)))
        w /= w.sum() if w.sum() > 0 else 1.0
        w = 0.98 * w + 0.02 / K                      # small mixing, avoids weight collapse
        hist.append(e)
    return lo, hi


def conformal_pid(mu_hat, y, alpha, window=250, Kp=0.10, Ki=0.02, warm=None, **_):
    """Conformal P+I control (after Angelopoulos, Candes & Tibshirani 2024):
    a trailing-quantile base radius plus proportional+integral correction on the
    running coverage error."""
    T = len(y)
    lo = np.empty(T); hi = np.empty(T)
    hist = list(np.abs(warm)) if warm is not None else []
    integral = 0.0
    for t in range(T):
        base = np.quantile(hist[-window:], 1 - alpha) if len(hist) >= 10 else (np.quantile(hist, 0.9) if hist else 1.0)
        scale = (np.quantile(hist[-window:], 0.95) - np.quantile(hist[-window:], 0.5)) if len(hist) >= 20 else base
        scale = max(scale, 1e-3)
        r = max(0.0, base + Kp * integral * scale)
        lo[t] = mu_hat[t] - r; hi[t] = mu_hat[t] + r
        err = (0.0 if (lo[t] <= y[t] <= hi[t]) else 1.0)
        integral += (err - alpha)                     # accumulate miscoverage error
        integral = float(np.clip(integral, -1.0 / max(Ki, 1e-6), 1.0 / max(Ki, 1e-6)))
        hist.append(abs(y[t] - mu_hat[t]))
    return lo, hi


def nexcp(mu_hat, y, alpha, rho=0.99, window=400, warm=None, **_):
    """Non-exchangeable / weighted conformal (Barber et al. 2023): recency-weighted
    quantile of recent absolute residuals (weights rho**age)."""
    T = len(y)
    lo = np.empty(T); hi = np.empty(T)
    hist = list(np.abs(warm)) if warm is not None else []
    for t in range(T):
        if len(hist) >= 10:
            recent = np.array(hist[-window:])
            ages = np.arange(len(recent))[::-1]
            w = rho ** ages
            q = _wquantile(recent, w, 1 - alpha)
        else:
            q = np.quantile(hist, 0.9) if hist else 1.0
        lo[t] = mu_hat[t] - q; hi[t] = mu_hat[t] + q
        hist.append(abs(y[t] - mu_hat[t]))
    return lo, hi


# ---------------- Probabilistic baselines (the yardstick) ----------------

def oracle_sigma(mu_hat, sigma_true, alpha, **_):
    """Same point forecast, but the TRUE conditional sd. The achievable frontier."""
    lo, hi = gaussian_interval(mu_hat, sigma_true, alpha)
    return lo, hi, mu_hat, np.asarray(sigma_true, float)


def ewma_vol(mu_hat, y, alpha, lam=0.94, warm=None, **_):
    """RiskMetrics EWMA volatility on residuals; Gaussian predictive."""
    T = len(y)
    lo = np.empty(T); hi = np.empty(T); sig = np.empty(T)
    if warm is not None and len(warm):
        var = float(np.mean(np.asarray(warm) ** 2))
    else:
        var = 1.0
    z = Z(alpha)
    for t in range(T):
        s = np.sqrt(max(var, 1e-9))
        sig[t] = s; lo[t] = mu_hat[t] - z * s; hi[t] = mu_hat[t] + z * s
        e = y[t] - mu_hat[t]
        var = lam * var + (1 - lam) * e * e
    return lo, hi, mu_hat, sig


def recal_const(mu_hat, resid_cal, alpha, **_):
    """Non-adaptive Gaussian: constant sd fit on calibration (log-score optimal const)."""
    s = float(np.sqrt(np.mean(np.asarray(resid_cal) ** 2)))
    T = len(mu_hat)
    sig = np.full(T, s)
    z = Z(alpha)
    return mu_hat - z * s, mu_hat + z * s, mu_hat, sig


def garch_vol(resid_train, resid_test, mu_hat, alpha, **_):
    """GARCH(1,1) conditional sd, rolling one-step forecasts; Gaussian predictive.
    Fit on the residual stream (mean=Zero). Falls back to EWMA on failure."""
    from arch import arch_model
    r_all = np.concatenate([resid_train, resid_test]).astype(float)
    scale = 1.0 / (np.std(r_all) + 1e-9)             # arch likes O(1-10) scale
    r_scaled = r_all * scale * 10.0
    n_tr = len(resid_train)
    try:
        am = arch_model(r_scaled[:n_tr], mean="Zero", vol="GARCH", p=1, q=1, dist="normal")
        res = am.fit(disp="off")
        # rolling one-step variance forecasts over the test region
        sig = np.empty(len(resid_test))
        params = res.params
        omega, a1, b1 = params["omega"], params["alpha[1]"], params["beta[1]"]
        var = res.conditional_volatility[-1] ** 2
        last_eps2 = r_scaled[n_tr - 1] ** 2
        for i in range(len(resid_test)):
            var = omega + a1 * last_eps2 + b1 * var
            sig[i] = np.sqrt(var) / (scale * 10.0)
            last_eps2 = r_scaled[n_tr + i] ** 2
        z = Z(alpha)
        return mu_hat - z * sig, mu_hat + z * sig, mu_hat, sig
    except Exception as ex:                            # pragma: no cover
        print("  [garch fell back to EWMA:", ex, "]")
        return ewma_vol(mu_hat, resid_test + mu_hat, alpha)
