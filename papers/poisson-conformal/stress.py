"""Can the i.i.d. margin be broken by dependence? If not, the dependence
correction is never the binding constraint and the paper's practical claim fails.

Push every dial that should favour the correction: extreme persistence, large
regime contrast d_p, small n, small eta.
"""
import math, numpy as np
from compare_arms import inv, freedman

def build(pi_H, lam, FL_at, FH_at, p=0.90, ell=1):
    pi_L = 1-pi_H
    P = np.array([[pi_L+lam*pi_H, pi_H*(1-lam)],[pi_L*(1-lam), pi_H+lam*pi_L]])
    # exponential emissions calibrated so F_L(1)=FL_at, F_H(1)=FH_at
    mu_L, mu_H = -1/math.log(1-FL_at), -1/math.log(1-FH_at)
    F_L = lambda q: 1-np.exp(-np.asarray(q,float)/mu_L)
    F_H = lambda q: 1-np.exp(-np.asarray(q,float)/mu_H)
    F   = lambda q: pi_L*F_L(q)+pi_H*F_H(q)
    Pl  = np.linalg.matrix_power(P, ell)
    law = lambda w: (lambda q: Pl[w,0]*F_L(q)+Pl[w,1]*F_H(q))
    return dict(pi=np.array([pi_L,pi_H]),P=P,F=F,Fw=[F_L,F_H],law=law,
                mu=[mu_L,mu_H],p=p,ell=ell,lam=lam)

def s2_of(M):
    p,pi,lam = M["p"],M["pi"],M["lam"]
    qp = inv(M["F"],p); d = float(M["Fw"][1](qp)-M["Fw"][0](qp))
    return p*(1-p)+2*pi[0]*pi[1]*d*d*lam/(1-lam)

def run(M, n, eta, reps=6000, seed=1):
    rng = np.random.default_rng(seed); p, ell, pi = M["p"], M["ell"], M["pi"]
    s2 = s2_of(M)
    out = {a:{"fail":0,"n":0,"cov":[]} for a in ("exch","sigma2")}
    for _ in range(reps):
        w = 0 if rng.random()<pi[0] else 1
        st = np.empty(n+ell,dtype=int)
        for t in range(n+ell):
            st[t]=w; w = 0 if rng.random()<M["P"][w,0] else 1
        cal = st[:n]
        sc = rng.exponential(np.where(cal==0,M["mu"][0],M["mu"][1]))
        wn = cal[-1]
        sub = np.sort(sc[np.where(cal[:-ell]==wn)[0]+ell]); N=len(sub)
        if N < 20: continue
        for arm in ("exch","sigma2"):
            V = p*(1-p) if arm=="exch" else s2
            k = int(N*(p+freedman(N,eta/2,1.0,V)))+1
            T = math.inf if k>N else sub[k-1]
            c = 1.0 if not math.isfinite(T) else float(M["law"](wn)(T))
            r=out[arm]; r["cov"].append(c); r["n"]+=1
            if c < p-1e-12: r["fail"]+=1
    return {a:(r["fail"]/r["n"], float(np.mean(r["cov"]))) for a,r in out.items() if r["n"]}

print("="*96)
print("Stress test: every dial pushed toward the dependence correction mattering.")
print("d_p = F_H(q_p) - F_L(q_p) is the regime contrast. Nominal eta in the header.")
print()
print(f"{'pi_H':>5} {'lam':>5} {'F_L':>5} {'F_H':>5} {'d_p':>6} {'infl':>6} {'n':>6} {'eta':>5}"
      f" | {'exch fail':>10} {'sig fail':>9} | {'exch cov':>9} {'sig cov':>8}")
grid = [
  (0.20,0.98,0.99,0.50,  400,0.10), (0.20,0.98,0.99,0.50, 1000,0.10),
  (0.50,0.98,0.99,0.40,  400,0.10), (0.50,0.99,0.99,0.30,  400,0.10),
  (0.50,0.995,0.99,0.30, 400,0.05), (0.50,0.995,0.99,0.20, 800,0.05),
  (0.50,0.998,0.99,0.10, 800,0.05), (0.50,0.999,0.99,0.10,2000,0.05),
]
for pi_H,lam,FL,FH,n,eta in grid:
    M = build(pi_H,lam,FL,FH); s2=s2_of(M); p=M["p"]
    qp=inv(M["F"],p); d=float(M["Fw"][1](qp)-M["Fw"][0](qp))
    r = run(M,n,eta)
    print(f"{pi_H:>5.2f} {lam:>5.3f} {FL:>5.2f} {FH:>5.2f} {d:>6.3f} {s2/(p*(1-p)):>6.1f} {n:>6} {eta:>5.2f}"
          f" | {r['exch'][0]:>10.3f} {r['sigma2'][0]:>9.3f} | {r['exch'][1]:>9.4f} {r['sigma2'][1]:>8.4f}")
