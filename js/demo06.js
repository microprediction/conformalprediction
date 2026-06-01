// Demo 06 — Conformal vs. recalibration: the fair steelman.
//
// An OVERCONFIDENT base model claims N(0, sigmaModel) with sigmaModel = sigmaTrue/overconf.
// We compare three treatments on the SAME test set:
//   RAW           — the base density as-is (too narrow): U-shaped PIT, low log-score,
//                   central-interval coverage below target.
//   CONFORMAL     — nonconformity |y|, band [−q, +q], q = conformalQuantile(scores_cal, α).
//                   Hits marginal coverage ≈ 1−α exactly. As a predictive *system* it just
//                   re-levels the base residual shape to a SET — it returns no fitted density,
//                   and its implied density is not optimized for the score you report.
//   RECALIBRATED  — variance recalibration fit to the proper (log) score. With correct mean,
//                   the maximizer is sigmaStar = sqrt(mean(y_cal^2)). PIT → ~uniform, log-score
//                   → near-optimal, and you get back a full density you can integrate and decide
//                   with. This is the practical analogue of Kuleshov et al. (2018).
//
// The honest concession: conformal's unique edge is a finite-sample, distribution-free coverage
// guarantee — the right tool only when the guarantee itself is the deliverable.
import { mulberry32, sampleNormal, linspace, conformalQuantile, coverage,
  histogram, normPdf, normInv, meanLogScoreNormal, pitNormal, mean, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const N = 3000;
const SIGMA_TRUE = 1;

// ---- panels ----
const main = new Plot(document.getElementById("main"), {
  xlim: [-4, 4], ylim: [0, 0.6], xlabel: "outcome  y", ylabel: "density",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});
const pitRaw = new Plot(document.getElementById("pitRaw"), {
  xlim: [0, 1], ylim: [0, 2.4], xlabel: "PIT  F(y)  —  RAW", ylabel: "density",
  margin: { l: 48, r: 12, t: 14, b: 44 },
});
const pitCal = new Plot(document.getElementById("pitCal"), {
  xlim: [0, 1], ylim: [0, 2.4], xlabel: "PIT  F(y)  —  RECALIBRATED", ylabel: "density",
  margin: { l: 48, r: 12, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["log-score: raw", "log-score: conformal-implied", "log-score: recalibrated",
   "coverage: raw", "coverage: conformal", "coverage: recalibrated", "returns a density?"]);

const ctrls = document.getElementById("controls");
let seed = 20260601;

const state = {
  overconf: 1.8,
  alpha: 0.1,
  highlight: "recal", // "raw" | "conformal" | "recal"
};

// Outcomes depend only on the seed.
function drawSample() {
  const rng = mulberry32(seed);
  const y = new Array(N);
  for (let i = 0; i < N; i++) y[i] = sampleNormal(rng, 0, SIGMA_TRUE);
  return y;
}
let yAll = drawSample();

// Mean log-score of the conformal-IMPLIED predictive system. The split-conformal
// predictive distribution built from absolute-residual scores |y| (μ̂≡0) is symmetric
// with CDF on the half-line given by the empirical |y| quantiles: it places probability
// mass ±s_(k) at the calibration order statistics. We turn that step-CDF into a piecewise
// density and score the test outcomes under it — the base residual SHAPE, re-leveled, NOT a
// density fit to the score. We score it the same way a forecaster would integrate it.
function conformalImpliedLogScore(scoresCal, yTest) {
  const s = scoresCal.slice().sort((a, b) => a - b);
  const m = s.length;
  // Symmetric density implied by the empirical |residual| distribution G:
  //   for the half-line, P(|Y| ≤ t) = G(t); density of |Y| is g(t); by symmetry the
  //   density of Y at y is 0.5 * g(|y|). Estimate g via spacing of order statistics.
  // Build a monotone CDF support 0..s_(m-1) and finite-difference it on a grid.
  const half = (t) => {
    if (t <= 0) return Infinity;            // mass concentrated near 0 if residuals tiny
    if (t >= s[m - 1]) return s[m - 1] === s[0] ? 1e-300 : NaN;
    // locate bracketing order statistics
    let lo = 0, hi = m - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= t) lo = mid; else hi = mid;
    }
    const dt = s[hi] - s[lo];
    if (dt <= 0) return 1e-300;
    // each consecutive pair carries probability 1/(m-1) of |Y|
    return (1 / (m - 1)) / dt;
  };
  let acc = 0;
  for (let i = 0; i < yTest.length; i++) {
    const g = half(Math.abs(yTest[i]));
    const dens = isFinite(g) ? 0.5 * g : 1e-300; // tail / out-of-support → floor
    acc += Math.log(Math.max(dens, 1e-300));
  }
  return acc / yTest.length;
}

function simulate() {
  const sigmaModel = SIGMA_TRUE / state.overconf;
  // split: half calibration, half test
  const nCal = Math.floor(N / 2);
  const yCal = yAll.slice(0, nCal);
  const yTest = yAll.slice(nCal);

  // (1) RAW — base density N(0, sigmaModel)
  const lsRaw = meanLogScoreNormal(yTest, 0, sigmaModel);
  const pitRawVals = pitNormal(yTest, 0, sigmaModel);
  // central (1−α) interval of the RAW forecast
  const zRaw = normInv(1 - state.alpha / 2, 0, sigmaModel);
  const covRaw = coverage(yTest.map(() => -zRaw), yTest.map(() => zRaw), yTest);

  // (2) CONFORMAL — nonconformity |y| (μ̂≡0); band [−q, +q]
  const scoresCal = yCal.map(Math.abs);
  const q = conformalQuantile(scoresCal, state.alpha);
  const covConf = coverage(yTest.map(() => -q), yTest.map(() => q), yTest);
  const lsConf = conformalImpliedLogScore(scoresCal, yTest);

  // (3) RECALIBRATED — variance recalibration fit to the proper score.
  // For Gaussian with correct mean, the log-score maximizer is sqrt(mean(y_cal^2)).
  const sigmaStar = Math.sqrt(mean(yCal.map(v => v * v)));
  const lsRecal = meanLogScoreNormal(yTest, 0, sigmaStar);
  const pitCalVals = pitNormal(yTest, 0, sigmaStar);
  const zRecal = normInv(1 - state.alpha / 2, 0, sigmaStar);
  const covRecal = coverage(yTest.map(() => -zRecal), yTest.map(() => zRecal), yTest);

  return {
    sigmaModel, sigmaStar, q, nCal, yTest,
    lsRaw, lsConf, lsRecal,
    covRaw, covConf, covRecal,
    pitRawVals, pitCalVals, zRaw, zRecal,
  };
}

function drawPit(plot, vals, label) {
  const H = histogram(vals, 20, 0, 1);
  plot.setLimits([0, 1], [0, 2.4]);
  plot.clear("#fff");
  plot.axes({ grid: true });
  plot.bars(H.centers, H.density, H.width, { color: "rgba(31,78,216,0.40)", stroke: "rgba(31,78,216,0.6)" });
  // uniform reference at density = 1
  plot.hline(1, { color: "var(--good)", dash: [6, 4], width: 2, label: "uniform" });
}

function draw() {
  const S = simulate();

  // ---- PIT panels: the money shot ----
  drawPit(pitRaw, S.pitRawVals, "raw");
  drawPit(pitCal, S.pitCalVals, "recal");

  // ---- main panel ----
  const H = histogram(S.yTest, 50, -4, 4);
  const peakDens = Math.max(normPdf(0, 0, S.sigmaModel), normPdf(0, 0, S.sigmaStar));
  const peak = Math.max(...H.density, peakDens, 0.45);
  main.setLimits([-4, 4], [0, peak * 1.14]);
  main.clear("#fff");
  main.axes({ grid: true });

  // conformal SET drawn as a shaded interval (a set, not a curve)
  if (isFinite(S.q)) {
    const confAlpha = state.highlight === "conformal" ? 0.22 : 0.10;
    main.vspan(-S.q, S.q, { color: `rgba(31,78,216,${confAlpha})` });
  }
  // histogram of outcomes
  main.bars(H.centers, H.density, H.width, { color: "rgba(120,120,120,0.32)", stroke: "rgba(120,120,120,0.45)" });

  const gx = linspace(-4, 4, 240);
  const dim = "rgba(120,120,120,0.45)";
  const hi = state.highlight;
  // RAW density (too narrow)
  main.line(gx, gx.map(x => normPdf(x, 0, S.sigmaModel)),
    { color: hi === "raw" ? "var(--bad)" : dim, width: hi === "raw" ? 2.6 : 1.6, alpha: hi === "raw" ? 1 : 0.7 });
  // RECALIBRATED density (matches truth)
  main.line(gx, gx.map(x => normPdf(x, 0, S.sigmaStar)),
    { color: hi === "recal" ? "var(--good)" : dim, width: hi === "recal" ? 2.8 : 1.6, alpha: hi === "recal" ? 1 : 0.7 });
  // conformal set edges
  if (isFinite(S.q)) {
    const edgeCol = hi === "conformal" ? "var(--accent)" : "rgba(31,78,216,0.55)";
    main.vline(-S.q, { color: edgeCol, dash: [6, 4], width: hi === "conformal" ? 2.4 : 1.6 });
    main.vline(S.q, { color: edgeCol, dash: [6, 4], width: hi === "conformal" ? 2.4 : 1.6 });
    main.text(S.q, peak * 1.06, "+q", { color: "#1f4ed8", align: "center" });
    main.text(-S.q, peak * 1.06, "−q", { color: "#1f4ed8", align: "center" });
  }
  main.legend([
    { label: "outcomes  y ~ N(0,1)", color: "rgba(120,120,120,0.5)" },
    { label: "RAW  N(0, σ/k)  (too narrow)", color: "var(--bad)" },
    { label: "RECALIBRATED  N(0, σ*)", color: "var(--good)" },
    { label: "CONFORMAL set [−q,+q]", color: "rgba(31,78,216,0.45)" },
  ], { x: main.X(-4) + 8, y: main.Y(peak * 1.14) + 8 });

  // ---- readouts ----
  // log-score ordering: raw < (conformal-implied ≲) recalibrated. Best = recalibrated.
  const best = Math.max(S.lsRaw, S.lsConf, S.lsRecal);
  const cls = (v) => (best - v < 0.02 ? "good" : best - v < 0.25 ? "warn" : "bad");
  setRO("log-score: raw", fmt(S.lsRaw, 3), cls(S.lsRaw));
  setRO("log-score: conformal-implied", fmt(S.lsConf, 3), cls(S.lsConf));
  setRO("log-score: recalibrated", fmt(S.lsRecal, 3), cls(S.lsRecal));

  const target = 1 - state.alpha;
  const covCls = (c) => (Math.abs(c - target) < 0.02 ? "good" : Math.abs(c - target) < 0.05 ? "warn" : "bad");
  setRO("coverage: raw", pct(S.covRaw, 1), covCls(S.covRaw));
  setRO("coverage: conformal", pct(S.covConf, 1), covCls(S.covConf));
  setRO("coverage: recalibrated", pct(S.covRecal, 1), covCls(S.covRecal));

  // categorical: does the method hand back an integrable density?
  if (state.highlight === "conformal") setRO("returns a density?", "a set", "bad");
  else if (state.highlight === "raw") setRO("returns a density?", "yes", "good");
  else setRO("returns a density?", "yes", "good");
}

// ---- controls ----
slider(ctrls, { label: "overconfidence  k = σ_true/σ_model", min: 1.0, max: 3.0, step: 0.05, value: state.overconf, fmt: v => v.toFixed(2) },
  v => { state.overconf = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });

// method-highlight selector
const selWrap = document.createElement("div");
selWrap.className = "control";
const selLab = document.createElement("label");
const selSpan = document.createElement("span");
selSpan.textContent = "highlight density";
selLab.appendChild(selSpan);
const sel = document.createElement("select");
sel.style.cssText = "width:100%;padding:5px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;";
for (const [val, txt] of [["recal", "recalibrated"], ["raw", "raw"], ["conformal", "conformal set"]]) {
  const o = document.createElement("option");
  o.value = val; o.textContent = txt;
  sel.appendChild(o);
}
sel.value = state.highlight;
sel.addEventListener("change", () => { state.highlight = sel.value; draw(); });
selWrap.appendChild(selLab);
selWrap.appendChild(sel);
ctrls.appendChild(selWrap);

button(ctrls, "↻ new sample", () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  yAll = drawSample();
  draw();
});

autoResize(main, draw);
autoResize(pitRaw, () => {});
autoResize(pitCal, () => {});
draw();
