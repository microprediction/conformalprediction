"""Is stratification's benefit CONDITIONING, or merely THINNING?

Members of a lagged-state stratum are about M steps apart in time, because only a
1/M fraction of times land in the bin. Their correlation is therefore phi^M, not phi.
So stratifying does two things at once: it resolves the state, and it thins the
sample in time. Thinning alone decorrelates.

Decisive comparison, all at the same effective sample size n/M:
  pooled     all n points, no conditioning, no thinning
  thinned    every M-th point, NO conditioning at all
  stratified M lagged-state bins, conditioning AND thinning
  shuffled   a stratum-sized random subset of the pooled scores (thinning with
             no time structure, an upper bound on how much thinning can buy)

If thinned ~ stratified, the benefit is thinning and the conditioning story is wrong.
"""
import math, numpy as np
from scipy.special import ndtr, ndtri
from numpy.polynomial.hermite_e import hermegauss

NU, ELL, P = 1.0, 1, 0.90
GX, GW = hermegauss(40); GW = GW/GW.sum()
G = lambda r, m, s: float(np.sum(GW*(2*ndtr(r*np.exp(-(m+s*GX)))-1)))
def inv_of(f,t,lo=1e-9,hi=300.0):
    for _ in range(160):
        mm=0.5*(lo+hi)
        if f(mm)<t: lo=mm
        else: hi=mm
    return 0.5*(lo+hi)

def lrv(I, maxlag=120):
    I = I - I.mean()
    return float(np.var(I) + 2*sum(float(np.mean(I[:-j]*I[j:])) for j in range(1, maxlag)))

def study(phi, M, T=600000, seed=5):
    rng = np.random.default_rng(seed)
    x = rng.normal(0,NU); xs = np.empty(T)
    for t in range(T):
        xs[t]=x; x = phi*x + math.sqrt(1-phi*phi)*NU*rng.normal()
    R = np.exp(xs)*np.abs(rng.normal(size=T))
    qp = inv_of(lambda r: G(r,0.0,NU), P)
    I = (R <= qp).astype(float)
    base = P*(1-P)
    out = {}
    out["pooled"] = lrv(I)/base
    out["thinned"] = lrv(I[::M])/base if M > 1 else out["pooled"]
    edges = [NU*ndtri(i/M) for i in range(1,M)] if M>1 else []
    lab = np.searchsorted(edges, xs)
    vals = []
    for b in range(M):
        idx = np.where(lab[:-ELL]==b)[0]+ELL
        if len(idx) > 4000: vals.append(lrv(I[idx]))
    out["stratified"] = float(np.mean(vals))/base if vals else float("nan")
    sub = rng.permutation(I)[:len(I)//M]
    out["shuffled"] = lrv(sub)/base
    return out

print("="*94)
print("Variance inflation over the i.i.d. baseline p(1-p). Is it conditioning or thinning?")
print()
for phi in (0.90, 0.98):
    print(f"  phi = {phi}")
    print(f"    {'M':>4} {'pooled':>9} {'thinned':>9} {'stratified':>12} {'shuffled':>10}"
          f" {'strat/thin':>11}")
    for M in (2,3,5,8,12,20,40):
        o = study(phi, M)
        print(f"    {M:>4} {o['pooled']:>9.2f} {o['thinned']:>9.2f} {o['stratified']:>12.2f}"
              f" {o['shuffled']:>10.2f} {o['stratified']/o['thinned']:>11.2f}")
    print()
print("shuffled ~ 1 is the no-dependence reference.")
print("If thinned ~ stratified, conditioning adds nothing beyond thinning.")
