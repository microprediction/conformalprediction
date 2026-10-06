import numpy as np
from scipy import stats

nu, n, alpha, reps = 3.0, 500, 0.10, 4000
rng = np.random.default_rng(1)
k = int(np.ceil((n+1)*(1-alpha)))

qA, qB, covA, covB = [], [], [], []
condA, condB = [], []
for _ in range(reps):
    # World A: iid t_nu, R independent of X
    RA = stats.t.rvs(nu, size=n, random_state=rng)
    yA = stats.t.rvs(nu, size=1, random_state=rng)[0]
    # World B: scale mixture, sigma^2 ~ InvGamma(nu/2, nu/2) -> marginally t_nu
    s2 = stats.invgamma.rvs(a=nu/2, scale=nu/2, size=n, random_state=rng)
    RB = rng.normal(0, np.sqrt(s2))
    s2n = stats.invgamma.rvs(a=nu/2, scale=nu/2, size=1, random_state=rng)[0]
    yB = rng.normal(0, np.sqrt(s2n))

    qa, qb = np.sort(np.abs(RA))[k-1], np.sort(np.abs(RB))[k-1]
    qA.append(qa); qB.append(qb)
    covA.append(abs(yA) <= qa); covB.append(abs(yB) <= qb)
    # local (oracle-conditional) coverage in world B at the realised scale
    condB.append(2*stats.norm.cdf(qb/np.sqrt(s2n)) - 1)
    condA.append(2*stats.t.cdf(qa, nu) - 1)

qA, qB = np.array(qA), np.array(qB)
print(f"nu={nu}, n={n}, target coverage {1-alpha:.2f}, {reps} replications\n")
print(f"  mean conformal q-hat   A {qA.mean():.4f}   B {qB.mean():.4f}")
print(f"  sd   conformal q-hat   A {qA.std():.4f}   B {qB.std():.4f}")
print(f"  KS test on q-hat law   p = {stats.ks_2samp(qA,qB).pvalue:.3f}   (large p = indistinguishable)")
print(f"  marginal coverage      A {np.mean(covA):.4f}   B {np.mean(covB):.4f}")
print()
ca, cb = np.array(condA), np.array(condB)
print("  CONDITIONAL coverage, which is what differs:")
print(f"    world A   mean {ca.mean():.4f}   sd {ca.std():.4f}   [{np.quantile(ca,.05):.3f}, {np.quantile(ca,.95):.3f}]")
print(f"    world B   mean {cb.mean():.4f}   sd {cb.std():.4f}   [{np.quantile(cb,.05):.3f}, {np.quantile(cb,.95):.3f}]")
