// Demo 15 - de Finetti and Kerns-Szekely: when the mixing measure goes negative.
// Symmetric two-coin (n=2) slice. An exchangeable law on {0,1}^2 is (p0,p1,p2), the
// distribution of the number of heads -- a point in a triangle. The i.i.d. laws
// Bernoulli(t)^2 trace a parabola. de Finetti's positive mixtures fill the rho>=0 lens;
// negative correlation forces a SIGNED mixing measure (Kerns-Szekely).
import { fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts } from "./lib/ui.js";

const state = { rho: 0.0 };
const HT = 0.866;                                   // triangle height
const bary = (p0, p1, p2) => [p2 + 0.5 * p1, HT * p1];   // (p0,p1,p2) -> 2D
const lawFromRho = (r) => [(1 + r) / 4, (1 - r) / 2, (1 + r) / 4]; // symmetric two-coin law

const simplex = new Plot(document.getElementById("simplex"),
  { xlim: [-0.08, 1.08], ylim: [-0.10, HT + 0.16], margin: { l: 10, r: 10, t: 12, b: 12 } });
const weights = new Plot(document.getElementById("weights"),
  { xlim: [-0.6, 2.6], ylim: [-0.8, 2.2], ylabel: "mixing weight", margin: { l: 52, r: 14, t: 14, b: 36 } });

const setRO = readouts(document.getElementById("readouts"),
  ["correlation ρ", "mixing measure", "extends to ∞?"]);

function drawSimplex() {
  const ctx = simplex.ctx; simplex.clear("#fff");
  const X = (x) => simplex.X(x), Y = (y) => simplex.Y(y);
  // i.i.d. parabola, sampled
  const arc = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; arc.push(bary((1 - t) * (1 - t), 2 * t * (1 - t), t * t)); }
  // de Finetti hull = lens between parabola and the bottom chord (rho >= 0)
  ctx.beginPath();
  arc.forEach(([x, y], i) => { i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); });
  ctx.closePath(); ctx.fillStyle = "rgba(31,78,216,0.10)"; ctx.fill();
  // triangle edges
  const V0 = bary(1, 0, 0), V1 = bary(0, 1, 0), V2 = bary(0, 0, 1);
  simplex.line([V0[0], V1[0], V2[0], V0[0]], [V0[1], V1[1], V2[1], V0[1]], { color: "rgba(0,0,0,0.45)", width: 1.5 });
  simplex.line(arc.map(a => a[0]), arc.map(a => a[1]), { color: "#d97706", width: 2.5 });
  // labels
  ctx.fillStyle = "#334155"; ctx.font = "12px ui-sans-serif, system-ui, sans-serif"; ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center"; ctx.fillText("TT (p₀=1)", X(V0[0]) + 18, Y(V0[1]) + 15);
  ctx.fillText("HH (p₂=1)", X(V2[0]) - 18, Y(V2[1]) + 15);
  ctx.fillText("one head (p₁=1)", X(V1[0]), Y(V1[1]) - 8);
  ctx.textAlign = "left"; ctx.fillStyle = "rgba(31,78,216,0.85)";
  ctx.fillText("de Finetti: positive mixtures, ρ ≥ 0", X(0.30), Y(0.30 * HT));
  ctx.fillStyle = "rgba(185,28,28,0.9)";
  ctx.fillText("signed (Székely): ρ < 0", X(0.34), Y(0.86 * HT));
  // current law
  const [p0, p1, p2] = lawFromRho(state.rho), [x, y] = bary(p0, p1, p2);
  simplex.points([x], [y], { color: state.rho >= 0 ? "#1f4ed8" : "#b91c1c", radius: 6 });
}

function drawWeights() {
  weights.clear("#fff"); weights.axes({ grid: true });
  weights.hline(0, { color: "rgba(0,0,0,0.55)", width: 1.5 });
  const w = [state.rho / 2, 1 - state.rho, state.rho / 2];   // weights at theta = 0, 1/2, 1
  for (let i = 0; i < 3; i++)
    weights.bars([i], [w[i]], 0.6, { base: 0, color: w[i] >= 0 ? "rgba(31,78,216,0.6)" : "rgba(185,28,28,0.65)" });
  const ctx = weights.ctx; ctx.fillStyle = "#334155";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ["θ=0", "θ=½", "θ=1"].forEach((s, i) => ctx.fillText(s, weights.X(i), weights.Y(0) + 16));
  ctx.fillStyle = "#64748b"; ctx.textAlign = "left";
  ctx.fillText("the de Finetti measure over θ", weights.X(-0.5) + 4, weights.Y(2.15));
}

function draw() {
  drawSimplex(); drawWeights();
  const neg = state.rho < 0;
  setRO("correlation ρ", fmt(state.rho, 2), neg ? "bad" : "good");
  setRO("mixing measure", neg ? "signed (Székely)" : "probability (de Finetti)", neg ? "bad" : "good");
  setRO("extends to ∞?", neg ? "no" : "yes", neg ? "bad" : "good");
}

slider(document.getElementById("controls"),
  { label: "correlation between the two coins  ρ", min: -1, max: 1, step: 0.02, value: state.rho, fmt: v => v.toFixed(2) },
  v => { state.rho = v; draw(); });

autoResize(simplex, draw); autoResize(weights, draw); draw();
