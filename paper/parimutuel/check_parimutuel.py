"""Numerical check for "Betting Against a Conformal Predictor".

Verifies the two operational claims of the note on a residual R = sigma(X) * eps
with a correct location (so any dependence is pure conditional shape, the gap is
I(R;X) = I(U;X) with U = G(R) the PIT):

  1. The parimutuel rent (Theorem 1 / Prop 2(ii)): an X-informed entrant's e-process
     wealth grows at rate (1/t) log W_t -> I(R;X), while against a homoscedastic
     residual (no gap) it does not grow and stays a martingale around 1.

  2. The static lower bound (Lemma 1): I(R;X) >= HSIC(U,X) / (2K).

Dependency: numpy only. One run; set the seed for reproducibility.
"""
import numpy as np

rng = np.random.default_rng(0)


def pit_ranks(R):
    """U = empirical-rank PIT of residuals, marginally ~Uniform(0,1)."""
    m = len(R)
    return (np.argsort(np.argsort(R)) + 1) / (m + 1)


def mc_information(sigma_fn, n=200_000):
    """I(U;X) = E_X KL(g(.|X) || Unif) for R = sigma(X) eps, eps ~ N(0,1).

    On the U-scale with correct location and symmetric noise, U|X is the law of
    Phi_marg(sigma(X) Z) where Phi_marg is the marginal CDF of sigma(X)Z. We get
    I(U;X) = I(R;X) directly as E[ log f(R|X) - log f_marg(R) ] by Monte Carlo.
    """
    from math import log, pi
    X = rng.uniform(-2, 2, n)
    s = sigma_fn(X)
    Z = rng.standard_normal(n)
    R = s * Z
    # log conditional density of R given X: Normal(0, s^2)
    log_cond = -0.5 * (np.log(2 * pi) + 2 * np.log(s) + (R / s) ** 2)
    # log marginal density of R: mixture over X of Normal(0, sigma(x)^2); estimate
    # via a fine grid of sigma values (X uniform on [-2,2]).
    grid = sigma_fn(np.linspace(-2, 2, 400))
    # f_marg(r) = mean_x N(r; 0, sigma(x)^2)
    rr = R[:, None]
    comp = -0.5 * (np.log(2 * pi) + 2 * np.log(grid)[None, :] + (rr / grid[None, :]) ** 2)
    log_marg = _logmeanexp(comp, axis=1)
    return float(np.mean(log_cond - log_marg))


def _logmeanexp(a, axis):
    m = np.max(a, axis=axis, keepdims=True)
    return (m.squeeze(axis) + np.log(np.mean(np.exp(a - m), axis=axis)))


def dcov2(a, b):
    """Squared distance covariance (Szekely-Rizzo-Bakirov), U-statistic-free version."""
    a = np.abs(a[:, None] - a[None, :])
    b = np.abs(b[:, None] - b[None, :])
    A = a - a.mean(0)[None, :] - a.mean(1)[:, None] + a.mean()
    B = b - b.mean(0)[None, :] - b.mean(1)[:, None] + b.mean()
    return (A * B).mean()


def eprocess_growth(sigma_fn, n_fit=4000, n_run=20_000, nbins=12):
    """Run the X-informed e-process. Bet b_t(u|x) learned on a fit fold as a
    histogram of U on the X-bin containing x, then compound W_t on a fresh run fold.
    Returns the realised growth rate (1/t) log W_t."""
    def sample(n):
        X = rng.uniform(-2, 2, n)
        R = sigma_fn(X) * rng.standard_normal(n)
        return X, R

    Xf, Rf = sample(n_fit)
    Uf = pit_ranks(Rf)                       # ranks on the fit fold
    xedges = np.quantile(Xf, np.linspace(0, 1, 7))
    xedges[0], xedges[-1] = -np.inf, np.inf
    uedges = np.linspace(0, 1, nbins + 1)
    # conditional U-density per X-bin, as a normalised histogram (the betting density)
    bx = np.digitize(Xf, xedges) - 1
    dens = np.ones((len(xedges) - 1, nbins))
    for j in range(len(xedges) - 1):
        h, _ = np.histogram(Uf[bx == j], bins=uedges)
        d = (h + 1.0)                        # Laplace smoothing keeps it strictly positive
        dens[j] = d / d.mean() / 1.0         # mean over u-bins = 1  => integral over [0,1] = 1
        dens[j] = dens[j] / (dens[j].mean()) # ensure exact normalisation: mean of density = 1

    Xr, Rr = sample(n_run)
    Ur = pit_ranks(Rr)
    bxr = np.clip(np.digitize(Xr, xedges) - 1, 0, len(xedges) - 2)
    ubin = np.clip(np.digitize(Ur, uedges) - 1, 0, nbins - 1)
    bets = dens[bxr, ubin]                    # b_t(U_t | X_t)
    logW = np.cumsum(np.log(bets))
    return logW[-1] / len(bets), logW


if __name__ == "__main__":
    print(f"{'regime':16s} {'I(R;X)':>9s} {'e-rate':>9s} {'HSIC/2K':>9s}  bound ok")
    for name, sigma_fn in [("homoscedastic", lambda x: 1.0 + 0 * x),
                           ("heteroscedastic", lambda x: np.exp(0.5 * x))]:
        I = mc_information(sigma_fn)
        rate, _ = eprocess_growth(sigma_fn)
        # static lower bound on a moderate sample, bounded Gaussian kernel (K=1)
        Xs = rng.uniform(-2, 2, 600)
        Rs = sigma_fn(Xs) * rng.standard_normal(600)
        Us = pit_ranks(Rs)
        # Gaussian-kernel HSIC, k<=1 => K=1; report HSIC/(2K) as the certified floor
        def gk(z):
            z = (z - z.mean()) / (z.std() + 1e-12)
            d = (z[:, None] - z[None, :]) ** 2
            return np.exp(-0.5 * d / np.median(d[d > 0]))
        Ku, Kx = gk(Us), gk(Xs)
        H = np.eye(600) - 1.0 / 600
        hsic = np.trace(Ku @ H @ Kx @ H) / 600 ** 2
        lb = hsic / 2.0
        print(f"{name:16s} {I:9.4f} {rate:9.4f} {lb:9.4f}  {str(I >= lb - 1e-3):>7s}")
    print("\n(e-rate -> I(R;X) for the informed bettor; ~0 with no gap; HSIC/2K is a"
          " certified floor on I, not a tight estimate.)")
