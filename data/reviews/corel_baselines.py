"""Zero-parameter interval baselines on the residuals saved by CoRel's run_base_model.py.

Usage: python baselines.py <base run dir> [alpha]

Reconstructs the calibration / test residual matrices R[t, n] for the single forecast
horizon in the run, then scores split-conformal intervals with different half-width
scalings, all conformalized on the calibration slice.  Metrics follow App. E of the
paper: coverage gap (pp), PI width, Winkler score with penalty 2/alpha, averaged over
nodes and test steps (masked).
"""
import sys, os, json
import numpy as np, pandas as pd

run_dir = sys.argv[1]
alpha = float(sys.argv[2]) if len(sys.argv) > 2 else 0.1
W, DELAY = 12, 11          # CoRel config for METR-LA (window 12, delay 11, horizon 1)

inp = pd.read_hdf(os.path.join(run_dir, 'residuals.h5'), key='input')
tgt = pd.read_hdf(os.path.join(run_dir, 'residuals.h5'), key='target')
try:
    msk = pd.read_hdf(os.path.join(run_dir, 'residuals.h5'), key='target_mask')
except KeyError:
    msk = None
idx = np.load(os.path.join(run_dir, 'indices.npz'))
cfg_delay = DELAY
# residual at time s (row index s) of the H-step forecast issued at s-H
R = tgt.values.astype(float)                 # [T_r, N]
M = msk.values.astype(bool) if msk is not None else np.ones_like(R, bool)
times = tgt.index
T, N = R.shape
pos = {t: i for i, t in enumerate(times)}

# calib / test target positions: sample i -> target time index[i + W + delay]
# The base dataset index is the full series index; we recover it from residual frames.
# indices.npz stores sample indices into the base torch_dataset; valid_target_indices maps
# residual rows to series positions.  Build series-position -> residual-row map.
vt = idx['valid_target_indices']             # series position of each residual row
row_of_pos = {p: r for r, p in enumerate(vt)}
def rows(sample_idx):
    out = []
    for i in sample_idx:
        p = int(i) + W + cfg_delay
        if p in row_of_pos:
            out.append(row_of_pos[p])
    return np.array(sorted(set(out)))
cal_rows, test_rows = rows(idx['calib_indices']), rows(idx['test_indices'])
# CoRel needs a full window of W past residual rows as input; drop test rows without it
test_rows = test_rows[test_rows >= W]
print(f'residual rows {T}, nodes {N}, calib rows {len(cal_rows)}, test rows {len(test_rows)}')
print(f'calib {times[cal_rows[0]]} .. {times[cal_rows[-1]]}; test {times[test_rows[0]]} .. {times[test_rows[-1]]}')

def winkler(lo, hi, y, a):
    w = hi - lo
    return w + (2 / a) * np.maximum(lo - y, 0) + (2 / a) * np.maximum(y - hi, 0)

def score(lo, hi, rows_, name):
    y = R[rows_]; m = M[rows_]
    cov = ((y >= lo) & (y <= hi))[m].mean()
    res = dict(method=name, dcov=100 * (cov - (1 - alpha)), width=(hi - lo)[m].mean(),
               winkler=winkler(lo, hi, y, alpha)[m].mean())
    print(f"{name:52s} dCov {res['dcov']:6.2f}  width {res['width']:7.2f}  Winkler {res['winkler']:7.2f}")
    return res

def cq(v, level):
    """finite-sample conformal quantile: ceil((n+1)level)/n empirical quantile"""
    v = np.sort(v[np.isfinite(v)]); n = len(v)
    k = min(int(np.ceil((n + 1) * level)), n)
    return v[k - 1]

def ewma_past(X, hl, mask=None):
    """EWMA of X along axis 0 using only rows strictly before each row (causal, one-step lag)."""
    lam = 0.5 ** (1 / hl)
    out = np.full_like(X, np.nan); s = np.zeros(X.shape[1]); wsum = np.zeros(X.shape[1])
    for t in range(X.shape[0]):
        out[t] = np.where(wsum > 0, s / np.maximum(wsum, 1e-12), np.nan)
        x = X[t]; ok = np.isfinite(x) & (mask[t] if mask is not None else True)
        s = lam * s + np.where(ok, x, 0); wsum = lam * wsum + ok
    return out

# The residual r_t is observed at t. At forecast time t we predict the residual at t+H
# (H = W... no: H = DELAY+1 = 12 steps). So the latest usable residual row is t, and the
# interval for row t+H uses statistics up to row t.  Shift everything by H rows.
H = cfg_delay + 1
def shift(S):  # S[t] uses rows <= t ; we need at row t+H -> S[t] placed at row t+H
    out = np.full_like(S, np.nan); out[H:] = S[:-H]; return out

absR = np.where(M, np.abs(R), np.nan)
sgnR = np.where(M, R, np.nan)
results = []
lo_q, hi_q = alpha / 2, 1 - alpha / 2

# 1. split conformal, symmetric |r|
q = cq(absR[cal_rows].ravel(), 1 - alpha)
results.append(score(-q * np.ones((len(test_rows), N)), q * np.ones((len(test_rows), N)), test_rows, 'SCP symmetric |r| (global)'))
# 2. split conformal, two-sided signed
ql, qh = cq(sgnR[cal_rows].ravel(), lo_q), cq(sgnR[cal_rows].ravel(), hi_q)
results.append(score(ql * np.ones((len(test_rows), N)), qh * np.ones((len(test_rows), N)), test_rows, 'SCP two-sided signed (global)'))
# 3. per-node SCP two-sided (node-wise quantiles, no time adaptation)
ql = np.array([cq(sgnR[cal_rows, j], lo_q) for j in range(N)]); qh = np.array([cq(sgnR[cal_rows, j], hi_q) for j in range(N)])
results.append(score(np.tile(ql, (len(test_rows), 1)), np.tile(qh, (len(test_rows), 1)), test_rows, 'SCP two-sided per node'))

# model selection slice: last 10% of calibration rows, like CoRel's val_len
nval = int(0.1 * len(cal_rows)); fit_rows, val_rows = cal_rows[:-nval], cal_rows[-nval:]

def scaled(name, S, center=None, select_on_val=True):
    """interval = center + [q_lo, q_hi] * S, with q's conformal quantiles of (r-center)/S on fit rows."""
    Z = (sgnR - (0 if center is None else center)) / S
    ql, qh = cq(Z[fit_rows].ravel(), lo_q), cq(Z[fit_rows].ravel(), hi_q)
    c = 0 if center is None else center[test_rows]
    return score(c + ql * S[test_rows], c + qh * S[test_rows], test_rows, name)

best = {}
for hl in [6, 12, 24, 48, 96, 288, 1000]:
    S_loc = shift(ewma_past(absR, hl, M)); S_loc = np.where(np.isfinite(S_loc) & (S_loc > 0), S_loc, np.nan)
    S_loc = np.where(np.isnan(S_loc), np.nanmean(S_loc), S_loc)
    r = scaled(f'  local EWMA|r| scale, half-life {hl}', S_loc)
    best.setdefault('local', []).append((r['winkler'], hl, r))
# choose half-life on the val slice? simpler: report all, mark best on test with a caveat, and also val-selected
def val_select(fn, grid):
    outs = []
    for g in grid:
        outs.append((fn(g), g))
    return outs

# cross-sectional scale: EWMA of the node-averaged |r| (uses all other series, no graph)
xs = np.nanmean(absR, axis=1, keepdims=True)
for hl in [1, 3, 6, 12, 24]:
    S_xs = shift(ewma_past(xs, hl)); S_xs = np.where(np.isnan(S_xs), np.nanmean(S_xs), S_xs)
    S_xs = np.repeat(S_xs, N, axis=1)
    scaled(f'  cross-sectional EWMA|r| scale, half-life {hl}', S_xs)
# product: local x cross-sectional (normalized)
for hl_l, hl_x in [(288, 3), (96, 3), (288, 6)]:
    S_loc = shift(ewma_past(absR, hl_l, M)); S_loc = np.where(np.isnan(S_loc), np.nanmean(S_loc), S_loc)
    S_xs = shift(ewma_past(xs, hl_x)); S_xs = np.where(np.isnan(S_xs), np.nanmean(S_xs), S_xs)
    S = S_loc * S_xs / np.nanmean(S_xs)
    scaled(f'  local({hl_l}) x cross-sectional({hl_x}) scale', S)
# bias correction: center = EWMA of signed residual (local) ; and cross-sectional mean of latest residuals
for hl in [3, 6, 12]:
    C_loc = shift(ewma_past(sgnR, hl, M)); C_loc = np.where(np.isnan(C_loc), 0, C_loc)
    S_loc = shift(ewma_past(absR, 288, M)); S_loc = np.where(np.isnan(S_loc), np.nanmean(S_loc), S_loc)
    scaled(f'  local center EWMA r (hl {hl}) + local(288) scale', S_loc, C_loc)
    C_xs = shift(ewma_past(np.nanmean(sgnR, axis=1, keepdims=True), hl)); C_xs = np.where(np.isnan(C_xs), 0, C_xs)
    C = np.repeat(C_xs, N, axis=1)
    scaled(f'  cross-sectional center (hl {hl}) + local(288) scale', S_loc, C)
    scaled(f'  local+xs center (hl {hl}) + local(288) x xs(3) scale', S_loc * np.repeat(np.where(np.isnan(shift(ewma_past(xs, 3))), np.nanmean(xs), shift(ewma_past(xs, 3))), N, 1) / np.nanmean(xs), 0.5 * (C_loc + C))
json.dump(results, open(os.path.join(os.path.dirname(__file__), 'baselines_out.json'), 'w'), indent=1)
