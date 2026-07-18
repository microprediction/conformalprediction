// stats.js — tiny, dependency-free numerical + conformal toolkit.
// Everything is deterministic given a seed, so demos are reproducible.

// ---------- Random number generation ----------

// mulberry32: small, fast, seedable PRNG. Returns a function -> [0,1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal via Box–Muller. Pass an rng() -> [0,1).
export function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sampleNormal(rng, mu = 0, sigma = 1) {
  return mu + sigma * randn(rng);
}

// ---------- Array helpers ----------

export function linspace(a, b, n) {
  if (n === 1) return [a];
  const out = new Array(n);
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + step * i;
  return out;
}

export function mean(xs) {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function std(xs, ddof = 1) {
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / Math.max(1, xs.length - ddof));
}

// Type-7 (linear interpolation) quantile, p in [0,1]. Copies + sorts input.
export function quantile(xs, p) {
  const a = xs.slice().sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return NaN;
  if (p <= 0) return a[0];
  if (p >= 1) return a[n - 1];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const frac = h - lo;
  return a[lo] + frac * (a[lo + 1] - a[lo]);
}

// ---------- Normal distribution ----------

export function normPdf(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

// Abramowitz & Stegun 7.1.26 error-function approximation.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

export function normCdf(x, mu = 0, sigma = 1) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

// Acklam's inverse normal CDF approximation. p in (0,1).
export function normInv(p, mu = 0, sigma = 1) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q, r, z;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return mu + sigma * z;
}

// ---------- Histograms & densities ----------

export function histogram(values, nbins, lo, hi) {
  if (lo === undefined) lo = Math.min(...values);
  if (hi === undefined) hi = Math.max(...values);
  const edges = linspace(lo, hi, nbins + 1);
  const counts = new Array(nbins).fill(0);
  const w = (hi - lo) / nbins;
  for (const v of values) {
    if (v < lo || v > hi) continue;
    let k = Math.floor((v - lo) / w);
    if (k === nbins) k = nbins - 1;
    counts[k]++;
  }
  const centers = new Array(nbins);
  const density = new Array(nbins);
  for (let i = 0; i < nbins; i++) {
    centers[i] = lo + w * (i + 0.5);
    density[i] = counts[i] / (values.length * w);
  }
  return { edges, centers, counts, density, width: w };
}

// ---------- Conformal prediction ----------

// Split-conformal quantile of nonconformity scores at miscoverage alpha.
// Uses the finite-sample correction: the ceil((n+1)(1-alpha))-th smallest score.
// Returns +Infinity when the correction exceeds n (the honest "infinite band").
export function conformalQuantile(scores, alpha) {
  const a = scores.slice().sort((x, y) => x - y);
  const n = a.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  if (k > n) return Infinity;
  return a[k - 1];
}

// Empirical coverage of intervals [lo_i, hi_i] against truths y_i, in [0,1].
export function coverage(lo, hi, y) {
  let c = 0;
  for (let i = 0; i < y.length; i++) if (y[i] >= lo[i] && y[i] <= hi[i]) c++;
  return c / y.length;
}

// Mean log-score (mean predictive log-likelihood) under Gaussian forecasts.
export function meanLogScoreNormal(y, mu, sigma) {
  let s = 0;
  for (let i = 0; i < y.length; i++) {
    const m = Array.isArray(mu) ? mu[i] : mu;
    const sd = Array.isArray(sigma) ? sigma[i] : sigma;
    s += Math.log(Math.max(normPdf(y[i], m, sd), 1e-300));
  }
  return s / y.length;
}

// Probability Integral Transform values: F(y_i). For Gaussian forecasts.
export function pitNormal(y, mu, sigma) {
  return y.map((yi, i) => {
    const m = Array.isArray(mu) ? mu[i] : mu;
    const sd = Array.isArray(sigma) ? sigma[i] : sigma;
    return normCdf(yi, m, sd);
  });
}

// ---------- Least-squares polynomial fit ----------

// Solve A x = b for small symmetric systems via Gaussian elimination w/ pivoting.
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat(b[i]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

// Fit y ~ polynomial in x of given degree. Returns coefficient array (low->high).
export function polyfit(x, y, degree) {
  const p = degree + 1;
  const A = Array.from({ length: p }, () => new Array(p).fill(0));
  const b = new Array(p).fill(0);
  for (let i = 0; i < x.length; i++) {
    const pows = new Array(2 * degree + 1);
    pows[0] = 1;
    for (let k = 1; k < pows.length; k++) pows[k] = pows[k - 1] * x[i];
    for (let r = 0; r < p; r++) {
      b[r] += pows[r] * y[i];
      for (let c = 0; c < p; c++) A[r][c] += pows[r + c];
    }
  }
  return solve(A, b);
}

export function polyval(coef, x) {
  let v = 0;
  for (let k = coef.length - 1; k >= 0; k--) v = v * x + coef[k];
  return v;
}

// ---------- Beta distribution ----------

// Lanczos log-gamma approximation.
export function logGamma(x) {
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  const lnB = logGamma(a) + logGamma(b) - logGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnB);
}

// Continued fraction for the incomplete beta (Numerical Recipes' betacf).
function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a,b) = P(X <= x) for X ~ Beta(a,b).
export function betaCdf(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBt = logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lnBt);
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

// Beta quantile by bisection on the CDF. p in (0,1).
export function betaInv(p, a, b) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (betaCdf(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// ---------- Misc ----------

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function fmt(x, digits = 2) {
  if (!isFinite(x)) return x > 0 ? "∞" : "−∞";
  return x.toFixed(digits);
}

export function pct(x, digits = 1) {
  return (100 * x).toFixed(digits) + "%";
}
