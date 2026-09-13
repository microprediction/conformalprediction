"""Re-run Stankeviciute et al.'s COVID-19 experiment with their code (CFRNN, QRNN,
DPRNN, their hyperparameters) on English lower-tier local authorities from the
UKHSA API, and score every method's intervals with the interval score alongside
their coverage and width. laplace (skaters) is run online on each test sequence's
own 100 observed days with no training data at all.

    python run_covid.py <seed>      -> results_covid_seed<seed>.json
"""
import sys, os, json, math, time, warnings
import numpy as np, torch
torch.set_num_threads(int(os.environ.get('TORCH_THREADS', 4)))
warnings.filterwarnings("ignore")
sys.path.insert(0, "."); sys.path.insert(0, os.path.expanduser("~/github/skaters/src"))
import utils.data_processing_covid as dpc
from models.cfrnn import CFRNN
from models.qrnn import QRNN
from models.dprnn import DPRNN
from utils.performance import evaluate_cfrnn_performance, evaluate_performance
from utils.train_medical import DEFAULT_MEDICAL_PARAMETERS, EPOCHS
from skaters import laplace

X_ALL = np.load("../covid_window.npy")          # [n_areas, 150] daily cases
N = len(X_ALL); NTR, NCAL = round(N * 200 / 380), round(N * 100 / 380); NTE = N - NTR - NCAL
T, HZ, ALPHA = 100, 50, 0.1
dpc.get_raw_covid_data = lambda cached=True: X_ALL      # their loader, our array
seed = int(sys.argv[1]) if len(sys.argv) > 1 else 0


def interval_score(lo, hi, y, a):
    return (hi - lo) + (2 / a) * np.maximum(lo - y, 0) + (2 / a) * np.maximum(y - hi, 0)


def score(lo, hi, Y, a):
    """lo, hi, Y: [n_test, H]. Returns per-horizon means and joint coverage."""
    cov = (lo <= Y) & (Y <= hi)
    return dict(IS=float(interval_score(lo, hi, Y, a).mean()), width=float((hi - lo).mean()),
                cov=float(cov.mean()), joint=float(cov.all(axis=1).mean()),
                IS_by_h=[float(x) for x in interval_score(lo, hi, Y, a).mean(0)[[0, 9, 24, 49]]])


PART = f"results_covid_seed{seed}.partial.json"

def _lap(x):
    f = laplace(k=HZ); st = None
    for y in x:
        d, st = f(float(y), st)
    q = lambda a: [dd.quantile(a) for dd in d]
    return (q(ALPHA / 2), q(1 - ALPHA / 2), q(ALPHA / HZ / 2), q(1 - ALPHA / HZ / 2))


def main():
    global out
    out = {"seed": seed, "n_areas": N, "split": [NTR, NCAL, NTE]}
    torch.manual_seed(seed); np.random.seed(seed)
    t0 = time.time()
    if os.path.exists(PART):
        out = json.load(open(PART)); print("loaded checkpoint", PART, flush=True)
    if "DPRNN" not in out:
        # ---- CFRNN (their code, their hyperparameters) ----
        tr, cal, te = dpc.get_covid_splits(length=T, horizon=HZ, conformal=True, n_train=NTR,
                                           n_calibration=NCAL, n_test=NTE, cached=False, seed=seed)
        p = dict(DEFAULT_MEDICAL_PARAMETERS); p.update(max_steps=T, output_size=HZ, epochs=EPOCHS["CFRNN"]["covid"])
        m = CFRNN(embedding_size=p["embedding_size"], horizon=HZ, error_rate=ALPHA, rnn_mode=p["rnn_mode"])
        m.fit(tr, cal, epochs=p["epochs"], lr=p["lr"], batch_size=p["batch_size"])
        Y = np.array([te[i][1].numpy().ravel() for i in range(len(te))])
        for corrected, tag, a in ((True, "CFRNN_bonf", ALPHA / HZ), (False, "CFRNN_marg", ALPHA)):
            r = evaluate_cfrnn_performance(m, te, correct_conformal=corrected)
            lo, hi = r["Lower limit"].detach().numpy().squeeze(-1), r["Upper limit"].detach().numpy().squeeze(-1)
            out[tag] = score(lo, hi, Y, a)
        eps = m.corrected_critical_calibration_scores.detach().numpy().ravel()
        maxres = m.calibration_scores.detach().numpy().max(axis=-1).ravel()       # [horizon]
        out["cfrnn_bonf_eps_equals_max_residual"] = bool(np.allclose(eps, maxres))
        out["cfrnn_bonf_k"] = math.ceil((NCAL + 1) * (1 - ALPHA / HZ)); out["cfrnn_n_cal"] = NCAL
        print(f"CFRNN done {time.time()-t0:.0f}s; bonf eps == max residual: {out['cfrnn_bonf_eps_equals_max_residual']}", flush=True)
        # ---- QRNN, DPRNN (their code) ----
        trr, _, ter = dpc.get_covid_splits(length=T, horizon=HZ, conformal=False, n_train=NTR,
                                           n_calibration=NCAL, n_test=NTE, cached=False, seed=seed)
        assert np.allclose(np.array(ter[1]), Y)
        for name, cls in (("QRNN", QRNN), ("DPRNN", DPRNN)):
            torch.manual_seed(seed); np.random.seed(seed)
            q = dict(DEFAULT_MEDICAL_PARAMETERS); q.update(max_steps=T, output_size=HZ, epochs=EPOCHS[name]["covid"])
            mdl = cls(**q); mdl.fit(trr[0], trr[1])
            r = evaluate_performance(mdl, ter[0], ter[1], coverage=1 - ALPHA)
            lo, hi = np.array(r["Lower limit"]).reshape(len(Y), HZ), np.array(r["Upper limit"]).reshape(len(Y), HZ)
            out[name] = score(lo, hi, Y, ALPHA)
            print(f"{name} done {time.time()-t0:.0f}s", flush=True)
            json.dump(out, open(PART, "w"), indent=1)
    # ---- laplace, online on the raw counts of each test sequence ----
    import pickle
    dpc.get_covid_splits(length=T, horizon=HZ, conformal=True, n_train=NTR, n_calibration=NCAL, n_test=NTE, cached=False, seed=seed)
    Xte_raw, Yte = pickle.load(open("processed_data/covid_test_vis.pkl", "rb"))
    Y = np.asarray(Yte, float)
    from concurrent.futures import ProcessPoolExecutor

    with ProcessPoolExecutor(int(os.environ.get("WORKERS", 8))) as ex:
        res = list(ex.map(_lap, [row for row in Xte_raw]))
    lo_m = np.array([r[0] for r in res]); hi_m = np.array([r[1] for r in res])
    lo_b = np.array([r[2] for r in res]); hi_b = np.array([r[3] for r in res])
    out["laplace_marg"] = score(lo_m, hi_m, Y, ALPHA)
    out["laplace_bonf"] = score(lo_b, hi_b, Y, ALPHA / HZ)
    print(f"laplace done {time.time()-t0:.0f}s", flush=True)
    json.dump(out, open(f"results_covid_seed{seed}.json", "w"), indent=1)
    for k, v in out.items():
        if isinstance(v, dict):
            print(f"{k:14s} IS {v['IS']:9.2f} width {v['width']:8.2f} cov {v['cov']:.3f} joint {v['joint']:.3f}  IS by h(1,10,25,50) {[round(x,1) for x in v['IS_by_h']]}")


if __name__ == "__main__":
    main()
