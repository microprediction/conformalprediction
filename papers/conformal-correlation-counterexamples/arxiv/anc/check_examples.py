"""Numerical checks for every calculation in "Conformal Correlation Counterexamples".

Exact claims are checked with fractions. Claims about randomized APS, the Beta law
of the realized coverage, and the Dirichlet variance are checked by simulation
with a tolerance. Run: python3 check_examples.py
"""
from fractions import Fraction as F
from itertools import product
import math, random
import numpy as np

OK = []
def check(name, cond):
    OK.append((name, bool(cond))); print(("PASS" if cond else "FAIL"), name)

# ---------- the statistic ----------
def ccm_from_law(law, H):
    """law: dict frozenset(set) -> probability. Returns (rho, p, q) with rho[i][j]
    the phi coefficient, None where undefined."""
    p = [sum(pr for S, pr in law.items() if i in S) for i in range(H)]
    q = [[sum(pr for S, pr in law.items() if i in S and j in S) for j in range(H)] for i in range(H)]
    rho = [[None]*H for _ in range(H)]
    for i in range(H):
        for j in range(H):
            v = p[i]*(1-p[i])*p[j]*(1-p[j])
            if v > 0:
                num = q[i][j] - p[i]*p[j]
                rho[i][j] = num / F(math.isqrt(v.numerator), math.isqrt(v.denominator)) if _is_square(v) else float(num) / math.sqrt(float(v))
    return rho, p, q

def _is_square(fr):
    return math.isqrt(fr.numerator)**2 == fr.numerator and math.isqrt(fr.denominator)**2 == fr.denominator

def phi(p_i, p_j, q_ij):
    return (q_ij - p_i*p_j) / math.sqrt(p_i*(1-p_i)*p_j*(1-p_j))

A, B, C, T = 0, 1, 2, 3
fs = frozenset

# ---------- Lemma 1: any rho in [-1,1] with coverage one, three classes ----------
for rho in [F(-1), F(-1,2), F(0), F(3,10), F(1)]:
    law = {fs({T}): (1+rho)/4, fs({T, A, B}): (1+rho)/4, fs({T, A}): (1-rho)/4, fs({T, B}): (1-rho)/4}
    r, p, q = ccm_from_law(law, 4)
    check(f"Lemma 1: rho_AB = {rho}", r[A][B] == rho and p[A] == F(1,2) and p[B] == F(1,2))

# two classes, coverage one: q_AB = p_A + p_B - 1 is forced
for pa, pb in [(F(1,2), F(3,4)), (F(2,3), F(2,3))]:
    # any law on nonempty subsets of {A,B} with these marginals
    qab = pa + pb - 1
    law = {fs({A}): pa - qab, fs({B}): pb - qab, fs({A, B}): qab}
    check("two classes, coverage one forces q_AB", all(v >= 0 for v in law.values()) and sum(law.values()) == 1
          and ccm_from_law(law, 2)[2][A][B] == qab)

# ---------- Theorem 1: reassigning Yhat within a set of size >= 2 ----------
rng = random.Random(1)
H = 3
joint = {}  # (y, yhat, set) -> prob
for y in range(H):
    for S in [fs({0}), fs({1}), fs({2}), fs({0, 1}), fs({1, 2}), fs({0, 2}), fs({0, 1, 2})]:
        for yh in S:
            joint[(y, yh, S)] = rng.random()
Z = sum(joint.values()); joint = {k: v/Z for k, v in joint.items()}
S0 = fs({0, 1}); b, b2 = 0, 1
def modify(joint, target):
    out = {}
    for (y, yh, S), pr in joint.items():
        key = (y, target, S) if S == S0 else (y, yh, S)
        out[key] = out.get(key, 0) + pr
    return out
j2, j3 = modify(joint, b), modify(joint, b2)
def law_YC(j): 
    d = {}
    for (y, yh, S), pr in j.items(): d[(y, S)] = d.get((y, S), 0) + pr
    return d
def confusion(j):
    d = {}
    for (y, yh, S), pr in j.items(): d[(y, yh)] = d.get((y, yh), 0) + pr
    return d
same_YC = all(abs(law_YC(j2).get(k, 0) - law_YC(j3).get(k, 0)) < 1e-12 for k in set(law_YC(j2)) | set(law_YC(j3)))
diff_conf = any(abs(confusion(j2).get(k, 0) - confusion(j3).get(k, 0)) > 1e-9 for k in set(confusion(j2)) | set(confusion(j3)))
check("Theorem 1: same law of (Y, C), different confusion matrices", same_YC and diff_conf)

# ---------- Example 1: randomized APS, two models, same set law ----------
def aps_set(probs_by_rank, order, tau, U):
    """probs_by_rank descending, order[k] = class at rank k. Randomized APS set."""
    cum, S = 0.0, []
    for k, pk in enumerate(probs_by_rank):
        before = cum; cum += pk
        if before >= tau: break
        if cum >= tau:  # boundary rank: keep with prob (tau - before)/pk
            if U >= 1 - (tau - before)/pk: S.append(order[k])
            break
        S.append(order[k])
    return fs(S)
ORDER1 = [[C, A, B], [A, B, C], [B, C, A]]
ORDER2 = [[B, A, C], [C, B, A], [A, C, B]]
PROBS = [0.6, 0.3, 0.1]
nprng = np.random.default_rng(7)
m, alpha = 1000, 0.1
k = math.ceil((m+1)*(1-alpha))
u_cal = nprng.random(m); scores = 0.9 - 0.3*u_cal          # same for both models
tau = np.sort(scores)[k-1]; r = (tau - 0.6)/0.3
N = 200000
ys = nprng.integers(0, 3, N); Us = nprng.random(N)
def run(ORDER):
    counts, conf, cov = {}, np.zeros((3, 3)), 0
    for y, U in zip(ys, Us):
        S = aps_set(PROBS, ORDER[y], tau, U)
        counts[S] = counts.get(S, 0) + 1; conf[y][ORDER[y][0]] += 1; cov += (y in S)
    law = {S: c/N for S, c in counts.items()}
    return law, conf/N, cov/N
law1, conf1, cov1 = run(ORDER1); law2, conf2, cov2 = run(ORDER2)
allsets = set(law1) | set(law2)
check("Example 1: same law of sets (max gap < 0.01)", max(abs(law1.get(S, 0) - law2.get(S, 0)) for S in allsets) < 0.01)
check("Example 1: singletons ~ (1-r)/3, pairs ~ r/3", abs(law1[fs({A})] - (1-r)/3) < 0.01 and abs(law1[fs({A, B})] - r/3) < 0.01)
check("Example 1: confusion matrices are transposes, accuracy zero", np.allclose(conf1, conf2.T, atol=0.01) and conf1.trace() == 0)
check("Example 1: coverage equals r conditional on calibration", abs(cov1 - r) < 0.01 and abs(cov2 - r) < 0.01)
rho1 = phi((1+r)/3, (1+r)/3, r/3); check("Example 1: entry formula -(r^2-r+1)/((1+r)(2-r))", abs(rho1 + (r*r - r + 1)/((1+r)*(2-r))) < 1e-12)
# r ~ Beta(k, m+1-k): compare mean and variance over many calibrations
rs = np.sort(0.9 - 0.3*nprng.random((20000, m)), axis=1)[:, k-1]; rs = (rs - 0.6)/0.3
bm, bv = k/(m+1), k*(m+1-k)/((m+1)**2*(m+2))
check("Example 1: r ~ Beta(k, m+1-k), mean and variance", abs(rs.mean() - bm) < 3e-4 and abs(rs.var() - bv) < 3e-6)
check("Example 1: r falls below 1-alpha on some calibrations", (rs < 1-alpha).mean() > 0.2)
# one bit: I(D;C)=0, I(D;Y|C)=log 2 by exact enumeration at fixed r
def law_yc(ORDER, r):
    d = {}
    for y in range(3):
        top, second = ORDER[y][0], ORDER[y][1]
        d[(y, fs({top}))] = F(1,3)*(1-r); d[(y, fs({top, second}))] = F(1,3)*r
    return d
rr = F(7,10); L1, L2 = law_yc(ORDER1, rr), law_yc(ORDER2, rr)
pc1 = {}; pc2 = {}
for (y, S), pr in L1.items(): pc1[S] = pc1.get(S, 0) + pr
for (y, S), pr in L2.items(): pc2[S] = pc2.get(S, 0) + pr
check("Example 1: I(D;C) = 0 (same set law for both models)", pc1 == pc2)
disjoint = all((k1 not in L2) for k1 in L1)   # supports of (Y,C) disjoint -> D determined
check("Example 1: I(D;Y|C) = log 2 (label plus set identifies the model)", disjoint)

# ---------- Examples 2-8, exact ----------
law = {fs({A, B}): F(1,3), fs({B, C}): F(1,3), fs({C, A}): F(1,3)}
r_, p_, q_ = ccm_from_law(law, 3)
check("Example 2: every off-diagonal entry -1/2", all(r_[i][j] == F(-1,2) for i in range(3) for j in range(3) if i != j))
eps = F(1,100)
law = {fs({A, B}): (1-eps)/2, fs({A}): eps/2, fs({B}): (1-eps)/2, fs({C}): eps/2}
r_, p_, q_ = ccm_from_law(law, 3)
check("Example 3: p_A=1/2, p_B=1-eps, rho_AB = 0", p_[A] == F(1,2) and p_[B] == 1-eps and r_[A][B] == 0)
for e in [F(2,5), F(1,100), F(1,10**6)]:
    law = {fs({T}): 1-e, fs({T, A, B}): e}
    r_, p_, q_ = ccm_from_law(law, 4)
    check(f"Example 4: rho_AB = 1 with co-occurrence {e}", r_[A][B] == 1 and q_[A][B] == e)
law = {fs({A, B, C}): F(1,2), fs({A}): F(1,6), fs({B}): F(1,6), fs({C}): F(1,6)}
r_, p_, q_ = ccm_from_law(law, 3)
check("Example 5: p_i = 2/3, q_ij = 1/2, rho = 1/4", p_[A] == F(2,3) and q_[A][B] == F(1,2) and r_[A][B] == F(1,4))
def pooled(pa1, pb1, pa2, pb2):
    law = {}
    for (pa, pb) in [(pa1, pb1), (pa2, pb2)]:
        for za, zb in product([0, 1], repeat=2):
            S = fs({T} | ({A} if za else set()) | ({B} if zb else set()))
            law[S] = law.get(S, 0) + F(1,2)*(pa if za else 1-pa)*(pb if zb else 1-pb)
    return ccm_from_law(law, 4)
r_, p_, q_ = pooled(F(9,10), F(9,10), F(1,10), F(1,10))
check("Example 6: pooled q_AB = 0.41, rho = 0.64", q_[A][B] == F(41,100) and r_[A][B] == F(16,25))
r_, p_, q_ = pooled(F(9,10), F(1,10), F(1,10), F(9,10))
check("Example 6 reversed: rho = -0.64", r_[A][B] == F(-16,25))
cat, dog, plane = 0, 1, 2
law = {fs({cat, dog}): F(1,3), fs({dog}): F(1,3), fs({plane}): F(1,3)}
r_, p_, q_ = ccm_from_law(law, 3)
check("Example 7: +1/2, -1/2, -1", r_[cat][dog] == F(1,2) and r_[cat][plane] == F(-1,2) and r_[dog][plane] == -1)
n = 1000
law_same = {fs({T, A, B}): F(1, n), fs({T}): F(n-1, n)}
law_diff = {fs({T, A}): F(1, n), fs({T, B}): F(1, n), fs({T}): F(n-2, n)}
check("Example 8: rho = 1 together, -1/(n-1) apart",
      ccm_from_law(law_same, 4)[0][A][B] == 1 and ccm_from_law(law_diff, 4)[0][A][B] == F(-1, n-1))

# ---------- Lemma 2: floor and Frechet range ----------
for pi_, pj_ in [(F(1,10), F(1,10)), (F(1,5), F(3,10)), (F(3,5), F(7,10))]:
    oi, oj = pi_/(1-pi_), pj_/(1-pj_)
    floor_pred = -math.sqrt(float(oi*oj))
    lo = max(F(0), pi_+pj_-1); hi = min(pi_, pj_)
    rho_lo, rho_hi = phi(float(pi_), float(pj_), float(lo)), phi(float(pi_), float(pj_), float(hi))
    pred_lo = -math.sqrt(float(oi*oj)) if pi_+pj_ <= 1 else -1/math.sqrt(float(oi*oj))
    pred_hi = math.sqrt(float(min(oi,oj)/max(oi,oj)))
    check(f"Lemma 2 range at p=({pi_},{pj_})", abs(rho_lo - pred_lo) < 1e-12 and abs(rho_hi - pred_hi) < 1e-12)
Hn = 10; check("Lemma 2: balanced singletons give -1/(H-1)", abs(phi(1/Hn, 1/Hn, 0) + 1/(Hn-1)) < 1e-12)

# ---------- Lemma 3: identification from three entries ----------
ps = [F(1,10), F(3,10), F(3,5)]
os_ = [p/(1-p) for p in ps]
rho = lambda i, j: -math.sqrt(float(os_[i]*os_[j]))
o0 = -rho(0,1)*rho(0,2)/rho(1,2)
check("Lemma 3: o_i = -rho_ij rho_ik / rho_jk, p_i = o_i/(1+o_i)", abs(o0 - float(os_[0])) < 1e-12 and abs(o0/(1+o0) - float(ps[0])) < 1e-12)

# ---------- Example 9: APS privacy construction, and the unequal-top counterexample ----------
pi_true = np.array([0.2, 0.3, 0.5]); tau9 = 0.4; r9 = tau9/0.6
p_incl = r9*pi_true
o = p_incl/(1-p_incl); rho9 = lambda i, j: -math.sqrt(o[i]*o[j])
o_rec = np.array([-rho9(0,1)*rho9(0,2)/rho9(1,2), -rho9(1,0)*rho9(1,2)/rho9(0,2), -rho9(2,0)*rho9(2,1)/rho9(0,1)])
p_rec = o_rec/(1+o_rec); pi_rec = p_rec/p_rec.sum()
check("Example 9: proportions recovered exactly from the matrix", np.allclose(pi_rec, pi_true))
# simulate the APS sets: perfect classifier, top prob 0.6, calibration scores 0.6-0.6u
u9 = nprng.random(m); tau_s = np.sort(0.6 - 0.6*u9)[k-1]; r_s = tau_s/0.6
y9 = nprng.choice(3, size=N, p=pi_true); U9 = nprng.random(N)
kept = U9 >= 1 - r_s
p_emp = np.array([np.mean(kept & (y9 == i)) for i in range(3)])
check("Example 9 simulation: p_i = r pi_i", np.allclose(p_emp, r_s*pi_true, atol=0.005))
# reviewer's counterexample: unequal top probabilities give the same inclusion rates
cfg1 = (np.array([1,1,1])/3, np.array([0.6,0.6,0.6])); cfg2 = (np.array([5,6,7])/18, np.array([0.5,0.6,0.7]))
t = 0.3
p1 = cfg1[0]*t/cfg1[1]; p2 = cfg2[0]*t/cfg2[1]
check("Example 9 caveat: different proportions, same inclusion rates 5t/9", np.allclose(p1, p2) and np.allclose(p1, 5*t/9))

# ---------- Section 6: Stutz normalization, and the conditional-mean example ----------
check("Section 6: rows (0.6,0.4) from f_B=0.4 always and from 0.6/0.2 half each", abs(0.5*0.6+0.5*0.2 - 0.4) < 1e-12)
# row normalization of a joint coverage-confusion matrix divides by expected set size
K = {(A, A): 1.0, (A, B): 1.0}  # every class-A input receives {A,B}: P(k in C | Y=A) = 1 for both
row = sum(K.values()); check("Section 6: row-normalizing a coverage confusion row gives 1/2,1/2 not 1,1", K[(A,A)]/row == 0.5)

# ---------- Section 5: ten clients, and the Dirichlet variance ----------
check("Section 5: nine clients at 1 and one at 0 pool to 0.9", abs(0.9*1 + 0.1*0 - 0.9) < 1e-12)
Hd = 10
for beta in [0.5, 1.0, 10.0]:
    th = nprng.dirichlet([beta]*Hd, size=200000)
    check(f"Section 6: Dirichlet Var(theta_h) = (H-1)/(H^2(H beta+1)) at beta={beta}",
          abs(th[:, 0].var() - (Hd-1)/(Hd**2*(Hd*beta+1))) < 2e-4)
check("Section 6: larger beta means smaller variance", all((Hd-1)/(Hd**2*(Hd*b+1)) > (Hd-1)/(Hd**2*(Hd*(b*2)+1)) for b in [0.5, 1, 10]))

# ---------- Section 1: APS coverage exactly k/(m+1) with distinct scores ----------
covs = []
for _ in range(2000):
    sc = nprng.random(m); t_ = np.sort(sc)[k-1]; covs.append((nprng.random(2000) <= t_).mean())
check("Section 3: APS coverage averages k/(m+1) over calibrations", abs(np.mean(covs) - k/(m+1)) < 2e-3)

fails = [n for n, ok in OK if not ok]
print(f"\n{len(OK)-len(fails)} of {len(OK)} checks passed" + (f"; FAILED: {fails}" if fails else ""))
