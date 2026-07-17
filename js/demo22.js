// Demo 22 — The time-series fan.
//
// Calibration scores are a stationary Gaussian AR(1) segment mapped to the
// uniform scale, U_t = Phi(X_t), X_t = phi X_{t-1} + sqrt(1-phi^2) eps_t, so
// marginals are exactly Uniform(0,1) and phi controls only serial dependence.
// Each Monte Carlo trial draws one segment and records the realized coverage
// c = U_(k) against the stationary law. The histogram is the dependent fan,
// overlaid on the iid Beta(k, n-k+1) fan. Readouts: mean shift (the vanishing
// tax) and the sd inflation factor (the permanent long-run-variance charge).
import { mulberry32, randn, normCdf, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, readouts } from "./lib/ui.js";

const M = 6000;                      // calibration segments per run
const state = { phi: 0.6, n: 80, alpha: 0.10 };
let seed = 17;

const fan = new Plot(document.getElementById("fan"), {
  xlim: [0.6, 1], ylim: [0, 1], xlabel: "realized coverage  c = U_(k)", ylabel: "density",
  margin: { l: 56, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "mean(c): dependent | iid", "sd(c): dependent | iid", "fan inflation  sd ratio", "segments"]);

const COL = { iid: "#1f4ed8", dep: "#c2410c" };
function softFill(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// exact Beta(k, n-k+1) density via log-gamma
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x));
}

function simulate() {
  const { phi, n, alpha } = state;
  const k = Math.ceil((1 - alpha) * (n + 1));
  const rng = mulberry32(seed);
  const cs = new Float64Array(M);
  const innov = Math.sqrt(1 - phi * phi);
  const u = new Float64Array(n);
  for (let m = 0; m < M; m++) {
    let x = randn(rng);                              // stationary start, sd 1
    for (let t = 0; t < n; t++) {
      x = phi * x + innov * randn(rng);
      u[t] = normCdf(x);
    }
    const sorted = Float64Array.from(u).sort();
    cs[m] = sorted[k - 1];
  }
  let s1 = 0, s2 = 0;
  for (const c of cs) { s1 += c; s2 += c * c; }
  const mean = s1 / M, sd = Math.sqrt(Math.max(s2 / M - mean * mean, 0));
  const betaMean = k / (n + 1);
  const betaSd = Math.sqrt(k * (n - k + 1) / ((n + 1) * (n + 1) * (n + 2)));
  return { cs, k, mean, sd, betaMean, betaSd };
}

function draw() {
  const { n, alpha } = state;
  const S = simulate();
  const lo = Math.max(0, Math.min(S.betaMean - 5 * S.betaSd, S.mean - 4 * S.sd));
  const hi = Math.min(1, Math.max(S.betaMean + 4 * S.betaSd, S.mean + 4 * S.sd));

  // histogram of dependent fan
  const nb = 48, h = new Float64Array(nb), w = (hi - lo) / nb;
  for (const c of S.cs) {
    let b = Math.floor((c - lo) / w);
    if (b < 0) b = 0; if (b >= nb) b = nb - 1;
    h[b]++;
  }
  const xs = [], ys = [];
  for (let i = 0; i < nb; i++) { xs.push(lo + (i + 0.5) * w); ys.push(h[i] / (M * w)); }

  // iid Beta fan curve
  const bx = [], by = [];
  for (let i = 0; i <= 240; i++) {
    const x = lo + ((hi - lo) * i) / 240;
    bx.push(x); by.push(betaPdf(x, S.k, n - S.k + 1));
  }
  const ymax = Math.max(...ys, ...by) * 1.12 || 1;

  fan.setLimits([lo, hi], [0, ymax]); fan.clear("#fff"); fan.axes({ grid: true });
  fan.band(xs, xs.map(() => 0), ys, { color: softFill(COL.dep, 0.16) });
  fan.line(xs, ys, { color: COL.dep, width: 2 });
  fan.line(bx, by, { color: COL.iid, width: 1.8 });
  fan.vline(1 - alpha, { color: "rgba(0,0,0,0.55)", dash: [5, 4], width: 1.4 });
  fan.text(1 - alpha, ymax, " 1−α", { color: "rgba(0,0,0,0.6)", baseline: "top" });
  fan.legend([
    { label: `AR(1) calibration, φ = ${state.phi.toFixed(2)}`, color: COL.dep },
    { label: "iid Beta fan", color: COL.iid },
  ], { x: fan.X(lo) + 8, y: fan.Y(ymax) + 8 });

  setRO("target 1−α", pct(1 - alpha, 0));
  setRO("mean(c): dependent | iid", `${fmt(S.mean, 4)} | ${fmt(S.betaMean, 4)}`,
    Math.abs(S.mean - S.betaMean) < 0.005 ? "good" : "warn");
  setRO("sd(c): dependent | iid", `${fmt(S.sd, 4)} | ${fmt(S.betaSd, 4)}`);
  const ratio = S.sd / S.betaSd;
  setRO("fan inflation  sd ratio", `${fmt(ratio, 2)}×`, ratio > 1.15 ? "bad" : "good");
  setRO("segments", fmt(M, 0));
}

const ctrls = document.getElementById("controls");
slider(ctrls, { label: "serial dependence  φ (AR(1))", min: 0, max: 0.95, step: 0.05, value: state.phi, fmt: v => v.toFixed(2) },
  v => { state.phi = v; draw(); });
slider(ctrls, { label: "calibration size n", min: 40, max: 240, step: 20, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.3, step: 0.05, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ resample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(fan, draw);
draw();
