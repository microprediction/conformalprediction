"""Numerical checks of the information-gap identities, by deterministic grid integration.

1. Residual gap (Proposition 1, residual case). For a fixed location predictor,
       (A) signed CPS:        E log q* - E log r_bar(R)  = I(R;X)
       (B) absolute interval: E log q* - E log h_sym(R)  = I(R;X) + KL(r_bar || h_sym)

2. Transform pooling (Proposition 1, general case). For a monotone score T = phi_X(Y) and the
   single transformed-shape forecaster q(y|x) = g_T(phi_x(y)) |phi_x'(y)|,
       E log q* - E log q = I(T;X).
   The test transform is distributional conformal prediction with a misspecified logistic
   conditional CDF, T = Phi^{-1}(F_hat(Y|X)), so the transform is nonlinear in y.
   The regret is integrated on the y grid; I(T;X) on a separate grid in T coordinates.

3. Forecastability accounting (Corollary 1). The signed CPS gains
       E log pi - E log p_Y = I(Y;X) - I(R;X)
   over the unconditional law, which is negative when I(R;X) > I(Y;X).

Every right-hand side is computed from its definition, independently of the left-hand side.

Run:  python check_gap.py
"""
import numpy as np

PHI = lambda z: np.exp(-0.5 * z * z) / np.sqrt(2 * np.pi)
TOL = 1e-4


def erf_(x):                                    # Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
    t = 1.0 / (1.0 + 0.3275911 * np.abs(x))
    y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t
             + 0.254829592) * t * np.exp(-x * x)
    return np.sign(x) * y


def ncdf(z):
    return 0.5 * (1 + erf_(z / np.sqrt(2)))


class Grid:
    def __init__(self, lo, hi, n):
        self.x = np.linspace(lo, hi, n)
        self.d = self.x[1] - self.x[0]

    def norm(self, p):
        return p / (p.sum(axis=-1, keepdims=True) * self.d)

    def cross(self, p, q):                      # int p log q, with 0 log q = 0
        m = p > 1e-300
        return np.sum(np.where(m, p * np.log(np.clip(q, 1e-300, None)), 0.0), axis=-1) * self.d

    def kl(self, p, q):
        return self.cross(p, p) - self.cross(p, q)


def skewnormal(z_grid, loc, scale, a):
    """Skew-normal density with shape a, recentred to the given mean `loc`."""
    d = a / np.sqrt(1 + a * a)
    xi = loc - scale * d * np.sqrt(2 / np.pi)
    z = (z_grid - xi) / scale
    return (2.0 / scale) * PHI(z) * ncdf(a * z)


def report(name, lhs, rhs, tol=TOL):
    ok = abs(lhs - rhs) < tol
    print(f"  {name:44s} lhs {lhs:+.6f}  rhs {rhs:+.6f}  diff {abs(lhs - rhs):.1e}  {'ok' if ok else 'FAIL'}")
    return ok


# ---------------------------------------------------------------- 1. residual identities
def check_residual(name, r):
    G = Grid(-14, 14, r.shape[1])
    r = G.norm(r)
    rbar = G.norm(r.mean(axis=0))
    hsym = G.norm(0.5 * (rbar + rbar[::-1]))
    oracle = G.cross(r, r).mean()
    I_RX = G.kl(r, rbar).mean()
    print(f"\n[1] {name}")
    a = report("(A) signed CPS regret = I(R;X)", oracle - G.cross(r, rbar).mean(), I_RX)
    b = report("(B) absolute regret = I(R;X) + KL(rbar||hsym)",
               oracle - G.cross(r, hsym).mean(), I_RX + G.kl(rbar, hsym))
    return a and b


def residual_cases(K=400, n=8001):
    rho = np.linspace(-14, 14, n)
    gauss = np.stack([PHI(rho / s) / s for s in np.linspace(0.5, 2.5, K)])
    skew = np.stack([skewnormal(rho, 0.0, w, 4.0) for w in np.linspace(0.6, 2.2, K)])
    return (check_residual("heteroscedastic Gaussian", gauss)
            & check_residual("heteroscedastic skew-normal", skew))


# ---------------------------------------------------------------- 2. transform pooling (DCP)
def check_dcp(K=200):
    """Truth: Y|x skew-normal, mean m(x), scale w(x). Model: logistic F_hat with wrong
    location and scale. Score T = Phi^{-1}(F_hat(y|x)); forecaster g_T(T) dT/dy."""
    xs = np.linspace(0, 1, K)
    m = 2 * np.sin(3 * xs)                      # true conditional mean
    w = 0.5 + 1.5 * xs                          # true conditional scale
    mu_h = 1.6 * np.sin(3 * xs) + 0.3           # misspecified model location
    s_h = 0.6 + 0.3 * xs                        # misspecified logistic scale

    # y space: truth and the Jacobian dT/dy
    Y = Grid(-25, 25, 20001)
    f = Y.norm(np.stack([skewnormal(Y.x, m[k], w[k], 3.0) for k in range(K)]))
    Fh = 1 / (1 + np.exp(-(Y.x[None, :] - mu_h[:, None]) / s_h[:, None]))
    Fh = np.clip(Fh, 1e-15, 1 - 1e-15)
    fh = Fh * (1 - Fh) / s_h[:, None]           # logistic density

    # T space, built independently: y(t) = mu_h + s_h logit(Phi(t)), p_T|x(t) = f(y(t)|x) dy/dt
    T = Grid(-8, 8, 16001)
    u = np.clip(ncdf(T.x), 1e-15, 1 - 1e-15)
    y_of_t = mu_h[:, None] + s_h[:, None] * np.log(u / (1 - u))[None, :]
    dy_dt = s_h[:, None] * (PHI(T.x) / (u * (1 - u)))[None, :]
    pT = np.stack([skewnormal(y_of_t[k], m[k], w[k], 3.0) for k in range(K)]) * dy_dt
    pT = T.norm(pT)
    gT = T.norm(pT.mean(axis=0))
    I_TX = T.kl(pT, gT).mean()

    # the pooled forecaster in y space: q(y|x) = g_T(t(y|x)) dt/dy, dt/dy = fh / phi(t)
    t_of_y = np.clip(np.sqrt(2) * erfinv_(2 * Fh - 1), T.x[0], T.x[-1])
    q = np.interp(t_of_y, T.x, gT) * fh / PHI(t_of_y)
    regret = (Y.cross(f, f) - Y.cross(f, q)).mean()
    print("\n[2] transform pooling: DCP score, misspecified logistic F_hat")
    ok = report("regret of pooled DCP forecaster = I(T;X)", regret, I_TX, tol=1e-3)
    # pooling raw residuals under the same location model, for scale
    R = Grid(-25, 25, 20001)
    r = R.norm(np.stack([skewnormal(R.x, m[k] - mu_h[k], w[k], 3.0) for k in range(K)]))
    I_RX = R.kl(r, R.norm(r.mean(axis=0))).mean()
    print(f"  for comparison, raw-residual gap I(R;X) under the same location = {I_RX:.4f}; "
          f"DCP gap I(T;X) = {I_TX:.4f}")
    return ok


def erfinv_(y):
    """Inverse erf by Newton on erf_, from a Giles-style start; adequate for |y| < 1-1e-15."""
    y = np.clip(y, -1 + 1e-15, 1 - 1e-15)
    x = np.sign(y) * np.sqrt(-np.log((1 - y) * (1 + y)))    # rough start
    x = np.where(np.abs(y) < 0.7, y * np.sqrt(np.pi) / 2, x)
    for _ in range(60):
        x = x - (erf_(x) - y) / (2 / np.sqrt(np.pi) * np.exp(-x * x))
    return x


# ---------------------------------------------------------------- 3. forecastability accounting
def check_accounting(name, m, w, mu_h, K):
    """Y|x skew-normal with mean m(x), scale w(x); location model mu_h(x); equal-weight x."""
    Y = Grid(-30, 30, 24001)
    f = Y.norm(np.stack([skewnormal(Y.x, m[k], w[k], 3.0) for k in range(K)]))
    pY = Y.norm(f.mean(axis=0))
    I_YX = Y.kl(f, pY).mean()                   # forecastability F = I(Y;X)

    R = Grid(-30, 30, 24001)
    r = R.norm(np.stack([skewnormal(R.x, m[k] - mu_h[k], w[k], 3.0) for k in range(K)]))
    rbar = R.norm(r.mean(axis=0))
    I_RX = R.kl(r, rbar).mean()

    pi = np.stack([np.interp(Y.x - mu_h[k], R.x, rbar) for k in range(K)])   # signed CPS
    gain = (Y.cross(f, pi) - Y.cross(f, np.broadcast_to(pY, f.shape))).mean()
    ratio = f"{1 - I_RX / I_YX:+.3f}" if I_YX > 1e-9 else "undefined (F = 0)"
    print(f"\n[3] {name}:  F = I(Y;X) = {I_YX:.4f},  I(R;X) = {I_RX:.4f},  ratio = {ratio}")
    return report("CPS gain over p_Y = I(Y;X) - I(R;X)", gain, I_YX - I_RX, tol=1e-3)


def accounting_cases(K=200):
    xs = np.linspace(0, 1, K)
    ok = check_accounting("good location, heteroscedastic",
                          2 * np.sin(3 * xs), 0.5 + 1.5 * xs, 2 * np.sin(3 * xs), K)
    ok &= check_accounting("biased location",
                           2 * np.sin(3 * xs), 0.5 + 1.5 * xs, 1.2 * np.sin(3 * xs), K)
    ok &= check_accounting("Y independent of X, bad location (negative gain)",
                           np.zeros(K), np.ones(K), 1.5 * np.cos(4 * xs), K)
    return ok


if __name__ == "__main__":
    ok = residual_cases()
    ok &= check_dcp()
    ok &= accounting_cases()
    print(f"\nALL CHECKS PASS: {bool(ok)}")
