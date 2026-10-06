// Demo 36 — The missing step. Cini, Jenkins, Mandic, Alippi and Bianchi
// (ICML 2025) fit a graph quantile network to the residuals of a pre-trained
// point forecaster and read the interval straight off the fitted quantiles
// (their Eq. 14). There is no conformalization step: the calibration set is the
// training set of the quantile model, and Proposition 3.1 bounds coverage by
// 1 - alpha minus the total variation between the fitted and true residual laws,
// which holds for any quantile estimate and cannot be checked.
//
// Here the construction is rebuilt on a case with known truth. N series on a
// ring follow
//   x_{i,t+1} = a x_{i,t} + sigma_i e_{i,t+1} + b (sigma_{i-1} e_{i-1,t} + sigma_{i+1} e_{i+1,t})/2,
// so each series is hit one step later by its neighbours' shocks. The base
// forecaster is a pooled univariate AR(2) fitted on the training slice; it
// never sees the neighbours and cannot recover their shocks from its own past,
// while the neighbours' last residuals reveal them. Four intervals are built
// on its residuals:
//   SCP     : point +/- one pooled quantile of |r|                (constant width)
//   RelQR   : point + [q_lo(f), q_hi(f)], linear quantile regressions on
//             features f = (neighbours' mean last residual, own lag, own last
//             residual, running scale, node one-hot) fitted by pinball loss on the calibration
//             slice and read directly, as CoRel does. The node one-hot plays
//             the role of the node embeddings.
//   RelQR+C : the same regressions fitted on the first half of the calibration
//             slice, then conformalized on the second half with the CQR score
//             max(q_lo - r, r - q_hi).
//   Oracle  : the true conditional mean as point forecast, per-series running
//             scale, split-conformal quantile of the scaled residual.
// Each is scored on a long test stretch by coverage, mean width and the
// interval score IS_a(l, u; y) = (u - l) + (2/a)(l - y)_+ + (2/a)(y - u)_+ .
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const N = 24, TRAIN = 400, TEST = 1500, BURN = 100, SHOW = 120;
const COL = { y: "#111827", qr: "#b91c1c", qrc: "#1f4ed8" };
const P = { ncal: 60, b: 1.0, het: 0.6, alpha: 0.1, seed: 1 };
const A = 0.5, LAM = 0.94;

function interval_score(lo, hi, y, a) {
  let s = hi - lo;
  if (y < lo) s += (2 / a) * (lo - y);
  else if (y > hi) s += (2 / a) * (y - hi);
  return s;
}
function kth(buf, a) {                               // k-th smallest, k = ceil((m+1)(1-a))
  const m = buf.length, k = Math.ceil((m + 1) * (1 - a));
  if (k > m) return Infinity;
  const s = Float64Array.from(buf).sort();
  return s[k - 1];
}
const nbmean = (row, i) => 0.5 * (row[(i + N - 1) % N] + row[(i + 1) % N]);

function simulate() {
  const rng = mulberry32(P.seed), T = BURN + TRAIN + P.ncal + TEST;
  const zrng = mulberry32(7), sig = new Float64Array(N);   // node scales fixed across resamples
  for (let i = 0; i < N; i++) sig[i] = Math.exp(P.het * randn(zrng));
  const x = Array.from({ length: T }, () => new Float64Array(N));
  const e = Array.from({ length: T }, () => new Float64Array(N));   // scaled shocks sigma_i e_{i,t}
  for (let t = 1; t < T; t++) {
    for (let i = 0; i < N; i++) e[t][i] = sig[i] * randn(rng);
    for (let i = 0; i < N; i++) x[t][i] = A * x[t - 1][i] + e[t][i] + P.b * nbmean(e[t - 1], i);
  }
  return { x, e, T };
}

// pooled AR(2) by least squares on the training slice: the univariate base model
function fitAR2(x, t0, t1) {
  const s = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
  for (let t = t0; t < t1; t++) for (let i = 0; i < N; i++) {
    const f = [1, x[t - 1][i], x[t - 2][i]], y = x[t][i];
    for (let p = 0; p < 3; p++) { v[p] += f[p] * y; for (let q = 0; q < 3; q++) s[p][q] += f[p] * f[q]; }
  }
  const a = s.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k]; }
  }
  return a.map((r, i) => r[3] / r[i]);
}

// two linear quantile regressions (levels lo, hi) by full-batch Adam on the pinball loss
function fitQR(F, y, lo, hi, iters = 400) {
  const n = y.length, d = F[0].length, lv = [lo, hi], lr = 0.03, b1 = 0.9, b2 = 0.999;
  const w = [new Float64Array(d), new Float64Array(d)], m = [new Float64Array(d), new Float64Array(d)], v = [new Float64Array(d), new Float64Array(d)];
  w[0][0] = kth(y, 1 - lo); w[1][0] = kth(y, 1 - hi);   // start at the pooled quantiles
  for (let it = 1; it <= iters; it++) {
    const g = [new Float64Array(d), new Float64Array(d)];
    for (let k = 0; k < n; k++) {
      const f = F[k];
      for (let j = 0; j < 2; j++) {
        let q = 0; for (let p = 0; p < d; p++) q += w[j][p] * f[p];
        const s = (y[k] > q ? -lv[j] : 1 - lv[j]) / n;   // d pinball / d q
        for (let p = 0; p < d; p++) g[j][p] += s * f[p];
      }
    }
    for (let j = 0; j < 2; j++) for (let p = 0; p < d; p++) {
      m[j][p] = b1 * m[j][p] + (1 - b1) * g[j][p]; v[j][p] = b2 * v[j][p] + (1 - b2) * g[j][p] * g[j][p];
      w[j][p] -= lr * (m[j][p] / (1 - Math.pow(b1, it))) / (Math.sqrt(v[j][p] / (1 - Math.pow(b2, it))) + 1e-8);
    }
  }
  return (f) => { let a = 0, b = 0; for (let p = 0; p < d; p++) { a += w[0][p] * f[p]; b += w[1][p] * f[p]; } return [Math.min(a, b), Math.max(a, b)]; };
}

function run() {
  const { x, e, T } = simulate();
  const a = P.alpha, lo = a / 2, hi = 1 - a / 2;
  const t_tr0 = BURN, t_tr1 = BURN + TRAIN, t_c1 = t_tr1 + P.ncal;
  const ar = fitAR2(x, t_tr0, t_tr1);
  const base = (t, i) => ar[0] + ar[1] * x[t - 1][i] + ar[2] * x[t - 2][i];
  const truth = (t, i) => A * x[t - 1][i] + P.b * nbmean(e[t - 1], i);   // exact conditional mean
  // one causal pass: residuals, features, running scales (values at t use rows < t only)
  const R = [], F = [], OS = [], OR = [];
  const sc = new Float64Array(N).fill(1), osc = new Float64Array(N).fill(1), rprev = new Float64Array(N);
  for (let t = t_tr0; t < T; t++) {
    const rt = new Float64Array(N), ft = [], ost = Float64Array.from(osc), ort = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      rt[i] = x[t][i] - base(t, i);
      const f = new Float64Array(5 + N); f[0] = 1; f[1] = nbmean(rprev, i); f[2] = x[t - 1][i]; f[3] = rprev[i]; f[4] = sc[i]; f[5 + i] = 1;
      ft.push(f);
      ort[i] = (x[t][i] - truth(t, i)) / osc[i];
    }
    R.push(rt); F.push(ft); OS.push(ost); OR.push(ort);
    for (let i = 0; i < N; i++) {
      sc[i] = Math.sqrt(LAM * sc[i] * sc[i] + (1 - LAM) * rt[i] * rt[i]); rprev[i] = rt[i];
      const oe = x[t][i] - truth(t, i); osc[i] = Math.sqrt(LAM * osc[i] * osc[i] + (1 - LAM) * oe * oe);
    }
  }
  const off = (t) => t - t_tr0;
  const cal = [], calF = [], calOr = [];
  for (let t = t_tr1; t < t_c1; t++) for (let i = 0; i < N; i++) { cal.push(R[off(t)][i]); calF.push(F[off(t)][i]); calOr.push(Math.abs(OR[off(t)][i])); }
  const qs = kth(cal.map(Math.abs), a);                       // SCP
  const qr = fitQR(calF, cal, lo, hi);                        // RelQR, read directly
  const half = Math.floor(cal.length / 2);                    // RelQR+C: fit on half, conformalize on the rest
  const qr2 = fitQR(calF.slice(0, half), cal.slice(0, half), lo, hi);
  const E = []; for (let k = half; k < cal.length; k++) { const [l, u] = qr2(calF[k]); E.push(Math.max(l - cal[k], cal[k] - u)); }
  const Q = kth(E, a);
  const qo = kth(calOr, a);                                   // oracle
  const acc = { scp: [0, 0, 0, 0], qr: [0, 0, 0, 0], qrc: [0, 0, 0, 0], or: [0, 0, 0, 0] };
  const bands = [];
  for (let t = t_c1; t < T; t++) for (let i = 0; i < N; i++) {
    const r = R[off(t)][i], f = F[off(t)][i], [l2, u2] = qr2(f), d = truth(t, i) - base(t, i), s = qo * OS[off(t)][i];
    const iv = { scp: [-qs, qs], qr: qr(f), qrc: [l2 - Q, u2 + Q], or: [d - s, d + s] };   // all relative to the base point forecast
    for (const m in iv) { const [l, u] = iv[m], c = acc[m]; c[0] += interval_score(l, u, r, a); c[1] += u - l; c[2] += l <= r && r <= u ? 1 : 0; c[3]++; }
    if (i === 0 && t >= T - SHOW) bands.push({ t, y: x[t][i], b: base(t, i), qr: iv.qr, qrc: iv.qrc });
  }
  return { acc, bands };
}

const plot = new Plot(document.getElementById("w-plot"), { xlabel: "time (series 1 of 24, test stretch)", ylabel: "x", margin: { l: 56, r: 16, t: 14, b: 40 } });
const KEYS = ["coverage SCP / RelQR / RelQR+C / oracle", "interval score SCP / RelQR / RelQR+C / oracle", "mean width SCP / RelQR / RelQR+C / oracle"];
const out = readouts(document.getElementById("w-readouts"), KEYS);

function draw() {
  const r = run(), n = (m, i) => r.acc[m][i] / r.acc[m][3], M = ["scp", "qr", "qrc", "or"];
  out(KEYS[0], M.map((m) => pct(n(m, 2))).join(" / "), n("qr", 2) < 1 - P.alpha - 0.01 ? "bad" : "");
  out(KEYS[1], M.map((m) => fmt(n(m, 0), 3)).join(" / "));
  out(KEYS[2], M.map((m) => fmt(n(m, 1), 3)).join(" / "));
  const xs = r.bands.map((d) => d.t), ys = r.bands.map((d) => d.y);
  let lo = Infinity, hi = -Infinity;
  for (const d of r.bands) { lo = Math.min(lo, d.b + d.qr[0], d.b + d.qrc[0], d.y); hi = Math.max(hi, d.b + d.qr[1], d.b + d.qrc[1], d.y); }
  plot.setLimits([xs[0], xs[xs.length - 1]], [lo - 0.05 * (hi - lo), hi + 0.05 * (hi - lo)]);
  plot.clear(); plot.axes();
  plot.band(xs, r.bands.map((d) => d.b + d.qrc[0]), r.bands.map((d) => d.b + d.qrc[1]), { color: COL.qrc, alpha: 0.12 });
  plot.line(xs, r.bands.map((d) => d.b + d.qrc[0]), { color: COL.qrc, width: 1.4 }); plot.line(xs, r.bands.map((d) => d.b + d.qrc[1]), { color: COL.qrc, width: 1.4 });
  plot.line(xs, r.bands.map((d) => d.b + d.qr[0]), { color: COL.qr, width: 1.4 }); plot.line(xs, r.bands.map((d) => d.b + d.qr[1]), { color: COL.qr, width: 1.4 });
  plot.line(xs, ys, { color: COL.y, width: 1 }); plot.points(xs, ys, { color: COL.y, radius: 1.8 });
  plot.legend([{ label: "series", color: COL.y }, { label: "RelQR: fitted quantiles read directly (CoRel, Eq. 14)", color: COL.qr }, { label: "RelQR+C: same regression, conformalized on held-out residuals", color: COL.qrc }]);
}

const ctl = document.getElementById("w-controls");
slider(ctl, { label: "calibration steps (× 24 series)", min: 10, max: 600, step: 10, value: P.ncal, fmt: (v) => String(v) }, (v) => { P.ncal = v; draw(); });
slider(ctl, { label: "neighbour coupling b", min: 0, max: 2, step: 0.1, value: P.b, fmt: (v) => fmt(v, 2) }, (v) => { P.b = v; draw(); });
slider(ctl, { label: "scale heterogeneity across series", min: 0, max: 1.2, step: 0.1, value: P.het, fmt: (v) => fmt(v, 1) }, (v) => { P.het = v; draw(); });
slider(ctl, { label: "error level α", min: 0.05, max: 0.3, step: 0.01, value: P.alpha, fmt: (v) => fmt(v, 2) }, (v) => { P.alpha = v; draw(); });
button(ctl, "Resample", () => { P.seed += 1; draw(); });
autoResize(plot, draw);
draw();
