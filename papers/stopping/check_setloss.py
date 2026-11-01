"""Level-wise form of the conformal information gap for discrete outcomes (Remark 8).

Zhang and Bates (2026, arXiv:2610.08785) score a set Gamma by l_lam(Y, Gamma) = |Gamma| +
1{Y not in Gamma}/lam, for a probability cutoff lam in (0, 1]. A frozen scheme with a score
W = A(X, Y), one-to-one in y for each x, acts at cutoff lam on the score set {w : ghat(w) >= lam}
pulled back through A(x, .); the oracle's Bayes set is {y : p(y | x) >= lam}. Because the pullback
keeps set sizes and coverage, the excess set loss over the oracle is, at every cutoff,

    I_lam(W; X | kappa) + D_lam(g || ghat),

with g the population pooled score law. Integrating over lam gives I(W; X | kappa), KL(g || ghat)
and the expected log regret, which is Proposition 2 for discrete outcomes.

Checked on random instances with a random one-to-one score per input, and on the reviewer's
example Y = X + B, A(x, y) = y - x, where W = B is independent of X and the excess must be zero
although I(Y; X) > 0.

    python check_setloss.py      # exits non-zero if any identity fails
"""
import sys
import numpy as np
from scipy.integrate import quad


def setloss(p, act, lam):
    """E l_lam(Y, {y : act_y >= lam}) for Y ~ p, both indexed on the same finite set."""
    keep = act >= lam
    return keep.sum() + p[~keep].sum() / lam


def integ(f, knots):
    knots = sorted({0.0, 1.0, *[x for x in knots if 0 < x < 1]})
    return sum(quad(f, a, b, limit=200)[0] for a, b in zip(knots[:-1], knots[1:]))


def verify(px, PY, A, ghat, label):
    """px: law of X; PY[x]: law of Y given x on outcomes 0..ny-1; A[x]: one-to-one map from the
    support of Y | x into score values 0..nw-1; ghat: estimated pooled score law."""
    nx, nw = len(px), len(ghat)
    PW = np.zeros((nx, nw))                      # law of W given x
    for x in range(nx):
        for y, w in A[x].items():
            PW[x, w] += PY[x][y]
    g = px @ PW                                   # population pooled score law (one stratum)

    def predictor_loss(x, lam):                   # frozen scheme, outcome coordinates
        S = {y for y, w in A[x].items() if ghat[w] >= lam}
        return len(S) + sum(PY[x][y] for y in A[x] if y not in S) / lam

    def oracle_loss(x, lam):
        return setloss(PY[x], PY[x], lam)

    excess = lambda lam: sum(px[x] * (predictor_loss(x, lam) - oracle_loss(x, lam)) for x in range(nx))
    I_lam = lambda lam: setloss(g, g, lam) - sum(px[x] * setloss(PW[x], PW[x], lam) for x in range(nx))
    D_lam = lambda lam: setloss(g, ghat, lam) - setloss(g, g, lam)
    knots = np.concatenate([ghat, g, PW.ravel(), np.concatenate([np.asarray(p) for p in PY])])
    pointwise = max(abs(excess(l) - I_lam(l) - D_lam(l)) for l in np.linspace(1e-3, 1, 400))
    with np.errstate(divide="ignore", invalid="ignore"):
        I = sum(px[x] * np.nansum(np.where(PW[x] > 0, PW[x] * np.log(PW[x] / g), 0)) for x in range(nx))
        KL = np.nansum(np.where(g > 0, g * np.log(g / ghat), 0))
        regret = sum(px[x] * sum(PY[x][y] * np.log(PY[x][y] / ghat[w]) for y, w in A[x].items()
                                 if PY[x][y] > 0) for x in range(nx))
    errs = [pointwise, abs(integ(I_lam, knots) - I), abs(integ(D_lam, knots) - KL),
            abs(integ(excess, knots) - regret)]
    print(f"{label}: I(W;X) = {I:.6f}, KL = {KL:.6f}, regret = {regret:.6f}; max error {max(errs):.1e}")
    return max(errs) < 1e-8


ok = True
for seed in range(5):
    rng = np.random.default_rng(seed)
    nx, n = 3, 5
    px = rng.dirichlet(np.ones(nx))
    PY = [rng.dirichlet(0.7 * np.ones(n)) for _ in range(nx)]
    A = [dict(zip(range(n), rng.permutation(n))) for _ in range(nx)]   # one-to-one score per x
    ghat = rng.dirichlet(np.ones(n))
    ok &= verify(px, PY, A, ghat, f"random seed {seed}")

# Reviewer's example: X ~ Bern(1/2), B ~ Bern(0.1), Y = X + B, A(x, y) = y - x, so W = B.
px = np.array([0.5, 0.5])
PY = [np.array([0.9, 0.1, 0.0]), np.array([0.0, 0.9, 0.1])]
A = [{0: 0, 1: 1}, {1: 0, 2: 1}]
ok &= verify(px, PY, A, np.array([0.9, 0.1]), "Y = X + B, exact pooled law")
ok &= verify(px, PY, A, np.array([0.7, 0.3]), "Y = X + B, misestimated law")
print("ALL CHECKS PASS:", bool(ok))
sys.exit(0 if ok else 1)
