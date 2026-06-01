"""Tabular benchmark: do the sklearn-ecosystem conformal 'skins' (MAPIE, crepes)
help on heteroscedastic regression, and on which axis? We compare them against
probabilistic baselines that model the conditional distribution directly, on a
synthetic problem with KNOWN mean f(x) and sd s(x) so conditional coverage and the
oracle are computable.

Run:  python run_tabular.py   -> results/tabular_results.csv, figures/tabular_*.png
"""
from __future__ import annotations
import os, warnings, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import GradientBoostingRegressor as GBR
import common as C

OUT = os.path.dirname(__file__)
os.makedirs(os.path.join(OUT, "results"), exist_ok=True)
os.makedirs(os.path.join(OUT, "figures"), exist_ok=True)
ALPHA = 0.1
Z = 1.6448536269514722  # norm ppf 0.95


def split(d, ntr, nca):
    X, y = d["X"], d["y"]
    sl = lambda a, b: slice(a, b)
    idx = dict(tr=sl(0, ntr), ca=sl(ntr, ntr + nca), te=sl(ntr + nca, len(y)))
    return {k: (X[v], y[v]) for k, v in idx.items()}, idx


def run_once(seed=0):
    d = C.make_tabular(n=6000, seed=seed)
    parts, idx = split(d, 2400, 1800)
    (Xtr, ytr), (Xca, yca), (Xte, yte) = parts["tr"], parts["ca"], parts["te"]
    s_te = d["s"][idx["te"]]; f_te = d["f"][idx["te"]]
    methods = {}   # name -> (lo, hi, mu_or_None, sigma_or_None, samples_or_None, family)

    # ---------- probabilistic baselines (the yardstick) ----------
    lo, hi = C.gaussian_interval(f_te, s_te, ALPHA)
    methods["oracle (true f,s)"] = (lo, hi, f_te, s_te, None, "oracle")

    mean = GBR().fit(Xtr, ytr)                       # heteroscedastic Gaussian: mean + variance models
    mu_tr = mean.predict(Xtr); mu_ca = mean.predict(Xca); mu_te = mean.predict(Xte)
    logr2 = np.log(np.maximum((ytr - mu_tr) ** 2, 1e-6))
    varm = GBR().fit(Xtr, logr2)
    sig_te = np.sqrt(np.exp(varm.predict(Xte)))
    # recalibrate the predicted sd by a constant factor fit on calibration (proper-score)
    sig_ca = np.sqrt(np.exp(varm.predict(Xca)))
    c = np.sqrt(np.mean(((yca - mu_ca) / np.maximum(sig_ca, 1e-6)) ** 2))
    sig_te_rc = sig_te * c
    methods["het-Gaussian (mean+var)"] = (mu_te - Z * sig_te_rc, mu_te + Z * sig_te_rc, mu_te, sig_te_rc, None, "prob")

    s_const = float(np.sqrt(np.mean((yca - mu_ca) ** 2)))   # non-adaptive Gaussian
    methods["static Gaussian (recal)"] = (mu_te - Z * s_const, mu_te + Z * s_const,
                                          mu_te, np.full_like(mu_te, s_const), None, "prob")

    # raw quantile regression (no conformal), as a reference
    ql = GBR(loss="quantile", alpha=ALPHA / 2).fit(Xtr, ytr)
    qu = GBR(loss="quantile", alpha=1 - ALPHA / 2).fit(Xtr, ytr)
    methods["quantile GBR (raw)"] = (ql.predict(Xte), qu.predict(Xte), None, None, None, "prob")

    # ---------- MAPIE (the sklearn conformal skin) ----------
    try:
        from mapie.regression import SplitConformalRegressor
        est = GBR().fit(Xtr, ytr)
        scr = SplitConformalRegressor(est, confidence_level=1 - ALPHA, conformity_score="absolute", prefit=True)
        scr.conformalize(Xca, yca)
        _, itv = scr.predict_interval(Xte)
        methods["MAPIE split (absolute)"] = (itv[:, 0, 0], itv[:, 1, 0], None, None, None, "cp")
    except Exception as e:
        print("  [MAPIE split failed:", repr(e)[:140], "]")
    try:
        from mapie.regression import ConformalizedQuantileRegressor
        cqr = ConformalizedQuantileRegressor(
            GBR(loss="quantile"), confidence_level=1 - ALPHA, prefit=False)
        cqr.fit(Xtr, ytr); cqr.conformalize(Xca, yca)
        _, itv = cqr.predict_interval(Xte)
        methods["MAPIE CQR"] = (itv[:, 0, 0], itv[:, 1, 0], None, None, None, "cp")
    except Exception as e:
        print("  [MAPIE CQR failed:", repr(e)[:140], "]")

    # ---------- crepes (the other skin) ----------
    try:
        from crepes import WrapRegressor
        from crepes.extras import DifficultyEstimator
        w = WrapRegressor(GBR()); w.fit(Xtr, ytr); w.calibrate(Xca, yca)
        pi = np.asarray(w.predict_int(Xte, confidence=1 - ALPHA))
        methods["crepes standard"] = (pi[:, 0], pi[:, 1], None, None, None, "cp")

        de = DifficultyEstimator().fit(X=Xtr, residuals=ytr - w.learner.predict(Xtr))
        wn = WrapRegressor(GBR()); wn.fit(Xtr, ytr); wn.calibrate(Xca, yca, de=de)
        pin = np.asarray(wn.predict_int(Xte, confidence=1 - ALPHA))
        methods["crepes normalized"] = (pin[:, 0], pin[:, 1], None, None, None, "cp")

        # conformal predictive system -> full distribution (CRPS via percentiles)
        wc = WrapRegressor(GBR()); wc.fit(Xtr, ytr); wc.calibrate(Xca, yca, de=de, cps=True)
        pc = np.asarray(wc.predict_cps(Xte, lower_percentiles=ALPHA / 2 * 100,
                                       higher_percentiles=(1 - ALPHA / 2) * 100))
        lo_c, hi_c = pc[:, 0], pc[:, 1]
        perc = list(range(2, 99, 2))
        samp = np.asarray(wc.predict_percentiles(Xte, higher_percentiles=perc))
        methods["crepes CPS"] = (lo_c, hi_c, None, None, samp, "cp")
    except Exception as e:
        import traceback; print("  [crepes failed:", repr(e)[:140], "]"); traceback.print_exc()

    rows = []
    for name, (lo, hi, mu, sig, samp, fam) in methods.items():
        lo = np.asarray(lo, float); hi = np.asarray(hi, float)
        row = dict(method=name, family=fam,
                   marg_cov=C.coverage(lo, hi, yte),
                   width=C.mean_width(lo, hi),
                   interval_score=C.interval_score(lo, hi, yte, ALPHA))
        cbs = C.coverage_by_stratum(lo, hi, yte, s_te, 5)
        row["cov_lowvar"] = cbs[0]; row["cov_hivar"] = cbs[-1]
        row["cond_cov_gap"] = float(np.nanmax(np.abs(cbs - (1 - ALPHA))))
        if sig is not None:
            row["CRPS"] = C.crps_gaussian(mu, sig, yte); row["logscore"] = C.log_score_gaussian(mu, sig, yte)
        elif samp is not None:
            row["CRPS"] = C.crps_samples(samp, yte); row["logscore"] = np.nan
        else:
            row["CRPS"] = np.nan; row["logscore"] = np.nan
        rows.append(row)
    return pd.DataFrame(rows), (methods, Xte, yte, s_te, f_te)


def main():
    frames, keep = [], None
    for seed in range(5):
        df, art = run_once(seed)
        frames.append(df)
        if seed == 0: keep = art
    agg = pd.concat(frames).groupby(["method", "family"], sort=False).mean(numeric_only=True).reset_index()
    agg = agg.sort_values("interval_score")
    cols = ["method", "family", "marg_cov", "cov_lowvar", "cov_hivar", "cond_cov_gap",
            "width", "interval_score", "CRPS", "logscore"]
    agg[cols].to_csv(os.path.join(OUT, "results", "tabular_results.csv"), index=False)
    pd.set_option("display.width", 170, "display.max_columns", 20)
    print("\n=== TABULAR BENCHMARK (mean over 5 seeds, alpha=0.1, target 0.90) ===")
    print(agg[cols].round(3).to_string(index=False))
    _figures(keep, agg)
    print("\nwrote results/tabular_results.csv and figures/tabular_*.png")


def _figures(keep, agg):
    methods, Xte, yte, s_te, f_te = keep
    # conditional coverage vs x (sorted), a few methods
    order = np.argsort(Xte.ravel()); xs = Xte.ravel()[order]
    sel = ["MAPIE split (absolute)", "crepes normalized", "het-Gaussian (mean+var)", "oracle (true f,s)"]
    plt.figure(figsize=(8.6, 4.2))
    nb = 16; edges = np.linspace(xs.min(), xs.max(), nb + 1)
    centers = 0.5 * (edges[:-1] + edges[1:])
    for nm in sel:
        if nm not in methods: continue
        lo, hi = np.asarray(methods[nm][0]), np.asarray(methods[nm][1])
        cov = []
        for b in range(nb):
            m = (Xte.ravel() >= edges[b]) & (Xte.ravel() < edges[b + 1] + (1e-9 if b == nb-1 else 0))
            cov.append(C.coverage(lo[m], hi[m], yte[m]) if m.any() else np.nan)
        plt.plot(centers, cov, marker="o", ms=3, lw=1.3, label=nm)
    plt.axhline(0.9, color="k", ls="--", lw=1, label="target 0.90")
    plt.xlabel("x  (true noise sd grows with x)"); plt.ylabel("conditional coverage")
    plt.ylim(0.5, 1.02); plt.legend(fontsize=8, ncol=2)
    plt.title("Tabular: who actually covers conditionally?")
    plt.tight_layout(); plt.savefig(os.path.join(OUT, "figures", "tabular_condcov.png"), dpi=130); plt.close()

    # the plane: conditional-coverage gap vs interval score
    plt.figure(figsize=(7.6, 5.2))
    colors = {"cp": "#1f4ed8", "prob": "#15803d", "oracle": "#c2410c"}
    for _, r in agg.iterrows():
        plt.scatter(r["cond_cov_gap"], r["interval_score"], c=colors.get(r["family"], "#666"), s=45)
        plt.annotate(r["method"], (r["cond_cov_gap"], r["interval_score"]), fontsize=7,
                     xytext=(4, 3), textcoords="offset points")
    plt.xlabel("worst conditional-coverage gap  (lower = more adaptive)")
    plt.ylabel("interval (Winkler) score  (lower = better)")
    plt.title("Tabular: adaptivity vs. efficiency")
    from matplotlib.lines import Line2D
    plt.legend(handles=[Line2D([0],[0],marker='o',ls='',color=colors[k],
               label={'cp':'conformal skin','prob':'probabilistic','oracle':'oracle'}[k]) for k in colors], fontsize=8)
    plt.tight_layout(); plt.savefig(os.path.join(OUT, "figures", "tabular_plane.png"), dpi=130); plt.close()


if __name__ == "__main__":
    main()
