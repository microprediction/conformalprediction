"""Is there an OPTIMAL stratification granularity, and does theory predict it?

Two forces pull against each other as the bin count M grows.

  residual dependence:  binning a state into M quantile bins leaves within-bin
                        state variance of order 1/M^2 (quantizer rate), so the
                        residual variance inflation over the i.i.d. baseline
                        should decay like (S - 1)/M^2 where S = sigma^2/p(1-p).

  sample starvation:    a stratum holds about n/M points, so the Freedman margin
                        grows like sqrt(M/n).

Margin^2 ~ (1 + (S-1)/M^2) * M / n.  Minimising M + (S-1)/M gives

                        M* = sqrt(S - 1).

Test: measure the within-stratum long-run variance directly, check the 1/M^2 decay,
then find the width-minimising valid M and compare with sqrt(S-1).
"""
import math, numpy as np
from scipy.special import ndtr, ndtri
from numpy.polynomial.hermite_e import hermegauss

NU, ELL, P = 1.0, 1, 0.90
GX, GW = hermegauss(40); GW = GW/GW.sum()

def G(r, mean, sd):
    u = mean + sd*GX
    return float(np.sum(GW*(2*ndtr(r*np.exp(-u))-1)))

law_from = lambda x, phi: (lambda r: G(r, phi**ELL*x, NU*math.sqrt(1-phi**(2*ELL))))
invariant = lambda: (lambda r: G(r, 0.0, NU))

def inv_of(f, t, lo=1e-9, hi=300.0):
    for _ in range(160):
        m=0.5*(lo+hi)
        if f(m)<t: lo=m
        else: hi=m
    return 0.5*(lo+hi)

def freedman(n, eta, B, V):
    x=math.log(1/eta); return (2*B+math.sqrt(2*n*V*x))/n + 2*B*x/(3*n)

def path(phi, T, rng):
    x = rng.normal(0,NU); xs=np.empty(T)
    for t in range(T):
        xs[t]=x; x = phi*x + math.sqrt(1-phi*phi)*NU*rng.normal()
    return xs, np.exp(xs)*np.abs(rng.normal(size=T))

def lrv_within(phi, M, T=400000, seed=11):
    """long-run variance of the coverage indicator WITHIN each lagged-state bin."""
    rng=np.random.default_rng(seed); xs,R = path(phi,T,rng)
    qp = inv_of(invariant(), P)
    edges=[NU*ndtri(i/M) for i in range(1,M)] if M>1 else []
    lab = np.searchsorted(edges, xs)
    out=[]
    for b in range(M):
        idx = np.where(lab[:-ELL]==b)[0]+ELL
        if len(idx)<5000: continue
        I=(R[idx]<=qp).astype(float); I-=I.mean()
        ac=[float(np.mean(I[:-j]*I[j:])) for j in range(1,80)]
        out.append(float(np.var(I)+2*sum(ac)))
    return float(np.mean(out)) if out else float("nan")

def run(phi, n, M, eta=0.05, reps=2000, seed=0, V=None):
    rng=np.random.default_rng(seed)
    edges=[NU*ndtri(i/M) for i in range(1,M)] if M>1 else []
    res={"fail":0,"n":0,"T":[]}
    for _ in range(reps):
        xs,R = path(phi, n+ELL, rng)
        calx, cal = xs[:n], R[:n]
        xn=calx[-1]; bn=int(np.searchsorted(edges,xn))
        lab=np.searchsorted(edges,calx)
        sub=np.sort(cal[np.where(lab[:-ELL]==bn)[0]+ELL]); N=len(sub)
        if N<20: continue
        k=int(N*(P+freedman(N,eta/2,1.0,V)))+1
        T=math.inf if k>N else sub[k-1]
        c=1.0 if not math.isfinite(T) else law_from(xn,phi)(T)
        res["T"].append(T if math.isfinite(T) else np.nan); res["n"]+=1
        if c<P-1e-12: res["fail"]+=1
    return res["fail"]/res["n"], float(np.nanmean(res["T"])), np.mean(np.isnan(res["T"]))

print("="*100)
print("Within-stratum long-run variance: does it decay like (S-1)/M^2?")
print()
for phi in (0.90, 0.98):
    S = lrv_within(phi, 1)/(P*(1-P))
    print(f"  phi={phi}: pooled inflation S = {S:.2f},  predicted M* = sqrt(S-1) = {math.sqrt(S-1):.2f}")
    print(f"    {'M':>4} {'within infl':>12} {'predicted 1+(S-1)/M^2':>23}")
    for M in (1,2,3,5,8,12,20):
        w = lrv_within(phi, M)/(P*(1-P))
        print(f"    {M:>4} {w:>12.2f} {1+(S-1)/M**2:>23.2f}")
    print()

print("="*100)
print("Width against bin count, using the measured within-stratum variance. n=1500, eta=0.05")
print()
for phi in (0.90, 0.98):
    S = lrv_within(phi,1)/(P*(1-P))
    print(f"  phi={phi}, S={S:.1f}, sqrt(S-1)={math.sqrt(S-1):.1f}")
    print(f"    {'M':>4} {'within V':>9} {'fail':>7} {'mean thr':>10} {'vacuous':>8}")
    best=None
    for M in (1,2,3,5,8,12,20):
        Vw = lrv_within(phi,M)
        f,t,v = run(phi,1500,M,V=Vw)
        flag=""
        if f<=0.05 and math.isfinite(t):
            if best is None or t<best[1]: best=(M,t); flag=" <-"
        print(f"    {M:>4} {Vw:>9.3f} {f:>7.3f} {t:>10.3f} {v:>8.2f}{flag}")
    if best: print(f"    width-minimising valid M = {best[0]}  (predicted {math.sqrt(S-1):.1f})")
    print()
