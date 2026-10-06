"""laplace (skaters, Rust backend skaters_fast) on each METR-LA sensor's own history, horizon 12 (60 min), its own 5%/95% quantiles,
scored on CoRel's test slice by Winkler, coverage, width. No training, no cross-sensor information.
Usage: python laplace_metrla.py <out csv> [workers] [start_pos]"""
import os, sys, csv, numpy as np, time
for v in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS"): os.environ.setdefault(v, "1")
from concurrent.futures import ProcessPoolExecutor, as_completed
OUT = sys.argv[1]; WORKERS = int(sys.argv[2]) if len(sys.argv) > 2 else 8; START = int(sys.argv[3]) if len(sys.argv) > 3 else 16000
H, A = 12, 0.1
TEST0, TEST1 = 27435, 34272          # series positions of scored targets (CoRel test slice, first window dropped)
def load():
    import pandas as pd
    X = np.load('metrla_X.npy'); M = np.load('metrla_M.npy'); return X, M
def run_sensor(j):
    import skaters_fast
    X, M = load(); y = X[:, j]; m = M[:, j]
    f = skaters_fast.laplace(H); pend = {}
    s = dict(j=j, IS=0.0, W=0.0, C=0, n=0, AE=0.0, t=time.time())
    for t in range(START, len(y)):
        d = f.step(float(y[t]))
        tgt = t + H
        if TEST0 <= tgt < TEST1:
            q = d[H-1]; pend[tgt] = (q.quantile(A/2), q.quantile(1-A/2), q.quantile(0.5))
        if t in pend:
            lo, hi, med = pend.pop(t)
            if m[t]:
                yt = y[t]; w = hi - lo
                s['IS'] += w + (2/A)*max(lo-yt, 0) + (2/A)*max(yt-hi, 0); s['W'] += w; s['C'] += int(lo <= yt <= hi); s['n'] += 1; s['AE'] += abs(yt-med)
    s['t'] = time.time() - s['t']; return s
if __name__ == '__main__':
    if not os.path.exists('metrla_X.npy'):
        sys.path.insert(0, 'repo'); from tsl.datasets import MetrLA
        ds = MetrLA(); np.save('metrla_X.npy', ds.dataframe().values.astype(float)); np.save('metrla_M.npy', ds.mask.reshape(ds.mask.shape[0], -1).astype(bool))
    X, M = load(); N = X.shape[1]
    rows = []
    with ProcessPoolExecutor(WORKERS) as ex:
        futs = [ex.submit(run_sensor, j) for j in range(N)]
        for k, fu in enumerate(as_completed(futs)):
            r = fu.result(); rows.append(r)
            print(f"{k+1}/{N} sensor {r['j']} n {r['n']} Winkler {r['IS']/max(r['n'],1):.2f} cov {r['C']/max(r['n'],1):.3f} width {r['W']/max(r['n'],1):.2f} mae {r['AE']/max(r['n'],1):.2f} ({r['t']:.0f}s)", flush=True)
    with open(OUT, 'w') as fh:
        w = csv.writer(fh); w.writerow(['sensor','n','IS_sum','W_sum','C_sum','AE_sum']); [w.writerow([r['j'], r['n'], r['IS'], r['W'], r['C'], r['AE']]) for r in rows]
    n = sum(r['n'] for r in rows); IS = sum(r['IS'] for r in rows)/n; W = sum(r['W'] for r in rows)/n; C = sum(r['C'] for r in rows)/n; AE = sum(r['AE'] for r in rows)/n
    nc = np.array([r['C']/max(r['n'],1) for r in rows])
    print(f"POOLED n {n} Winkler {IS:.2f} dCov {100*(C-0.9):.2f} width {W:.2f} MAE(median) {AE:.2f} sensor cov p10/p90 {100*np.percentile(nc,10):.1f}/{100*np.percentile(nc,90):.1f} min/max {100*nc.min():.1f}/{100*nc.max():.1f}")
