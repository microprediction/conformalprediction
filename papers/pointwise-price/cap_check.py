"""Check the capped-variable argument (baseline version of the two-point bound)."""
import numpy as np
alpha=0.1; ell=np.log(1/alpha)
K=3.0; c_q=ell; C_q=2*ell*(np.exp(.5)-1)
fbar=alpha; kappa=alpha*np.exp(-2); rho=np.exp(.5); b2=2/3
q0=ell
Ccap_tight=max(1,q0/rho,0.5+alpha/(kappa*rho**2))
Ccap_loose=max(1,(q0/rho)**2,(0.5+alpha/(kappa*rho**2))**2)
print("Ccap tight %.4f loose %.4f"%(Ccap_tight,Ccap_loose))
psi=lambda e: np.minimum(e**2,rho*np.abs(e))
# 1. f_1 > kappa*rho and Z^2 <= Ccap psi(e), pointwise F_1(T) <= 1-alpha+f_1(Z-gamma)
worst=0; worstF=np.inf; ok_f=True
for delta in np.linspace(1e-4,0.5,200):
    m1=np.exp(delta); q1=ell*m1; gamma=q1-q0
    if C_q*delta>rho/2: continue
    f1=alpha/m1; ok_f&=f1>kappa*rho
    B=gamma+alpha/f1
    T=np.linspace(0,400,800001); e=T-q0; Z=np.minimum(e,B)
    with np.errstate(divide='ignore',invalid='ignore'):
        r=np.where(psi(e)>0,Z**2/psi(e),0)
    worst=max(worst,r.max())
    F1=1-np.exp(-T/m1)
    worstF=min(worstF,(1-alpha+f1*(Z-gamma)-F1).min())
print("f1>kappa rho:",ok_f," sup Z^2/psi = %.4f (<= tight %.4f)"%(worst,Ccap_tight)," min slack cap bound %.2e"%worstF)

# 2. baseline bound vs searched procedures valid under both fields
def design(n):
    x=(np.arange(n)+.5)/n; return np.sort(np.abs(x-.5))
def bump(d,h): return h*np.maximum(1-d/h,0)
def cov(lam,th,th0):
    k=len(th); return 1-np.prod(1/(1+lam*np.exp(th-th0)/k))
def min_lam(th,th0):
    lo,hi=0.,50.
    for _ in range(80):
        mid=(lo+hi)/2
        if cov(mid,th,th0)>=1-alpha: hi=mid
        else: lo=mid
    return hi
A1=c_q/2; A2=kappa*c_q**2/(8*fbar*Ccap_tight*K*b2)
print("A1' %.4f  A2' %.4f"%(A1,A2))
allok=True
print(f"{'n':>8}{'h':>9}{'I':>8}{'bound':>11}{'best D0':>11}{'k':>7}{'ratio':>8}")
for n in [10**3,10**4,10**5,10**6]:
    d=design(n)
    for mult in [0.25,0.5,1,2,4]:
        h=mult*n**-.5; delta=h; I=n*K*b2*delta**2*h
        if not(delta<=.5 and C_q*delta<=rho/2 and I<=1): continue
        bound=min(A1*h,A2/(n*h))
        best=np.inf;bk=None
        for k in np.unique(np.round(np.logspace(0,np.log10(n/2),150)).astype(int)):
            th1=bump(d[:k],h)
            lam=max(min_lam(np.zeros(k),0.),min_lam(th1,delta))
            D0=lam-ell
            if D0<best: best,bk=D0,k
        allok&=best>=bound
        print(f"{n:>8}{h:>9.5f}{I:>8.3f}{bound:>11.6f}{best:>11.6f}{bk:>7}{best/bound:>8.1f}")
print("baseline bound holds on family:",allok)

# 3. randomized two-point gambles: T = t_lo w.p. 1-p, t_hi w.p. p, data-free. Must be valid under both.
best=np.inf
m1=np.exp(0.01); 
for tlo in np.linspace(0,3,301):
    for thi in [3,5,10,50,1e3]:
        for p in np.linspace(0,1,201):
            c0=(1-p)*(1-np.exp(-tlo))+p*(1-np.exp(-thi))
            c1=(1-p)*(1-np.exp(-tlo/m1))+p*(1-np.exp(-thi/m1))
            if c0>=1-alpha and c1>=1-alpha:
                best=min(best,(1-p)*tlo+p*thi-ell)
print("data-free gambles, delta=0.01: min D0 = %.5f, gamma = %.5f (needs D0 >= gamma-ish since chi2 irrelevant)"%(best,ell*(m1-1)))
