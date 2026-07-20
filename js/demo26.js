// Demo 26 — Conformal prediction as Bayesian quadrature (Snell & Griffiths 2025).
//
// Panel 1: n sorted calibration scores cut the line into n+1 gaps; each gap
// carries Dirichlet(1,...,1) mass with mean 1/(n+1); the threshold q = S_(k)
// separates the first k gaps (realized coverage) from the rest.
// Panel 2: the exact posterior over realized coverage, Beta(k, n+1-k),
// overlaid with a Monte Carlo histogram of realized coverage F(S_(k)) across
// fresh calibration draws. Distribution-free: the histogram matches the Beta
// for every score distribution offered.
import { mulberry32, randn, histogram, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, readouts } from "./lib/ui.js";

const COL = { cov: "#1f4ed8", unc: "#c2410c", beta: "#111", mc: "rgba(31,78,216,0.25)", mark: "#7d3c98" };
const DISTS = { unif: "uniform", gauss: "Gaussian", heavy: "heavy-tailed" };
const state = { n: 39, alpha: 0.1, qlev: 0.1, dist: "gauss" };
let seed = 21;

const quad = new Plot(document.getElementById("quad"), {
  xlim: [0, 1], ylim: [0, 1], xlabel: "score line (n sorted calibration scores)", ylabel: "gap mass",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});
const post = new Plot(document.getElementById("post"), {
  xlim: [0.5, 1], ylim: [0, 10], xlabel: "realized coverage of the interval", ylabel: "density",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["k of n+1 (posterior mean)", "posterior sd", "lower quantile of coverage", "P(coverage < 1−α)"]);

function lgamma(x) {
  // Lanczos
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let s = 1.000000000190015, t = x + 5.5;
  for (let j = 0; j < 6; j++) s += g[j] / (x + 1 + j);
  return Math.log(2.5066282746310005 * s / x) - t + (x + 0.5) * Math.log(t);
}
function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x));
}
function betaCdf(x, a, b) {
  // regularized incomplete beta via continued fraction
  if (x <= 0) return 0; if (x >= 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2);
    let num;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d; f *= cd;
    if (Math.abs(1 - cd) < 1e-10) break;
  }
  const val = front * (f - 1);
  return x < (a + 1) / (a + b + 2) ? val : 1 - betaCdf(1 - x, b, a);
}
function betaInv(p, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function drawScore(rng) {
  if (state.dist === "unif") return rng();
  if (state.dist === "gauss") return randn(rng);
  const u = rng(); return randn(rng) / Math.sqrt(Math.max(u, 0.02));
}
function cdfOf(x) {
  if (state.dist === "unif") return Math.min(Math.max(x, 0), 1);
  if (state.dist === "gauss") { // normCdf inline via erf approx
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    let pr = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - pr : pr;
  }
  return NaN; // heavy: no closed form used; MC uses empirical rank instead
}

function draw() {
  const n = state.n, N = n + 1, k = Math.ceil((1 - state.alpha) * N);
  const a = k, b = N - k;
  const rng = mulberry32(seed);

  // panel 1: sorted scores mapped to [0,1] by plotting rank position; gap masses at mean 1/(n+1)
  const raw = Array.from({ length: n }, () => drawScore(rng)).sort((x, y) => x - y);
  const lo = raw[0] - 0.05 * (raw[n - 1] - raw[0] + 1e-9), hi = raw[n - 1] + 0.05 * (raw[n - 1] - raw[0] + 1e-9);
  const xs = raw.map(v => (v - lo) / (hi - lo));
  quad.setLimits([0, 1], [0, 2.2 / N]); quad.clear("#fff"); quad.axes({ grid: false });
  const edges = [0, ...xs, 1];
  for (let g = 0; g < N; g++) {
    const x0 = edges[g], x1 = edges[g + 1];
    const covered = g < k;
    quad.bars([(x0 + x1) / 2], [1 / N], x1 - x0, { color: covered ? "rgba(31,78,216,0.35)" : "rgba(194,65,12,0.35)", stroke: "#fff" });
  }
  for (const x of xs) quad.vline(x, { color: "rgba(0,0,0,0.35)", width: 1 });
  quad.vline(xs[k - 1], { color: COL.mark, width: 2.5 });
  quad.text(xs[k - 1] + 0.01, 1.9 / N, "q = S(k)", { color: COL.mark });
  quad.text(0.02, 1.6 / N, "each gap: mean mass 1/(n+1); blue = below threshold", { color: "#444" });

  // panel 2: Beta posterior + MC realized coverage
  const M = 3000, cov = [];
  for (let m = 0; m < M; m++) {
    const s = Array.from({ length: n }, () => drawScore(rng)).sort((x, y) => x - y);
    const q = s[k - 1];
    if (state.dist === "heavy") {
      // empirical F via a large reference sample (same law), enough for a histogram
      let c = 0; for (let j = 0; j < 400; j++) c += (drawScore(rng) <= q) ? 1 : 0;
      cov.push(c / 400);
    } else cov.push(cdfOf(q));
  }
  const mean = k / N, sd = Math.sqrt(a * b / ((a + b) * (a + b) * (a + b + 1)));
  const xlo = Math.max(0, mean - 6 * sd), xhi = Math.min(1, mean + 5 * sd);
  const grid = Array.from({ length: 400 }, (_, i) => xlo + (i / 399) * (xhi - xlo));
  const pdf = grid.map(x => betaPdf(x, a, b));
  const ymax = Math.max(...pdf) * 1.15;
  post.setLimits([xlo, xhi], [0, ymax]); post.clear("#fff"); post.axes({ grid: true });
  const H = histogram(cov, 40, xlo, xhi);
  const bw = H.edges[1] - H.edges[0];
  const centers = [], dens = [];
  for (let i = 0; i < H.counts.length; i++) {
    centers.push((H.edges[i] + H.edges[i + 1]) / 2);
    dens.push(Math.min(H.counts[i] / (M * bw), ymax));
  }
  post.bars(centers, dens, bw, { color: COL.mc });
  post.line(grid, pdf, { color: COL.beta, width: 2 });
  post.vline(mean, { color: COL.mark, width: 2 });
  post.text(mean, ymax * 0.97, " mean k/(n+1)", { color: COL.mark });
  const qv = betaInv(state.qlev, a, b);
  post.vline(qv, { color: "#b91c1c", width: 2 });
  post.text(qv, ymax * 0.85, ` ${pct(state.qlev, 0)} quantile`, { color: "#b91c1c" });
  post.vline(1 - state.alpha, { color: "rgba(0,0,0,0.4)", width: 1.2 });
  post.text(1 - state.alpha, ymax * 0.73, " 1−α", { color: "#555" });
  post.legend([
    { label: "Beta(k, n+1−k) posterior", color: COL.beta },
    { label: "MC realized coverage", color: "rgba(31,78,216,0.6)" },
  ], { x: post.X(xlo) + 8, y: post.Y(ymax) + 8 });

  setRO("k of n+1 (posterior mean)", `${k} / ${N} = ${fmt(mean, 4)}`);
  setRO("posterior sd", fmt(sd, 4));
  setRO("lower quantile of coverage", `${pct(state.qlev, 0)}: ${fmt(qv, 4)}`, qv >= 1 - state.alpha ? "good" : "bad");
  setRO("P(coverage < 1−α)", pct(betaCdf(1 - state.alpha, a, b), 1));
}

const ctrls = document.getElementById("controls");
const row = document.createElement("div"); row.className = "control";
const btns = {};
for (const key in DISTS) btns[key] = button(row, DISTS[key], () => { state.dist = key; refresh(); draw(); });
ctrls.appendChild(row);
function refresh() {
  for (const key in btns) {
    const on = key === state.dist, bt = btns[key];
    bt.style.borderColor = on ? "var(--accent)" : "var(--line)";
    bt.style.color = on ? "var(--accent)" : "var(--ink)";
    bt.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
slider(ctrls, { label: "calibration size n", min: 9, max: 399, step: 10, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.05, max: 0.3, step: 0.05, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "reported lower quantile of the posterior", min: 0.01, max: 0.5, step: 0.01, value: state.qlev, fmt: v => v.toFixed(2) },
  v => { state.qlev = v; draw(); });
button(ctrls, "↻ redraw scores", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

refresh();
autoResize(post, draw);
autoResize(quad, () => {});
draw();
