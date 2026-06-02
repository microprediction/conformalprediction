// Demo 10 — Conformal p-values: calibrated anomaly detection.
// Here coverage *is* the objective and conformal prediction is at its cleanest: a
// distribution-free hypothesis test. The conformal p-value of a genuine inlier is
// super-uniform, so flagging when p <= alpha controls the false-alarm rate at exactly
// alpha, whatever the (unknown) inlier distribution. Detection power is the model's job.
import { mulberry32, sampleNormal, histogram, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [-6, 6], ylim: [0, 1.04], xlabel: "test value x", ylabel: "conformal p-value",
});
const hist = new Plot(document.getElementById("hist"), {
  xlim: [0, 1], ylim: [0, 2], xlabel: "conformal p-value of true inliers", ylabel: "density",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target α", "false-alarm rate", "detection rate", "calibration n"]);

const ctrls = document.getElementById("controls");
let seed = 23;

const state = { alpha: 0.1, shift: 3.0, contam: 0.25, n: 500 };

function pValue(sortedCal, t) {
  // (1 + #{cal score >= t}) / (n + 1)
  let c = 0;
  for (let i = sortedCal.length - 1; i >= 0; i--) { if (sortedCal[i] >= t) c++; else break; }
  return (1 + c) / (sortedCal.length + 1);
}

function simulate() {
  const rng = mulberry32(seed);
  const nCal = state.n;
  // calibration: inliers ~ N(0,1); score = |x| (distance from the inlier centre)
  const cal = [];
  for (let i = 0; i < nCal; i++) cal.push(Math.abs(sampleNormal(rng, 0, 1)));
  cal.sort((a, b) => a - b);
  // test stream: a mix of inliers and anomalies
  const M = 600;
  const pts = [];
  let inl = 0, inlFlag = 0, ano = 0, anoFlag = 0;
  const inlierPvals = [];
  for (let i = 0; i < M; i++) {
    const isAno = rng() < state.contam;
    let x;
    if (isAno) x = sampleNormal(rng, (rng() < 0.5 ? -1 : 1) * state.shift, 1);
    else x = sampleNormal(rng, 0, 1);
    const p = pValue(cal, Math.abs(x));
    const flag = p <= state.alpha;
    pts.push({ x, p, isAno, flag });
    if (isAno) { ano++; if (flag) anoFlag++; }
    else { inl++; if (flag) inlFlag++; inlierPvals.push(p); }
  }
  return { pts, far: inl ? inlFlag / inl : 0, power: ano ? anoFlag / ano : 0, inlierPvals };
}

function draw() {
  const S = simulate();

  // ---- main: x vs conformal p-value ----
  main.clear("#fff");
  main.axes({ grid: true });
  const groups = {
    inlierOK:  { xs: [], ys: [], color: "rgba(120,120,120,0.5)", r: 2.2 },
    falseAlarm:{ xs: [], ys: [], color: "rgba(185,28,28,0.9)",  r: 3.0 },
    detected:  { xs: [], ys: [], color: "rgba(21,128,61,0.85)", r: 3.0 },
    missed:    { xs: [], ys: [], color: "rgba(217,119,6,0.9)",  r: 3.0 },
  };
  for (const pt of S.pts) {
    const g = pt.isAno ? (pt.flag ? "detected" : "missed") : (pt.flag ? "falseAlarm" : "inlierOK");
    groups[g].xs.push(pt.x); groups[g].ys.push(pt.p);
  }
  for (const k of ["inlierOK", "missed", "detected", "falseAlarm"]) {
    main.points(groups[k].xs, groups[k].ys, { color: groups[k].color, radius: groups[k].r });
  }
  main.hline(state.alpha, { color: "var(--warn)", dash: [6, 4], width: 2 });
  main.text(5.9, state.alpha + 0.02, "flag if p ≤ α", { color: "#c2410c", align: "right" });
  main.legend([
    { label: "inlier, not flagged", color: "rgba(120,120,120,0.7)" },
    { label: "false alarm", color: "rgba(185,28,28,0.9)" },
    { label: "anomaly, detected", color: "rgba(21,128,61,0.85)" },
    { label: "anomaly, missed", color: "rgba(217,119,6,0.9)" },
  ], { x: main.X(-6) + 8, y: main.Y(1.04) + 8 });

  // ---- hist: inlier p-values are ~uniform ----
  const H = histogram(S.inlierPvals, 20, 0, 1);
  hist.clear("#fff");
  hist.axes({ grid: true });
  hist.bars(H.centers, H.density, H.width, { color: "rgba(31,78,216,0.4)", stroke: "rgba(31,78,216,0.7)" });
  hist.hline(1.0, { color: "rgba(0,0,0,0.45)", dash: [4, 4], width: 1.5, label: "uniform" });
  hist.vline(state.alpha, { color: "var(--warn)", dash: [6, 4], width: 2 });

  // ---- readouts ----
  setRO("target α", pct(state.alpha, 0));
  const farCls = S.far <= state.alpha + 0.03 ? "good" : "warn";
  setRO("false-alarm rate", pct(S.far, 1), farCls);
  setRO("detection rate", pct(S.power, 0), "good");
  setRO("calibration n", String(state.n));
}

slider(ctrls, { label: "false-alarm budget α", min: 0.01, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "anomaly shift", min: 1.0, max: 5.0, step: 0.1, value: state.shift, fmt: v => v.toFixed(1) },
  v => { state.shift = v; draw(); });
slider(ctrls, { label: "anomaly fraction", min: 0.05, max: 0.5, step: 0.01, value: state.contam, fmt: v => v.toFixed(2) },
  v => { state.contam = v; draw(); });
slider(ctrls, { label: "calibration n", min: 50, max: 2000, step: 25, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(hist, () => {});
draw();
