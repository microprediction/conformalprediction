"""laplace (skaters_fast) per METR-LA sensor from a given start position; dumps horizon-12 quantiles
(5%, 50%, 95%) for every target position >= start+12 so scores can be cut any way afterwards.
Usage: laplace_dump.py <start> <out.npz> [workers] [sensor list csv or 'all']"""
import os, sys, numpy as np, time
from concurrent.futures import ProcessPoolExecutor, as_completed
START = int(sys.argv[1]); OUT = sys.argv[2]; WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 6
SENS = None if len(sys.argv) < 5 or sys.argv[4] == 'all' else [int(v) for v in sys.argv[4].split(',')]
H = 12
def run_sensor(j):
    import skaters_fast
    y = np.load('metrla_X.npy', mmap_mode='r')[:, j]; T = len(y)
    f = skaters_fast.laplace(H); Q = np.full((T, 3), np.nan)
    for t in range(START, T):
        d = f.step(float(y[t]))
        if t + H < T:
            q = d[H-1]; Q[t+H] = (q.quantile(0.05), q.quantile(0.5), q.quantile(0.95))
    return j, Q
if __name__ == '__main__':
    N = np.load('metrla_X.npy', mmap_mode='r').shape[1]; sens = list(range(N)) if SENS is None else SENS
    T = np.load('metrla_X.npy', mmap_mode='r').shape[0]; out = np.full((T, N, 3), np.nan, np.float32); t0 = time.time()
    with ProcessPoolExecutor(WORKERS) as ex:
        for k, fu in enumerate(as_completed([ex.submit(run_sensor, j) for j in sens])):
            j, Q = fu.result(); out[:, j] = Q
            if k % 20 == 0: print(f'{k+1}/{len(sens)} {time.time()-t0:.0f}s', flush=True)
    np.savez_compressed(OUT, Q=out, sensors=np.array(sens), start=START); print('saved', OUT, time.time()-t0)
