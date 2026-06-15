// Demo 16 - A Thurstone contest at the -1/n floor.
// A fixed field of M competitors with latent strengths. Each calibration sample is a random
// subset of the field, drawn WITHOUT replacement, so the scores are negatively associated with
// pairwise correlation rho = -1/(M-1) -- the floor a Thurstone / one-winner contest sits on.
// Split conformal then holds marginal coverage but its per-case (calibration-conditional)
// coverage fans. Companion to the de Finetti note; same result as check_sign.py, in a contest.
import { mulberry32, sampleNormal, mean, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts } from "./lib/ui.js";

const alpha = 0.1, frac = 0.7;
const state = { M: 30 };

const fieldPlot = new Plot(document.getElementById("field"),
  { xlim: [0.5, 30.5], ylim: [0, 1], xlabel: "competitor (sorted by strength)", ylabel: "latent strength",
    margin: { l: 50, r: 14, t: 14, b: 40 } });
const covPlot = new Plot(document.getElementById("coverage"),
  { xlim: [0.5, 5.5], ylim: [0.5, 1.03], xlabel: "calibration sample strength  (weak → strong)",
    ylabel: "coverage", margin: { l: 52, r: 14, t: 14, b: 40 } });

const setRO = readouts(document.getElementById("readouts"),
  ["field size M", "ρ = −1/(M−1)", "marginal coverage", "conditional spread"]);

function buildField(M) {                 // frozen Thurstone-ish field of latent strengths
  const rng = mulberry32(2024 + M), f = [];
  for (let i = 0; i < M; i++) f.push(Math.abs(sampleNormal(rng, 0, 1)) * Math.exp(0.7 * sampleNormal(rng, 0, 1)));
  return f.sort((a, b) => a - b);
}

function simulate(field) {
  const M = field.length, n = Math.round(frac * M), k = Math.ceil((n + 1) * (1 - alpha));
  const rng = mulberry32(99), T = 6000, idx = Array.from({ length: M }, (_, i) => i);
  const cm = new Float64Array(T), cv = new Uint8Array(T);
  for (let t = 0; t < T; t++) {
    for (let i = 0; i <= n; i++) {       // partial Fisher-Yates: first n+1 are the sample
      const j = i + Math.floor(rng() * (M - i)), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    const cal = []; for (let i = 0; i < n; i++) cal.push(field[idx[i]]);
    const test = field[idx[n]];
    cal.sort((a, b) => a - b);
    cm[t] = mean(cal); cv[t] = test <= cal[k - 1] ? 1 : 0;
  }
  // coverage by calibration-mean quintile
  const order = Array.from({ length: T }, (_, t) => t).sort((a, b) => cm[a] - cm[b]);
  const bins = [];
  for (let b = 0; b < 5; b++) {
    let s = 0, c = 0;
    for (let r = b * T / 5; r < (b + 1) * T / 5; r++) { s += cv[order[r]]; c++; }
    bins.push(s / c);
  }
  let marg = 0; for (let t = 0; t < T; t++) marg += cv[t]; marg /= T;
  return { bins, marg, n, k };
}

function draw() {
  const M = state.M, field = buildField(M), sim = simulate(field), rho = -1 / (M - 1);

  // field panel
  fieldPlot.clear("#fff"); fieldPlot.setLimits([0.5, M + 0.5], [0, Math.max(...field) * 1.12]);
  fieldPlot.clear("#fff"); fieldPlot.axes({ grid: true });
  for (let i = 0; i < M; i++)
    fieldPlot.bars([i + 1], [field[i]], 0.8, { base: 0, color: "rgba(31,78,216,0.55)" });
  const fctx = fieldPlot.ctx; fctx.fillStyle = "#64748b";
  fctx.font = "12px ui-sans-serif, system-ui, sans-serif"; fctx.textAlign = "right"; fctx.textBaseline = "alphabetic";
  fctx.fillText(`M = ${M} competitors,  ρ = −1/(M−1) = ${fmt(rho, 3)}`, fieldPlot.X(M + 0.5) - 4, fieldPlot.Y(Math.max(...field) * 1.06));

  // coverage panel
  const lo = Math.min(0.6, Math.min(...sim.bins) - 0.04);
  covPlot.clear("#fff"); covPlot.setLimits([0.5, 5.5], [lo, 1.03]); covPlot.clear("#fff"); covPlot.axes({ grid: true });
  covPlot.hline(1 - alpha, { color: "rgba(0,0,0,0.45)", dash: [5, 4], width: 1.5 });   // target
  covPlot.hline(sim.marg, { color: "rgba(217,119,6,0.95)", dash: [6, 4], width: 2 });   // marginal
  covPlot.line([1, 2, 3, 4, 5], sim.bins, { color: "#b91c1c", width: 2.5 });
  covPlot.points([1, 2, 3, 4, 5], sim.bins, { color: "#b91c1c", radius: 4 });
  covPlot.legend([
    { label: "per-case coverage (by calibration sample)", color: "#b91c1c" },
    { label: "marginal coverage", color: "rgba(217,119,6,0.95)", dash: [6, 4] },
    { label: "target 1−α", color: "rgba(0,0,0,0.45)", dash: [5, 4] },
  ], { x: covPlot.X(0.5) + 8, y: covPlot.Y(1.03) + 6 });

  setRO("field size M", String(M));
  setRO("ρ = −1/(M−1)", fmt(rho, 3), M <= 25 ? "bad" : "warn");
  setRO("marginal coverage", fmt(sim.marg, 3), "good");
  setRO("conditional spread", fmt(Math.max(...sim.bins) - Math.min(...sim.bins), 2), "bad");
}

slider(document.getElementById("controls"),
  { label: "field size  M  (smaller ⇒ closer to the −1/n floor)", min: 12, max: 80, step: 1, value: state.M, fmt: v => v.toFixed(0) },
  v => { state.M = Math.round(v); draw(); });

autoResize(fieldPlot, draw); autoResize(covPlot, draw); draw();
