// Demo 24 — Balanced placements: the conformal side of the Steinitz duality.
//
// Draw N = n+1 scores (the distribution is irrelevant to the count), mark the
// k covered placements (rank <= k), then traverse the placements in two
// orders: a uniform shuffle and the balanced word
// b_t = floor(tk/N + 1/2) - floor((t-1)k/N + 1/2). The panel shows the running
// placement-acceptance average deviation (1/t) sum chi - k/N, with the +/- 1/(2t)
// envelope. The balanced traversal stays inside it at every prefix; at t = N
// both orders land exactly on zero.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, readouts } from "./lib/ui.js";

const COL = { rand: "#c2410c", bal: "#1f4ed8", env: "rgba(0,0,0,0.45)" };
const DISTS = { iid: "i.i.d. Gaussian", heavy: "heavy-tailed", trend: "adversarial trend" };
const state = { n: 79, alpha: 0.1, dist: "iid" };
let seed = 13;

const dev = new Plot(document.getElementById("dev"), {
  xlim: [1, 80], ylim: [-0.2, 0.2], xlabel: "prefix length  t", ylabel: "acceptance average − k/N",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["k of N covered", "max |prefix count − tk/N|: balanced", "max |prefix count − tk/N|: random", "value at t = N (both)"]);

function scores(N, rng) {
  const s = new Float64Array(N);
  if (state.dist === "iid") for (let i = 0; i < N; i++) s[i] = randn(rng);
  else if (state.dist === "heavy") for (let i = 0; i < N; i++) { const u = rng(); s[i] = randn(rng) / Math.sqrt(Math.max(u, 0.02)); }
  else for (let i = 0; i < N; i++) s[i] = 0.08 * i + 0.6 * randn(rng);
  return s;
}

function draw() {
  const N = state.n + 1, k = Math.ceil((1 - state.alpha) * N);
  const rng = mulberry32(seed);
  const s = scores(N, rng);

  // covered placements: rank <= k
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => s[a] - s[b] || a - b);
  const covered = new Array(N).fill(false);
  for (let r = 0; r < k; r++) covered[order[r]] = true;
  const covIdx = [], uncIdx = [];
  for (let i = 0; i < N; i++) (covered[i] ? covIdx : uncIdx).push(i);

  // balanced word traversal
  const balSeq = [];
  let ci = 0, ui = 0;
  for (let t = 1; t <= N; t++) {
    const b = Math.floor((t * k) / N + 0.5) - Math.floor(((t - 1) * k) / N + 0.5);
    balSeq.push(b === 1 ? covIdx[ci++] : uncIdx[ui++]);
  }
  // random traversal
  const randSeq = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [randSeq[i], randSeq[j]] = [randSeq[j], randSeq[i]]; }

  function devs(seq) {
    const ts = [], ds = [], counts = [];
    let c = 0;
    for (let t = 1; t <= N; t++) {
      c += covered[seq[t - 1]] ? 1 : 0;
      ts.push(t); ds.push(c / t - k / N); counts.push(Math.abs(c - (t * k) / N));
    }
    return { ts, ds, maxCount: Math.max(...counts) };
  }
  const B = devs(balSeq), R = devs(randSeq);

  const lim = Math.max(0.06, ...R.ds.map(Math.abs), ...B.ds.map(Math.abs)) * 1.25;
  dev.setLimits([1, N], [-lim, lim]); dev.clear("#fff"); dev.axes({ grid: true });
  // +/- 1/(2t) envelope
  const ets = [], eup = [], edn = [];
  for (let t = 1; t <= N; t++) { ets.push(t); eup.push(Math.min(1 / (2 * t), lim)); edn.push(Math.max(-1 / (2 * t), -lim)); }
  dev.line(ets, eup, { color: COL.env, width: 1.3, dash: [5, 4] });
  dev.line(ets, edn, { color: COL.env, width: 1.3, dash: [5, 4] });
  dev.text(N * 0.7, 1 / (2 * Math.max(2, N * 0.7)) + lim * 0.06, "±1/(2t) envelope", { color: COL.env });
  dev.hline(0, { color: "rgba(0,0,0,0.35)", width: 1 });
  dev.line(R.ts, R.ds, { color: COL.rand, width: 1.6 });
  dev.line(B.ts, B.ds, { color: COL.bal, width: 2 });
  dev.legend([
    { label: "balanced word", color: COL.bal },
    { label: "random shuffle", color: COL.rand },
  ], { x: dev.X(1) + 8, y: dev.Y(lim) + 8 });

  setRO("k of N covered", `${k} of ${N}`);
  setRO("max |prefix count − tk/N|: balanced", fmt(B.maxCount, 3), B.maxCount <= 0.5 + 1e-9 ? "good" : "bad");
  setRO("max |prefix count − tk/N|: random", fmt(R.maxCount, 2));
  setRO("value at t = N (both)", fmt(Math.abs(B.ds[N - 1]) + Math.abs(R.ds[N - 1]), 6), "good");
}

const ctrls = document.getElementById("controls");
const row = document.createElement("div"); row.className = "control";
const btns = {};
for (const key in DISTS) btns[key] = button(row, DISTS[key], () => { state.dist = key; refresh(); draw(); });
ctrls.appendChild(row);
function refresh() {
  for (const key in btns) {
    const on = key === state.dist, b = btns[key];
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
slider(ctrls, { label: "calibration size n  (N = n+1 placements)", min: 19, max: 199, step: 10, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.3, step: 0.05, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ redraw scores", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

refresh();
autoResize(dev, draw);
draw();
