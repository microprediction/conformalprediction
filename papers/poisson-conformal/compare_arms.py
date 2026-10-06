"""Three ways to carry a conditional guarantee under Markov dependence.

  WC   worst-case invariant quantile        (Theorem 5)
  SI   state-indexed invariant quantile     (Theorem 9, new)
  MO   Mondrian on the LAGGED state         (no Poisson equation needed)

Population comparison first, then finite sample with each arm's own margin.
The question is where SI's use of all n points beats MO's tighter target but
split sample.
"""
import math, numpy as np

def model(pi_H, lam=0.80, p=0.90, ell=1):
    pi_L = 1 - pi_H
    P = np.array([[pi_L + lam*pi_H, pi_H*(1-lam)], [pi_L*(1-lam), pi_H + lam*pi_L]])
    mu_L, mu_H = 1/math.log(20.0), 1/math.log(10.0/3.0)
    F_L = lambda q: 1-np.exp(-np.asarray(q, float)/mu_L)
    F_H = lambda q: 1-np.exp(-np.asarray(q, float)/mu_H)
    F   = lambda q: pi_L*F_L(q) + pi_H*F_H(q)
    Pl  = np.linalg.matrix_power(P, ell)
    law = lambda w: (lambda q: Pl[w,0]*F_L(q) + Pl[w,1]*F_H(q))
    return dict(pi=np.array([pi_L,pi_H]), P=P, F=F, Fw=[F_L,F_H], law=law,
                mu=[mu_L,mu_H], p=p, ell=ell, lam=lam)

def inv(f, target, lo=1e-12, hi=80.0):
    for _ in range(300):
        m = 0.5*(lo+hi)
        if f(m) < target: lo = m
        else: hi = m
    return 0.5*(lo+hi)

def levels(M):
    """u*(w) and the worst case u*, for the invariant-quantile arms."""
    p, F = M["p"], M["F"]
    out = []
    for w in (0,1):
        lawf = M["law"](w)
        if lawf(inv(F,p)) >= p: out.append(p)
        else:
            lo, hi = p, 1-1e-12
            for _ in range(300):
                m = 0.5*(lo+hi)
                if lawf(inv(F,m)) >= p: hi = m
                else: lo = m
            out.append(hi)
    return out, max(out)

print("=" * 92)
print("POPULATION thresholds, no sampling noise. lambda=0.8, p=0.9, ell=1")
print(f"{'pi_H':>6} {'WC':>9} {'SI(L)':>9} {'SI(H)':>9} {'MO(L)':>9} {'MO(H)':>9} "
      f"{'E[WC]':>8} {'E[SI]':>8} {'E[MO]':>8}")
for pi_H in (0.02, 0.05, 0.10, 0.20, 0.40):
    M = model(pi_H); us, u_wc = levels(M); p = M["p"]; pi = M["pi"]
    Twc = inv(M["F"], u_wc)
    Tsi = [inv(M["F"], us[0]), inv(M["F"], us[1])]
    Tmo = [inv(M["law"](0), p), inv(M["law"](1), p)]
    print(f"{pi_H:>6.2f} {Twc:>9.4f} {Tsi[0]:>9.4f} {Tsi[1]:>9.4f} {Tmo[0]:>9.4f} {Tmo[1]:>9.4f} "
          f"{Twc:>8.4f} {pi@Tsi:>8.4f} {pi@Tmo:>8.4f}")
print("  MO dominates SI in the population at every rarity: it targets the right law.")

# ---------------- finite sample -------------------------------------------
def freedman(n, eta, B, V):
    x = math.log(1/eta)
    return (2*B + math.sqrt(2*n*V*x))/n + 2*B*x/(3*n)

def chi(M, q, w):
    return (float(M["Fw"][w](q)) - float(M["F"](q))) / (1 - M["lam"])

def Vexact(M, q):
    c = np.array([chi(M,q,0), chi(M,q,1)]); out = 0.0
    for w in (0,1):
        m = M["P"][w] @ c
        out = max(out, float(M["P"][w] @ (c-m)**2))
    return out

def run(pi_H, n, eta=0.10, reps=3000, seed=0):
    M = model(pi_H); rng = np.random.default_rng(seed)
    us, u_wc = levels(M); p, ell, pi = M["p"], M["ell"], M["pi"]
    B = max(abs(chi(M, inv(M["F"],u), w)) for u in set(us+[u_wc]) for w in (0,1))
    V = max(Vexact(M, inv(M["F"],u)) for u in set(us+[u_wc]))
    d_wc, d_si = freedman(n,eta,B,V), freedman(n,eta/2,B,V)
    acc = {a: {"T":[], "fail":0, "inf":0} for a in ("WC","SI","MO")}
    for _ in range(reps):
        w = 0 if rng.random() < pi[0] else 1
        st = np.empty(n+ell, dtype=int)
        for t in range(n+ell):
            st[t] = w; w = 0 if rng.random() < M["P"][w,0] else 1
        cal = st[:n]
        sc = rng.exponential(np.where(cal==0, M["mu"][0], M["mu"][1]))
        wn = cal[-1]
        srt = np.sort(sc)
        def take(sorted_arr, lvl):
            k = int(len(sorted_arr)*lvl) + 1
            return math.inf if k > len(sorted_arr) else sorted_arr[k-1]
        T = {"WC": take(srt, u_wc + d_wc), "SI": take(srt, us[wn] + d_si)}
        # Mondrian: stratify by the state ell steps earlier
        lagw = st[:n]                      # W_{i-ell} for score index i, ell=1 -> shift
        idx = np.where(lagw[:-ell] == wn)[0] + ell if ell else np.where(lagw==wn)[0]
        sub = np.sort(sc[idx])
        if len(sub) < 10:
            T["MO"] = math.inf
        else:
            Vw, Bw = Vexact(M, inv(M["F"], p)), B
            T["MO"] = take(sub, p + freedman(len(sub), eta/2, Bw, Vw))
        for a,t in T.items():
            acc[a]["T"].append(t if math.isfinite(t) else np.nan)
            if not math.isfinite(t): acc[a]["inf"] += 1
            elif M["law"](wn)(t) < p - 1e-12: acc[a]["fail"] += 1
    return {a: (np.nanmean(v["T"]) if np.isfinite(v["T"]).any() else math.inf,
                v["fail"]/reps, v["inf"]/reps) for a,v in acc.items()}

print()
print("=" * 92)
print("FINITE SAMPLE, eta=0.10, 3000 reps. mean threshold (nan-dropped) / fail rate / share vacuous")
print(f"{'pi_H':>6} {'n':>7} | {'WC thr':>8} {'fail':>6} {'vac':>5} | {'SI thr':>8} {'fail':>6} {'vac':>5} "
      f"| {'MO thr':>8} {'fail':>6} {'vac':>5}")
for pi_H in (0.02, 0.10, 0.20):
    for n in (500, 2000, 8000):
        r = run(pi_H, n)
        print(f"{pi_H:>6.2f} {n:>7} | {r['WC'][0]:>8.3f} {r['WC'][1]:>6.3f} {r['WC'][2]:>5.2f} "
              f"| {r['SI'][0]:>8.3f} {r['SI'][1]:>6.3f} {r['SI'][2]:>5.2f} "
              f"| {r['MO'][0]:>8.3f} {r['MO'][1]:>6.3f} {r['MO'][2]:>5.2f}")
