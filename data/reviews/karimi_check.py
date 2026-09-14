"""Karimi & Samavi (2023) Theorem 2: for an input with prediction set size m the
'conformal model uncertainty' U_C(x) is claimed to lie in [L_C, H_C], where
  u_hat = (m + delta - 1)/K,  L_C = u_hat(1-delta) + delta - 1/(n+1),
  H_C = u_hat (n+2)/(n+1) + delta (1 - u_hat),
and U_C(x) = u_hat P(P1) + P(P0), P1 = {y in C(x)}, P0 = {y not in C(x)}.
The proof inserts the marginal coverage bounds 1-delta <= P(P1) <= 1-delta+1/(n+1)
for the individual x. Two-group counterexample: every set is a singleton, group A
inputs are always covered, group B inputs are covered 65% of the time, marginal
coverage 91%."""
import numpy as np
rng = np.random.default_rng(0)
K, delta, n_cal, n_test = 10, 0.1, 1000, 200_000
pA = 0.75

def draw(n):
    g = rng.random(n) < pA                       # True = group A
    y = rng.integers(0, K, n)
    P = np.full((n, K), np.nan)
    # group A: p(true)=0.9, others 0.1/9
    a = np.where(g)[0]; P[a] = 0.1 / 9; P[a, y[a]] = 0.9
    # group B: a top label with p=0.65 which is the true label w.p. 0.65; others 0.35/9
    b = np.where(~g)[0]
    top = np.where(rng.random(len(b)) < 0.65, y[b], (y[b] + rng.integers(1, K, len(b))) % K)
    P[b] = 0.35 / 9; P[b, top] = 0.65
    return g, y, P

g, y, P = draw(n_cal)
s = 1 - P[np.arange(n_cal), y]
k = int(np.ceil((n_cal + 1) * (1 - delta)))
qhat = np.sort(s)[k - 1]
gt, yt, Pt = draw(n_test)
C = Pt >= 1 - qhat
m = C.sum(1); cov = C[np.arange(n_test), yt]
print(f"qhat={qhat:.3f}; marginal coverage {cov.mean():.4f}; set sizes {np.bincount(m, minlength=K+1)[:3]} (count of m=0,1,2)")
for name, mask in (("group A", gt), ("group B", ~gt)):
    mm = mask & (m == 1)
    print(f"  {name}: share {mask.mean():.3f}, sets of size 1: {mm.sum()/mask.sum():.3f}, conditional coverage given m=1: {cov[mm].mean():.4f}")
u = (1 + delta - 1) / K
L = u * (1 - delta) + delta - 1 / (n_cal + 1)
H = u * (n_cal + 2) / (n_cal + 1) + delta * (1 - u)
print(f"Theorem 2 for m=1: u_hat={u:.3f}, certified interval [{L:.4f}, {H:.4f}] for every input with m=1")
for name, mask in (("group A", gt), ("group B", ~gt)):
    p1 = cov[mask & (m == 1)].mean()
    print(f"  their eq (13) U_C = u_hat*P(P1) + P(P0) with the group's own P(P1)={p1:.3f}: U_C={u*p1 + (1-p1):.4f}  "
          f"{'inside' if L <= u*p1+(1-p1) <= H else 'OUTSIDE'} the certified interval")
