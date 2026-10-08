"""Level-wise form of the conformal information gap for discrete outcomes (Remark 8).

Zhang and Bates (2026, arXiv:2610.08785) score a set Gamma by l_lam(Y, Gamma) = |Gamma| +
1{Y not in Gamma}/lam. A frozen predictor that acts on one pooled law q for every input has excess
set loss over the oracle that splits, at every lam, into their conformal mutual information
I_lam(X;Y|kappa) and their divergence D_lam(g || q) between the population pooled law g and q.
Integrating over lam in (0,1] gives Shannon I, KL(g || q), and the expected log regret.

    python check_setloss.py      # exits non-zero if any identity fails
"""
import sys
import numpy as np
from scipy.integrate import quad


def setloss(p, act, lam):
    """E l_lam(Y, {y : act_y >= lam}) for Y ~ p."""
    keep = act >= lam
    return keep.sum() + p[~keep].sum() / lam


def check(seed, nx=3, ny=5):
    rng = np.random.default_rng(seed)
    px = rng.dirichlet(np.ones(nx))
    P = rng.dirichlet(0.7 * np.ones(ny), size=nx)
    g = px @ P
    q = rng.dirichlet(np.ones(ny))
    excess = lambda lam: sum(px[i] * (setloss(P[i], q, lam) - setloss(P[i], P[i], lam)) for i in range(nx))
    I_lam = lambda lam: setloss(g, g, lam) - sum(px[i] * setloss(P[i], P[i], lam) for i in range(nx))
    D_lam = lambda lam: setloss(g, q, lam) - setloss(g, g, lam)
    pointwise = max(abs(excess(l) - I_lam(l) - D_lam(l)) for l in np.linspace(1e-3, 1, 400))
    knots = sorted({0.0, 1.0, *[x for x in np.concatenate([q, g, P.ravel()]) if x < 1]})
    integ = lambda f: sum(quad(f, a, b, limit=200)[0] for a, b in zip(knots[:-1], knots[1:]))
    I = sum(px[i] * np.sum(P[i] * np.log(P[i] / g)) for i in range(nx))
    KL = np.sum(g * np.log(g / q))
    regret = sum(px[i] * np.sum(P[i] * np.log(P[i] / q)) for i in range(nx))
    errs = [pointwise, abs(integ(I_lam) - I), abs(integ(D_lam) - KL), abs(integ(excess) - regret)]
    print(f"seed {seed}: I = {I:.6f}, KL = {KL:.6f}, regret = {regret:.6f}; "
          f"max errors {max(errs):.1e}")
    return max(errs) < 1e-8


ok = all(check(s) for s in range(5))
print("ALL CHECKS PASS:", ok)
sys.exit(0 if ok else 1)
