// Demo 09 — Adaptive prediction sets: the set is the deliverable.
// Conformal classification (least-ambiguous / LAC). The marginal guarantee is the
// whole point here, and the *size* of the set is an honest per-input confidence signal:
// a singleton where the input is easy, several labels where it is genuinely ambiguous.
import { mulberry32, sampleNormal, linspace, normPdf, conformalQuantile, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const CLASS_COLORS = ["#1f4ed8", "#15803d", "#c2410c"];
const CLASS_NAMES = ["A", "B", "C"];

const main = new Plot(document.getElementById("main"), {
  xlim: [-5, 5], ylim: [0, 1.08], xlabel: "feature x", ylabel: "posterior  p(class | x)",
});
const sizes = new Plot(document.getElementById("sizes"), {
  xlim: [-0.6, 3.6], ylim: [0, 1], xlabel: "prediction-set size", ylabel: "fraction of inputs",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "empirical coverage", "mean set size", "singletons"]);

const ctrls = document.getElementById("controls");
let seed = 11;

const state = { alpha: 0.1, sigma: 1.0, n: 900 };
const CENTERS = [-1.8, 0, 1.8];

function posterior(x, sigma) {
  const w = CENTERS.map(c => normPdf(x, c, sigma));
  const Z = w[0] + w[1] + w[2];
  return w.map(v => v / Z);
}

function simulate() {
  const rng = mulberry32(seed);
  const N = state.n, sg = state.sigma;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const k = Math.floor(rng() * 3);
    xs.push(sampleNormal(rng, CENTERS[k], sg));
    ys.push(k);
  }
  // 50% calibration, 50% test
  const half = Math.floor(N / 2);
  const calI = [...Array(half).keys()];
  const teI = [...Array(N).keys()].slice(half);
  // LAC nonconformity score: 1 - p_{true class}(x)
  const scores = calI.map(i => 1 - posterior(xs[i], sg)[ys[i]]);
  const q = conformalQuantile(scores, state.alpha);
  const thresh = isFinite(q) ? 1 - q : -Infinity; // label in set if p_k(x) >= 1 - q
  // evaluate on test
  const sizeCount = [0, 0, 0, 0];
  let covered = 0;
  for (const i of teI) {
    const p = posterior(xs[i], sg);
    let sz = 0;
    for (let k = 0; k < 3; k++) if (p[k] >= thresh) sz++;
    sizeCount[Math.min(sz, 3)]++;
    if (p[ys[i]] >= thresh) covered++;
  }
  const nTe = teI.length;
  const meanSize = (sizeCount[1] * 1 + sizeCount[2] * 2 + sizeCount[3] * 3) / nTe;
  return { xs, ys, calI, teI, sg, q, thresh,
    cov: covered / nTe, sizeFrac: sizeCount.map(c => c / nTe), meanSize };
}

const SIZE_COLORS = ["#b91c1c", "#15803d", "#d97706", "#b91c1c"]; // 0=miss,1=confident,2=ambiguous,3=very

function draw() {
  const S = simulate();

  // ---- main panel: posterior curves + threshold ----
  const lo = CENTERS[0] - 3.2 * S.sg, hi = CENTERS[2] + 3.2 * S.sg;
  main.setLimits([lo, hi], [0, 1.08]);
  main.clear("#fff");
  main.axes({ grid: true });
  const gx = linspace(lo, hi, 260);
  for (let k = 0; k < 3; k++) {
    main.line(gx, gx.map(x => posterior(x, S.sg)[k]), { color: CLASS_COLORS[k], width: 2 });
  }
  if (isFinite(S.thresh) && S.thresh > 0) {
    main.hline(S.thresh, { color: "var(--warn)", dash: [6, 4], width: 2 });
    main.text(hi, S.thresh + 0.015, "1 − q", { color: "#c2410c", align: "right" });
  }
  // rug of test points along the bottom, coloured by true class
  for (const i of S.teI) {
    const yk = 0.02 + S.ys[i] * 0.018;
    main.points([S.xs[i]], [yk], { color: CLASS_COLORS[S.ys[i]], radius: 1.5, alpha: 0.5 });
  }
  main.legend([
    { label: "p(A | x)", color: CLASS_COLORS[0] },
    { label: "p(B | x)", color: CLASS_COLORS[1] },
    { label: "p(C | x)", color: CLASS_COLORS[2] },
    { label: "threshold 1−q", color: "var(--warn)", dash: [6, 4] },
  ], { x: main.X(lo) + 8, y: main.Y(1.08) + 8 });

  // ---- sizes panel ----
  sizes.clear("#fff");
  sizes.axes({ grid: true });
  for (let s = 0; s <= 3; s++) {
    sizes.bars([s], [S.sizeFrac[s]], 0.7, { color: SIZE_COLORS[s], stroke: "rgba(0,0,0,0.15)" });
    if (S.sizeFrac[s] > 0.01) {
      sizes.text(s, S.sizeFrac[s] + 0.03, pct(S.sizeFrac[s], 0), { align: "center", color: "rgba(0,0,0,0.65)" });
    }
  }

  // ---- readouts ----
  setRO("target 1−α", pct(1 - state.alpha, 0));
  setRO("empirical coverage", pct(S.cov, 1), S.cov >= 1 - state.alpha - 0.02 ? "good" : "warn");
  setRO("mean set size", fmt(S.meanSize, 2));
  setRO("singletons", pct(S.sizeFrac[1], 0));
}

slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "class overlap σ", min: 0.5, max: 2.0, step: 0.05, value: state.sigma, fmt: v => v.toFixed(2) },
  v => { state.sigma = v; draw(); });
slider(ctrls, { label: "sample size N", min: 200, max: 2400, step: 50, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(sizes, () => {});
draw();
