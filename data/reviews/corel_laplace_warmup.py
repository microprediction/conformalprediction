"""Warm-up sweep and weekly learning curve for laplace on METR-LA, from the dumps of laplace_dump.py.
Usage: laplace_analyze.py <base run dir>"""
import sys, glob, numpy as np, pandas as pd
A = 0.1; H = 12; TEST0, TEST1 = 27435, 34272; WEEK = 2016
X = np.load('metrla_X.npy'); M = np.load('metrla_M.npy'); T, N = X.shape
def wink(lo, hi, y): return (hi-lo) + (2/A)*np.maximum(lo-y,0) + (2/A)*np.maximum(y-hi,0)
def score(Q, rows, sens):
    lo, hi = Q[rows][:, sens, 0], Q[rows][:, sens, 2]; y = X[rows][:, sens]; m = M[rows][:, sens] & np.isfinite(lo)
    if m.sum() == 0: return None
    return dict(n=int(m.sum()), winkler=float(wink(lo,hi,y)[m].mean()), dcov=100*float((((y>=lo)&(y<=hi))[m]).mean()-0.9), width=float((hi-lo)[m].mean()), mae=float(np.abs(Q[rows][:, sens, 1]-y)[m].mean()))
subs = [int(v) for v in open('sensors40.txt').read().strip().split(',')]; test = np.arange(TEST0, TEST1)
print('--- warm-up sweep, 40-sensor subset, scored on the test slice (positions 27435-34271) ---')
print(f'{"start":>6s} {"warm-up steps":>14s} {"Winkler":>8s} {"dCov":>6s} {"width":>6s} {"med MAE":>8s}')
rows = []
for f in sorted(glob.glob('lap_start*.npz'), key=lambda f: int(np.load(f)['start'])):
    z = np.load(f); st = int(z['start']); sens = [int(s) for s in z['sensors']]
    if not set(subs) <= set(sens): continue
    r = score(z['Q'], test, subs); rows.append((st, r)); print(f'{st:6d} {TEST0-st:14d} {r["winkler"]:8.2f} {r["dcov"]:6.2f} {r["width"]:6.2f} {r["mae"]:8.2f}')
z0 = np.load('lap_start0.npz'); Q0 = z0['Q']
keep = [j for j in range(N) if j not in (56, 109, 82)]
r = score(Q0, test, keep); print(f'\nfull history, 204 sensors (56, 109, 82 excluded), test slice: Winkler {r["winkler"]:.2f} dCov {r["dcov"]:.2f} width {r["width"]:.2f} median MAE {r["mae"]:.2f}')
# GRU + per-sensor split conformal reference on the residual rows
D = sys.argv[1]; t = pd.read_hdf(D+'/residuals.h5','target'); mm = pd.read_hdf(D+'/residuals.h5','target_mask').values.astype(bool)
R = np.where(mm, t.values, np.nan); i = np.load(D+'/indices.npz'); vt = i['valid_target_indices']
cal_pos = {k+23 for k in i['calib_indices']}; calrows = np.array([r for r,p in enumerate(vt) if p in cal_pos])
def cq(v, level): v = np.sort(v[np.isfinite(v)]); k = min(int(np.ceil((len(v)+1)*level)), len(v)); return v[k-1]
ql = np.array([cq(R[calrows, j], A/2) for j in range(N)]); qh = np.array([cq(R[calrows, j], 1-A/2) for j in range(N)])
pos2row = {p: r for r, p in enumerate(vt)}
print('\n--- weekly learning curve, full-history run, all sensors (week = 2016 steps of 5 min) ---')
print(f'{"week":>4s} {"positions":>14s} {"laplace W":>10s} {"dCov":>6s} {"width":>6s} {"GRU+SCP/sensor W":>17s} {"slice":>6s}')
for w in range(T // WEEK + 1):
    rows_ = np.arange(w*WEEK, min((w+1)*WEEK, T)); rl = score(Q0, rows_, keep)
    if rl is None: continue
    rr = [pos2row[p] for p in rows_ if p in pos2row]
    ref = ''
    if len(rr) > 100:
        y = R[rr]; m = np.isfinite(y); lo = np.broadcast_to(ql, y.shape); hi = np.broadcast_to(qh, y.shape); ref = f'{wink(lo,hi,y)[m].mean():17.2f}'
    sl = 'train' if rows_[-1] < 16463 else ('calib' if rows_[0] < TEST0 else 'test')
    print(f'{w:4d} {rows_[0]:6d}-{rows_[-1]:6d} {rl["winkler"]:10.2f} {rl["dcov"]:6.2f} {rl["width"]:6.2f} {ref:>17s} {sl:>6s}')
