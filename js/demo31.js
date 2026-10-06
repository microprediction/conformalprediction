// Demo 31 — Two worlds. A matched pair that split conformal cannot tell apart.
//
//   World A   R ~ t_nu, independent of the state. Fat tails are a property of
//             the noise. One interval width is correct forever.
//   World B   sigma^2 ~ InvGamma(nu/2, nu/2) and R = sigma * eps. Given the
//             scale the error is Gaussian, and the scale is a state you could
//             have conditioned on.
//
// The Student t is exactly a Gaussian scale mixture, so the two worlds have the
// same marginal law. Split conformal reads a quantile off the pooled residuals
// and therefore returns the same interval and the same coverage in both. What
// differs is conditional coverage, and the information that pooling discarded,
//
//   I(R;X) = h(t_nu) - (1/2)[log(nu/2) - psi(nu/2)] - (1/2)log(2 pi e),
//
// which is verified against numerical integration and Monte Carlo in
// papers/matched-pair/.
import { mulberry32, randn, logGamma, quantile, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const COL = { a: "#1f4ed8", b: "#b45309", band: "#94a3b8", target: "#15803d" };
const N_SHOW = 220;

const seriesPlot = new Plot(document.getElementById("series"), {
  xlim: [0, N_SHOW], ylim: [-1, 1], xlabel: "observation", ylabel: "",
});
const condPlot = new Plot(document.getElementById("cond"), {
  xlim: [0, 1], ylim: [0, 1], xlabel: "percentile of the period's scale", ylabel: "conditional coverage",
});

const setRO = readouts(document.getElementById("readouts"),
  ["marginal coverage, A", "marginal coverage, B", "conditional coverage, B, worst 5%", "information gap"]);
const ctrls = document.getElementById("controls");

const state = { nu: 3, alpha: 0.10, n: 500 };
let seed = 4;

// ---------- sampling ----------

// Marsaglia and Tsang, rate 1.
function gammaSample(rng, shape) {
  if (shape < 1) return gammaSample(rng, shape + 1) * Math.pow(rng(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = randn(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// sigma^2 ~ InvGamma(nu/2, nu/2), so sigma = sqrt(nu / chi2_nu).
function drawScale(rng, nu) {
  return Math.sqrt(nu / (2 * gammaSample(rng, nu / 2)));
}

// ---------- the gap, in closed form ----------

function digamma(x) {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x
    - f * (1 / 12 - f * (1 / 120 - f * (1 / 252)));
}

function entropyT(nu) {
  const lnB = logGamma(nu / 2) + logGamma(0.5) - logGamma((nu + 1) / 2);
  return ((nu + 1) / 2) * (digamma((nu + 1) / 2) - digamma(nu / 2))
    + Math.log(Math.sqrt(nu)) + lnB;
}

function infoGap(nu) {
  return entropyT(nu) - 0.5 * (Math.log(nu / 2) - digamma(nu / 2))
    - 0.5 * Math.log(2 * Math.PI * Math.E);
}

function normCdfLocal(z) {
  // Abramowitz and Stegun 7.1.26 on the error function.
  const s = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}

// ---------- run ----------

let sim = null;

function run() {
  const rng = mulberry32(seed);
  const { nu, alpha, n } = state;

  // One calibration set. The pooled residuals are the same object in both
  // worlds, so the conformal interval is identical, not merely equal in law.
  const cal = [];
  for (let i = 0; i < n; i++) cal.push(randn(rng) * drawScale(rng, nu));
  const k = Math.ceil((n + 1) * (1 - alpha));
  const q = [...cal].map(Math.abs).sort((p, r) => p - r)[Math.min(k, n) - 1];
  const qA = q, qB = q;

  // evaluation draws: world B keeps its scale, world A does not have one
  const M = 4000;
  const evA = [], evB = [], sig = [];
  for (let i = 0; i < M; i++) {
    evA.push(randn(rng) * drawScale(rng, nu));
    const s = drawScale(rng, nu);
    sig.push(s); evB.push(randn(rng) * s);
  }
  const covA = evA.filter((r) => Math.abs(r) <= qA).length / M;
  const covB = evB.filter((r) => Math.abs(r) <= qB).length / M;

  // conditional coverage in world B is exact given the scale: 2 Phi(q/sigma) - 1
  const sorted = [...sig].sort((p, q) => p - q);
  const xs = [], ys = [];
  for (let i = 0; i <= 100; i++) {
    const s = sorted[Math.min(sorted.length - 1, Math.floor((i / 100) * sorted.length))];
    xs.push(i / 100);
    ys.push(2 * normCdfLocal(qB / s) - 1);
  }
  const condLo = quantile(ys, 0.05), condHi = quantile(ys, 0.95);

  sim = { qA, qB, evA: evA.slice(0, N_SHOW), evB: evB.slice(0, N_SHOW),
          sigShow: sig.slice(0, N_SHOW), covA, covB, xs, ys, condLo, condHi,
          gap: infoGap(nu) };
}

function draw() {
  if (!sim) return;
  const { qA, qB } = sim;
  const half = Math.max(qA, qB) * 2.2;
  const off = half * 1.15;

  seriesPlot.setLimits([0, N_SHOW], [-2 * off, 2 * off]);
  seriesPlot.clear("#fff");
  seriesPlot.axes({ yticks: [] });

  // world A on top, world B beneath, the same band on each
  const idx = sim.evA.map((_, i) => i);
  seriesPlot.band(idx, idx.map(() => off - qA), idx.map(() => off + qA), { color: "rgba(148,163,184,0.22)" });
  seriesPlot.band(idx, idx.map(() => -off - qB), idx.map(() => -off + qB), { color: "rgba(148,163,184,0.22)" });
  seriesPlot.points(idx, sim.evA.map((r) => off + Math.max(-half, Math.min(half, r))),
    { color: COL.a, radius: 1.9 });
  seriesPlot.points(idx, sim.evB.map((r) => -off + Math.max(-half, Math.min(half, r))),
    { color: COL.b, radius: 1.9 });
  seriesPlot.hline(0, { color: "#e2e2e2", width: 1 });
  seriesPlot.text(4, off + half * 0.72, "world A: fat tails", { color: COL.a, font: "700 12px system-ui" });
  seriesPlot.text(4, -off + half * 0.72, "world B: stochastic scale", { color: COL.b, font: "700 12px system-ui" });

  condPlot.setLimits([0, 1], [0, 1]);
  condPlot.clear("#fff");
  condPlot.axes({});
  condPlot.hline(1 - state.alpha, { color: COL.target, width: 1.4, dash: [5, 4] });
  condPlot.line([0, 1], [sim.covA, sim.covA], { color: COL.a, width: 2.2 });
  condPlot.line(sim.xs, sim.ys, { color: COL.b, width: 2.2 });
  condPlot.legend([
    { label: "world A (no state to condition on)", color: COL.a },
    { label: "world B, given the period's scale", color: COL.b },
    { label: `target ${pct(1 - state.alpha, 0)}`, color: COL.target },
  ], {});

  setRO("marginal coverage, A", pct(sim.covA, 1));
  setRO("marginal coverage, B", pct(sim.covB, 1));
  setRO("conditional coverage, B, worst 5%", pct(sim.condLo, 0));
  setRO("information gap", `${fmt(sim.gap, 3)} nats`);
}

function refresh() { run(); draw(); }

slider(ctrls, { label: "tail index ν", min: 2.5, max: 30, step: 0.5, value: state.nu, fmt: (v) => fmt(v, 1) },
  (v) => { state.nu = v; refresh(); });
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.25, step: 0.01, value: state.alpha, fmt: (v) => pct(v, 0) },
  (v) => { state.alpha = v; refresh(); });
slider(ctrls, { label: "calibration size", min: 100, max: 2000, step: 50, value: state.n, fmt: (v) => String(v) },
  (v) => { state.n = v; refresh(); });
button(ctrls, "resample", () => { seed += 1; refresh(); });

autoResize(seriesPlot, draw);
autoResize(condPlot, draw);
refresh();
