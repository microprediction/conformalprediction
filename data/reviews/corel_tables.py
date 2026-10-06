"""Binned (Mondrian) split-conformal intervals on the residuals saved by CoRel's base run.

Keys: sensor, hour of day, weekend flag, current-speed bin (speed observed at the forecast origin).
Two-sided conformal quantiles of the signed residual are taken within each cell of the finest
keying; cells with fewer than MIN_N calibration residuals fall back to the next coarser keying.
The keying is chosen on the last 10% of the calibration slice by Winkler score, as CoRel selects
its checkpoint, and the chosen table is then refit on the full calibration slice and scored on test.
"""
import sys, json, numpy as np, pandas as pd
D = sys.argv[1]; a = float(sys.argv[2]) if len(sys.argv) > 2 else 0.1; MIN_N = 50
t = pd.read_hdf(D+'/residuals.h5','target'); m = pd.read_hdf(D+'/residuals.h5','target_mask').values.astype(bool)
R = np.where(m, t.values, np.nan); T, N = R.shape; times = t.index
from tsl.datasets import MetrLA
X = MetrLA().dataframe().reindex(index=times).values
i = np.load(D+'/indices.npz'); vt = i['valid_target_indices']; row = {p:r for r,p in enumerate(vt)}
cal = np.array(sorted({row[k+23] for k in i['calib_indices'] if k+23 in row})); tst = np.array(sorted({row[k+23] for k in i['test_indices'] if k+23 in row})); tst = tst[tst>=12]
nval = int(0.1*len(cal)); fit, val = cal[:-nval], cal[-nval:]
H = 12; hour = np.array(times.hour); wk = np.array(times.weekday >= 5).astype(int)
Xnow = np.full_like(R, np.nan); Xnow[H:] = X[:-H]
spd = np.digitize(np.nan_to_num(Xnow, nan=60.0), [20, 35, 50, 60])
def cq(v, level):
    v = np.sort(v[np.isfinite(v)]); n = len(v); k = int(np.ceil((n+1)*level))
    return np.inf if k > n else v[k-1]
def wink(lo, hi, y): return (hi-lo) + (2/a)*np.maximum(lo-y,0) + (2/a)*np.maximum(y-hi,0)
LEVELS = {'sensor': lambda: np.broadcast_to(np.arange(N)[None,:], (T,N)), 'hour': lambda: np.broadcast_to(hour[:,None], (T,N)),
          'weekend': lambda: np.broadcast_to(wk[:,None], (T,N)), 'speed': lambda: spd}
def key(kind):
    K = np.zeros((T,N), np.int64)
    for k in kind: K = K*1000 + LEVELS[k]()
    return K
class Table:
    """two-sided conformal quantiles per cell with hierarchical fallback over a list of keyings, coarsest last"""
    def __init__(self, kinds, rows):
        self.kinds = kinds; self.tabs = []
        for kind in kinds:
            K = key(kind)[rows]; df = pd.DataFrame({'k': K.ravel(), 'v': R[rows].ravel()}).dropna(); g = df.groupby('k').v
            self.tabs.append((kind, g.size(), g.apply(lambda v: cq(v.values, a/2)), g.apply(lambda v: cq(v.values, 1-a/2))))
        # global fallback
        v = R[rows].ravel(); self.glob = (cq(v, a/2), cq(v, 1-a/2))
    def interval(self, rows):
        lo = np.full((len(rows), N), np.nan); hi = np.full((len(rows), N), np.nan); done = np.zeros((len(rows), N), bool); used = []
        for kind, cnt, ql, qh in self.tabs:
            K = key(kind)[rows].ravel()
            n = cnt.reindex(K).fillna(0).values.reshape(len(rows), N)
            ok = (~done) & (n >= MIN_N)
            lo[ok] = ql.reindex(K).values.reshape(len(rows), N)[ok]; hi[ok] = qh.reindex(K).values.reshape(len(rows), N)[ok]
            used.append((kind, int(ok.sum()))); done |= ok
        lo[~done], hi[~done] = self.glob; used.append(('global', int((~done).sum())))
        return lo, hi, used
def score(lo, hi, rows):
    y = R[rows]; ok = np.isfinite(y)
    cov = ((y>=lo)&(y<=hi))[ok]
    node_cov = np.array([((y[:,j]>=lo[:,j])&(y[:,j]<=hi[:,j]))[ok[:,j]].mean() for j in range(N)])
    return dict(dcov=100*(cov.mean()-(1-a)), width=float(np.mean((hi-lo)[ok])), winkler=float(wink(lo,hi,y)[ok].mean()),
                node_cov_min=100*node_cov.min(), node_cov_max=100*node_cov.max(), node_cov_p10=100*np.percentile(node_cov,10), node_cov_p90=100*np.percentile(node_cov,90))
CANDS = {
 'split conformal, two-sided': [],
 'sensor': [('sensor',)],
 'hour': [('hour',)],
 'speed': [('speed',)],
 'sensor x hour': [('sensor','hour'), ('sensor',)],
 'sensor x speed': [('sensor','speed'), ('sensor',)],
 'hour x speed': [('hour','speed'), ('hour',)],
 'sensor x hour x speed': [('sensor','hour','speed'), ('sensor','hour'), ('sensor',)],
 'sensor x hour x weekend x speed': [('sensor','hour','weekend','speed'), ('sensor','hour','speed'), ('sensor','hour'), ('sensor',)],
}
out = {}
print(f'{"keying":36s} {"val Winkler":>11s} | test: dCov  width  Winkler  sensor coverage p10/p90 (min/max)')
for name, kinds in CANDS.items():
    tv = Table(kinds, fit); lo, hi, _ = tv.interval(val); sv = score(lo, hi, val)
    tt = Table(kinds, cal); lo, hi, used = tt.interval(tst); st = score(lo, hi, tst)
    out[name] = dict(val=sv, test=st, cells_used=used)
    print(f'{name:36s} {sv["winkler"]:11.2f} | {st["dcov"]:6.2f} {st["width"]:6.2f} {st["winkler"]:8.2f}   {st["node_cov_p10"]:.1f}/{st["node_cov_p90"]:.1f} ({st["node_cov_min"]:.1f}/{st["node_cov_max"]:.1f})   {used}')
best = min(out, key=lambda k: out[k]['val']['winkler']); print('selected on calibration tail:', best, '-> test Winkler', round(out[best]['test']['winkler'],2))
json.dump(out, open('ours/keytables_out.json','w'), indent=1)
