"""Derive the thinning and conditioning factors from the spectrum, then test them.

For the AR(1) log-volatility state the transition operator is the Ornstein-Uhlenbeck
one: eigenvalues phi^k with Hermite eigenfunctions He_k. Expand the state-measurable
part of the centred coverage indicator,

    g(x) = F_x(q_p) - p = sum_{k>=1} b_k He_k(x) / sqrt(k!) ,

with emissions conditionally independent given the state. Then everything follows.

  pooled          sigma^2 = p(1-p) + 2 sum_k b_k^2 phi^k / (1 - phi^k)
  thinned by M    sigma^2 = p(1-p) + 2 sum_k b_k^2 phi^{kM} / (1 - phi^{kM})
  conditioned     sigma^2 = p(1-p) - sum_k b_k^2            (law of total variance)

The third is below the i.i.d. baseline, which is the overshoot seen in Finding 7.
"""
import math, numpy as np
from scipy.special import ndtr, ndtri
from numpy.polynomial.hermite_e import hermegauss

NU, ELL, P, KMAX = 1.0, 1, 0.90, 24
GX, GW = hermegauss(120); GW = GW/GW.sum()

def Fx(q, x):
    """P(R <= q | log s = x) for R = e^{log s}|eps|."""
    return 2*ndtr(q*np.exp(-x)) - 1

def qp_of():
    f = lambda q: float(np.sum(GW*Fx(q, GX)))
    lo, hi = 1e-9, 300.0
    for _ in range(200):
        m = 0.5*(lo+hi)
        if f(m) < P: lo = m
        else: hi = m
    return 0.5*(lo+hi)

QP = qp_of()

def hermite_coeffs():
    """b_k = E[g(X) He_k(X)]/sqrt(k!), X ~ N(0,1), by Gauss-Hermite."""
    g = Fx(QP, GX) - P
    b = []
    for k in range(1, KMAX+1):
        He = np.polynomial.hermite_e.hermeval(GX, [0]*k + [1])
        b.append(float(np.sum(GW*g*He)) / math.sqrt(math.factorial(k)))
    return np.array(b)

B = hermite_coeffs()
BASE = P*(1-P)
Vstate = float(np.sum(B**2))          # state-explained share of the marginal variance

def pooled(phi):  return BASE + 2*sum(B[k-1]**2 * phi**k/(1-phi**k) for k in range(1, KMAX+1))
def thinned(phi, M): return BASE + 2*sum(B[k-1]**2 * phi**(k*M)/(1-phi**(k*M)) for k in range(1, KMAX+1))
def conditioned(): return BASE - Vstate

print("="*96)
print(f"q_p = {QP:.4f},  p(1-p) = {BASE:.4f},  state-explained variance = {Vstate:.5f}")
print(f"Hermite weight: first three modes carry {100*np.sum(B[:3]**2)/Vstate:.1f}% of it")
print()
print("PREDICTED vs MEASURED variance inflation over p(1-p).")
print("Measured columns are from attack_thinning.py (600k-step paths).")
print()
meas = {  # (phi, M) -> (thinned, stratified) measured
 (0.90,2):(3.48,3.15), (0.90,3):(2.60,1.98), (0.90,5):(1.63,1.24), (0.90,8):(1.48,1.03),
 (0.90,12):(1.33,0.87), (0.90,20):(0.90,0.72), (0.90,40):(1.15,0.74),
 (0.98,2):(14.89,12.54),(0.98,3):(10.43,6.80),(0.98,5):(6.57,2.82),(0.98,8):(4.54,1.51),
 (0.98,12):(3.18,1.04),(0.98,20):(2.07,0.80),(0.98,40):(1.81,0.71)}
for phi in (0.90, 0.98):
    print(f"  phi = {phi}   pooled: predicted {pooled(phi)/BASE:6.2f}   measured "
          f"{6.02 if phi==0.90 else 26.79:6.2f}")
    print(f"    {'M':>4} {'thin pred':>10} {'thin meas':>10} {'err':>7} | "
          f"{'cond limit':>11} {'strat meas':>11}")
    for M in (2,3,5,8,12,20,40):
        tp = thinned(phi,M)/BASE; tm, sm = meas[(phi,M)]
        print(f"    {M:>4} {tp:>10.2f} {tm:>10.2f} {100*(tp-tm)/tm:>6.0f}% | "
              f"{conditioned()/BASE:>11.2f} {sm:>11.2f}")
    print()

print("="*96)
print("The optimal granularity as a formula.")
print("Margin^2 ~ sigma^2_strat(M) * M / n. Model sigma^2_strat(M) by the two effects:")
print("  binning resolves modes with k*M small; unresolved modes still thin at phi^{kM}.")
print()
def strat_model(phi, M):
    """resolved modes removed from the marginal variance, unresolved ones thinned."""
    tot = BASE
    for k in range(1, KMAX+1):
        w = B[k-1]**2
        res = 1.0/(1.0 + (k/M)**2)          # bins resolve mode k when k << M
        tot += -w*res + 2*w*(1-res)*phi**(k*M)/(1-phi**(k*M))
    return tot
for phi in (0.90, 0.98):
    best = min(range(1,41), key=lambda M: strat_model(phi,M)*M)
    print(f"  phi = {phi}:  argmin_M sigma^2_strat(M)*M  =  {best}    "
          f"(grid search on width gave {5 if phi==0.90 else 8})")
    print(f"    {'M':>4} {'model V':>9} {'V*M':>9} {'meas V':>8}")
    for M in (2,3,5,8,12,20):
        print(f"    {M:>4} {strat_model(phi,M)/BASE:>9.2f} {strat_model(phi,M)*M/BASE:>9.2f}"
              f" {meas[(phi,M)][1]:>8.2f}")
    print()
