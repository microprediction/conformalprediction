"""State-adaptive honest Markov correction: numerical verification.

Worst-case Theorem 5 calibrates at the level u* that protects the WORST current state.
The state-adaptive version calibrates at u*(w) for the observed state w, paying a union
bound over the M states inside the Freedman deviation. This script

  (a) reproduces the paper's two-state illustration exactly,
  (b) computes u*(w) per state and the worst-case u*,
  (c) checks the honesty claim by direct simulation of the sampled chain,
  (d) reports when the adaptive rank beats the worst-case rank.
"""
import math
import numpy as np

# ---- the paper's two-state model (Section 8 illustration) --------------------
p      = 0.90      # target conditional coverage
pi_H   = 0.20
pi_L   = 1 - pi_H
lam    = 0.80      # nontrivial eigenvalue of the sampled chain
ell    = 1         # test point one step after the calibration block

# reversible 2-state kernel with invariant pi and second eigenvalue lam
P = np.array([[pi_L + lam*pi_H, pi_H*(1-lam)],
              [pi_L*(1-lam),    pi_H + lam*pi_L]])          # order: (L, H)
pi = np.array([pi_L, pi_H])

# exponential scores chosen so F_L(1)=0.95, F_H(1)=0.70, mixture 0.90 at q_p=1
mu_L = 1/math.log(20.0)
mu_H = 1/math.log(10.0/3.0)
F_L = lambda q: 1 - np.exp(-np.asarray(q)/mu_L)
F_H = lambda q: 1 - np.exp(-np.asarray(q)/mu_H)
F   = lambda q: pi_L*F_L(q) + pi_H*F_H(q)
Fw  = [F_L, F_H]

def P_ell_H(q, w, ell=ell):
    """P^ell H_q (w) = P(R_{n+ell} <= q | W_n = w)."""
    row = np.linalg.matrix_power(P, ell)[w]
    return row[0]*F_L(q) + row[1]*F_H(q)

def Finv(u, lo=1e-12, hi=50.0):
    f = lambda q: F(q) - u
    for _ in range(200):
        m = 0.5*(lo+hi)
        if f(m) < 0: lo = m
        else: hi = m
    return 0.5*(lo+hi)

print("=" * 74)
print("(a) reproducing the paper's illustration")
q_p = Finv(p)
print(f"    q_p = F^-1(0.90)      = {q_p:.6f}   (paper uses 1)")
print(f"    F_L(q_p), F_H(q_p)    = {F_L(q_p):.4f}, {F_H(q_p):.4f}   (paper: 0.95, 0.70)")
print(f"    one-step coverage | H = {P_ell_H(q_p,1):.4f}   (paper: 0.74)")
print(f"    one-step coverage | L = {P_ell_H(q_p,0):.4f}   (paper: 0.94)")

# ---- (b) state-specific and worst-case protection levels ---------------------
def u_star_state(w, ell=ell, tol=1e-12):
    """smallest u in [p,1) with P^ell H_{F^-1(u)}(w) >= p."""
    lo, hi = p, 1 - 1e-12
    if P_ell_H(Finv(lo), w, ell) >= p:
        return lo
    for _ in range(200):
        m = 0.5*(lo+hi)
        if P_ell_H(Finv(m), w, ell) >= p: hi = m
        else: lo = m
    return hi

u_s = [u_star_state(w) for w in (0, 1)]
u_wc = max(u_s)
print()
print("=" * 74)
print("(b) protection levels")
print(f"    u*(L) = {u_s[0]:.6f}    u*(H) = {u_s[1]:.6f}    worst case u* = {u_wc:.6f}")
print(f"    threshold F^-1: L {Finv(u_s[0]):.4f}   H {Finv(u_s[1]):.4f}   worst {Finv(u_wc):.4f}")
print(f"    E_pi[u* - u*(W)] = {pi @ (u_wc - np.array(u_s)):.6f}")
print(f"    the chain sits in the cheap state {100*pi_L:.0f}% of the time")

# ---- (c) honesty by simulation ----------------------------------------------
def freedman_delta(n, eta, B, V):
    x = math.log(1/eta)
    return (2*B + math.sqrt(2*n*V*x))/n + 2*B*x/(3*n)

def chi(q, w):
    """Poisson solution for the 2-state chain: (I-P)chi = H_q - F(q), pi chi = 0.
    H_q(w) is the indicator {r(w) <= q}; in expectation over the emission it is F_w(q),
    and with one nonunit mode the centered solution is g/(1-lam)."""
    g = float(Fw[w](q)) - float(F(q))                    # centered coverage at state w
    return g / (1 - lam)                                 # single nonunit mode

def V_exact(q):
    """max_w Var( chi_q(W_1) | W_0 = w ) for the two-state chain."""
    c = np.array([chi(q, 0), chi(q, 1)])
    out = 0.0
    for w in (0, 1):
        m = P[w] @ c
        out = max(out, float(P[w] @ (c - m)**2))
    return out


def simulate(n, eta, n_rep, rng, adaptive):
    M = 2
    eta_use = eta/M if adaptive else eta
    # class constants at the level actually used
    qs = [Finv(u) for u in (u_s if adaptive else [u_wc, u_wc])]
    B = max(abs(chi(q, w)) for q in qs for w in (0, 1))
    V = max(V_exact(q) for q in qs)  # exact max_w Var(chi(W_1) | W_0 = w)
    d = freedman_delta(n, eta_use, B, V)
    bad = 0
    for _ in range(n_rep):
        w = 0 if rng.random() < pi_L else 1              # stationary start
        states = np.empty(n+ell, dtype=int)
        for t in range(n+ell):
            states[t] = w
            w = 0 if rng.random() < P[w, 0] else 1
        cal = states[:n]
        scores = rng.exponential([mu_L, mu_H][0]*(cal == 0) + [mu_L, mu_H][1]*(cal == 1))
        w_n = cal[-1]                                    # observed current state
        u_use = u_s[w_n] if adaptive else u_wc
        k = int(n*(u_use + d)) + 1
        if k > n:
            continue                                     # R_(k) = +inf, covers
        R_k = np.sort(scores)[k-1]
        if P_ell_H(R_k, w_n) < p - 1e-12:                # realized conditional coverage
            bad += 1
    return bad/n_rep, d

rng = np.random.default_rng(0)
print()
print("=" * 74)
print("(c) honesty check by simulation, eta = 0.10, 4000 replicates")
print(f"    {'n':>6} {'worst-case fail':>16} {'adaptive fail':>15} {'delta_wc':>10} {'delta_ad':>10}")
for n in (500, 2000, 8000):
    f_wc, d_wc = simulate(n, 0.10, 4000, np.random.default_rng(1), adaptive=False)
    f_ad, d_ad = simulate(n, 0.10, 4000, np.random.default_rng(1), adaptive=True)
    print(f"    {n:>6} {f_wc:>16.4f} {f_ad:>15.4f} {d_wc:>10.4f} {d_ad:>10.4f}")
print("    (both must stay at or below eta = 0.10)")

# ---- (d) when does adaptive win? --------------------------------------------
print()
print("=" * 74)
print("(d) rank and threshold comparison, eta = 0.10")
B = max(abs(chi(Finv(u), w)) for u in (u_s + [u_wc]) for w in (0, 1))
V = max(V_exact(Finv(u)) for u in (u_s + [u_wc]))
print(f"    {'n':>7} {'k_wc/n':>9} {'k_ad(L)/n':>11} {'k_ad(H)/n':>11} {'adaptive better in L?':>23}")
for n in (500, 1000, 2000, 5000, 20000):
    d1 = freedman_delta(n, 0.10, B, V)
    d2 = freedman_delta(n, 0.05, B, V)
    kwc = u_wc + d1
    kL, kH = u_s[0] + d2, u_s[1] + d2
    print(f"    {n:>7} {kwc:>9.4f} {kL:>11.4f} {kH:>11.4f} {str(kL < kwc):>23}")
gap = u_wc - u_s[0]
n_star = 2*V*math.log(2)/gap**2
print(f"    level gap u* - u*(L) = {gap:.4f}; crossover near n ~ 2V log M / gap^2 = {n_star:.0f}")
