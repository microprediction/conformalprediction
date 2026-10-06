import sys, numpy as np, pandas as pd
D = sys.argv[1]
t = pd.read_hdf(D+'/residuals.h5','target'); m = pd.read_hdf(D+'/residuals.h5','target_mask').values.astype(bool)
R = np.where(m, t.values, np.nan); T, N = R.shape
i = np.load(D+'/indices.npz'); vt = i['valid_target_indices']; row = {p:r for r,p in enumerate(vt)}
cal = np.array(sorted({row[k+23] for k in i['calib_indices'] if k+23 in row})); tst = np.array(sorted({row[k+23] for k in i['test_indices'] if k+23 in row})); tst = tst[tst>=12]
def acf(lag):
    a, b = R[:-lag], R[lag:]; ok = np.isfinite(a)&np.isfinite(b)
    return np.corrcoef(a[ok], b[ok])[0,1]
print('residual ACF at lags', {l: round(acf(l),3) for l in [1,2,3,6,12,13,24,36,288]})
# cross-sectional: corr of r_{i,t} with mean of others at same t, and with others' r at t-12
xs = np.nanmean(R, axis=1, keepdims=True)
ok = np.isfinite(R)
print('corr(r_it, mean_j r_jt)', round(np.corrcoef(R[ok], np.repeat(xs, N, 1)[ok])[0,1],3))
a, b = R[12:], np.repeat(xs, N, 1)[:-12]; ok2 = np.isfinite(a)&np.isfinite(b)
print('corr(r_i,t+12, mean_j r_j,t)', round(np.corrcoef(a[ok2], b[ok2])[0,1],3))
# linear residual forecaster: r_{i,t+12} ~ own last 12 residuals + cross-sectional mean of last 12 residuals; pooled OLS on calib, scored on test
L = 12; H = 12
def feats(rows):
    X = []; Y = []; idx = []
    for r in rows:
        own = R[r-H-L+1:r-H+1]            # rows t-11..t where t=r-H
        xsm = xs[r-H-L+1:r-H+1, 0]
        for j in range(N):
            if np.isfinite(R[r, j]) and np.all(np.isfinite(own[:, j])) and np.all(np.isfinite(xsm)):
                X.append(np.concatenate([[1], own[:, j], xsm])); Y.append(R[r, j]); idx.append((r, j))
    return np.array(X), np.array(Y), idx
Xc, Yc, _ = feats(cal[cal >= H+L]); Xt, Yt, it = feats(tst)
w, *_ = np.linalg.lstsq(Xc, Yc, rcond=None)
pc, pt = Xc @ w, Xt @ w
print('R^2 calib', round(1-np.var(Yc-pc)/np.var(Yc),3), 'R^2 test', round(1-np.var(Yt-pt)/np.var(Yt),3))
w2, *_ = np.linalg.lstsq(Xc[:, :L+1], Yc, rcond=None); pt2 = Xt[:, :L+1] @ w2
print('own-only R^2 test', round(1-np.var(Yt-pt2)/np.var(Yt),3))
a = 0.1
def cq(v, level): v = np.sort(v); k = min(int(np.ceil((len(v)+1)*level)), len(v)); return v[k-1]
def wink(lo, hi, y): return (hi-lo) + 20*np.maximum(lo-y,0) + 20*np.maximum(y-hi,0)
for name, pcal, ptst in [('SCP two-sided on raw residual', 0*pc, 0*pt), ('linear residual forecast (own+xs) + SCP', pc, pt), ('linear residual forecast (own only) + SCP', Xc[:, :L+1]@w2, pt2)]:
    e = Yc - pcal; ql, qh = cq(e, a/2), cq(e, 1-a/2)
    lo, hi = ptst+ql, ptst+qh
    print(f'{name:45s} dCov {100*(((Yt>=lo)&(Yt<=hi)).mean()-0.9):6.2f} width {np.mean(hi-lo):6.2f} Winkler {wink(lo,hi,Yt).mean():6.2f}')
