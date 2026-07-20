// Demo 21 — Moving the balls, moving the slots.
//
// Top: kernel herding vs Monte Carlo on a standard Gaussian target, RBF kernel,
// everything closed-form. Herding greedily picks x_{t+1} = argmax_x [ mu(x) -
// (1/t) sum_s k(x, x_s) ] over a grid (Chen, Welling & Smola 2010); the
// discrepancy readout is the exact MMD to the target embedding. Log-log error
// panel carries 1/n and 1/sqrt(n) guides.
//
// Bottom: the conformal slot rotation. Draw n+1 scores once — iid, MA(3),
// heavy-tailed, or adversarially trending — then rotate the "test" label
// through the slots. A placement is covered iff its score is at most the k-th
// smallest of the others, k = ceil((1-alpha)(n+1)); equivalently iff its rank
// is at most k, so exactly k of n+1 placements are covered for ANY scores.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, readouts } from "./lib/ui.js";

// ============================== herding panel ==============================
const H = 0.5, SIG = 1;                                  // kernel bandwidth, target sd
const kern = (a, b) => Math.exp(-((a - b) * (a - b)) / (2 * H * H));
// mean embedding of N(0, SIG^2) under the RBF kernel, and E k(X, X')
const muEmb = (x) => (H / Math.sqrt(H * H + SIG * SIG)) * Math.exp(-x * x / (2 * (H * H + SIG * SIG)));
const EKK = H / Math.sqrt(H * H + 2 * SIG * SIG);

const NGRID = 321;
const GRID = Array.from({ length: NGRID }, (_, i) => -4 + (8 * i) / (NGRID - 1));
const MUG = GRID.map(muEmb);

const hState = { n: 200 };
let hSeed = 11;

function runHerding(n) {
  const xs = [], mmd = [];
  const sumK = new Float64Array(NGRID);                  // sum_s k(grid, x_s)
  let S1 = 0, Smu = 0;                                   // sum_{i,j} k(x_i,x_j), sum_i mu(x_i)
  for (let t = 0; t < n; t++) {
    let best = 0, bestVal = -Infinity;
    for (let g = 0; g < NGRID; g++) {
      const v = MUG[g] - (t > 0 ? sumK[g] / t : 0);
      if (v > bestVal) { bestVal = v; best = g; }
    }
    const x = GRID[best];
    let rowSum = 0;
    for (const xi of xs) rowSum += kern(x, xi);
    S1 += 2 * rowSum + 1;                                // k(x,x) = 1
    Smu += muEmb(x);
    xs.push(x);
    for (let g = 0; g < NGRID; g++) sumK[g] += kern(GRID[g], x);
    const m = xs.length;
    mmd.push(Math.sqrt(Math.max(S1 / (m * m) - (2 * Smu) / m + EKK, 1e-18)));
  }
  return { xs, mmd };
}

function runMC(n, seed) {
  const rng = mulberry32(seed);
  const xs = [], mmd = [];
  let S1 = 0, Smu = 0;
  for (let t = 0; t < n; t++) {
    const x = randn(rng) * SIG;
    let rowSum = 0;
    for (const xi of xs) rowSum += kern(x, xi);
    S1 += 2 * rowSum + 1;
    Smu += muEmb(x);
    xs.push(x);
    const m = xs.length;
    mmd.push(Math.sqrt(Math.max(S1 / (m * m) - (2 * Smu) / m + EKK, 1e-18)));
  }
  return { xs, mmd };
}

const COL = { herd: "#1f4ed8", mc: "#c2410c" };
const pts = new Plot(document.getElementById("pts"), {
  xlim: [-4, 4], ylim: [0, 1], xlabel: "x", ylabel: "target density, and where the points land",
  margin: { l: 56, r: 16, t: 12, b: 40 },
});
const err = new Plot(document.getElementById("err"), {
  xlim: [0, 2.5], ylim: [-3, 0], xlabel: "log10 n", ylabel: "log10 discrepancy (MMD)",
  margin: { l: 62, r: 16, t: 12, b: 42 },
});
const setHRO = readouts(document.getElementById("herd-readouts"),
  ["points n", "herding MMD", "Monte Carlo MMD", "advantage"]);

function drawHerding() {
  const n = hState.n;
  const herd = runHerding(n);
  const mc = runMC(n, hSeed);

  // points panel: density curve + point strips
  const dmax = 1 / Math.sqrt(2 * Math.PI * SIG * SIG);
  pts.setLimits([-4, 4], [0, dmax * 1.35]);
  pts.clear("#fff"); pts.axes({ grid: true });
  const dx = GRID, dy = GRID.map(x => Math.exp(-x * x / (2 * SIG * SIG)) / Math.sqrt(2 * Math.PI * SIG * SIG));
  pts.line(dx, dy, { color: "rgba(0,0,0,0.5)", width: 1.6 });
  pts.points(herd.xs, herd.xs.map(() => dmax * 1.22), { color: COL.herd, radius: 2 });
  pts.text(-3.9, dmax * 1.27, "herded (balls placed to balance)", { color: COL.herd, baseline: "bottom" });
  pts.points(mc.xs, mc.xs.map(() => dmax * 1.08), { color: COL.mc, radius: 2 });
  pts.text(-3.9, dmax * 1.13, "i.i.d. (balls where they fell)", { color: COL.mc, baseline: "bottom" });

  // error panel, log-log with guides
  const lx = [], lh = [], lm = [];
  for (let t = 1; t < n; t++) {
    lx.push(Math.log10(t + 1));
    lh.push(Math.log10(herd.mmd[t]));
    lm.push(Math.log10(mc.mmd[t]));
  }
  const lo = Math.min(...lh, ...lm) - 0.3, hi = Math.max(...lh, ...lm) + 0.3;
  err.setLimits([Math.log10(2), Math.log10(n)], [lo, hi]);
  err.clear("#fff"); err.axes({ grid: true });
  // guides through the early Monte Carlo level
  const x0 = Math.log10(2), y0 = lm[0];
  err.line([x0, Math.log10(n)], [y0, y0 - (Math.log10(n) - x0)], { color: "rgba(31,78,216,0.35)", width: 1.2, dash: [5, 4] });
  err.line([x0, Math.log10(n)], [y0, y0 - 0.5 * (Math.log10(n) - x0)], { color: "rgba(194,65,12,0.35)", width: 1.2, dash: [5, 4] });
  err.line(lx, lh, { color: COL.herd, width: 2 });
  err.line(lx, lm, { color: COL.mc, width: 2 });
  err.legend([
    { label: "herding  (guide: slope −1)", color: COL.herd },
    { label: "Monte Carlo  (guide: slope −1/2)", color: COL.mc },
  ], { x: err.X(Math.log10(2)) + 8, y: err.Y(hi) + 8 });

  setHRO("points n", fmt(n, 0));
  setHRO("herding MMD", herd.mmd[n - 1].toExponential(2));
  setHRO("Monte Carlo MMD", mc.mmd[n - 1].toExponential(2));
  setHRO("advantage", `${fmt(mc.mmd[n - 1] / herd.mmd[n - 1], 1)}×`, "good");
}

const hCtrls = document.getElementById("herd-controls");
slider(hCtrls, { label: "number of points n", min: 40, max: 400, step: 20, value: hState.n, fmt: v => v.toFixed(0) },
  v => { hState.n = v; drawHerding(); });
button(hCtrls, "↻ redraw Monte Carlo", () => { hSeed = (hSeed * 1103515245 + 12345) & 0x7fffffff; drawHerding(); });

// ============================== slots panel ==============================
const sState = { n: 40, alpha: 0.1, dist: "iid", revealed: 0 };
let sSeed = 5;

const DISTS = {
  iid: "i.i.d. Gaussian",
  ma: "MA(3) dependent",
  heavy: "heavy-tailed",
  trend: "adversarial trend",
};

function drawScores() {
  const rng = mulberry32(sSeed);
  const m = sState.n + 1, s = new Float64Array(m);
  if (sState.dist === "iid") for (let i = 0; i < m; i++) s[i] = randn(rng);
  else if (sState.dist === "ma") {
    const W = new Float64Array(m + 3);
    for (let i = 0; i < W.length; i++) W[i] = randn(rng);
    for (let i = 0; i < m; i++) s[i] = (W[i] + W[i + 1] + W[i + 2] + W[i + 3]) / 2;
  } else if (sState.dist === "heavy") {
    for (let i = 0; i < m; i++) { const u = rng(); s[i] = randn(rng) / Math.sqrt(Math.max(u, 0.02)); }
  } else { // trend: drifting mean plus noise — flagrantly non-exchangeable
    for (let i = 0; i < m; i++) s[i] = 0.08 * i + 0.6 * randn(rng);
  }
  return s;
}

let scores = null, covered = null;
function recompute() {
  scores = drawScores();
  const m = scores.length, k = Math.ceil((1 - sState.alpha) * m);
  // covered[i] <=> rank of s_i among all m values <= k  (ties broken by index, immaterial for continuous draws)
  const order = Array.from({ length: m }, (_, i) => i).sort((a, b) => scores[a] - scores[b] || a - b);
  covered = new Array(m).fill(false);
  for (let r = 0; r < k; r++) covered[order[r]] = true;
  sState.revealed = 0;
}

const slots = new Plot(document.getElementById("slots"), {
  xlim: [0, 41], ylim: [-4, 4], xlabel: "slot (arrival order); the pointer sweeps the 'test' label", ylabel: "score",
  margin: { l: 56, r: 16, t: 14, b: 44 },
});
const setSRO = readouts(document.getElementById("slot-readouts"),
  ["k = ⌈(1−α)(n+1)⌉", "placements visited", "covered so far", "covered / (n+1), final", "distribution"]);

function drawSlots() {
  const m = scores.length, k = Math.ceil((1 - sState.alpha) * m);
  let lo = Math.min(...scores), hi = Math.max(...scores);
  const pad = 0.1 * (hi - lo || 1); lo -= pad; hi += pad;
  slots.setLimits([0, m + 1], [lo, hi]);
  slots.clear("#fff"); slots.axes({ grid: true });
  const R = sState.revealed;
  const base = Math.max(lo, Math.min(hi, 0));   // bars grow from zero when zero is in view
  for (let i = 0; i < m; i++) {
    const x = i + 1;
    const seen = i < R;
    const col = !seen ? "rgba(120,120,120,0.45)" : covered[i] ? "#15803d" : "#b91c1c";
    slots.line([x, x], [base, scores[i]], { color: col, width: 3 });
    slots.points([x], [scores[i]], { color: col, radius: 3 });
  }
  if (R > 0 && R <= m) {
    const i = R - 1, x = i + 1;
    // threshold for this placement: k-th smallest of the OTHERS
    const others = [];
    for (let j = 0; j < m; j++) if (j !== i) others.push(scores[j]);
    others.sort((a, b) => a - b);
    const thr = others[Math.min(k - 1, others.length - 1)];
    slots.hline(thr, { color: "rgba(0,0,0,0.5)", dash: [5, 4], width: 1.4 });
    slots.text(m, thr, " threshold for this placement", { color: "rgba(0,0,0,0.55)", align: "right", baseline: "bottom" });
    slots.vline(x, { color: "rgba(0,0,0,0.25)", width: 8 });
  }
  slots.legend([
    { label: "covered placement (rank ≤ k)", color: "#15803d" },
    { label: "uncovered placement", color: "#b91c1c" },
    { label: "not yet visited", color: "rgba(120,120,120,0.45)" },
  ], { x: slots.X(0) + 8, y: slots.Y(hi) + 8 });

  const nCov = covered.filter(Boolean).length;
  let covSoFar = 0;
  for (let i = 0; i < R; i++) if (covered[i]) covSoFar++;
  setSRO("k = ⌈(1−α)(n+1)⌉", `${k} of ${m}`);
  setSRO("placements visited", fmt(Math.min(R, m), 0));
  setSRO("covered so far", fmt(covSoFar, 0));
  setSRO("covered / (n+1), final", `${nCov}/${m} = ${pct(nCov / m, 1)} ≥ ${pct(1 - sState.alpha, 0)}`, "good");
  setSRO("distribution", DISTS[sState.dist]);
}

let spinning = false;
function spin() {
  if (spinning) return;
  spinning = true;
  sState.revealed = 0;
  const m = scores.length;
  const tick = () => {
    sState.revealed++;
    drawSlots();
    if (sState.revealed <= m) setTimeout(tick, Math.max(24, 900 / m));
    else spinning = false;
  };
  tick();
}

const sCtrls = document.getElementById("slot-controls");
const distRow = document.createElement("div"); distRow.className = "control";
const distBtns = {};
for (const key in DISTS) distBtns[key] = button(distRow, DISTS[key], () => {
  sState.dist = key; refreshDist(); recompute(); sState.revealed = scores.length + 1; drawSlots();
});
sCtrls.appendChild(distRow);
function refreshDist() {
  for (const key in distBtns) {
    const on = key === sState.dist, b = distBtns[key];
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
slider(sCtrls, { label: "calibration size n  (n+1 slots)", min: 19, max: 79, step: 10, value: sState.n, fmt: v => v.toFixed(0) },
  v => { sState.n = v; recompute(); sState.revealed = scores.length + 1; drawSlots(); });
slider(sCtrls, { label: "miscoverage α", min: 0.05, max: 0.3, step: 0.05, value: sState.alpha, fmt: v => v.toFixed(2) },
  v => { sState.alpha = v; recompute(); sState.revealed = scores.length + 1; drawSlots(); });
button(sCtrls, "↻ redraw scores", () => { sSeed = (sSeed * 1103515245 + 12345) & 0x7fffffff; recompute(); sState.revealed = scores.length + 1; drawSlots(); });
button(sCtrls, "▶ spin the pointer", spin);

refreshDist();
recompute();
sState.revealed = scores.length + 1; // start fully revealed; "spin" replays the sweep
autoResize(pts, drawHerding);
autoResize(err, () => {});
autoResize(slots, drawSlots);
drawHerding();
drawSlots();
