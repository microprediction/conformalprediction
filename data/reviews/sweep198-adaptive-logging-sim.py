# Per-(context,arm) running empirical quantile (Mondrian, no propensities) vs per-arm logged quantile
# vs per-arm IPW-weighted quantile (Online-COPP-like). Paper's instances, T=20000, eps=0.05, alpha=0.1.
import numpy as np
def run(inst,D,T=20000,seed=0,eps=0.05):
    rng=np.random.default_rng(seed)
    X=rng.integers(2,size=T)
    if inst=='mean':
        mu=np.where(X[:,None]==0,[0,D],[D,0]); Y=rng.normal(mu,1); S=np.abs(Y)
    elif inst=='var':
        sd=np.where(X[:,None]==0,[1,1+D],[1+D,1]); S=np.abs(rng.normal(0,sd))
    else: # rho=0: arms share the same outcome law in each context
        sd=np.where(X==0,1.,1+D)[:,None]*np.ones(2); S=np.abs(rng.normal(0,sd))
    fav=X
    A=np.where(rng.random(T)<eps, rng.integers(2,size=T), fav)
    P=np.where(A==fav,1-eps/2,eps/2)
    out={}
    for m in ['arm','ipw','cell']:
        cov=np.zeros((T,2),bool)
        for t in range(200,T):
            past=slice(0,t)
            for b in range(2):
                sel=(A[:t]==b)
                if m=='cell': sel&=(X[:t]==X[t])
                s=S[:t,b][sel]
                if m=='ipw':
                    w=1/P[:t][sel]; o=np.argsort(s); cw=np.cumsum(w[o])/w.sum(); q=s[o][np.searchsorted(cw,0.9)]
                else: q=np.quantile(s,0.9) if len(s) else np.inf
                cov[t,b]=S[t,b]<=q
        c=cov[200:]; a=A[200:]
        out[m]=dict(ccov_gap=round(float(np.max(np.abs(c.mean(0)-0.9))),3), mcov=round(float(c[np.arange(len(a)),a].mean()),3))
    return out
for inst in ['mean','var','rho0']: print(inst, run(inst,2,T=20000))
