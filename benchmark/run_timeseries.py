"""Time-series benchmark: do conformal-for-time-series methods help, and on which
axis? We judge marginal coverage, *conditional* coverage (against true sigma_t and
worst rolling window), interval efficiency, and the proper interval (Winkler) score,
against probabilistic baselines and an oracle that knows sigma_t.

Run:  python run_timeseries.py
Writes results/ts_results.csv and figures/ts_*.png
"""
from __future__ import annotations
import os, warnings, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import common as C
import ts_methods as M

try:
    from timemachines.skaters.simple.thinking import thinking_fast_and_slow as _SKATER
    _HAVE_SKATER = True
except Exception:
    _HAVE_SKATER = False


def _skater_preds(yraw):
    """Run a skater (microprediction/timemachines) online over the raw series and return
    one-step-ahead (mu, sd) aligned so that index t is the forecast of y[t]."""
    s = {}
    mu = np.full(len(yraw), np.nan); sd = np.full(len(yraw), np.nan)
    for t in range(len(yraw)):
        x, x_std, s = _SKATER(y=float(yraw[t]), s=s, k=1)   # forecast of y[t+1]
        if t + 1 < len(yraw):
            mu[t + 1] = x[0]; sd[t + 1] = max(float(x_std[0]), 1e-6)
    return mu, sd

OUT = os.path.dirname(__file__)
os.makedirs(os.path.join(OUT, "results"), exist_ok=True)
os.makedirs(os.path.join(OUT, "figures"), exist_ok=True)

ALPHA = 0.1
N_LAGS = 12
FIT_END, CAL_END = 700, 1000   # indices into the lag-aligned arrays
WINDOW = 100                   # rolling-coverage window


def base_forecast(y):
    X, yy, _ = C.lag_features(y, N_LAGS)
    model = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
    model.fit(X[:FIT_END], yy[:FIT_END])
    mu = model.predict(X)
    return X, yy, mu


def run_once(seed=0, heavy_tail=False):
    d = C.make_timeseries(T=3500, seed=seed, heavy_tail=heavy_tail)
    X, yy, mu = base_forecast(d["y"])
    sig_true = d["sigma"][N_LAGS:]
    resid = yy - mu

    ts = slice(CAL_END, len(yy))            # test region
    mu_te, y_te, sig_te = mu[ts], yy[ts], sig_true[ts]
    warm = resid[:CAL_END]                   # residual history before test
    resid_cal = resid[FIT_END:CAL_END]
    resid_tr = resid[:FIT_END]

    methods = {}   # name -> (lo, hi, mu_or_None, sigma_or_None, family)
    # --- conformal-for-time-series ---
    methods["fixed split (CP)"] = (*M.fixed_split(mu_te, resid_cal, y_te, ALPHA), None, None, "cp")
    methods["ACI"] = (*M.aci(mu_te, y_te, ALPHA, gamma=0.03, warm=warm), None, None, "cp")
    methods["AgACI"] = (*M.agaci(mu_te, y_te, ALPHA, warm=warm), None, None, "cp")
    methods["conformal PID"] = (*M.conformal_pid(mu_te, y_te, ALPHA, warm=warm), None, None, "cp")
    methods["NexCP (weighted)"] = (*M.nexcp(mu_te, y_te, ALPHA, warm=warm), None, None, "cp")
    # --- probabilistic baselines (yardstick) ---
    level_te = d["level"][N_LAGS:][ts]
    lo, hi = C.gaussian_interval(level_te, sig_te, ALPHA)
    methods["oracle (true μ,σ)"] = (lo, hi, level_te, sig_te, "oracle")
    lo, hi, m_, s_ = M.oracle_sigma(mu_te, sig_te, ALPHA); methods["true σ on est. μ"] = (lo, hi, m_, s_, "oracle")
    lo, hi, m_, s_ = M.ewma_vol(mu_te, y_te, ALPHA, warm=warm); methods["EWMA-vol Gaussian"] = (lo, hi, m_, s_, "prob")
    lo, hi, m_, s_ = M.garch_vol(resid_tr, resid[CAL_END:], mu_te, ALPHA); methods["GARCH(1,1) Gaussian"] = (lo, hi, m_, s_, "prob")
    lo, hi, m_, s_ = M.recal_const(mu_te, resid_cal, ALPHA); methods["static Gaussian (recal)"] = (lo, hi, m_, s_, "prob")

    # --- skaters: a real probabilistic forecaster (the essay's own tool) ---
    if _HAVE_SKATER:
        sk_mu_f, sk_sd_f = _skater_preds(d["y"])
        orig = np.arange(len(yy)) + N_LAGS              # original index of each lag-aligned row
        sk_mu, sk_sd = sk_mu_f[orig], sk_sd_f[orig]
        sk_mu_te, sk_sd_te = sk_mu[ts], sk_sd[ts]
        z = M.Z(ALPHA)
        methods["skaters (Gaussian)"] = (sk_mu_te - z * sk_sd_te, sk_mu_te + z * sk_sd_te,
                                         sk_mu_te, sk_sd_te, "prob")
        sk_resid_cal = yy[FIT_END:CAL_END] - sk_mu[FIT_END:CAL_END]
        methods["skaters + split conformal"] = (*M.fixed_split(sk_mu_te, sk_resid_cal, y_te, ALPHA), None, None, "cp")
        # fair, adaptive conformalization: normalized score |resid|/sd keeps skaters' sigma_t
        sk_sd_cal = sk_sd[FIT_END:CAL_END]
        norm_scores = np.sort(np.abs(sk_resid_cal) / np.maximum(sk_sd_cal, 1e-6))
        kk = int(np.ceil((len(norm_scores) + 1) * (1 - ALPHA)))
        qn = np.inf if kk > len(norm_scores) else norm_scores[kk - 1]
        methods["skaters + norm. conformal"] = (sk_mu_te - qn * sk_sd_te, sk_mu_te + qn * sk_sd_te,
                                                None, None, "cp")

    # --- MAPIE's own time-series skins (the actual library) ---
    methods.update(_mapie_ts(X, yy, mu, ts))

    rows = []
    for name, (lo, hi, m_, s_, fam) in methods.items():
        lo = np.asarray(lo, float); hi = np.asarray(hi, float)
        row = dict(method=name, family=fam,
                   marg_cov=C.coverage(lo, hi, y_te),
                   worst_win_cov=C.worst_window_coverage(lo, hi, y_te, WINDOW),
                   width=C.mean_width(lo, hi),
                   frac_inf=C.frac_infinite(lo, hi),
                   interval_score=C.interval_score(lo, hi, y_te, ALPHA))
        cbs = C.coverage_by_stratum(lo, hi, y_te, sig_te, 4)
        row["cov_lowvol"] = cbs[0]; row["cov_hivol"] = cbs[-1]
        row["cond_cov_gap"] = float(np.nanmax(np.abs(cbs - (1 - ALPHA))))
        if s_ is not None:
            row["CRPS"] = C.crps_gaussian(m_, s_, y_te)
            row["logscore"] = C.log_score_gaussian(m_, s_, y_te)
        else:
            row["CRPS"] = np.nan; row["logscore"] = np.nan
        rows.append(row)
    return pd.DataFrame(rows), (methods, y_te, sig_te, d, ts)


def _mapie_ts(X, yy, mu, ts):
    """Run MAPIE's EnbPI and ACI if the installed version cooperates."""
    out = {}
    try:
        from mapie.regression import TimeSeriesRegressor
        from mapie.subsample import BlockBootstrap
        from sklearn.linear_model import Ridge as R
        from sklearn.pipeline import make_pipeline as mp
        from sklearn.preprocessing import StandardScaler as SS
        Xtr, ytr = X[:CAL_END], yy[:CAL_END]
        Xte = X[ts]; n_te = Xte.shape[0]
        cv = BlockBootstrap(n_resamplings=20, length=48, overlapping=True, random_state=0)
        base = mp(SS(), R(alpha=1.0))
        yte = yy[ts]; n_te = Xte.shape[0]
        # EnbPI, run ONLINE (stream residuals each step) — its intended adaptive mode.
        try:
            enb = TimeSeriesRegressor(base, method="enbpi", cv=cv, agg_function="mean")
            enb.fit(Xtr, ytr); enb.conformalize(Xtr, ytr)
            lo = np.empty(n_te); hi = np.empty(n_te)
            for i in range(n_te):
                _, itv = enb.predict(Xte[i:i+1], confidence_level=1 - ALPHA, allow_infinite_bounds=True)
                lo[i], hi[i] = itv[0, 0, 0], itv[0, 1, 0]
                enb.update(Xte[i:i+1], yte[i:i+1], gamma=0.0)   # stream residuals, no level adaptation
            out["MAPIE EnbPI (online)"] = (lo, hi, None, None, "cp")
        except Exception as e:
            print("  [MAPIE EnbPI failed:", repr(e)[:160], "]")
        # ACI (online adaptation)
        try:
            aci = TimeSeriesRegressor(base, method="aci", cv=cv, agg_function="mean")
            aci.fit(Xtr, ytr); aci.conformalize(Xtr, ytr)
            lo = np.empty(n_te); hi = np.empty(n_te)
            yte = yy[ts]
            for i in range(n_te):
                _, itv = aci.predict(Xte[i:i+1], confidence_level=1 - ALPHA, allow_infinite_bounds=True)
                lo[i], hi[i] = itv[0, 0, 0], itv[0, 1, 0]
                aci.update(Xte[i:i+1], yte[i:i+1], gamma=0.03)
            out["MAPIE ACI"] = (lo, hi, None, None, "cp")
        except Exception as e:
            print("  [MAPIE ACI failed:", repr(e)[:160], "]")
    except Exception as e:
        print("  [MAPIE unavailable:", repr(e)[:160], "]")
    return out


def main():
    # average over a few seeds for stable numbers; keep one seed's curves for plots
    frames = []
    keep = None
    for seed in range(5):
        df, art = run_once(seed=seed, heavy_tail=False)
        frames.append(df)
        if seed == 0:
            keep = art
    alldf = pd.concat(frames)
    agg = alldf.groupby(["method", "family"], sort=False).mean(numeric_only=True).reset_index()
    agg = agg.sort_values("interval_score")
    cols = ["method", "family", "marg_cov", "worst_win_cov", "cov_hivol", "cond_cov_gap",
            "width", "frac_inf", "interval_score", "CRPS", "logscore"]
    agg = agg[cols]
    agg.to_csv(os.path.join(OUT, "results", "ts_results.csv"), index=False)
    pd.set_option("display.width", 160, "display.max_columns", 20)
    print("\n=== TIME-SERIES BENCHMARK (mean over 5 seeds, alpha=0.1, target cov 0.90) ===")
    print(agg.round(3).to_string(index=False))

    _figures(keep, agg)
    print("\nwrote results/ts_results.csv and figures/ts_*.png")


def _figures(keep, agg):
    methods, y_te, sig_te, d, ts = keep
    t = np.arange(len(y_te))
    # 1) rolling coverage over time, selected methods
    sel = ["fixed split (CP)", "ACI", "conformal PID", "EWMA-vol Gaussian", "oracle-σ (knows σ_t)"]
    plt.figure(figsize=(9, 4.2))
    for nm in sel:
        if nm in methods:
            lo, hi, *_ = methods[nm]
            rc = C.rolling_coverage(lo, hi, y_te, WINDOW)
            plt.plot(np.arange(len(rc)), rc, label=nm, lw=1.4)
    plt.axhline(1 - ALPHA, color="k", ls="--", lw=1, label="target 0.90")
    # shade the high-vol regime within the test window
    plt.xlabel(f"test step (rolling coverage, window={WINDOW})"); plt.ylabel("coverage")
    plt.ylim(0.4, 1.02); plt.legend(fontsize=8, ncol=2); plt.title("Coverage now, not on average: rolling coverage under drift")
    plt.tight_layout(); plt.savefig(os.path.join(OUT, "figures", "ts_coverage.png"), dpi=130); plt.close()

    # 2) the coverage–sharpness plane: interval score vs worst-window coverage
    plt.figure(figsize=(7.6, 5.2))
    colors = {"cp": "#1f4ed8", "prob": "#15803d", "oracle": "#c2410c"}
    for _, r in agg.iterrows():
        c = colors.get(r["family"], "#666")
        plt.scatter(r["worst_win_cov"], r["interval_score"], c=c, s=45)
        plt.annotate(r["method"], (r["worst_win_cov"], r["interval_score"]),
                     fontsize=7, xytext=(4, 3), textcoords="offset points")
    plt.axvline(1 - ALPHA, color="k", ls="--", lw=1)
    plt.xlabel("worst rolling-window coverage  (→ conditional coverage)")
    plt.ylabel("interval (Winkler) score  (lower = better)")
    plt.title("Time-series: efficiency vs. worst-case coverage")
    from matplotlib.lines import Line2D
    plt.legend(handles=[Line2D([0],[0],marker='o',ls='',color=colors[k],
               label={'cp':'conformal','prob':'probabilistic','oracle':'oracle'}[k]) for k in colors], fontsize=8)
    plt.tight_layout(); plt.savefig(os.path.join(OUT, "figures", "ts_plane.png"), dpi=130); plt.close()

    # 3) interval width over time for a few adaptive methods + true 90% band width
    plt.figure(figsize=(9, 4.0))
    z = M.Z(ALPHA)
    plt.plot(t, 2 * z * sig_te, color="k", lw=1.3, label="oracle width 2·z·σ_t")
    for nm in ["fixed split (CP)", "NexCP (weighted)", "EWMA-vol Gaussian"]:
        if nm in methods:
            lo, hi, *_ = methods[nm]
            plt.plot(t, np.clip(hi - lo, 0, 30), lw=1.1, label=nm)
    plt.xlabel("test step"); plt.ylabel("interval width"); plt.legend(fontsize=8)
    plt.title("Does the width track the true volatility?")
    plt.tight_layout(); plt.savefig(os.path.join(OUT, "figures", "ts_width.png"), dpi=130); plt.close()


if __name__ == "__main__":
    main()
