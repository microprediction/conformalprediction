"""laplace (skaters_fast, horizon 12) on each sensor's GRU residual series from CoRel's base run; the interval
is the GRU point forecast plus laplace's 5%/95% residual quantiles. Dumps per-target quantiles like laplace_dump.py.
Usage: laplace_resid.py <base run dir> <out.npz> [workers]"""
import sys, numpy as np, pandas as pd, time
from concurrent.futures import ProcessPoolExecutor, as_completed
D, OUT = sys.argv[1], sys.argv[2]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 8; H = 12
def prep():
    t = pd.read_hdf(D+'/residuals.h5','target'); m = pd.read_hdf(D+'/residuals.h5','target_mask').values.astype(bool)
    R = np.where(m, t.values, 0.0)          # masked residual fed as 0
    np.save('resid_R.npy', R); np.save('resid_M.npy', m); return R.shape
def run_sensor(j):
    import skaters_fast
    r = np.load('resid_R.npy', mmap_mode='r')[:, j]; mk = np.load('resid_M.npy', mmap_mode='r')[:, j]; T = len(r); f = skaters_fast.laplace(H); Q = np.full((T, 3), np.nan); d = None
    for t in range(T):
        if mk[t] or d is None: d = f.step(float(r[t]))      # SKIPMASK: masked residuals are not fed; the last predictive stands
        if t + H < T: q = d[H-1]; Q[t+H] = (q.quantile(0.05), q.quantile(0.5), q.quantile(0.95))
    return j, Q
if __name__ == '__main__':
    T, N = prep(); out = np.full((T, N, 3), np.nan, np.float32); t0 = time.time()
    with ProcessPoolExecutor(W) as ex:
        for k, fu in enumerate(as_completed([ex.submit(run_sensor, j) for j in range(N)])):
            j, Q = fu.result(); out[:, j] = Q
            if k % 40 == 0: print(f'{k+1}/{N} {time.time()-t0:.0f}s', flush=True)
    np.savez_compressed(OUT, Q=out); print('saved', OUT, time.time()-t0)
