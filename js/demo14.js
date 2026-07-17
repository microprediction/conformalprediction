// Demo 14 - One number, four pictures.
// The residual-information gap I(R;X) read four ways (paper, Remark "Four readings"):
//   (i)   a false-pooling cost           — conditional residual laws collapsed onto r-bar
//   (ii)  an average log Bayes factor     — mean of per-sample log[ r(R|x) / r-bar(R) ]
//   (iii) conditional non-uniformity of conformal ranks U = G(R)
//   (iv)  a projection onto independence  — KL( P_{X,R} || P_X (x) P_R )
// One model, one I(R;X), four synchronized panels. The gap math mirrors demo 13 / check_gap.py.
import { mulberry32, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts } from "./lib/ui.js";

// ---- shared grid + helpers (same construction as the demo 13 numerical check) ----
const GRID = (() => { const a = []; for (let i = 0; i < 1201; i++) a.push(-10 + 20 * i / 1200); return a; })();
const N = GRID.length, DR = GRID[1] - GRID[0];
const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
function gnorm(p) { let s = 0; for (const v of p) s += v; s *= DR; return p.map(v => v / s); }
function cross(p, q) { let s = 0; for (let i = 0; i < p.length; i++) if (p[i] > 1e-300) s += p[i] * Math.log(Math.max(q[i], 1e-300)); return s * DR; }
function klr(p, q) { let s = 0; for (let i = 0; i < p.length; i++) if (p[i] > 1e-300) s += p[i] * Math.log(p[i] / Math.max(q[i], 1e-300)); return s * DR; }
// inverse-CDF index lookup, used to sample R ~ r(.|x_k) in the Bayes and wealth panels
function idxOf(cum, u) { let a = 0, b = N - 1; while (a < b) { const m = (a + b) >> 1; if (cum[m] < u) a = m + 1; else b = m; } return a; }

const K = 120;                      // number of conditioning slices across x
const state = { eta: 0.5, skew: 0.0 };

// Build the conditional residual laws rows[k] = r(.|x_k), the pooled r-bar, and I(R;X).
function model() {
  const a = state.skew, d = a / Math.sqrt(1 + a * a), shift = -d * Math.sqrt(2 / Math.PI);
  const rows = [];
  for (let k = 0; k < K; k++) {
    const u = -1 + 2 * k / (K - 1), w = Math.exp(state.eta * u), xi = w * shift;
    rows.push(gnorm(GRID.map(rho => { const t = (rho - xi) / w; return (2 / w) * phi(t) * 0.5 * (1 + erf(a * t / Math.SQRT2)); })));
  }
  const rbar = gnorm(GRID.map((_, i) => rows.reduce((s, r) => s + r[i], 0) / K));
  const hsym = gnorm(GRID.map((_, i) => 0.5 * (rbar[i] + rbar[N - 1 - i])));
  let meanHcond = 0; for (const r of rows) meanHcond += -cross(r, r); meanHcond /= K;
  const I = (-cross(rbar, rbar)) - meanHcond;        // I(R;X), entropy route
  const KLskew = klr(rbar, hsym);
  // cumulative of each row, for sampling in panel (ii); and of rbar, for ranks in (iii)
  const cum = rows.map(r => { const c = []; let s = 0; for (let i = 0; i < N; i++) { s += r[i] * DR; c.push(s); } return c; });
  const Gcum = []; { let s = 0; for (let i = 0; i < N; i++) { s += rbar[i] * DR; Gcum.push(s > 1 ? 1 : s); } }
  return { rows, rbar, I, KLskew, cum, Gcum };
}

const setRO = readouts(document.getElementById("readouts"),
  ["I(R;X)", "skew penalty  KL(r̄‖h_sym)", "abs-interval gap"]);

// ---------- panels ----------
const pool = new Plot(document.getElementById("pool"), { xlim: [-6, 6], ylim: [0, 0.6], xlabel: "residual  R", ylabel: "density", margin: { l: 52, r: 14, t: 12, b: 42 } });
const bayes = new Plot(document.getElementById("bayes"), { xlim: [-2.5, 3.5], ylim: [0, 1], xlabel: "per-sample log Bayes factor  log[ r(R|x) / r̄(R) ]   (nats)", ylabel: "frequency", margin: { l: 52, r: 14, t: 12, b: 44 } });
const ranks = new Plot(document.getElementById("ranks"), { xlim: [0, 1], ylim: [0, 3], xlabel: "conformal rank  U = G(R)", ylabel: "density", margin: { l: 52, r: 14, t: 12, b: 42 } });
const proj = new Plot(document.getElementById("proj"), { xlim: [0, 1], ylim: [0, 1], margin: { l: 8, r: 8, t: 12, b: 22 } });
const wealth = new Plot(document.getElementById("wealth"), { xlim: [0, 1500], ylim: [-1, 1], xlabel: "betting round  t", ylabel: "oracle relative log-wealth (nats)", margin: { l: 58, r: 14, t: 12, b: 42 } });

// even spread of slice indices for the coloured conditional curves
const SLICES = [0, Math.round(K * 0.25), Math.round(K * 0.5), Math.round(K * 0.75), K - 1];
const rampColor = (f) => { // green (easy, small sigma) -> red (hard, large sigma)
  const r = Math.round(21 + f * (185 - 21)), g = Math.round(128 - f * (128 - 28)), b = Math.round(61 - f * (61 - 28));
  return `rgb(${r},${g},${b})`;
};

function drawPool(M) {
  pool.clear("#fff"); pool.axes({ grid: true });
  let ymax = 0; for (const k of SLICES) for (const v of M.rows[k]) ymax = Math.max(ymax, v);
  pool.setLimits([-6, 6], [0, ymax * 1.12]);
  pool.clear("#fff"); pool.axes({ grid: true });
  pool.line(GRID, M.rbar, { color: "rgba(110,110,110,0.95)", width: 3, dash: [6, 4] }); // pooled r-bar
  SLICES.forEach((k, j) => pool.line(GRID, M.rows[k], { color: rampColor(j / (SLICES.length - 1)), width: 2 }));
  pool.legend([
    { label: "easy input  r(·|x), small σ", color: rampColor(0) },
    { label: "hard input  r(·|x), large σ", color: rampColor(1) },
    { label: "pooled  r̄  (one shape)", color: "rgba(110,110,110,0.95)", dash: [6, 4] },
  ], { x: pool.X(-6) + 8, y: pool.Y(ymax * 1.12) + 8 });
  pool.text(5.8, ymax * 1.02, `forfeit = I(R;X) = ${fmt(M.I, 3)} nats`, { color: "#b91c1c", align: "right" });
}

function drawBayes(M) {
  // Monte-Carlo per-sample log Bayes factors: pick a slice k, draw R ~ r(.|x_k), score log[r/r-bar].
  const rng = mulberry32(20240611);
  const NS = 9000, lo = -2.5, hi = 3.5, B = 44, h = new Array(B).fill(0);
  let inRange = 0;
  for (let s = 0; s < NS; s++) {
    const k = Math.min(K - 1, Math.floor(rng() * K));
    const i = idxOf(M.cum[k], rng());
    const ri = M.rows[k][i], rb = M.rbar[i];
    if (ri <= 1e-300 || rb <= 1e-300) continue;
    const L = Math.log(ri / rb);
    let bin = Math.floor((L - lo) / (hi - lo) * B);
    if (bin >= 0 && bin < B) { h[bin]++; inRange++; }
  }
  const ymax = Math.max(1, ...h) / Math.max(1, inRange);
  bayes.clear("#fff");
  bayes.setLimits([lo, hi], [0, ymax * 1.15]);
  bayes.clear("#fff"); bayes.axes({ grid: true });
  const ctr = Array.from({ length: B }, (_, j) => lo + (j + 0.5) / B * (hi - lo));
  bayes.bars(ctr, h.map(v => v / Math.max(1, inRange)), (hi - lo) / B * 0.92, { color: "rgba(31,78,216,0.5)" });
  bayes.vline(0, { color: "rgba(0,0,0,0.4)", dash: [4, 4], width: 1.5 });
  bayes.vline(M.I, { color: "#b91c1c", width: 2 });
  bayes.text(M.I + 0.05, ymax * 1.05, `mean = I(R;X) = ${fmt(M.I, 3)}`, { color: "#b91c1c", align: "left" });
}

function uHist(p, Gcum, B) {
  const h = new Array(B).fill(0);
  for (let i = 0; i < N; i++) { let b = Math.floor(Gcum[i] * B); if (b < 0) b = 0; if (b >= B) b = B - 1; h[b] += p[i] * DR; }
  return h.map(v => v * B); // density on [0,1], Uniform = 1
}
function drawRanks(M) {
  const B = 24, ctr = Array.from({ length: B }, (_, j) => (j + 0.5) / B);
  const easy = uHist(M.rows[0], M.Gcum, B), hard = uHist(M.rows[K - 1], M.Gcum, B), marg = uHist(M.rbar, M.Gcum, B);
  const ymax = Math.max(2, ...easy, ...hard) * 1.12;
  ranks.clear("#fff"); ranks.setLimits([0, 1], [0, ymax]); ranks.clear("#fff"); ranks.axes({ grid: true });
  ranks.hline(1, { color: "rgba(0,0,0,0.45)", dash: [4, 4], width: 1.5 });
  ranks.line(ctr, marg, { color: "rgba(120,120,120,0.9)", width: 2 });
  ranks.line(ctr, easy, { color: "#15803d", width: 2 });
  ranks.line(ctr, hard, { color: "#b91c1c", width: 2 });
  ranks.legend([
    { label: "marginal (uniform)", color: "rgba(120,120,120,0.9)" },
    { label: "easy input (small σ)", color: "#15803d" },
    { label: "hard input (large σ)", color: "#b91c1c" },
    { label: "Uniform[0,1]", color: "rgba(0,0,0,0.45)", dash: [4, 4] },
  ], { x: ranks.X(0) + 8, y: ranks.Y(ymax) + 8 });
}

// Panel (iv): two side-by-side density fields, joint vs independence, drawn as a heatmap.
function drawProj(M) {
  const ctx = proj.ctx; proj.clear("#fff");
  const { l, r, t, b } = proj.margin, W = proj.w - l - r, H = proj.h - t - b;
  const gap = 26, halfW = (W - gap) / 2;
  const COLS = 60, ROWS = 56;
  // restrict r to a visible window and find a common max density for both fields
  const rLo = -6, rHi = 6, iLo = Math.round((rLo + 10) / DR), iHi = Math.round((rHi + 10) / DR);
  const colK = (c) => Math.min(K - 1, Math.floor(c / COLS * K));
  const rowI = (rw) => iLo + Math.floor((rw + 0.5) / ROWS * (iHi - iLo));
  let vmax = 1e-9;
  for (let c = 0; c < COLS; c++) for (let rw = 0; rw < ROWS; rw++) {
    vmax = Math.max(vmax, M.rows[colK(c)][rowI(rw)], M.rbar[rowI(rw)]);
  }
  const cell = (x0, dens) => {
    const cw = halfW / COLS, ch = H / ROWS;
    for (let c = 0; c < COLS; c++) for (let rw = 0; rw < ROWS; rw++) {
      const v = Math.min(1, dens(c, rw) / vmax);
      ctx.fillStyle = `rgba(31,78,216,${(0.06 + 0.94 * v).toFixed(3)})`;
      ctx.fillRect(x0 + c * cw, t + rw * ch, cw + 0.6, ch + 0.6);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.strokeRect(x0, t, halfW, H);
  };
  cell(l, (c, rw) => M.rows[colK(c)][rowI(rw)]);                 // joint  P(x,R): columns breathe
  cell(l + halfW + gap, (_c, rw) => M.rbar[rowI(rw)]);           // independence P(x) (x) r-bar: flat
  ctx.fillStyle = "#334155"; ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("joint  P(x, R)", l + halfW / 2, proj.h - 6);
  ctx.fillText("independence  P(x) ⊗ r̄", l + halfW + gap + halfW / 2, proj.h - 6);
  ctx.textAlign = "left"; ctx.fillStyle = "#b91c1c";
  ctx.fillText(`KL = I(R;X) = ${fmt(M.I, 3)}`, l + 4, t + 14);
  ctx.save(); ctx.translate(l - 2, t + H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#64748b"; ctx.textAlign = "center"; ctx.fillText("residual R", 0, -0.5); ctx.restore();
}

// Panel (v): relative log-wealth of an oracle bettor vs the single-shape "crowd".
// Each round's increment is log[r(R|x)/r-bar(R)] — the same draws as panel (ii) —
// so the path drifts up at expected slope I(R;X). The rent, compounding.
function drawWealth(M) {
  const rng = mulberry32(70010), T = 1500;
  const path = new Array(T + 1); path[0] = 0;
  let acc = 0;
  for (let t = 1; t <= T; t++) {
    const k = Math.min(K - 1, Math.floor(rng() * K));
    const i = idxOf(M.cum[k], rng());
    const ri = M.rows[k][i], rb = M.rbar[i];
    acc += (ri > 1e-300 && rb > 1e-300) ? Math.log(ri / rb) : 0;
    path[t] = acc;
  }
  const xs = Array.from({ length: T + 1 }, (_, t) => t), refEnd = M.I * T;
  let lo = 0, hi = 0; for (const v of path) { if (v < lo) lo = v; if (v > hi) hi = v; }
  hi = Math.max(hi, refEnd); const pad = (hi - lo) * 0.12 + 0.02;
  wealth.clear("#fff"); wealth.setLimits([0, T], [lo - pad, hi + pad]); wealth.clear("#fff"); wealth.axes({ grid: true });
  wealth.hline(0, { color: "rgba(0,0,0,0.4)", dash: [4, 4], width: 1.5 });                       // crowd baseline
  wealth.line([0, T], [0, refEnd], { color: "rgba(185,28,28,0.85)", width: 2, dash: [7, 5] });   // expected drift
  wealth.line(xs, path, { color: "#1f4ed8", width: 2 });                                          // realized oracle wealth
  wealth.text(T * 0.46, M.I * T * 0.46, ` slope = I(R;X) = ${fmt(M.I, 3)} / round`, { color: "#b91c1c", align: "left" });
  wealth.legend([
    { label: "oracle relative log-wealth", color: "#1f4ed8" },
    { label: "expected drift (slope I(R;X))", color: "rgba(185,28,28,0.85)", dash: [7, 5] },
    { label: "single-shape “crowd” baseline", color: "rgba(0,0,0,0.4)", dash: [4, 4] },
  ], { x: wealth.X(0) + 8, y: wealth.Y(hi + pad) + 8 });
}

function drawAll() {
  const M = model();
  setRO("I(R;X)", fmt(M.I, 3) + " nats", M.I < 0.05 ? "good" : "warn");
  setRO("skew penalty  KL(r̄‖h_sym)", fmt(M.KLskew, 3) + " nats", M.KLskew < 0.01 ? "good" : "warn");
  setRO("abs-interval gap", fmt(M.I + M.KLskew, 3) + " nats");
  drawPool(M); drawBayes(M); drawRanks(M); drawProj(M); drawWealth(M);
}

// One logical pair of knobs, rendered once at the top and once under each panel.
// Moving any copy updates the state, mirrors the value into every other copy,
// and redraws all five readings.
const hosts = [document.getElementById("controls"), ...document.querySelectorAll(".ctlclone")];
function syncedSlider(params, apply) {
  const clones = hosts.map(host => slider(host, params, v => {
    apply(v);
    for (const c of clones) {
      if (!c || c.el.valueAsNumber === v) continue;
      c.el.value = v;
      const val = c.el.parentElement.querySelector(".val");
      if (val) val.textContent = params.fmt ? params.fmt(v) : v;
    }
    drawAll();
  }));
}
syncedSlider({ label: "heteroscedasticity  (spread depends on x  →  I(R;X))", min: 0, max: 1.2, step: 0.02, value: state.eta, fmt: v => v.toFixed(2) },
  v => { state.eta = v; });
syncedSlider({ label: "residual skew  (→ KL skew penalty, leaves I(R;X) fixed)", min: 0, max: 6, step: 0.1, value: state.skew, fmt: v => v.toFixed(1) },
  v => { state.skew = v; });

autoResize(pool, drawAll); autoResize(bayes, drawAll); autoResize(ranks, drawAll); autoResize(proj, drawAll); autoResize(wealth, drawAll);
drawAll();
