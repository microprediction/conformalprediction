import numpy as np
rng=np.random.default_rng(0)
# finite Markov chain on S states, score r(w)=w-value; check eq (59):
# C_{n,l,k} = E[ P^l H_{R(k)}(W_n) ]  ==  F(R(k)) + (P^l - P^{l+1}) chi_{R(k)}(W_n)
S=5
Pm=rng.uniform(0.2,1.0,(S,S)); Pm/=Pm.sum(1,keepdims=True)
# invariant pi
A=np.vstack([Pm.T-np.eye(S), np.ones(S)]); bvec=np.append(np.zeros(S),1.0)
pi,*_=np.linalg.lstsq(A,bvec,rcond=None)
rvals=np.array([0.3,1.1,0.7,2.0,1.5])   # r(w)
def Hq(q): return (rvals<=q).astype(float)      # H_q(w) vector over states
def F(q): return pi@Hq(q)
def Pl(l): 
    M=np.eye(S)
    for _ in range(l): M=M@Pm
    return M
def chi(q):
    h=Hq(q)-F(q)                                 # solve (I-P)chi=h, pi.chi=0
    A2=np.vstack([np.eye(S)-Pm, pi]); b2=np.append(h,0.0)
    x,*_=np.linalg.lstsq(A2,b2,rcond=None); return x
maxerr=0.0
for l in [1,2,3]:
    for q in [0.5,0.8,1.2,1.6]:
        lhs=Pl(l)@Hq(q)                          # P^l H_q (w) for each current state w
        rhs=F(q)+ (Pl(l)-Pl(l+1))@chi(q)         # invariant + Poisson corrector
        maxerr=max(maxerr, np.abs(lhs-rhs).max())
print("max |LHS-RHS| over l,q,states:", maxerr)
