// Demo 05 — Exchangeability & time series.
// Conformal coverage rests on exchangeability. Under drift, fixed split-conformal
// coverage collapses out-of-sample. ACI restores only a long-run TIME-AVERAGE
// miscoverage rate, not per-step or short-window conditional coverage.
import { mulberry32, sampleNormal, conformalQuantile, quantile, clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, checkbox, readouts, button } from "./lib/ui.js";

const T = 500;       // series length
const T0 = 120;      // calibration ends here
const K = 12;        // rolling-mean forecast window
const COV_WIN = 40;  // trailing window for rolling coverage
const JUMP_AT = 300; // regime jump location
const NOISE = 1.0;

const main = new Plot(document.getElementById("main"), {
  xlim: [0, T], ylim: [-6, 14], xlabel: "t", ylabel: "y",
  margin: { l: 52, r: 16, t: 14, b: 40 },
});
const covPlot = new Plot(document.getElementById("cov"), {
  xlim: [0, T], ylim: [0, 1], xlabel: "t", ylabel: "rolling coverage",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "fixed-conformal coverage", "ACI long-run average", "ACI current-window"]);

const ctrls = document.getElementById("controls");
let seed = 11;

const state = {
  alpha: 0.1,
  drift: 1.0,    // 0 = stationary/exchangeable; larger = stronger nonstationarity
  gamma: 0.05,   // ACI learning rate
  showACI: true,
};

// True level: calibration window [0,T0] is near-stationary; the trend ramps up
// afterwards and a regime jump lands at JUMP_AT, so the fixed band meets an
// unseen distribution. Drift scales both effects.
function levelAt(t) {
  const ramp = Math.max(0, t - 160);
  const trend = state.drift * 0.02 * ramp;
  const jump = t >= JUMP_AT ? state.drift * 5.0 : 0; // regime shift
  return 4 + trend + jump;
}
// Post-regime the innovation variance also inflates: exchangeability breaks in
// scale as well as location, which a fixed half-width cannot track.
function noiseAt(t) {
  return NOISE * (1 + (t >= JUMP_AT ? state.drift * 0.9 : 0));
}

function simulate() {
  const rng = mulberry32(seed);
  const y = new Array(T + 1);
  for (let t = 0; t <= T; t++) y[t] = levelAt(t) + sampleNormal(rng, 0, noiseAt(t));

  // Online point forecast: rolling mean of the last K observations (last value for t<K).
  const yHat = new Array(T + 1).fill(NaN);
  for (let t = 1; t <= T; t++) {
    const lo = Math.max(0, t - K);
    let s = 0, n = 0;
    for (let j = lo; j < t; j++) { s += y[j]; n++; }
    yHat[t] = n ? s / n : y[t - 1];
  }

  // ---- FIXED split conformal: calibrate on [1, T0], apply fixed q for t > T0 ----
  const calScores = [];
  for (let t = 1; t <= T0; t++) calScores.push(Math.abs(y[t] - yHat[t]));
  const qFixed = conformalQuantile(calScores, state.alpha);

  const fixedLo = new Array(T + 1).fill(NaN), fixedHi = new Array(T + 1).fill(NaN);
  const fixedCovered = new Array(T + 1).fill(false);
  for (let t = T0 + 1; t <= T; t++) {
    fixedLo[t] = yHat[t] - qFixed;
    fixedHi[t] = yHat[t] + qFixed;
    fixedCovered[t] = y[t] >= fixedLo[t] && y[t] <= fixedHi[t];
  }

  // ---- ACI: online update of alpha_t over a trailing set of scores ----
  const aciLo = new Array(T + 1).fill(NaN), aciHi = new Array(T + 1).fill(NaN);
  const aciCovered = new Array(T + 1).fill(false);
  const aciErr = new Array(T + 1).fill(NaN);
  const scoreWin = calScores.slice(-200); // seed with calibration scores; trail thereafter
  let alphaT = state.alpha;
  for (let t = T0 + 1; t <= T; t++) {
    const aT = clamp(alphaT, 0, 1);
    let qt;
    if (aT <= 0) qt = Infinity;
    else if (aT >= 1) qt = 0;
    else qt = quantile(scoreWin, 1 - aT);
    aciLo[t] = yHat[t] - qt;
    aciHi[t] = yHat[t] + qt;
    const inside = y[t] >= aciLo[t] && y[t] <= aciHi[t];
    aciCovered[t] = inside;
    const err = inside ? 0 : 1;
    aciErr[t] = err;
    // update alpha for the next step
    alphaT = alphaT + state.gamma * (state.alpha - err);
    // trail the score set with the realized nonconformity score
    scoreWin.push(Math.abs(y[t] - yHat[t]));
    if (scoreWin.length > 200) scoreWin.shift();
  }

  // ---- coverage summaries (post-t0) ----
  let fc = 0, fn = 0, ac = 0, an = 0;
  for (let t = T0 + 1; t <= T; t++) {
    if (fixedCovered[t]) fc++; fn++;
    if (aciCovered[t]) ac++; an++;
  }
  const fixedCov = fn ? fc / fn : NaN;
  const aciLongRun = an ? ac / an : NaN;

  // ACI current-window coverage (last COV_WIN steps)
  let cwC = 0, cwN = 0;
  for (let t = T - COV_WIN + 1; t <= T; t++) {
    if (t <= T0) continue;
    if (aciCovered[t]) cwC++; cwN++;
  }
  const aciCurWin = cwN ? cwC / cwN : NaN;

  // ---- rolling coverage series (trailing COV_WIN), and ACI cumulative average ----
  const ts = [], rollFixed = [], rollACI = [], cumACI = [];
  let cumC = 0, cumN = 0;
  for (let t = T0 + 1; t <= T; t++) {
    ts.push(t);
    // trailing windows (only count steps > T0)
    let fC = 0, fN = 0, aC = 0, aN = 0;
    for (let j = Math.max(T0 + 1, t - COV_WIN + 1); j <= t; j++) {
      if (fixedCovered[j]) fC++; fN++;
      if (aciCovered[j]) aC++; aN++;
    }
    rollFixed.push(fN ? fC / fN : NaN);
    rollACI.push(aN ? aC / aN : NaN);
    if (aciCovered[t]) cumC++; cumN++;
    cumACI.push(cumN ? cumC / cumN : NaN);
  }

  return {
    y, yHat, qFixed, fixedLo, fixedHi, fixedCovered, aciLo, aciHi, aciCovered,
    fixedCov, aciLongRun, aciCurWin, ts, rollFixed, rollACI, cumACI,
  };
}

function yRange(S) {
  let lo = Infinity, hi = -Infinity;
  for (let t = 1; t <= T; t++) { if (S.y[t] < lo) lo = S.y[t]; if (S.y[t] > hi) hi = S.y[t]; }
  // include the fixed band a touch
  if (isFinite(S.qFixed)) { lo -= 0; hi += 0; }
  const pad = 0.12 * (hi - lo || 1);
  return [lo - pad, hi + pad];
}

const COL = {
  y: "rgba(60,60,60,0.7)",
  yhat: "#1f4ed8",
  fixed: "rgba(31,78,216,0.13)",
  aci: "rgba(194,65,12,0.16)",
  covered: "rgba(21,128,61,0.85)",
  missed: "rgba(185,28,28,0.95)",
};

function draw() {
  const S = simulate();

  // ---- main panel ----
  main.setLimits([0, T], yRange(S));
  main.clear("#fff");
  main.axes({ grid: true });

  // fixed conformal band over t > T0
  const bx = S.ts;
  main.band(bx, bx.map((_, i) => S.fixedLo[S.ts[i]]), bx.map((_, i) => S.fixedHi[S.ts[i]]),
    { color: COL.fixed });
  if (state.showACI) {
    main.band(bx, bx.map((_, i) => S.aciLo[S.ts[i]]), bx.map((_, i) => S.aciHi[S.ts[i]]),
      { color: COL.aci });
  }

  // calibration-region points (grey), forecast line
  const calX = [], calY = [];
  for (let t = 1; t <= T0; t++) { calX.push(t); calY.push(S.y[t]); }
  main.points(calX, calY, { color: "rgba(150,150,150,0.5)", radius: 1.8 });

  // post-t0 covered/missed (relative to the FIXED band)
  const cX = [], cY = [], mX = [], mY = [];
  for (let t = T0 + 1; t <= T; t++) {
    if (S.fixedCovered[t]) { cX.push(t); cY.push(S.y[t]); }
    else { mX.push(t); mY.push(S.y[t]); }
  }
  main.points(cX, cY, { color: COL.covered, radius: 2.2 });
  main.points(mX, mY, { color: COL.missed, radius: 2.8 });

  // forecast line
  const allT = [];
  for (let t = 1; t <= T; t++) allT.push(t);
  main.line(allT, allT.map(t => S.yHat[t]), { color: COL.yhat, width: 1.6 });

  // calibration end + regime jump markers
  main.vline(T0, { color: "rgba(0,0,0,0.55)", dash: [5, 4], width: 1.5 });
  main.text(T0, main.ylim[1], " calibration ends", { color: "rgba(0,0,0,0.6)", baseline: "top" });
  main.vline(JUMP_AT, { color: "rgba(194,65,12,0.7)", dash: [3, 3], width: 1.5 });
  main.text(JUMP_AT, main.ylim[1], " regime jump", { color: "rgba(194,65,12,0.85)", baseline: "top" });

  const legend = [
    { label: "ŷ_t (rolling mean)", color: COL.yhat },
    { label: "fixed conformal band", color: "rgba(31,78,216,0.4)" },
  ];
  if (state.showACI) legend.push({ label: "ACI band", color: "rgba(194,65,12,0.5)" });
  legend.push({ label: "covered (fixed)", color: COL.covered });
  legend.push({ label: "missed (fixed)", color: COL.missed });
  main.legend(legend, { x: main.X(0) + 8, y: main.Y(main.ylim[1]) + 8 });

  // ---- coverage panel ----
  covPlot.setLimits([0, T], [0, 1]);
  covPlot.clear("#fff");
  covPlot.axes({ grid: true });
  covPlot.hline(1 - state.alpha, { color: "rgba(0,0,0,0.55)", dash: [6, 4], width: 1.5, label: "target 1−α" });
  covPlot.line(S.ts, S.rollFixed, { color: "#1f4ed8", width: 1.8 });
  if (state.showACI) {
    covPlot.line(S.ts, S.rollACI, { color: "#c2410c", width: 1.6, alpha: 0.9 });
    covPlot.line(S.ts, S.cumACI, { color: "rgba(120,40,160,0.9)", width: 1.6, dash: [4, 3] });
  }
  covPlot.vline(JUMP_AT, { color: "rgba(194,65,12,0.6)", dash: [3, 3], width: 1.2 });
  const covLegend = [
    { label: "fixed (trailing " + COV_WIN + ")", color: "#1f4ed8" },
  ];
  if (state.showACI) {
    covLegend.push({ label: "ACI (trailing " + COV_WIN + ")", color: "#c2410c" });
    covLegend.push({ label: "ACI cumulative avg", color: "rgba(120,40,160,0.9)", dash: [4, 3] });
  }
  covPlot.legend(covLegend, { x: covPlot.X(0) + 8, y: covPlot.Y(1) + 8 });

  // ---- readouts ----
  const target = 1 - state.alpha;
  setRO("target 1−α", pct(target, 0));
  const fixedCls = S.fixedCov >= target - 0.05 ? "good" : "bad";
  setRO("fixed-conformal coverage", pct(S.fixedCov, 1), fixedCls);
  const aciCls = Math.abs(S.aciLongRun - target) < 0.05 ? "good" : "warn";
  setRO("ACI long-run average", pct(S.aciLongRun, 1), aciCls);
  const cwCls = Math.abs(S.aciCurWin - target) < 0.08 ? "good" : "warn";
  setRO("ACI current-window", pct(S.aciCurWin, 1), cwCls);
}

// ---- controls ----
slider(ctrls, { label: "drift magnitude", min: 0, max: 2.5, step: 0.05, value: state.drift, fmt: v => v.toFixed(2) },
  v => { state.drift = v; draw(); });
slider(ctrls, { label: "ACI learning rate γ", min: 0.005, max: 0.2, step: 0.005, value: state.gamma, fmt: v => v.toFixed(3) },
  v => { state.gamma = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
checkbox(ctrls, { label: "show ACI band", checked: state.showACI },
  v => { state.showACI = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(covPlot, () => {});
draw();
