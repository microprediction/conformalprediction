// Demo 27 — Crossing the gap, in the limit (Vovk's universally consistent CPS).
// Implements the histogram predictive system of ALRW working paper #18
// (Definitions 27-33, in its Mondrian/histogram form): partition x into cells
// of width h_n (powers of 2, h_n -> 0 with n*h_n -> infinity); the predictive
// CDF at x is the within-cell empirical CDF of the labels. Universal
// consistency is weak convergence to the true conditional law, so the demo
// grades all systems by Wasserstein-1 distance to that law (which metrizes
// weak convergence here), well-defined for step CDFs with no density smoothing.
// Three tracks vs n: a single-shape split-conformal CPD (pooled residual
// shape, the family the information gap prices), the histogram CPS, and a
// two-stage parametric fit. The single-shape track plateaus; the histogram
// track decays, slowly; the parametric track decays fast.
import { mulberry32, sampleNormal, normCdf, polyfit, polyval, linspace, clamp, fmt, pct }
  from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const COL = {
  truth: "rgba(0,0,0,0.75)",
  single: "#b45309",
  hist: "#1f4ed8",
  param: "#15803d",
};

const mfun = (x) => Math.sin(2 * Math.PI * x);
const sfun = (x) => 0.15 + 0.85 * x;

const cdfPlot = new Plot(document.getElementById("cdfs"), {
  xlim: [-3, 3], ylim: [0, 1], xlabel: "y", ylabel: "predictive CDF at x*",
});
const racePlot = new Plot(document.getElementById("race"), {
  xlim: [2, 4.6], ylim: [0, 0.5], xlabel: "training size n", ylabel: "avg W1 distance to true conditional law",
});

const setRO = readouts(document.getElementById("readouts"),
  ["single-shape W1 (the plateau)", "histogram CPS W1", "parametric W1", "cell width h(n)", "coverage of 90% band (hist)"]);
const ctrls = document.getElementById("controls");

const state = { nExp: 10, xstar: 0.8, cmul: 1 };
let seed = 26;
const nOf = () => 2 ** state.nExp;

// Vovk's schedule: h_n a power of 2 with h_n -> 0 and n*h_n -> infinity.
// h = cmul * 2^(-round(log2(n)/3)) gives h ~ n^(-1/3), n*h ~ n^(2/3).
function hOf(n) {
  const e = Math.round(Math.log2(n) / 3);
  return clamp(state.cmul * 2 ** (-e), 1 / 1024, 0.5);
}

function dataset(n, rng) {
  const xs = new Float64Array(n), ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = rng();
    xs[i] = x;
    ys[i] = mfun(x) + sfun(x) * sampleNormal(rng);
  }
  return { xs, ys };
}

// ---- the three systems; each returns Q(y|x), a CDF in y ----

// (1) single-shape split-conformal CPD: fitted mean, pooled residual ECDF.
function fitSingle(d) {
  const coef = polyfit(Array.from(d.xs), Array.from(d.ys), 3);
  const r = new Float64Array(d.xs.length);
  for (let i = 0; i < r.length; i++) r[i] = d.ys[i] - polyval(coef, d.xs[i]);
  r.sort();
  return (y, x) => ecdf(r, y - polyval(coef, x));
}

// (2) histogram CPS (WP 18, Defs 27-33, Mondrian/histogram form):
// within-cell empirical CDF of the labels, cells of width h.
function fitHist(d, h) {
  const cells = new Map();
  for (let i = 0; i < d.xs.length; i++) {
    const k = Math.floor(d.xs[i] / h);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(d.ys[i]);
  }
  for (const arr of cells.values()) arr.sort((a, b) => a - b);
  return (y, x) => {
    const arr = cells.get(Math.floor(x / h));
    if (!arr || arr.length === 0) return y >= 0 ? 1 : 0; // WP18's empty-cell convention
    return ecdfArr(arr, y, arr.length + 1);              // rank/(N+1), tie-smoothed in spirit
  };
}

// (3) two-stage parametric fit: poly-3 mean, linear scale from |residuals|.
function fitParam(d) {
  const coef = polyfit(Array.from(d.xs), Array.from(d.ys), 3);
  const ax = [], ar = [];
  for (let i = 0; i < d.xs.length; i++) {
    ax.push(d.xs[i]);
    ar.push(Math.abs(d.ys[i] - polyval(coef, d.xs[i])) * Math.sqrt(Math.PI / 2));
  }
  const sc = polyfit(ax, ar, 1);
  return (y, x) => normCdf(y, polyval(coef, x), Math.max(0.03, polyval(sc, x)));
}

function ecdf(sorted, v) { return ecdfArr(sorted, v, sorted.length + 1); }
function ecdfArr(sorted, v, denom) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
  return (lo + 0.5) / denom;
}

// ---- W1 distance of Q(.|x) to the true conditional law, averaged over x ----
const YGRID = linspace(-5.2, 5.2, 280);
const DY = YGRID[1] - YGRID[0];
function w1at(Q, x) {
  const m = mfun(x), s = sfun(x);
  let acc = 0;
  for (const y of YGRID) acc += Math.abs(Q(y, x) - normCdf(y, m, s));
  return acc * DY;
}
const XTEST = linspace(0.0125, 0.9875, 80);
function avgW1(Q) {
  let a = 0;
  for (const x of XTEST) a += w1at(Q, x);
  return a / XTEST.length;
}

// coverage of the histogram CPS's central 90% band on fresh data
function covHist(Q, rng, m) {
  let c = 0;
  for (let i = 0; i < m; i++) {
    const x = rng(), y = mfun(x) + sfun(x) * sampleNormal(rng);
    const u = Q(y, x);
    if (u > 0.05 && u < 0.95) c++;
  }
  return c / m;
}

// ---- the race curve, computed once per seed/cmul ----
const NEXPS = [7, 8, 9, 10, 11, 12, 13, 14, 15];
let race = null;
function buildRace() {
  const out = { single: [], hist: [], param: [] };
  for (const e of NEXPS) {
    const n = 2 ** e;
    const d = dataset(n, mulberry32(seed + e));
    out.single.push(avgW1(fitSingle(d)));
    out.hist.push(avgW1(fitHist(d, hOf(n))));
    out.param.push(avgW1(fitParam(d)));
  }
  return out;
}

function draw() {
  const n = nOf(), h = hOf(n);
  const rng = mulberry32(seed);
  const d = dataset(n, rng);
  const Qs = fitSingle(d), Qh = fitHist(d, h), Qp = fitParam(d);

  // ===== panel 1: the three CDFs at x*, against the truth =====
  const x = state.xstar, m = mfun(x), s = sfun(x);
  cdfPlot.setLimits([m - 3.2, m + 3.2], [0, 1.02]);
  cdfPlot.clear("#fff");
  cdfPlot.axes({ grid: true });
  const ys = linspace(m - 3.2, m + 3.2, 320);
  cdfPlot.line(ys, ys.map((y) => normCdf(y, m, s)), { color: COL.truth, width: 2.4, dash: [6, 4] });
  cdfPlot.line(ys, ys.map((y) => Qs(y, x)), { color: COL.single, width: 2 });
  cdfPlot.line(ys, ys.map((y) => Qh(y, x)), { color: COL.hist, width: 2 });
  cdfPlot.line(ys, ys.map((y) => Qp(y, x)), { color: COL.param, width: 1.6 });
  cdfPlot.legend([
    { label: "true conditional CDF", color: COL.truth, dash: [6, 4] },
    { label: "single-shape conformal CPD", color: COL.single },
    { label: "histogram CPS (WP 18)", color: COL.hist },
    { label: "parametric fit", color: COL.param },
  ], { x: cdfPlot.X(m - 3.2) + 8, y: cdfPlot.Y(1.02) + 8 });

  // ===== panel 2: the race =====
  if (!race) race = buildRace();
  const ymax = Math.max(0.12, 1.15 * Math.max(...race.single, ...race.hist, ...race.param));
  racePlot.setLimits([NEXPS[0] * Math.LOG10E * Math.LN2, NEXPS[NEXPS.length - 1] * Math.LOG10E * Math.LN2], [0, ymax]);
  racePlot.clear("#fff");
  const xsr = NEXPS.map((e) => e * Math.LOG10E * Math.LN2); // log10(2^e)
  const XL = { 7: "128", 9: "512", 11: "2k", 13: "8k", 15: "32k" };
  racePlot.axes({ grid: true, xticks: [7, 9, 11, 13, 15].map((e) => e * Math.LOG10E * Math.LN2), xfmt: (v) => XL[Math.round(v / (Math.LOG10E * Math.LN2))] || "" });
  racePlot.line(xsr, race.single, { color: COL.single, width: 2 });
  racePlot.line(xsr, race.hist, { color: COL.hist, width: 2 });
  racePlot.line(xsr, race.param, { color: COL.param, width: 1.6 });
  racePlot.vline(state.nExp * Math.LOG10E * Math.LN2, { color: "rgba(0,0,0,0.35)", dash: [3, 4], width: 1 });
  racePlot.legend([
    { label: "single-shape: the plateau", color: COL.single },
    { label: "histogram CPS: slow descent", color: COL.hist },
    { label: "parametric: fast, then a bias floor", color: COL.param },
  ]);

  // ===== readouts =====
  const i = NEXPS.indexOf(state.nExp);
  const rs = i >= 0 ? race.single[i] : avgW1(Qs);
  const rh = i >= 0 ? race.hist[i] : avgW1(Qh);
  const rp = i >= 0 ? race.param[i] : avgW1(Qp);
  setRO("single-shape W1 (the plateau)", fmt(rs, 3), "warn");
  setRO("histogram CPS W1", fmt(rh, 3), rh < rs ? "good" : "warn");
  setRO("parametric W1", fmt(rp, 3), rh < rp ? "warn" : "good");
  setRO("cell width h(n)", h >= 1 / 64 ? String(h) : h.toExponential(1));
  setRO("coverage of 90% band (hist)", pct(covHist(Qh, mulberry32(seed + 999), 4000), 1), "good");
}

slider(ctrls, { label: "training size n", min: 7, max: 15, step: 1, value: state.nExp, fmt: (v) => (2 ** v).toLocaleString("en-US") },
  (v) => { state.nExp = v; draw(); });
slider(ctrls, { label: "test point x*", min: 0.05, max: 0.95, step: 0.05, value: state.xstar, fmt: (v) => v.toFixed(2) },
  (v) => { state.xstar = v; draw(); });
slider(ctrls, { label: "cell-width multiplier", min: 0.5, max: 2, step: 0.5, value: state.cmul, fmt: (v) => "×" + v },
  (v) => { state.cmul = v; race = null; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; race = null; draw(); });

autoResize(cdfPlot, draw);
autoResize(racePlot, draw);
draw();
