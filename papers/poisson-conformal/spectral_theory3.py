"""Close the theory. The gap between prediction and measurement was Jensen.

Thinning by M spaces samples exactly M apart, so mode k decorrelates by phi^{kM}.
Stratifying gives a mean gap of M but a return-time distribution tau skewed toward 1
under persistence, and phi^{k tau} is convex in tau, so

    E[phi^{k tau}]  >=  phi^{k E[tau]}  =  phi^{kM}

with the inequality strict. Stratification therefore buys strictly less decorrelation
than its sample-size reduction suggests. Substituting the measured E[phi^{k tau}] for
phi^{kM} should close the error.
"""
import math, numpy as np
from scipy.special import ndtr, ndtri
from numpy.polynomial.hermite_e import hermegauss, hermeval

P, KMAX = 0.90, 24
GX, GW = hermegauss(200); GW = GW/GW.sum()
Fx = lambda q,x: 2*ndtr(q*np.exp(-x))-1
def _qp():
    lo,hi=1e-9,300.0
    for _ in range(200):
        m=0.5*(lo+hi)
        if float(np.sum(GW*Fx(m,GX)))<P: lo=m
        else: hi=m
    return 0.5*(lo+hi)
QP=_qp(); BASE=P*(1-P)
G = Fx(QP,GX)-P
B = np.array([float(np.sum(GW*G*hermeval(GX,[0]*k+[1])))/math.sqrt(math.factorial(k))
              for k in range(1,KMAX+1)])

def rho(M):
    if M==1: return np.zeros(KMAX)
    e=[ndtri(i/M) for i in range(1,M)]; lab=np.searchsorted(e,GX); out=np.zeros(KMAX)
    for k in range(1,KMAX+1):
        He=hermeval(GX,[0]*k+[1])/math.sqrt(math.factorial(k)); tot=0.0
        for j in range(M):
            m=lab==j; wj=float(np.sum(GW[m]))
            if wj>0: tot+=wj*(float(np.sum(GW[m]*He[m]))/wj)**2
        out[k-1]=min(1.0,tot)
    return out

def gap_moments(phi, M, T=400000, seed=3):
    """E[phi^{k tau}] for each mode k, over the realised return times to a bin."""
    rng=np.random.default_rng(seed)
    x=rng.normal(); xs=np.empty(T)
    for t in range(T):
        xs[t]=x; x=phi*x+math.sqrt(1-phi*phi)*rng.normal()
    e=[ndtri(i/M) for i in range(1,M)] if M>1 else []
    lab=np.searchsorted(e,xs)
    vals=[]
    for b in range(M):
        g=np.diff(np.where(lab==b)[0])
        if len(g)>500: vals.append(g)
    g=np.concatenate(vals)
    return np.array([float(np.mean(phi**(k*g))) for k in range(1,KMAX+1)])

meas={(0.90,2):3.15,(0.90,3):1.98,(0.90,5):1.24,(0.90,8):1.03,(0.90,12):0.87,(0.90,20):0.72,
      (0.98,2):12.54,(0.98,3):6.80,(0.98,5):2.82,(0.98,8):1.51,(0.98,12):1.04,(0.98,20):0.80}

print("="*90)
print("Closing the model with the Jensen factor. Nothing fitted; E[phi^{k tau}] is measured")
print("from the return times, everything else from the Hermite expansion.")
print()
for phi in (0.90,0.98):
    print(f"  phi = {phi}")
    print(f"    {'M':>4} {'phi^M':>8} {'E[phi^tau]':>11} | {'even-gap':>9} {'Jensen':>8} {'measured':>9} {'err':>7}")
    for M in (2,3,5,8,12,20):
        r=rho(M); eg=gap_moments(phi,M)
        even = BASE + sum(-B[k-1]**2*r[k-1] + 2*B[k-1]**2*(1-r[k-1])*phi**(k*M)/(1-phi**(k*M))
                          for k in range(1,KMAX+1))
        jen  = BASE + sum(-B[k-1]**2*r[k-1] + 2*B[k-1]**2*(1-r[k-1])*eg[k-1]/(1-eg[k-1])
                          for k in range(1,KMAX+1))
        mv=meas[(phi,M)]
        print(f"    {M:>4} {phi**M:>8.3f} {eg[0]:>11.3f} | {even/BASE:>9.2f} {jen/BASE:>8.2f}"
              f" {mv:>9.2f} {100*(jen/BASE-mv)/mv:>6.0f}%")
    print()
