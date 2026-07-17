// Demo 19 — The dependence tax: split conformal on MA(t) noise.
//
// Live reproduction of Figure 1 of Barber & Pananjady (2026), "Predictive inference
// for time series: why is split conformal effective despite temporal dependence?"
// (arXiv:2510.02471). Noise eps_i = sum_{j=i-t}^{i} W_j with W_j iid N(0,1); score
// s_i = |eps_i| (pretrained oracle predictor); split conformal covers iff s_{n+1}
// falls below the ceil((1-alpha)(n+1))-th order statistic of the n calibration
// scores. Coverage is Monte Carlo'd progressively for three calibration sizes
// n, 2n, 3n over a grid of ratios t/n, so the curves sharpen while you watch.
//
// Overlays: the nominal level 1-alpha (dotted), a reference line of slope alpha
// per unit t/n (grey dashed, the empirical law), and — in zoom-out mode — the
// switch-coefficient worst-case floor 1 - alpha - (t+1)/(n+1) (blue dashed),
// which for MA(t) is the bound min_tau { tau/(n+1) + 2 beta(tau) } with
// beta(tau) = 0 beyond lag t.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, checkbox, readouts } from "./lib/ui.js";

const RMAX = 0.35;                      // largest ratio t/n shown
const NPTS = 11;                        // grid points along t/n
const MMAX = 400000;                    // trials per point before we stop
const COL = ["#1f4ed8", "#c2410c", "#15803d"];
const REF = "rgba(100,100,100,0.8)";
const BOUND = "#1f4ed8";

const plot = new Plot(document.getElementById("main"), {
  xlim: [0, RMAX], ylim: [0.85, 0.92], xlabel: "ratio  t/n", ylabel: "coverage",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "trials per point", "coverage at t/n = 0.35", "worst-case floor there", "fitted tax slope ÷ α"]);

const state = { alpha: 0.10, nBase: 60, zoom: false };
let seed = 7;

// Per-(curve, gridpoint) accumulators and independent RNG streams.
let acc = null;
function reset() {
  const ratios = [];
  for (let j = 0; j < NPTS; j++) ratios.push((j * RMAX) / (NPTS - 1));
  acc = { ratios, ns: [1, 2, 3].map(m => m * state.nBase), cover: [], trials: [], rngs: [], ts: [] };
  for (let c = 0; c < 3; c++) {
    const n = acc.ns[c];
    acc.cover.push(new Float64Array(NPTS));
    acc.trials.push(new Float64Array(NPTS));
    acc.ts.push(ratios.map(r => Math.round(r * n)));
    acc.rngs.push(ratios.map((_, j) => mulberry32((seed * 2654435761 + c * 97 + j * 13) >>> 0)));
  }
}

// One split-conformal trial on an MA(t) path of length n+1. Covers iff fewer than
// k = ceil((1-alpha)(n+1)) calibration scores sit strictly below the test score.
function trial(rng, n, t, k) {
  const L = n + 1 + t;
  const W = new Float64Array(L);
  for (let i = 0; i < L; i++) W[i] = randn(rng);
  let st = 0;                              // test score: eps_{n+1} = W[n] + ... + W[n+t]
  for (let j = n; j < L; j++) st += W[j];
  const test = Math.abs(st);
  let s = 0;                               // sliding window over the calibration scores
  for (let j = 0; j <= t; j++) s += W[j];
  let cnt = Math.abs(s) < test ? 1 : 0;    // eps_1
  for (let i = 1; i < n; i++) {            // eps_2 .. eps_n
    s += W[i + t] - W[i - 1];
    if (Math.abs(s) < test) cnt++;
  }
  return cnt < k;
}

let rr = 0; // round-robin cursor over (curve, point)
function step(budgetMs) {
  const t0 = performance.now();
  const B = 24; // trials per visit
  let did = false;
  while (performance.now() - t0 < budgetMs) {
    const c = rr % 3, j = Math.floor(rr / 3) % NPTS;
    rr++;
    if (acc.trials[c][j] >= MMAX) continue;
    const n = acc.ns[c], t = acc.ts[c][j];
    const k = Math.ceil((1 - state.alpha) * (n + 1));
    const rng = acc.rngs[c][j];
    let cov = 0;
    for (let b = 0; b < B; b++) if (trial(rng, n, t, k)) cov++;
    acc.cover[c][j] += cov;
    acc.trials[c][j] += B;
    did = true;
  }
  return did;
}

function fittedSlope() {
  // least squares through the origin on (r, nominal_iid - coverage), pooled.
  let num = 0, den = 0;
  for (let c = 0; c < 3; c++) {
    const n = acc.ns[c];
    const iid = Math.ceil((1 - state.alpha) * (n + 1)) / (n + 1); // exact iid coverage
    for (let j = 1; j < NPTS; j++) {
      if (acc.trials[c][j] < 2000) continue;
      const r = acc.ratios[j], loss = iid - acc.cover[c][j] / acc.trials[c][j];
      num += r * loss; den += r * r;
    }
  }
  return den > 0 ? num / den : NaN;
}

function draw() {
  const a = state.alpha, target = 1 - a;
  const floorAt = r => target - (Math.round(r * acc.ns[1]) + 1) / (acc.ns[1] + 1);

  // y-limits: zoomed to the data, or out to the worst-case floor.
  let lo, hi;
  if (state.zoom) { lo = floorAt(RMAX) - 0.03; hi = target + 0.06 * a / 0.1; }
  else {
    lo = target - 1.35 * a * RMAX; hi = target + 0.25 * a * RMAX;
    for (let c = 0; c < 3; c++) for (let j = 0; j < NPTS; j++)
      if (acc.trials[c][j] > 2000) lo = Math.min(lo, acc.cover[c][j] / acc.trials[c][j] - 0.004);
  }
  plot.setLimits([0, RMAX], [lo, hi]);
  plot.clear("#fff"); plot.axes({ grid: true });

  // nominal + reference slope alpha, + optional worst-case floor
  plot.line([0, RMAX], [target, target], { color: "rgba(0,0,0,0.55)", width: 1.3, dash: [5, 4] });
  plot.text(0.004, target, "1−α", { color: "rgba(0,0,0,0.6)", baseline: "bottom" });
  plot.line([0, RMAX], [target, target - a * RMAX], { color: REF, width: 1.3, dash: [7, 5] });
  plot.text(RMAX * 0.72, target - a * RMAX * 0.66, "slope α (reference)", { color: REF, baseline: "top" });
  if (state.zoom) {
    const xs = acc.ratios, ys = xs.map(floorAt);
    plot.line(xs, ys, { color: BOUND, width: 1.6, dash: [3, 4] });
    plot.text(RMAX * 0.45, floorAt(RMAX * 0.55), "worst-case floor  1−α−(t+1)/(n+1)", { color: BOUND, baseline: "top" });
  }

  // the three Monte Carlo curves with ±2se ribbons
  const leg = [];
  for (let c = 0; c < 3; c++) {
    const xs = [], ys = [], yl = [], yh = [];
    for (let j = 0; j < NPTS; j++) {
      const M = acc.trials[c][j];
      if (M < 500) continue;
      const p = acc.cover[c][j] / M, se = Math.sqrt(Math.max(p * (1 - p), 1e-9) / M);
      xs.push(acc.ratios[j]); ys.push(p); yl.push(p - 2 * se); yh.push(p + 2 * se);
    }
    if (xs.length > 1) {
      plot.band(xs, yl, yh, { color: softFill(COL[c], 0.14) });
      plot.line(xs, ys, { color: COL[c], width: 2 });
      plot.points(xs, ys, { color: COL[c], radius: 2.4 });
    }
    leg.push({ label: `n = ${acc.ns[c]}`, color: COL[c] });
  }
  plot.legend(leg, { x: plot.X(0) + 8, y: plot.Y(hi) + 8 });

  // readouts
  setRO("target 1−α", pct(target, 0));
  let mmin = Infinity;
  for (let c = 0; c < 3; c++) for (let j = 0; j < NPTS; j++) mmin = Math.min(mmin, acc.trials[c][j]);
  setRO("trials per point", mmin >= MMAX ? `${fmt(MMAX / 1000, 0)}k (done)` : `${fmt(mmin / 1000, 1)}k…`);
  const jl = NPTS - 1, Ml = acc.trials[2][jl];
  setRO("coverage at t/n = 0.35", Ml > 500 ? fmt(acc.cover[2][jl] / Ml, 4) : "–");
  setRO("worst-case floor there", fmt(target - (acc.ts[2][jl] + 1) / (acc.ns[2] + 1), 3));
  const sl = fittedSlope();
  setRO("fitted tax slope ÷ α", Number.isFinite(sl) ? fmt(sl / a, 2) : "–", Number.isFinite(sl) && sl / a < 2 ? "good" : "");
}

function softFill(hex, aa) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${aa})`;
}

// ---- controls ----
const ctrls = document.getElementById("controls");
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; reset(); });
slider(ctrls, { label: "calibration sizes  n, 2n, 3n", min: 40, max: 120, step: 10, value: state.nBase, fmt: v => `${v}, ${2 * v}, ${3 * v}` },
  v => { state.nBase = v; reset(); });
checkbox(ctrls, { label: "zoom out: show the worst-case floor (switch-coefficient bound)", checked: false },
  v => { state.zoom = v; draw(); });
button(ctrls, "↻ restart", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; reset(); });

reset();
autoResize(plot, draw);
(function loop() {
  const did = step(11);
  draw();
  if (did) requestAnimationFrame(loop);
  else setTimeout(() => requestAnimationFrame(loop), 250); // idle poll for control changes
})();
