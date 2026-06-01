// Demo 01 — How split conformal works.
import { mulberry32, sampleNormal, linspace, polyfit, polyval, conformalQuantile,
  coverage, histogram, quantile, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 4], ylim: [-1, 7], xlabel: "x", ylabel: "y",
});
const hist = new Plot(document.getElementById("hist"), {
  xlim: [0, 3], ylim: [0, 2], xlabel: "nonconformity score  |y − μ̂(x)|", ylabel: "density",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "empirical coverage", "band half-width q", "calibration n"]);

const ctrls = document.getElementById("controls");
let seed = 7;

const state = {
  alpha: 0.1,
  n: 240,
  sigma: 0.6,
};

const truth = (x) => Math.sin(x * 1.3) * 2 + 3;

function simulate() {
  const rng = mulberry32(seed);
  const N = state.n;
  // generate
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 4;
    xs.push(x);
    ys.push(truth(x) + sampleNormal(rng, 0, state.sigma));
  }
  // split: 40% train, 30% calibration, 30% test
  const idx = [...Array(N).keys()];
  const nTr = Math.floor(N * 0.4), nCal = Math.floor(N * 0.3);
  const trI = idx.slice(0, nTr), calI = idx.slice(nTr, nTr + nCal), teI = idx.slice(nTr + nCal);
  const coef = polyfit(trI.map(i => xs[i]), trI.map(i => ys[i]), 3);
  const muHat = (x) => polyval(coef, x);
  // calibration scores
  const scores = calI.map(i => Math.abs(ys[i] - muHat(xs[i])));
  const q = conformalQuantile(scores, state.alpha);
  // test coverage
  const teX = teI.map(i => xs[i]), teY = teI.map(i => ys[i]);
  const lo = teX.map(x => muHat(x) - q), hi = teX.map(x => muHat(x) + q);
  const cov = coverage(lo, hi, teY);
  return { xs, ys, trI, calI, teI, muHat, scores, q, teX, teY, cov, nCal };
}

function draw() {
  const S = simulate();
  // ---- main panel ----
  main.clear("#fff");
  main.axes({ grid: true });
  // band
  const gx = linspace(0, 4, 120);
  const glo = gx.map(x => S.muHat(x) - S.q);
  const ghi = gx.map(x => S.muHat(x) + S.q);
  main.band(gx, glo, ghi, { color: "rgba(31,78,216,0.13)" });
  // calibration + test points
  main.points(S.calI.map(i => S.xs[i]), S.calI.map(i => S.ys[i]), { color: "rgba(160,160,160,0.55)", radius: 2.2 });
  const covered = [], missed = [];
  for (let k = 0; k < S.teX.length; k++) {
    const inside = S.teY[k] >= S.muHat(S.teX[k]) - S.q && S.teY[k] <= S.muHat(S.teX[k]) + S.q;
    (inside ? covered : missed).push(k);
  }
  main.points(covered.map(k => S.teX[k]), covered.map(k => S.teY[k]), { color: "rgba(21,128,61,0.8)", radius: 2.8 });
  main.points(missed.map(k => S.teX[k]), missed.map(k => S.teY[k]), { color: "rgba(185,28,28,0.95)", radius: 3.2 });
  // fitted mean
  main.line(gx, gx.map(x => S.muHat(x)), { color: "#1f4ed8", width: 2 });
  main.legend([
    { label: "μ̂(x)", color: "#1f4ed8" },
    { label: "conformal band", color: "rgba(31,78,216,0.4)" },
    { label: "test, covered", color: "rgba(21,128,61,0.85)" },
    { label: "test, missed", color: "rgba(185,28,28,0.95)" },
  ], { x: main.X(0) + 8, y: main.Y(7) + 8 });

  // ---- histogram panel ----
  const hmax = Math.max(3, Math.ceil(Math.max(...S.scores)));
  hist.setLimits([0, hmax], null);
  const H = histogram(S.scores, 24, 0, hmax);
  const peak = Math.max(...H.density, 0.5);
  hist.setLimits([0, hmax], [0, peak * 1.15]);
  hist.clear("#fff");
  hist.axes({ grid: true });
  hist.bars(H.centers, H.density, H.width, { color: "rgba(31,78,216,0.45)", stroke: "rgba(31,78,216,0.7)" });
  if (isFinite(S.q)) hist.vline(S.q, { color: "var(--warn)", dash: [6, 4], width: 2 });
  hist.text(Math.min(S.q, hmax * 0.98), peak * 1.08, "q", { color: "#c2410c", align: "center" });

  // ---- readouts ----
  setRO("target 1−α", pct(1 - state.alpha, 0));
  const covCls = Math.abs(S.cov - (1 - state.alpha)) < 0.06 ? "good" : "warn";
  setRO("empirical coverage", pct(S.cov, 1), covCls);
  setRO("band half-width q", isFinite(S.q) ? fmt(S.q, 2) : "∞");
  setRO("calibration n", String(S.nCal));
}

// controls
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "sample size N", min: 60, max: 1200, step: 20, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
slider(ctrls, { label: "noise σ", min: 0.1, max: 1.5, step: 0.05, value: state.sigma, fmt: v => v.toFixed(2) },
  v => { state.sigma = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(hist, () => {});
draw();
