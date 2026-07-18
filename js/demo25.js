// Demo 25 — The coverage lottery (calibration-conditional coverage is a Beta draw).
// Two panels:
//  (1) M labs each run split conformal once on their own n calibration points.
//      Lab-level realized coverage is the k-th order statistic of n uniforms,
//      k = ceil((n+1)(1−α)), so across labs it is exactly Beta(k, n+1−k)
//      (Vovk 2012), whatever the score distribution.
//  (2) What that wobble costs: quote "miss insurance" at premium α+s and an
//      informed counterparty accepts only when your draw came up short
//      (true miss rate p > α+s). Expected concession per posted contract is
//      E[(p − α − s)+], computed in closed form from the Beta law and
//      cross-checked against the simulated labs.
import { mulberry32, linspace, histogram, betaPdf, betaCdf, betaInv, pct, clamp }
  from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const COL = {
  beta: "#1f4ed8",
  hist: "rgba(120,120,120,0.45)",
  target: "rgba(185,28,28,0.85)",
  short: "rgba(185,28,28,0.07)",
  mc: "#d97706",
  thresh: "rgba(21,128,61,0.7)",
};

const fan = new Plot(document.getElementById("fan"), {
  xlim: [0.65, 1], ylim: [0, 1], xlabel: "realized coverage of your band", ylabel: "density across calibration draws",
});
const cost = new Plot(document.getElementById("cost"), {
  xlim: [1, 5.3], ylim: [0, 1], xlabel: "calibration size n", ylabel: "concession, ¢ per $1 insured",
});
const grow = new Plot(document.getElementById("grow"), {
  xlim: [1, 4], ylim: [0.6, 1], xlabel: "points drawn so far, n", ylabel: "realized coverage",
});

const setFanRO = readouts(document.getElementById("readouts-fan"),
  ["stamped level 1−α", "middle 95% of draws", "P(short by >5 pts)", "n to pin ±1 pt"]);
const setCostRO = readouts(document.getElementById("readouts-cost"),
  ["edge conceded per $1", "quotes picked off", "n for edge < 0.1¢"]);

const ctrls = document.getElementById("controls");
let seed = 19;

const state = { nExp: 7, alpha: 0.1, spread: 0 };
const nOf = () => Math.round(2 ** state.nExp);
const kOf = (n, alpha) => Math.ceil((n + 1) * (1 - alpha));

// k-th smallest (1-indexed) via Hoare-partition quickselect; mutates a.
function kthSmallest(a, k) {
  let lo = 0, hi = a.length - 1;
  const target = k - 1;
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (target <= j) hi = j;
    else if (target >= i) lo = i;
    else return a[target];
  }
  return a[target];
}

// One lab = one calibration draw. Realized coverage is the k-th order
// statistic of n uniforms (distribution-free, so uniforms lose nothing).
function simulate(n, k, t) {
  const rng = mulberry32(seed);
  const M = clamp(Math.round(4e6 / n), 600, 4000);
  const covs = new Float64Array(M);
  const buf = new Float64Array(n);
  let edgeSum = 0, taken = 0;
  for (let m = 0; m < M; m++) {
    for (let i = 0; i < n; i++) buf[i] = rng();
    const c = kthSmallest(buf, k);
    covs[m] = c;
    const p = 1 - c;
    if (p > t) { taken++; edgeSum += p - t; }
  }
  return { covs, M, mcEdge: edgeSum / M, mcTaken: taken / M };
}

// E[(p − t)+] and P(p > t) for p = 1 − coverage ~ Beta(n+1−k, k).
function analyticEdge(n, alpha, s) {
  const k = kOf(n, alpha);
  if (k > n) return { edge: 0, pTrade: 0 };
  const a = n + 1 - k, b = k, mu = a / (n + 1), t = alpha + s;
  const tail = 1 - betaCdf(t, a, b);
  const tailA1 = 1 - betaCdf(t, a + 1, b);
  return { edge: Math.max(0, mu * tailA1 - t * tail), pTrade: tail };
}

// Smallest n whose middle-95% band of realized coverage sits within ±eps
// of the stamped level. Doubling search, then bisection.
function nToPin(alpha, eps) {
  const target = 1 - alpha;
  const ok = (n) => {
    const k = kOf(n, alpha);
    if (k > n) return false;
    const a = k, b = n + 1 - k;
    return betaInv(0.025, a, b) >= target - eps && betaInv(0.975, a, b) <= target + eps;
  };
  let hi = 64;
  while (!ok(hi)) { hi *= 2; if (hi > 2e6) return Infinity; }
  let lo = hi / 2;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

// Smallest n whose analytic concession drops below `cap` (fraction of notional).
function nForEdgeBelow(alpha, s, cap) {
  const ok = (n) => analyticEdge(n, alpha, s).edge < cap && kOf(n, alpha) <= n;
  let hi = 32;
  while (!ok(hi)) { hi *= 2; if (hi > 2e6) return Infinity; }
  let lo = Math.max(1, hi / 2);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

const fmtN = (n) => (isFinite(n) ? n.toLocaleString("en-US") : ">2M");

function draw() {
  const n = nOf(), alpha = state.alpha, s = state.spread;
  const k = kOf(n, alpha);
  const target = 1 - alpha;
  const degenerate = k > n;

  // ===== fan panel =====
  const xlo = Math.max(0, target - 0.25);
  fan.setLimits([xlo, 1], [0, 1]);
  fan.clear("#fff");

  setFanRO("stamped level 1−α", pct(target, 0));

  if (degenerate) {
    fan.axes({ grid: true, xfmt: (v) => v.toFixed(2) });
    fan.text(xlo + (1 - xlo) / 2, 0.55,
      "n < 1/α − 1: the finite-sample correction exceeds n,", { align: "center" });
    fan.text(xlo + (1 - xlo) / 2, 0.45,
      "the band is the whole line, coverage 100% by vacuity.", { align: "center" });
    setFanRO("middle 95% of draws", "100% – 100%");
    setFanRO("P(short by >5 pts)", pct(0, 1), "good");
  } else {
    const a = k, b = n + 1 - k;
    const sd = Math.sqrt((a * b) / ((n + 1) ** 2 * (n + 2)));
    const xs = linspace(xlo, 1, 500);
    const dens = xs.map((x) => betaPdf(x, a, b));

    const sim = simulate(n, k, alpha + s);
    const nb = clamp(Math.round((1 - xlo) / (sd / 3)), 40, 200);
    const hist = histogram(Array.from(sim.covs), nb, xlo, 1);

    const ymax = 1.12 * Math.max(...dens, ...hist.density);
    fan.setLimits([xlo, 1], [0, ymax]);
    fan.axes({ grid: true, xfmt: (v) => v.toFixed(2) });
    fan.vspan(xlo, target - 0.05, { color: COL.short });
    fan.bars(hist.centers, hist.density, hist.width, { color: COL.hist });
    fan.line(xs, dens, { color: COL.beta, width: 2 });
    fan.vline(target, { color: COL.target, dash: [5, 4], width: 1.5 });
    fan.legend([
      { label: sim.M.toLocaleString("en-US") + " labs, one draw each", color: COL.hist },
      { label: "Beta(k, n+1−k), exact", color: COL.beta },
      { label: "stamped level 1−α", color: COL.target, dash: [5, 4] },
    ], { x: fan.X(xlo) + 8, y: fan.Y(ymax) + 8 });

    const qlo = betaInv(0.025, a, b), qhi = betaInv(0.975, a, b);
    setFanRO("middle 95% of draws", pct(qlo, 1) + " – " + pct(qhi, 1),
      qlo < target - 0.03 ? "warn" : "good");
    const pShort = betaCdf(target - 0.05, a, b);
    setFanRO("P(short by >5 pts)",
      pct(pShort, pShort < 0.001 ? 2 : 1),
      pShort > 0.1 ? "bad" : pShort > 0.01 ? "warn" : "good");

    // ===== cost panel: MC dot at the current n =====
    var mcDot = { x: Math.log10(n), y: 100 * sim.mcEdge };
  }
  setFanRO("n to pin ±1 pt", fmtN(nToPin(alpha, 0.01)));

  // ===== cost panel =====
  const exps = linspace(1, 5.3, 90);
  const edges = exps.map((e) => 100 * analyticEdge(Math.round(10 ** e), alpha, s).edge);
  const ymaxC = Math.max(0.2, 1.15 * Math.max(...edges));
  cost.setLimits([1, 5.3], [0, ymaxC]);
  cost.clear("#fff");
  const XL = { 1: "10", 2: "100", 3: "1k", 4: "10k", 5: "100k" };
  cost.axes({ grid: true, xticks: [1, 2, 3, 4, 5], xfmt: (v) => XL[v] || "" });
  cost.hline(0.1, { color: COL.thresh, dash: [4, 4], width: 1, label: "0.1¢" });
  cost.line(exps, edges, { color: COL.beta, width: 2 });
  cost.vline(Math.log10(n), { color: "rgba(0,0,0,0.35)", dash: [3, 4], width: 1 });
  if (!degenerate && typeof mcDot !== "undefined") {
    cost.points([mcDot.x], [mcDot.y], { color: COL.mc, radius: 4.5 });
  }
  cost.legend([
    { label: "E[(p − α − s)+], exact", color: COL.beta },
    { label: "simulated labs at this n", color: COL.mc },
  ]);

  const ae = analyticEdge(n, alpha, s);
  setCostRO("edge conceded per $1",
    degenerate ? "0¢ (nothing sold)" : (100 * ae.edge).toFixed(2) + "¢",
    ae.edge > 0.01 ? "bad" : ae.edge > 0.001 ? "warn" : "good");
  setCostRO("quotes picked off", pct(ae.pTrade, 1));
  setCostRO("n for edge < 0.1¢", fmtN(nForEdgeBelow(alpha, s, 0.001)));
}

// ===== the growth panel: eight labs accumulate one calibration set each =====
// Grid of n values doubling every second step (…, 20, 28, 40, 57, 80, …), so a
// constant animation pace per grid step reads as "twenty points, then forty".
const NMAX = 10000, NLABS = 8;
const NGRID = [];
{
  let v = 10;
  while (Math.round(v) <= NMAX) { NGRID.push(Math.round(v)); v *= Math.SQRT2; }
  if (NGRID[NGRID.length - 1] !== NMAX) NGRID.push(NMAX);
}

let labSeed = 7;
let growth = null;          // cached paths + envelope for the current α
let growUpto = NGRID.length - 1;
let animId = null;

function buildGrowth(alpha) {
  const rng = mulberry32(labSeed);
  const paths = [];
  for (let l = 0; l < NLABS; l++) {
    // one lab = one growing calibration set: later stages keep the early points
    const u = new Float64Array(NMAX);
    for (let i = 0; i < NMAX; i++) u[i] = rng();
    const row = new Float64Array(NGRID.length);
    for (let g = 0; g < NGRID.length; g++) {
      const n = NGRID[g], k = kOf(n, alpha);
      row[g] = k > n ? 1 : kthSmallest(u.slice(0, n), k);
    }
    paths.push(row);
  }
  const env = { q025: [], q25: [], q75: [], q975: [] };
  for (const n of NGRID) {
    const k = kOf(n, alpha);
    if (k > n) { env.q025.push(1); env.q25.push(1); env.q75.push(1); env.q975.push(1); continue; }
    const a = k, b = n + 1 - k;
    env.q025.push(betaInv(0.025, a, b)); env.q25.push(betaInv(0.25, a, b));
    env.q75.push(betaInv(0.75, a, b)); env.q975.push(betaInv(0.975, a, b));
  }
  return { paths, env };
}

function drawGrow() {
  if (!growth) growth = buildGrowth(state.alpha);
  const target = 1 - state.alpha;
  const ylo = Math.max(0.35, target - 0.3);
  const xs = NGRID.map((n) => Math.log10(n));
  grow.setLimits([1, 4], [ylo, 1.005]);
  grow.clear("#fff");
  const XL = { 1: "10", 2: "100", 3: "1k", 4: "10k" };
  grow.axes({ grid: true, xticks: [1, 2, 3, 4], xfmt: (v) => XL[v] || "" });
  grow.band(xs, growth.env.q025, growth.env.q975, { color: "rgba(31,78,216,0.10)" });
  grow.band(xs, growth.env.q25, growth.env.q75, { color: "rgba(31,78,216,0.16)" });
  grow.hline(target, { color: COL.target, dash: [5, 4], width: 1.2 });
  const upx = xs.slice(0, growUpto + 1);
  for (let l = NLABS - 1; l >= 0; l--) {
    grow.line(upx, Array.from(growth.paths[l]).slice(0, growUpto + 1),
      { color: l === 0 ? COL.mc : "rgba(100,100,100,0.4)", width: l === 0 ? 2.2 : 1.2 });
  }
  grow.legend([
    { label: "middle 95% of draws", color: "rgba(31,78,216,0.22)" },
    { label: "middle 50%", color: "rgba(31,78,216,0.4)" },
    { label: "your lab", color: COL.mc },
    { label: "seven other labs", color: "rgba(100,100,100,0.5)" },
  ]);
  grow.text(1.05, ylo + 0.03, "n = " + NGRID[growUpto].toLocaleString("en-US"),
    { color: "rgba(0,0,0,0.6)" });
}

function playGrow() {
  if (animId) cancelAnimationFrame(animId);
  const T = 9000;
  let t0 = null;
  const step = (ts) => {
    if (t0 === null) t0 = ts;
    const f = Math.min(1, (ts - t0) / T);
    growUpto = Math.max(1, Math.round(f * (NGRID.length - 1)));
    drawGrow();
    if (f < 1) animId = requestAnimationFrame(step);
    else animId = null;
  };
  animId = requestAnimationFrame(step);
}

slider(ctrls, { label: "calibration size n", min: 4, max: 13, step: 1, value: state.nExp, fmt: (v) => String(Math.round(2 ** v)) },
  (v) => { state.nExp = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.25, step: 0.05, value: state.alpha, fmt: (v) => v.toFixed(2) },
  (v) => { state.alpha = v; growth = null; draw(); drawGrow(); });
slider(ctrls, { label: "spread s over fair premium", min: 0, max: 0.05, step: 0.005, value: state.spread, fmt: (v) => pct(v, 1) },
  (v) => { state.spread = v; draw(); });
button(ctrls, "↻ new draw of labs", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

const gctrls = document.getElementById("controls-grow");
button(gctrls, "▶ draw 20, 40, 80, … points", playGrow);
button(gctrls, "↻ new labs", () => { labSeed = (labSeed * 1103515245 + 12345) & 0x7fffffff; growth = null; growUpto = NGRID.length - 1; drawGrow(); });

autoResize(fan, draw);
autoResize(cost, draw);
autoResize(grow, drawGrow);
draw();
drawGrow();
