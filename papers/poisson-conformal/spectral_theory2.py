"""Complete the theory: compute the per-mode resolution of M quantile bins exactly.

Earlier the interpolation between the thinned and conditioned limits used an ad hoc
kernel. It does not need to be guessed. For Hermite mode k and M quantile bins of the
stationary state, the resolved fraction is

    rho_k(M) = sum_j pi_j ( E[He_k | bin j] )^2 / k!

computed by quadrature. Then, with emissions conditionally independent,

    sigma^2_strat(M) = p(1-p) - sum_k b_k^2 rho_k(M)
                              + 2 sum_k b_k^2 (1 - rho_k(M)) phi^{kM} / (1 - phi^{kM})

the resolved part leaving the marginal variance and the unresolved part still carrying
serial dependence at the thinned rate. Nothing is fitted.
"""
import math, numpy as np
from scipy.special import ndtr, ndtri
from numpy.polynomial.hermite_e import hermegauss, hermeval

P, KMAX = 0.90, 24
GX, GW = hermegauss(200); GW = GW/GW.sum()
Fx = lambda q, x: 2*ndtr(q*np.exp(-x)) - 1
def _qp():
    lo, hi = 1e-9, 300.0
    for _ in range(200):
        m=0.5*(lo+hi)
        if float(np.sum(GW*Fx(m,GX))) < P: lo=m
        else: hi=m
    return 0.5*(lo+hi)
QP = _qp(); BASE = P*(1-P)
G = Fx(QP, GX) - P
B = np.array([float(np.sum(GW*G*hermeval(GX,[0]*k+[1])))/math.sqrt(math.factorial(k))
              for k in range(1, KMAX+1)])
VSTATE = float(np.sum(B**2))

def rho(M):
    """resolved fraction of each Hermite mode under M quantile bins, by quadrature."""
    if M == 1: return np.zeros(KMAX)
    edges = [ndtri(i/M) for i in range(1, M)]
    lab = np.searchsorted(edges, GX)
    out = np.zeros(KMAX)
    for k in range(1, KMAX+1):
        He = hermeval(GX, [0]*k+[1]) / math.sqrt(math.factorial(k))
        tot = 0.0
        for j in range(M):
            m = lab == j
            wj = float(np.sum(GW[m]))
            if wj <= 0: continue
            tot += wj * (float(np.sum(GW[m]*He[m]))/wj)**2
        out[k-1] = min(1.0, tot)
    return out

def strat(phi, M):
    r = rho(M); t = BASE
    for k in range(1, KMAX+1):
        w = B[k-1]**2; rk = r[k-1]
        t += -w*rk + 2*w*(1-rk)*phi**(k*M)/(1-phi**(k*M))
    return t

meas = {(0.90,2):3.15,(0.90,3):1.98,(0.90,5):1.24,(0.90,8):1.03,(0.90,12):0.87,
        (0.90,20):0.72,(0.90,40):0.74,
        (0.98,2):12.54,(0.98,3):6.80,(0.98,5):2.82,(0.98,8):1.51,(0.98,12):1.04,
        (0.98,20):0.80,(0.98,40):0.71}

print("="*92)
print(f"q_p = {QP:.4f}   p(1-p) = {BASE:.4f}   state-explained share = {VSTATE/BASE:.3f}")
print(f"conditioning limit 1 - Vstate/p(1-p) = {1-VSTATE/BASE:.3f}")
print()
print("Mode resolution by M quantile bins (fraction of each Hermite mode recovered):")
print(f"  {'M':>4} " + " ".join(f"k={k}" for k in (1,2,3,4,6)))
for M in (2,3,5,8,12,20):
    r = rho(M)
    print(f"  {M:>4} " + " ".join(f"{r[k-1]:.2f}" for k in (1,2,3,4,6)))
print()
print("Predicted vs measured stratified inflation, nothing fitted:")
for phi in (0.90, 0.98):
    print(f"  phi = {phi}")
    print(f"    {'M':>4} {'predicted':>10} {'measured':>9} {'error':>7} | {'V*M':>7}")
    vm = {}
    for M in (2,3,5,8,12,20,40):
        pv = strat(phi,M)/BASE; mv = meas[(phi,M)]
        vm[M] = strat(phi,M)*M/BASE
        print(f"    {M:>4} {pv:>10.2f} {mv:>9.2f} {100*(pv-mv)/mv:>6.0f}% | {vm[M]:>7.2f}")
    best = min(range(2,41), key=lambda M: strat(phi,M)*M)
    print(f"    argmin V(M)*M = {best}   (grid search on realised width gave "
          f"{5 if phi==0.90 else 8})")
    print()
