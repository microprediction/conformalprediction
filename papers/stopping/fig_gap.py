"""Figure 1: the conformal information gap when the error spread varies with the input.

Setup: X uniform on [0, 4]; given X = x the residual R is Gaussian with mean 0 and standard
deviation sigma(x) = 0.15 + 0.7 x. A pooled (single-shape) conformal predictive uses the
marginal law of R for every input. Its excess log loss over the oracle is I(R;X)
(Proposition 2 with one stratum), computed here by grid integration.

    python fig_gap.py        # writes figures/fig_gap.pdf and prints I(R;X)
"""
import os
import numpy as np
from scipy.stats import norm

HERE = os.path.dirname(os.path.abspath(__file__))
XS = np.linspace(0.0, 4.0, 801)            # input grid, uniform weights
ZZ = np.linspace(-14.0, 14.0, 14001)       # residual grid
DZ = ZZ[1] - ZZ[0]


def sigma(x):
    return 0.15 + 0.7 * x


def conditional():
    return np.stack([norm.pdf(ZZ, 0.0, sigma(x)) for x in XS])


def pooled(cond):
    return cond.mean(axis=0)


def gap_nats():
    """I(R;X) = E_X KL(r(.|X) || rbar), by grid integration."""
    cond = conditional()
    rbar = pooled(cond)
    m = cond > 1e-300
    kl = np.where(m, cond * np.log(np.where(m, cond, 1.0) / np.clip(rbar, 1e-300, None)), 0.0)
    return float(kl.sum(axis=1).mean() * DZ)


def draw():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.size": 10, "axes.titlesize": 10, "axes.labelsize": 10,
                         "legend.fontsize": 8.5, "savefig.bbox": "tight", "axes.grid": True,
                         "grid.alpha": 0.25, "font.family": "serif"})
    green, orange = "#15803d", "#c2410c"
    rbar = pooled(conditional())
    z = np.linspace(-8, 8, 801)
    rb = np.interp(z, ZZ, rbar)
    fig, axes = plt.subplots(1, 2, figsize=(8.4, 3.0), sharey=True)
    for ax, xv, title in [(axes[0], 0.4, "low-noise input ($x=0.4$)"),
                          (axes[1], 3.4, "high-noise input ($x=3.4$)")]:
        ax.plot(z, norm.pdf(z, 0.0, sigma(xv)), green, lw=2, label="conditional law of $R$ given $x$")
        ax.plot(z, rb, orange, ls="--", lw=2, label="pooled law used by conformal")
        ax.set_title(title)
        ax.set_xlabel("residual $r=y-\\widehat\\mu(x)$")
        ax.set_xlim(-8, 8)
        ax.legend(loc="upper right", fontsize=8)
    axes[0].set_ylabel("density")
    os.makedirs(os.path.join(HERE, "figures"), exist_ok=True)
    fig.savefig(os.path.join(HERE, "figures", "fig_gap.pdf"))
    plt.close(fig)


if __name__ == "__main__":
    draw()
    print(f"I(R;X) = {gap_nats():.3f} nats")
