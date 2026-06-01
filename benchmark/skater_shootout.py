"""Quick head-to-head of forecaster policies on the nonstationary benchmark series.
Reports one-step-ahead marginal coverage, worst-window coverage, mean interval (Winkler)
score, CRPS, and corr(predicted sd, true sigma_t). Lower interval/CRPS = better.
"""
import warnings, numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import common as C

ALPHA = 0.1
Z = 1.6448536269514722
T = 3500
SEEDS = range(3)
TEST = slice(1000, None)   # after warm-up


def run_online(make, y):
    """make() -> skater f with f(y, state) -> (dists, state); dists[0].mean/.std."""
    f = make(); state = None
    mu = np.full(len(y), np.nan); sd = np.full(len(y), np.nan)
    for t in range(len(y)):
        dists, state = f(float(y[t]), state)
        if t + 1 < len(y):
            mu[t + 1] = dists[0].mean; sd[t + 1] = max(float(dists[0].std), 1e-6)
    return mu, sd


def run_tm(skater, y):
    """timemachines skater f(y=,s=,k=) -> (x, x_std, s)."""
    s = {}; mu = np.full(len(y), np.nan); sd = np.full(len(y), np.nan)
    for t in range(len(y)):
        x, x_std, s = skater(y=float(y[t]), s=s, k=1)
        if t + 1 < len(y):
            mu[t + 1] = x[0]; sd[t + 1] = max(float(x_std[0]), 1e-6)
    return mu, sd


def metrics(mu, sd, y, sig):
    idx = np.arange(len(y))[TEST]
    idx = idx[~np.isnan(mu[idx])]
    m, s, yt, st = mu[idx], sd[idx], y[idx], sig[idx]
    lo, hi = m - Z * s, m + Z * s
    return dict(cov=C.coverage(lo, hi, yt),
                worst=C.worst_window_coverage(lo, hi, yt, 100),
                interval=C.interval_score(lo, hi, yt, ALPHA),
                CRPS=C.crps_gaussian(m, s, yt),
                corr_sd=float(np.corrcoef(s, st)[0, 1]))


def build_methods():
    M = {}
    from skaters import skater, holt, hosking, laplace, samuelson, wald, dantzig
    for name, fn in [("skaters:default", skater), ("skaters:holt", holt),
                     ("skaters:hosking", hosking), ("skaters:laplace", laplace),
                     ("skaters:samuelson", samuelson), ("skaters:wald", wald),
                     ("skaters:dantzig", dantzig)]:
        M[name] = ("online", lambda fn=fn: fn(k=1))
    try:
        from timemachines.skaters.simple.thinking import (
            thinking_fast_and_slow, thinking_fast_and_fast, thinking_slow_and_fast)
        M["tm:fast_and_slow"] = ("tm", thinking_fast_and_slow)
        M["tm:fast_and_fast"] = ("tm", thinking_fast_and_fast)
        M["tm:slow_and_fast"] = ("tm", thinking_slow_and_fast)
    except Exception as e:
        print("timemachines unavailable:", e)
    return M


def main():
    M = build_methods()
    rows = []
    for name, (kind, obj) in M.items():
        accs = []
        for seed in SEEDS:
            d = C.make_timeseries(T=T, seed=seed)
            y, sig = d["y"], d["sigma"]
            try:
                mu, sd = run_online(obj, y) if kind == "online" else run_tm(obj, y)
                accs.append(metrics(mu, sd, y, sig))
            except Exception as e:
                print(f"  {name} failed: {repr(e)[:120]}")
                accs = None; break
        if accs:
            agg = {k: np.mean([a[k] for a in accs]) for k in accs[0]}
            agg["method"] = name; rows.append(agg)
    df = pd.DataFrame(rows)[["method", "cov", "worst", "interval", "CRPS", "corr_sd"]]
    df = df.sort_values("interval")
    pd.set_option("display.width", 140)
    print("\n=== skater policy shootout (mean over 3 seeds, alpha=0.1, target 0.90) ===")
    print(df.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
