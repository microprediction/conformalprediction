// Demo 02 — Marginal vs. conditional coverage (the central demo).
import { mulberry32, sampleNormal, linspace, polyfit, polyval, conformalQuantile,
  coverage, clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 4], ylim: [-2, 8], xlabel: "x", ylabel: "y",
});
const cov = new Plot(document.getElementById("cov"), {
  xlim: [0, 4], ylim: [0, 1], xlabel: "x", ylabel: "local coverage",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "marginal coverage", "local coverage in window", "window center xc"]);

const ctrls = document.getElementById("controls");
let seed = 11;

const state = {
  xc: 0.8,      // window center
  alpha: 0.1,   // miscoverage
  hetero: 0.6,  // heteroscedasticity strength
  n: 600,
};

const HALF = 0.4; // window half-width
const NBINS = 12;

const truth = (x) => Math.sin(x * 1.3) * 2 + 3;
const sigmaX = (x) => 0.15 + state.hetero * x;

function simulate() {
  const rng = mulberry32(seed);
  const N = state.n;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 4;
    xs.push(x);
    ys.push(truth(x) + sampleNormal(rng, 0, sigmaX(x)));
  }
  // split: 40% train, 30% calibration, 30% test
  const idx = [...Array(N).keys()];
  const nTr = Math.floor(N * 0.4), nCal = Math.floor(N * 0.3);
  const trI = idx.slice(0, nTr), calI = idx.slice(nTr, nTr + nCal), teI = idx.slice(nTr + nCal);
  const coef = polyfit(trI.map(i => xs[i]), trI.map(i => ys[i]), 3);
  const muHat = (x) => polyval(coef, x);
  // calibration scores -> constant band half-width q
  const scores = calI.map(i => Math.abs(ys[i] - muHat(xs[i])));
  const q = conformalQuantile(scores, state.alpha);
  // test set
  const teX = teI.map(i => xs[i]), teY = teI.map(i => ys[i]);
  const lo = teX.map(x => muHat(x) - q), hi = teX.map(x => muHat(x) + q);
  const marginal = coverage(lo, hi, teY);
  const inside = teX.map((x, k) => teY[k] >= lo[k] && teY[k] <= hi[k]);

  // per-bin local coverage
  const edges = linspace(0, 4, NBINS + 1);
  const w = 4 / NBINS;
  const binCenters = [], binCov = [], binCount = [];
  for (let b = 0; b < NBINS; b++) {
    const c0 = edges[b], c1 = edges[b + 1];
    let n = 0, c = 0;
    for (let k = 0; k < teX.length; k++) {
      if (teX[k] >= c0 && (b === NBINS - 1 ? teX[k] <= c1 : teX[k] < c1)) {
        n++; if (inside[k]) c++;
      }
    }
    binCenters.push((c0 + c1) / 2);
    binCount.push(n);
    binCov.push(n > 0 ? c / n : NaN);
  }

  // local coverage inside the selection window
  const wa = state.xc - HALF, wb = state.xc + HALF;
  let wn = 0, wc = 0;
  for (let k = 0; k < teX.length; k++) {
    if (teX[k] >= wa && teX[k] <= wb) { wn++; if (inside[k]) wc++; }
  }
  const winCov = wn > 0 ? wc / wn : NaN;

  return { xs, ys, calI, muHat, q, teX, teY, inside, marginal,
    binCenters, binCov, binCount, w, wa, wb, winCov, wn };
}

function covClass(c) {
  const target = 1 - state.alpha;
  if (!isFinite(c)) return "";
  const d = c - target;
  if (Math.abs(d) <= 0.05) return "good";
  if (Math.abs(d) <= 0.12) return "warn";
  return "bad";
}

function draw() {
  const S = simulate();
  const gx = linspace(0, 4, 160);

  // ---- main panel ----
  main.clear("#fff");
  main.axes({ grid: true });
  // selection window first (behind everything)
  main.vspan(S.wa, S.wb, { color: "rgba(255,193,7,0.16)" });
  // constant-width conformal band
  const glo = gx.map(x => S.muHat(x) - S.q);
  const ghi = gx.map(x => S.muHat(x) + S.q);
  main.band(gx, glo, ghi, { color: "rgba(31,78,216,0.12)" });
  // faint calibration points
  main.points(S.calI.map(i => S.xs[i]), S.calI.map(i => S.ys[i]),
    { color: "rgba(160,160,160,0.45)", radius: 2.0 });
  // test points: covered green / missed red
  const cvX = [], cvY = [], msX = [], msY = [];
  for (let k = 0; k < S.teX.length; k++) {
    if (S.inside[k]) { cvX.push(S.teX[k]); cvY.push(S.teY[k]); }
    else { msX.push(S.teX[k]); msY.push(S.teY[k]); }
  }
  main.points(cvX, cvY, { color: "rgba(21,128,61,0.78)", radius: 2.6 });
  main.points(msX, msY, { color: "rgba(185,28,28,0.95)", radius: 3.0 });
  // fitted mean
  main.line(gx, gx.map(x => S.muHat(x)), { color: "#1f4ed8", width: 2 });
  main.legend([
    { label: "μ̂(x)", color: "#1f4ed8" },
    { label: "constant band", color: "rgba(31,78,216,0.4)" },
    { label: "covered", color: "rgba(21,128,61,0.85)" },
    { label: "missed", color: "rgba(185,28,28,0.95)" },
    { label: "window", color: "rgba(255,193,7,0.5)" },
  ], { x: main.X(0) + 8, y: main.Y(8) + 8 });

  // ---- local coverage panel ----
  cov.clear("#fff");
  cov.axes({ grid: true });
  cov.vspan(S.wa, S.wb, { color: "rgba(255,193,7,0.16)" });
  // per-bin coverage as bars
  const heights = S.binCov.map(c => isFinite(c) ? c : 0);
  cov.bars(S.binCenters, heights, S.w * 0.9,
    { color: "rgba(31,78,216,0.35)", stroke: "rgba(31,78,216,0.6)", base: 0 });
  // connecting line through bin coverage
  cov.line(S.binCenters, S.binCov, { color: "#1f4ed8", width: 2 });
  cov.points(S.binCenters, S.binCov, { color: "#1f4ed8", radius: 3 });
  // target reference
  cov.hline(1 - state.alpha, { color: "var(--bad)", dash: [6, 4], width: 1.8,
    label: "target 1−α" });
  cov.legend([
    { label: "per-bin coverage", color: "#1f4ed8" },
    { label: "target 1−α", color: "#b91c1c", dash: [6, 4] },
  ], { x: cov.X(0) + 8, y: cov.Y(1) + 8 });

  // ---- readouts ----
  const target = 1 - state.alpha;
  setRO("target 1−α", pct(target, 0));
  const margCls = Math.abs(S.marginal - target) < 0.04 ? "good" : "warn";
  setRO("marginal coverage", pct(S.marginal, 1), margCls);
  setRO("local coverage in window",
    isFinite(S.winCov) ? `${pct(S.winCov, 1)} (n=${S.wn})` : "no points",
    covClass(S.winCov));
  setRO("window center xc", fmt(state.xc, 2));
}

// ---- controls ----
slider(ctrls, { label: "window center xc", min: 0.4, max: 3.6, step: 0.05, value: state.xc,
  fmt: v => v.toFixed(2) }, v => { state.xc = clamp(v, 0.4, 3.6); draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha,
  fmt: v => v.toFixed(2) }, v => { state.alpha = v; draw(); });
slider(ctrls, { label: "heteroscedasticity", min: 0, max: 1.0, step: 0.05, value: state.hetero,
  fmt: v => v.toFixed(2) }, v => { state.hetero = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(cov, () => {});
draw();
