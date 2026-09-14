"""Audit Finding 10. Is the within-stratum variance driven by VISIT CLUSTERING
(my gap/Jensen story) or by the long-run covariance of the coverage INDICATOR?

Decisive test. By Kac's lemma every equal-probability stratum has the SAME mean
return time M. If clustering of visits drove the within-stratum variance, bins with
similar gap statistics would have similar variance. Compare, per bin:

  (a) mean gap and E[phi^tau]          my proposed mechanism
  (b) measured within-bin long-run variance of the coverage indicator
  (c) the indicator's within-bin lag-1 autocorrelation

If (b) varies a lot across bins while (a) barely moves, the gap story is wrong.
"""
import math, numpy as np
from scipy.special import ndtr, ndtri

PHI, M, P, T = 0.98, 8, 0.90, 800000
GX = np.polynomial.hermite_e.hermegauss(200)[0]
GW = np.polynomial.hermite_e.hermegauss(200)[1]; GW = GW/GW.sum()
Fx = lambda q,x: 2*ndtr(q*np.exp(-x))-1
lo,hi=1e-9,300.0
for _ in range(200):
    m=0.5*(lo+hi)
    if float(np.sum(GW*Fx(m,GX)))<P: lo=m
    else: hi=m
QP=0.5*(lo+hi)

rng=np.random.default_rng(4)
x=rng.normal(); xs=np.empty(T)
for t in range(T):
    xs[t]=x; x=PHI*x+math.sqrt(1-PHI*PHI)*rng.normal()
R=np.exp(xs)*np.abs(rng.normal(size=T))
I=(R<=QP).astype(float)
edges=[ndtri(i/M) for i in range(1,M)]
lab=np.searchsorted(edges,xs)

def lrv(v, maxlag=150):
    v=v-v.mean()
    return float(np.var(v)+2*sum(float(np.mean(v[:-j]*v[j:])) for j in range(1,maxlag)))

print("="*100)
print(f"AR(1) phi={PHI}, {M} equal-probability bins, T={T}. Kac: every bin has mean return time {M}.")
print()
print(f"{'bin':>4} {'P(R<=q|bin)':>12} {'mean gap':>9} {'E[phi^tau]':>11} {'lag-1 ac':>9}"
      f" {'within LRV':>11} {'ESS/count':>10}")
rows=[]
for b in range(M):
    idx=np.where(lab[:-1]==b)[0]+1
    if len(idx)<3000: continue
    g=np.diff(np.where(lab==b)[0])
    Ib=I[idx]; v=lrv(Ib)
    p_b=float(Ib.mean())
    ac1=float(np.corrcoef(Ib[:-1],Ib[1:])[0,1])
    ess=float(np.var(Ib)/v) if v>0 else float("nan")
    rows.append((b,p_b,g.mean(),float(np.mean(PHI**g)),ac1,v,ess))
    print(f"{b:>4} {p_b:>12.4f} {g.mean():>9.2f} {np.mean(PHI**g):>11.3f} {ac1:>9.3f}"
          f" {v:>11.5f} {ess:>10.3f}")
r=np.array([[x[2],x[3],x[5],x[6]] for x in rows])
print()
print(f"spread across bins:  mean gap {r[:,0].max()/r[:,0].min():.2f}x   "
      f"E[phi^tau] {r[:,1].max()/r[:,1].min():.2f}x   "
      f"within LRV {r[:,2].max()/r[:,2].min():.1f}x   ESS/count {r[:,3].max()/r[:,3].min():.1f}x")
print()
print("If the LRV spread is far larger than the gap-statistic spread, visit clustering")
print("is not the mechanism and Finding 10's explanation is wrong.")
