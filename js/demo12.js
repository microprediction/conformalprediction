// Demo 12 — A certified safety envelope for robotics and control.
// Coverage is exactly the right object here: a controller does not need a sharp forecast
// of the next state, it needs a *region* the true state is guaranteed to lie in, so it can
// prove it stays clear of an obstacle. Conformal prediction sizes that tube distribution-free.
import { mulberry32, sampleNormal, linspace, conformalQuantile, coverage, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 30], ylim: [0, 7], xlabel: "time step", ylabel: "position",
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "tube coverage", "clearance margin", "certified clear?"]);

const ctrls = document.getElementById("controls");
let seed = 53;

const state = { alpha: 0.05, sigma: 0.45, ceiling: 5.5, horizon: 30 };

// nominal predicted trajectory: accelerate, then level off below the obstacle
const path = (t) => 1 + 3.2 * (1 - Math.exp(-t / 7));

function simulate() {
  const rng = mulberry32(seed);
  const T = state.horizon, sg = state.sigma;
  // calibration rollouts: residuals of the predictor against realised states
  const scores = [];
  for (let r = 0; r < 400; r++) {
    const t = rng() * T;
    const y = path(t) + sampleNormal(rng, 0, sg);
    scores.push(Math.abs(y - path(t)));
  }
  const q = conformalQuantile(scores, state.alpha);
  // test rollout: realised states across the horizon
  const teT = [], teY = [];
  for (let i = 0; i < 500; i++) {
    const t = rng() * T;
    teT.push(t); teY.push(path(t) + sampleNormal(rng, 0, sg));
  }
  const lo = teT.map(t => path(t) - q), hi = teT.map(t => path(t) + q);
  const cov = coverage(lo, hi, teY);
  // certified clear if the whole tube stays below the ceiling over the horizon
  const gt = linspace(0, T, 120);
  const tubeTop = Math.max(...gt.map(t => path(t) + q));
  const margin = state.ceiling - tubeTop;
  return { q, teT, teY, cov, margin, certified: margin > 0, T };
}

function draw() {
  const S = simulate();
  main.setLimits([0, S.T], [0, Math.max(7, state.ceiling + 1.2)]);
  main.clear("#fff");
  main.axes({ grid: true });

  // keep-out zone above the ceiling
  const gt = linspace(0, S.T, 120);
  main.band(gt, gt.map(() => state.ceiling), gt.map(() => Infinity), { color: "rgba(185,28,28,0.08)" });
  main.hline(state.ceiling, { color: "rgba(185,28,28,0.8)", dash: [5, 4], width: 2, label: "obstacle" });

  // conformal safety tube
  const glo = gt.map(t => path(t) - S.q), ghi = gt.map(t => path(t) + S.q);
  main.band(gt, glo, ghi, { color: "rgba(21,128,61,0.14)" });
  main.line(gt, gt.map(t => path(t)), { color: "#15803d", width: 2 });

  // realised states, coloured by containment
  const inX = [], inY = [], outX = [], outY = [];
  for (let k = 0; k < S.teT.length; k++) {
    const t = S.teT[k], y = S.teY[k];
    const inside = y >= path(t) - S.q && y <= path(t) + S.q;
    (inside ? inX : outX).push(t);
    (inside ? inY : outY).push(y);
  }
  main.points(inX, inY, { color: "rgba(21,128,61,0.7)", radius: 2.2 });
  main.points(outX, outY, { color: "rgba(185,28,28,0.95)", radius: 3.0 });
  main.legend([
    { label: "predicted state", color: "#15803d" },
    { label: "safety tube", color: "rgba(21,128,61,0.4)" },
    { label: "realised, contained", color: "rgba(21,128,61,0.75)" },
    { label: "realised, escaped", color: "rgba(185,28,28,0.95)" },
  ], { x: main.X(0) + 8, y: main.Y(Math.max(7, state.ceiling + 1.2)) + 8 });

  setRO("target 1−α", pct(1 - state.alpha, 0));
  setRO("tube coverage", pct(S.cov, 1), S.cov >= 1 - state.alpha - 0.02 ? "good" : "warn");
  setRO("clearance margin", fmt(S.margin, 2));
  setRO("certified clear?", S.certified ? "yes ✓" : "no", S.certified ? "good" : "bad");
}

slider(ctrls, { label: "risk budget α", min: 0.005, max: 0.2, step: 0.005, value: state.alpha, fmt: v => v.toFixed(3) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "process noise σ", min: 0.1, max: 1.2, step: 0.05, value: state.sigma, fmt: v => v.toFixed(2) },
  v => { state.sigma = v; draw(); });
slider(ctrls, { label: "obstacle height", min: 3.5, max: 7.0, step: 0.1, value: state.ceiling, fmt: v => v.toFixed(1) },
  v => { state.ceiling = v; draw(); });
slider(ctrls, { label: "horizon", min: 10, max: 40, step: 1, value: state.horizon, fmt: v => v.toFixed(0) },
  v => { state.horizon = v; draw(); });
button(ctrls, "↻ new rollout", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
draw();
