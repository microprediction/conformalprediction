// Demo 23 — Steinitz balancing.
//
// A zero-sum population of N unit-bounded vectors in the plane, walked in three
// orders: a uniform shuffle, a greedy balanced ordering (each step appends the
// remaining vector minimizing the new prefix norm), and an adversarial angular
// sort. Panel 1: the prefix-sum paths. Panel 2: prefix norm vs t. The greedy
// rule is a heuristic; the Steinitz lemma guarantees a bounded ordering exists.
import { mulberry32, randn, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, checkbox, readouts } from "./lib/ui.js";

const COL = { rand: "#c2410c", bal: "#1f4ed8", adv: "#7d3c98" };
const state = { N: 120, showAdv: false };
let seed = 9;

const path = new Plot(document.getElementById("path"), {
  xlim: [-6, 6], ylim: [-6, 6], xlabel: "prefix sum, x", ylabel: "prefix sum, y",
  margin: { l: 56, r: 16, t: 14, b: 42 },
});
const norm = new Plot(document.getElementById("norm"), {
  xlim: [0, 120], ylim: [0, 10], xlabel: "step  t", ylabel: "prefix norm  ‖Σ z‖",
  margin: { l: 56, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["max prefix norm: balanced", "max prefix norm: random", "max prefix norm: adversarial", "running-average error at t=N/2 (balanced)"]);

function population(N, rng) {
  // unit-bounded vectors, then centered so they sum to exactly zero
  const z = [];
  for (let i = 0; i < N; i++) {
    const a = 2 * Math.PI * rng(), r = Math.sqrt(rng());
    z.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  let mx = 0, my = 0;
  for (const [x, y] of z) { mx += x; my += y; }
  mx /= N; my /= N;
  return z.map(([x, y]) => [x - mx, y - my]);
}

function prefixes(order, z) {
  const xs = [0], ys = [0], ns = [0];
  let sx = 0, sy = 0;
  for (const i of order) {
    sx += z[i][0]; sy += z[i][1];
    xs.push(sx); ys.push(sy); ns.push(Math.hypot(sx, sy));
  }
  return { xs, ys, ns };
}

function orders(z, rng) {
  const N = z.length;
  const rand = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rand[i], rand[j]] = [rand[j], rand[i]]; }
  // greedy balanced: append the remaining vector minimizing the new prefix norm
  const left = new Set(rand);
  const bal = [];
  let sx = 0, sy = 0;
  while (left.size) {
    let best = -1, bv = Infinity;
    for (const i of left) {
      const v = Math.hypot(sx + z[i][0], sy + z[i][1]);
      if (v < bv) { bv = v; best = i; }
    }
    left.delete(best); bal.push(best);
    sx += z[best][0]; sy += z[best][1];
  }
  // adversarial: sorted by angle — one long excursion and back
  const adv = Array.from({ length: N }, (_, i) => i)
    .sort((a, b) => Math.atan2(z[a][1], z[a][0]) - Math.atan2(z[b][1], z[b][0]));
  return { rand, bal, adv };
}

function draw() {
  const N = state.N, rng = mulberry32(seed);
  const z = population(N, rng);
  const O = orders(z, rng);
  const R = prefixes(O.rand, z), B = prefixes(O.bal, z), A = prefixes(O.adv, z);

  const shown = state.showAdv ? [...A.ns, ...R.ns] : R.ns;
  const lim = Math.max(4, ...shown) * 1.1;
  path.setLimits([-lim, lim], [-lim, lim]); path.clear("#fff"); path.axes({ grid: true });
  if (state.showAdv) path.line(A.xs, A.ys, { color: COL.adv, width: 1.4 });
  path.line(R.xs, R.ys, { color: COL.rand, width: 1.6 });
  path.line(B.xs, B.ys, { color: COL.bal, width: 2 });
  path.points([0], [0], { color: "#111", radius: 4 });
  path.legend([
    { label: "balanced (greedy)", color: COL.bal },
    { label: "random shuffle", color: COL.rand },
    ...(state.showAdv ? [{ label: "adversarial (angle-sorted)", color: COL.adv }] : []),
  ], { x: path.X(-lim) + 8, y: path.Y(lim) + 8 });

  const ts = Array.from({ length: N + 1 }, (_, t) => t);
  const nmax = Math.max(...shown, 1) * 1.15;
  norm.setLimits([0, N], [0, nmax]); norm.clear("#fff"); norm.axes({ grid: true });
  const sq = ts.map(t => Math.sqrt(t) * 0.55);
  norm.line(ts, sq, { color: "rgba(0,0,0,0.35)", width: 1.2, dash: [5, 4] });
  norm.text(N * 0.98, Math.min(Math.sqrt(N) * 0.55, nmax) , "√t guide ", { color: "rgba(0,0,0,0.5)", align: "right", baseline: "bottom" });
  if (state.showAdv) norm.line(ts, A.ns, { color: COL.adv, width: 1.4 });
  norm.line(ts, R.ns, { color: COL.rand, width: 1.6 });
  norm.line(ts, B.ns, { color: COL.bal, width: 2 });

  setRO("max prefix norm: balanced", fmt(Math.max(...B.ns), 2), "good");
  setRO("max prefix norm: random", fmt(Math.max(...R.ns), 2));
  setRO("max prefix norm: adversarial", fmt(Math.max(...A.ns), 2), "bad");
  const h = Math.floor(N / 2);
  setRO("running-average error at t=N/2 (balanced)", fmt(B.ns[h] / h, 3), "good");
}

const ctrls = document.getElementById("controls");
slider(ctrls, { label: "population size N", min: 40, max: 400, step: 20, value: state.N, fmt: v => v.toFixed(0) },
  v => { state.N = v; draw(); });
checkbox(ctrls, { label: "show the adversarial ordering (its excursion dwarfs the others)", checked: state.showAdv },
  v => { state.showAdv = v; draw(); });
button(ctrls, "↻ new population", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(path, draw);
autoResize(norm, () => {});
draw();
