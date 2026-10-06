// Demo 29 — Just a transform. The fence-post rank map, interpolated, is an
// invertible univariate monotone transform: exact at its retained knots on
// exchangeable input whatever the law, within one knot cell of calibrated
// everywhere, and convergent to the oracle Gaussianizer Phi^{-1}(F(y)).
// Panel 1 draws the implemented map against the oracle. Panel 2 draws the
// calibration of the probability-scale output U = Phi(m(Y)) on fresh draws,
// with the retained levels ticked: the empirical CDF pins the diagonal at
// every knot, and the retained-cell width Delta_n bounds the excursion
// between them.
import { mulberry32, randn, normCdf, normInv, fmt }
  from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const COL = {
  map: "#1f4ed8",
  oracle: "rgba(0,0,0,0.55)",
  knots: "#b45309",
  cal: "#1f4ed8",
  diag: "rgba(0,0,0,0.55)",
  cell: "rgba(180,83,9,0.18)",
};

const DISTS = {
  gaussian: {
    label: "Gaussian",
    sample: (rng) => randn(rng),
    cdf: (y) => normCdf(y),
    xlim: [-3.2, 3.2],
  },
  lognormal: {
    label: "lognormal",
    sample: (rng) => Math.exp(0.9 * randn(rng)) - 1.2,
    cdf: (y) => (y + 1.2 > 0 ? normCdf(Math.log(y + 1.2) / 0.9) : 0),
    xlim: [-1.4, 5],
  },
  student: {
    label: "heavy-tailed",
    sample: (rng) => {
      // Student t3 via normal / sqrt(chi2/3)
      const z = randn(rng);
      const c = randn(rng) ** 2 + randn(rng) ** 2 + randn(rng) ** 2;
      return z / Math.sqrt(c / 3);
    },
    cdf: (y) => {
      // t3 CDF, closed form
      const a = y / Math.sqrt(3);
      return 0.5 + (1 / Math.PI) * (a / (1 + a * a) + Math.atan(a));
    },
    xlim: [-6, 6],
  },
  bimodal: {
    label: "bimodal",
    sample: (rng) => (rng() < 0.5 ? -1.6 : 1.6) + 0.55 * randn(rng),
    cdf: (y) => 0.5 * normCdf(y, -1.6, 0.55) + 0.5 * normCdf(y, 1.6, 0.55),
    xlim: [-3.6, 3.6],
  },
};

const mapPlot = new Plot(document.getElementById("mapview"), {
  xlim: [-3.2, 3.2], ylim: [-3, 3], xlabel: "observation y", ylabel: "transformed z",
});
const calPlot = new Plot(document.getElementById("calview"), {
  xlim: [0, 1], ylim: [0, 1], xlabel: "nominal level u", ylabel: "P(U ≤ u) on fresh draws",
});

const setRO = readouts(document.getElementById("readouts"),
  ["retained knots", "largest retained cell Δ", "worst miss at a knot", "worst miss between knots"]);
const ctrls = document.getElementById("controls");

const state = { dist: "lognormal", n: 300, K: 39 };
let seed = 7;

function build() {
  const D = DISTS[state.dist];
  const rng = mulberry32(seed);
  const ys = Array.from({ length: state.n }, () => D.sample(rng)).sort((a, b) => a - b);
  const n = ys.length;
  const K = Math.min(state.K, n);
  const cs = [], zs = [];
  for (let i = 0; i < K; i++) {
    const idx = Math.floor((i + 0.5) * n / K);
    const y = ys[idx];
    if (cs.length && y <= cs[cs.length - 1]) continue;
    cs.push(y);
    zs.push(normInv((idx + 1) / (n + 1)));
  }
  const m = (y) => {
    if (y <= cs[0]) {
      const s = (zs[1] - zs[0]) / (cs[1] - cs[0]);
      return zs[0] + s * (y - cs[0]);
    }
    if (y >= cs[cs.length - 1]) {
      const k = cs.length - 1;
      const s = (zs[k] - zs[k - 1]) / (cs[k] - cs[k - 1]);
      return zs[k] + s * (y - cs[k]);
    }
    let lo = 0, hi = cs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cs[mid] <= y) lo = mid; else hi = mid;
    }
    return zs[lo] + (zs[hi] - zs[lo]) * (y - cs[lo]) / (cs[hi] - cs[lo]);
  };
  return { D, rng, cs, zs, m };
}

function draw() {
  const { D, rng, cs, zs, m } = build();

  // Panel 1: the map against the oracle.
  mapPlot.setLimits(D.xlim, [-3, 3]);
  mapPlot.clear();
  mapPlot.axes();
  const xs = [], ms = [], os = [];
  for (let i = 0; i <= 400; i++) {
    const y = D.xlim[0] + (i / 400) * (D.xlim[1] - D.xlim[0]);
    xs.push(y);
    ms.push(m(y));
    const p = Math.min(1 - 1e-9, Math.max(1e-9, D.cdf(y)));
    os.push(normInv(p));
  }
  mapPlot.line(xs, os, { color: COL.oracle, width: 1.4, dash: [5, 4] });
  mapPlot.line(xs, ms, { color: COL.map, width: 2 });
  mapPlot.points(cs, zs, { color: COL.knots, radius: 2.6 });
  mapPlot.legend([
    { label: "implemented map (knots at order statistics)", color: COL.map },
    { label: "oracle Φ⁻¹(F(y))", color: COL.oracle },
  ]);

  // Panel 2: calibration of U on fresh draws from the same law.
  const M = 6000;
  const us = new Float64Array(M);
  for (let i = 0; i < M; i++) us[i] = normCdf(m(D.sample(rng)));
  us.sort();
  const levels = zs.map(normCdf);
  const ecdf = (u) => {
    let lo = -1, hi = M;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (us[mid] <= u) lo = mid; else hi = mid;
    }
    return (lo + 1) / M;
  };
  calPlot.clear();
  calPlot.axes();
  // retained-cell shading around the worst cell
  let dmax = levels[0], dArg = [0, levels[0]];
  for (let j = 1; j < levels.length; j++) {
    if (levels[j] - levels[j - 1] > dmax) { dmax = levels[j] - levels[j - 1]; dArg = [levels[j - 1], levels[j]]; }
  }
  if (1 - levels[levels.length - 1] > dmax) { dmax = 1 - levels[levels.length - 1]; dArg = [levels[levels.length - 1], 1]; }
  calPlot.vspan(dArg[0], dArg[1], { color: COL.cell });
  const gu = [], ge = [];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    gu.push(u);
    ge.push(ecdf(u));
  }
  calPlot.line([0, 1], [0, 1], { color: COL.diag, width: 1.2, dash: [5, 4] });
  calPlot.line(gu, ge, { color: COL.cal, width: 2 });
  calPlot.points(levels, levels.map(ecdf), { color: COL.knots, radius: 2.4 });
  calPlot.legend([
    { label: "empirical CDF of U", color: COL.cal },
    { label: "retained levels", color: COL.knots },
  ]);

  let knotMiss = 0;
  for (const lv of levels) knotMiss = Math.max(knotMiss, Math.abs(ecdf(lv) - lv));
  let midMiss = 0;
  for (let i = 0; i <= 400; i++) {
    const u = i / 400;
    midMiss = Math.max(midMiss, Math.abs(ecdf(u) - u));
  }
  setRO([
    String(levels.length),
    fmt(dmax, 3),
    fmt(knotMiss, 3),
    fmt(midMiss, 3),
  ]);
}

const distRow = document.createElement("div");
distRow.className = "btnrow";
ctrls.appendChild(distRow);
for (const key of Object.keys(DISTS)) {
  button(distRow, DISTS[key].label, () => { state.dist = key; draw(); });
}
slider(ctrls, { label: "calibration points n", min: 60, max: 2000, step: 20, value: state.n },
  (v) => { state.n = v; draw(); });
slider(ctrls, { label: "retained knots", min: 4, max: 79, step: 5, value: state.K },
  (v) => { state.K = v; draw(); });
button(ctrls, "resample", () => { seed += 1; draw(); });

autoResize(mapPlot, draw);
autoResize(calPlot, draw);
draw();
