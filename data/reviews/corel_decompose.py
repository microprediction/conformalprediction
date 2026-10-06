"""Decompose a dumped quantile-network run: per-sensor coverage, and how much of its Winkler gain over
split conformal is the moving centre versus the state-dependent width. Usage: decompose.py <run dir> <base dir>"""
import sys, numpy as np, pandas as pd
run, base = sys.argv[1], sys.argv[2]; a = 0.1
z = np.load(run + '/test_predictions.npz'); yh = z['y_hat']; y = z['y']; m = z['mask']; qs = z['quantiles']
yh = yh.reshape(yh.shape[0], -1, yh.shape[-1]); y = y.reshape(y.shape[0], -1); m = m.reshape(m.shape[0], -1).astype(bool) if m is not None and m.ndim else np.ones_like(y, bool)
il, ih, im = [int(np.argmin(np.abs(qs - v))) for v in (a/2, 1-a/2, 0.5)]
lo, hi, med = yh[..., il], yh[..., ih], yh[..., im]
def wink(lo, hi, y): return (hi-lo) + (2/a)*np.maximum(lo-y,0) + (2/a)*np.maximum(y-hi,0)
def rep(name, lo, hi):
    cov = ((y>=lo)&(y<=hi)); node = np.array([cov[:,j][m[:,j]].mean() for j in range(y.shape[1])])
    print(f'{name:58s} dCov {100*(cov[m].mean()-0.9):6.2f} width {np.mean((hi-lo)[m]):6.2f} Winkler {wink(lo,hi,y)[m].mean():6.2f}  sensor cov p10/p90 {100*np.percentile(node,10):.1f}/{100*np.percentile(node,90):.1f} (min/max {100*node.min():.1f}/{100*node.max():.1f})')
print('test samples', y.shape, 'masked frac', m.mean().round(3))
rep('network quantiles as read (Eq. 14)', lo, hi)
# split conformal on the same calibration residuals (two-sided), from the base run
t = pd.read_hdf(base + '/residuals.h5', 'target'); mm = pd.read_hdf(base + '/residuals.h5', 'target_mask').values.astype(bool)
R = np.where(mm, t.values, np.nan); i = np.load(base + '/indices.npz'); vt = i['valid_target_indices']; row = {p:r for r,p in enumerate(vt)}
cal = np.array(sorted({row[k+23] for k in i['calib_indices'] if k+23 in row}))
def cq(v, level): v = np.sort(v[np.isfinite(v)]); k = min(int(np.ceil((len(v)+1)*level)), len(v)); return v[k-1]
ql, qh = cq(R[cal].ravel(), a/2), cq(R[cal].ravel(), 1-a/2)
rep('split conformal, two-sided', np.full_like(y, ql), np.full_like(y, qh))
rep('network width, centred at zero', -(hi-lo)/2, (hi-lo)/2)
rep('network median as centre, split-conformal width', med + ql - (ql+qh)/2, med + qh - (ql+qh)/2)
rep('network median as centre, network width about it', med - (hi-lo)/2, med + (hi-lo)/2)
print('mean |median shift|', np.mean(np.abs(med[m])).round(3), '; mean width', np.mean((hi-lo)[m]).round(3), '; corr(|median|, width)', np.corrcoef(np.abs(med[m]), (hi-lo)[m])[0,1].round(3))
# conformalize the network's own quantiles with CQR on the calibration tail (10%) is not possible from the test dump; report instead what a global shift needs
E = np.maximum(lo - y, y - hi)[m]; print('CQR shift that would give 90% on test (oracle, for scale only):', np.quantile(E, 0.9).round(3))
