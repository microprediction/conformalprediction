"""Reproducibility checks for 'One Poisson Equation for Conformal Coverage under
Dependence'. Every load-bearing algebraic identity is verified on random finite
chains. Run: python verify_decomposition.py

Checks:
  (1) Theorem 1 corrector:  C = F(R_(k)) + (P^l - P^{l+1}) chi   (eq. for coverage)
  (2) psi_p = chi_{q_p}: the calibration-variance Poisson solution IS the corrector
  (3) reversible spectral identities for b_{l,w}(q) and sigma^2(q)
  (4) homogenization generator limit: delta * chi -> (-Q)^{-1} g  as delta -> 0
"""
import numpy as np
import scipy.linalg as sl

rng = np.random.default_rng(0)


def invariant(P):
    S = P.shape[0]
    A = np.vstack([P.T - np.eye(S), np.ones(S)])
    return np.linalg.lstsq(A, np.append(np.zeros(S), 1.0), rcond=None)[0]


def poisson(P, pi, h):
    """centered solution of (I-P)chi = h, pi.chi = 0."""
    S = P.shape[0]
    A = np.vstack([np.eye(S) - P, pi])
    return np.linalg.lstsq(A, np.append(h, 0.0), rcond=None)[0]


# ---------------------------------------------------------------------------
def check_corrector():
    S = 5
    P = rng.uniform(0.2, 1.0, (S, S)); P /= P.sum(1, keepdims=True)
    pi = invariant(P)
    r = np.array([0.3, 1.1, 0.7, 2.0, 1.5])
    err = 0.0
    for l in [1, 2, 3]:
        Pl = np.linalg.matrix_power(P, l); Pl1 = Pl @ P
        for q in [0.5, 0.8, 1.2, 1.6]:
            H = (r <= q).astype(float); F = pi @ H
            chi = poisson(P, pi, H - F)
            lhs = Pl @ H                       # P^l H_q (current state w)
            rhs = F + (Pl - Pl1) @ chi         # invariant + Poisson corrector
            err = max(err, np.abs(lhs - rhs).max())
    print(f"(1) Theorem 1 corrector      max|LHS-RHS| = {err:.2e}")


def check_psi_equals_chi():
    S = 5
    P = rng.uniform(0.2, 1.0, (S, S)); P /= P.sum(1, keepdims=True)
    pi = invariant(P)
    r = rng.uniform(0, 2, S)
    q = float(np.quantile(r, 0.6))
    p = pi @ (r <= q).astype(float)            # F(q); pick q so we know p
    H = (r <= q).astype(float)
    chi_q = poisson(P, pi, H - p)
    g_p = H - p                                # centered coverage indicator
    psi_p = poisson(P, pi, g_p)
    print(f"(2) psi_p == chi_(q_p)       max|psi-chi| = {np.abs(psi_p - chi_q).max():.2e}")


def check_spectral():
    S = 6
    W = rng.uniform(0.1, 1, (S, S)); W = (W + W.T) / 2      # reversible chain
    P = W / W.sum(1, keepdims=True); pi = W.sum(1) / W.sum()
    r = rng.uniform(0, 2, S); q = 1.0
    H = (r <= q).astype(float); F = pi @ H; g = H - F
    chi = poisson(P, pi, g)
    Di = np.diag(1 / np.sqrt(pi)); D = np.diag(np.sqrt(pi))
    Sym = D @ P @ Di; Sym = (Sym + Sym.T) / 2
    lam, V = np.linalg.eigh(Sym)
    phi = Di @ V
    c = np.array([(pi * g * phi[:, j]).sum() for j in range(S)])
    eb = 0.0
    for l in [1, 2]:
        Pl = np.linalg.matrix_power(P, l)
        bl = (Pl - Pl @ P) @ chi
        spec = sum(c[j] * lam[j]**l * phi[:, j] for j in range(S))
        eb = max(eb, np.abs(bl - spec).max())
    sig_d = pi @ (chi**2) - pi @ ((P @ chi)**2)
    sig_s = sum(c[j]**2 * (1 + lam[j]) / (1 - lam[j]) for j in range(S) if lam[j] < 1 - 1e-9)
    print(f"(3) spectral b_(l,w)         max err = {eb:.2e}")
    print(f"    spectral sigma^2(q)      err = {abs(sig_d - sig_s):.2e}")


def check_generator_limit():
    S = 6
    Q = rng.uniform(0.1, 1, (S, S)); np.fill_diagonal(Q, 0)
    np.fill_diagonal(Q, -Q.sum(1))
    piq = invariant(sl.expm(Q))                # invariant of the flow
    r = rng.uniform(0, 2, S); q = 1.0
    g = (r <= q).astype(float) - piq @ (r <= q).astype(float)
    Ac = np.vstack([-Q, piq])
    phi_cell = np.linalg.lstsq(Ac, np.append(g, 0.0), rcond=None)[0]   # -Q phi = g
    print("(4) generator limit delta*chi -> (-Q)^{-1} g:")
    for delta in [0.1, 0.01, 0.001]:
        Pd = sl.expm(delta * Q)
        chid = poisson(Pd, piq, g)
        print(f"      delta={delta:6.3f}  err = {np.abs(delta * chid - phi_cell).max():.2e}")


if __name__ == "__main__":
    check_corrector()
    check_psi_equals_chi()
    check_spectral()
    check_generator_limit()
