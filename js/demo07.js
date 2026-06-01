// Demo 07 — The price of conditional coverage (the no-go theorem made tangible).
// Localized / Mondrian split conformal: bin x, calibrate a separate quantile per
// bin. As the conditioning resolution B grows, per-bin (conditional) coverage
// becomes uniform and hits target — but only because sparse bins are forced to
// q = +Infinity. This is Lei & Wasserman (2014, Lemma 1): non-trivial
// finite-sample conditional validity requires infinite expected length.
import { mulberry32, sampleNormal, linspace, polyfit, polyval, conformalQuantile,
  clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 4], ylim: [-2, 11], xlabel: "x", ylabel: "y",
});
const trade = new Plot(document.getElementById("trade"), {
  xlim: [1, 60], ylim: [0, 1], xlabel: "conditioning resolution B (number of x-bins)",
  ylabel: "fraction (0–1)", margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["conditioning resolution B", "worst-bin coverage", "mean band length", "% intervals = ∞"]);

const ctrls = document.getElementById("controls");
let seed = 23;

const state = {
  B: 3,         // number of equal-width x-bins over [0,4]
  alpha: 0.1,   // miscoverage
  hetero: 0.7,  // heteroscedasticity strength
  n: 900,
};

const BMAX = 60;
const truth = (x) => Math.sin(x * 1.3) * 2 + 3;
const sigmaX = (x) => 0.15 + state.hetero * x;

// Draw one deterministic sample and fit muHat on the train split.
// Returns the calibration + test arrays plus the fitted mean function.
function sampleAndFit() {
  const rng = mulberry32(seed);
  const N = state.n;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 4;
    xs.push(x);
    ys.push(truth(x) + sampleNormal(rng, 0, sigmaX(x)));
  }
  // split: 40% train, 30% calibration, 30% test
  const nTr = Math.floor(N * 0.4), nCal = Math.floor(N * 0.3);
  const trX = xs.slice(0, nTr), trY = ys.slice(0, nTr);
  const calX = xs.slice(nTr, nTr + nCal), calY = ys.slice(nTr, nTr + nCal);
  const teX = xs.slice(nTr + nCal), teY = ys.slice(nTr + nCal);
  const coef = polyfit(trX, trY, 3);
  const muHat = (x) => polyval(coef, x);
  return { muHat, calX, calY, teX, teY };
}

// Bin index for x in [0,4] given B equal-width bins (right edge inclusive).
function binOf(x, B) {
  let b = Math.floor((x / 4) * B);
  if (b >= B) b = B - 1;
  if (b < 0) b = 0;
  return b;
}

// Run localized split conformal at resolution B over an already-fit sample.
// Returns per-bin quantiles, edges, per-test interval bounds, coverage stats.
function localizedConformal(fit, B, alpha) {
  const { muHat, calX, calY, teX, teY } = fit;
  const edges = linspace(0, 4, B + 1);
  // calibration residual scores per bin
  const scoresByBin = Array.from({ length: B }, () => []);
  for (let i = 0; i < calX.length; i++) {
    scoresByBin[binOf(calX[i], B)].push(Math.abs(calY[i] - muHat(calX[i])));
  }
  const qByBin = scoresByBin.map(s => conformalQuantile(s, alpha));

  // apply bands to test points
  const inside = new Array(teX.length);
  const lenFinite = [];           // finite interval lengths only
  let nInf = 0;
  for (let k = 0; k < teX.length; k++) {
    const q = qByBin[binOf(teX[k], B)];
    if (!isFinite(q)) { inside[k] = true; nInf++; continue; }
    const m = muHat(teX[k]);
    inside[k] = teY[k] >= m - q && teY[k] <= m + q;
    lenFinite.push(2 * q);
  }

  // per-bin (conditional) coverage on the test set
  const binCov = new Array(B).fill(NaN);
  const binCount = new Array(B).fill(0);
  const binCovered = new Array(B).fill(0);
  for (let k = 0; k < teX.length; k++) {
    const b = binOf(teX[k], B);
    binCount[b]++;
    if (inside[k]) binCovered[b]++;
  }
  let worst = Infinity, worstHasPoints = false;
  for (let b = 0; b < B; b++) {
    if (binCount[b] > 0) {
      binCov[b] = binCovered[b] / binCount[b];
      if (binCov[b] < worst) { worst = binCov[b]; worstHasPoints = true; }
    }
  }
  const meanLenFinite = lenFinite.length
    ? lenFinite.reduce((a, b) => a + b, 0) / lenFinite.length : Infinity;
  const fracInf = teX.length ? nInf / teX.length : 0;

  return {
    edges, qByBin, inside, worstCov: worstHasPoints ? worst : NaN,
    meanLenFinite, fracInf, binCov, binCount,
  };
}

// Sweep B = 1..BMAX once, returning the trade-off curves.
function sweep(fit, alpha) {
  const Bs = [], worst = [], fracInf = [], meanLenNorm = [], meanLenRaw = [];
  // collect raw lengths first to normalize for plotting
  const raws = [];
  for (let B = 1; B <= BMAX; B++) {
    const r = localizedConformal(fit, B, alpha);
    Bs.push(B);
    worst.push(r.worstCov);
    fracInf.push(r.fracInf);
    raws.push(r.meanLenFinite);
  }
  const finiteRaws = raws.filter(isFinite);
  const maxLen = finiteRaws.length ? Math.max(...finiteRaws) : 1;
  for (let i = 0; i < raws.length; i++) {
    meanLenRaw.push(raws[i]);
    meanLenNorm.push(isFinite(raws[i]) ? raws[i] / maxLen : NaN);
  }
  return { Bs, worst, fracInf, meanLenNorm, meanLenRaw, maxLen };
}

function covClass(c) {
  const target = 1 - state.alpha;
  if (!isFinite(c)) return "good"; // ∞ everywhere is "valid" (trivially)
  const d = c - target;
  if (d >= -0.04) return "good";
  if (d >= -0.12) return "warn";
  return "bad";
}

function draw() {
  const fit = sampleAndFit();
  const B = state.B;
  const R = localizedConformal(fit, B, state.alpha);
  const SW = sweep(fit, state.alpha);
  const gx = linspace(0, 4, 240);
  const target = 1 - state.alpha;

  // ---- main panel: data + piecewise (per-bin) band ----
  main.clear("#fff");
  main.axes({ grid: true });

  // faint bin boundaries
  for (let b = 1; b < B; b++) {
    main.vline(R.edges[b], { color: "rgba(0,0,0,0.10)", width: 1 });
  }

  // piecewise band, per bin. Infinite bins shaded distinctly + annotated "∞".
  for (let b = 0; b < B; b++) {
    const c0 = R.edges[b], c1 = R.edges[b + 1];
    const q = R.qByBin[b];
    const xsB = linspace(c0, c1, 24);
    if (isFinite(q)) {
      const lo = xsB.map(x => fit.muHat(x) - q);
      const hi = xsB.map(x => fit.muHat(x) + q);
      main.band(xsB, lo, hi, { color: "rgba(31,78,216,0.13)" });
    } else {
      // infinite band: spans the whole vertical view, shaded distinctly
      const lo = xsB.map(() => -Infinity);
      const hi = xsB.map(() => Infinity);
      main.band(xsB, lo, hi, { color: "rgba(185,28,28,0.10)" });
      main.text((c0 + c1) / 2, 10.2, "∞", {
        align: "center", color: "rgba(185,28,28,0.85)",
        font: "bold 18px ui-sans-serif, system-ui, sans-serif",
      });
    }
  }

  // faint calibration points
  main.points(fit.calX, fit.calY, { color: "rgba(160,160,160,0.40)", radius: 1.8 });
  // test points: covered green / missed red
  const cvX = [], cvY = [], msX = [], msY = [];
  for (let k = 0; k < fit.teX.length; k++) {
    if (R.inside[k]) { cvX.push(fit.teX[k]); cvY.push(fit.teY[k]); }
    else { msX.push(fit.teX[k]); msY.push(fit.teY[k]); }
  }
  main.points(cvX, cvY, { color: "rgba(21,128,61,0.78)", radius: 2.4 });
  main.points(msX, msY, { color: "rgba(185,28,28,0.95)", radius: 3.0 });
  // fitted mean
  main.line(gx, gx.map(x => fit.muHat(x)), { color: "#1f4ed8", width: 2 });
  main.legend([
    { label: "μ̂(x)", color: "#1f4ed8" },
    { label: "per-bin band", color: "rgba(31,78,216,0.45)" },
    { label: "band = ∞", color: "rgba(185,28,28,0.45)" },
    { label: "covered", color: "rgba(21,128,61,0.85)" },
    { label: "missed", color: "rgba(185,28,28,0.95)" },
  ], { x: main.X(0) + 8, y: main.Y(11) + 8 });

  // ---- trade-off panel ----
  trade.clear("#fff");
  trade.axes({ grid: true });
  // worst-bin coverage (rises to target)
  trade.line(SW.Bs, SW.worst, { color: "#15803d", width: 2.2 });
  trade.points(SW.Bs, SW.worst, { color: "#15803d", radius: 1.8 });
  // % intervals = ∞ (rises toward 1)
  trade.line(SW.Bs, SW.fracInf, { color: "#b91c1c", width: 2.2 });
  // mean finite length, normalized to [0,1] by its sweep max (dashed)
  trade.line(SW.Bs, SW.meanLenNorm, { color: "#c2410c", width: 2, dash: [6, 4] });
  // target hline
  trade.hline(target, { color: "rgba(0,0,0,0.55)", dash: [3, 3], width: 1.4,
    label: "target 1−α" });
  // current B marker
  trade.vline(B, { color: "rgba(0,0,0,0.55)", width: 1.6, dash: [2, 3] });
  trade.legend([
    { label: "worst-bin coverage", color: "#15803d" },
    { label: "% intervals = ∞", color: "#b91c1c" },
    { label: "mean length (÷max)", color: "#c2410c", dash: [6, 4] },
  ], { x: trade.X(1) + 8, y: trade.Y(1) + 8 });

  // ---- readouts ----
  setRO("conditioning resolution B", `${B}` + (B === 1 ? " (global)" : ""));
  setRO("worst-bin coverage",
    isFinite(R.worstCov) ? pct(R.worstCov, 1) : "n/a", covClass(R.worstCov));
  if (isFinite(R.meanLenFinite)) {
    const inflate = R.fracInf > 0 ? " + ∞" : "";
    setRO("mean band length", fmt(R.meanLenFinite, 2) + inflate,
      R.fracInf > 0.05 ? "warn" : "");
  } else {
    setRO("mean band length", "∞", "bad");
  }
  setRO("% intervals = ∞", pct(R.fracInf, 1),
    R.fracInf > 0.25 ? "bad" : R.fracInf > 0.02 ? "warn" : "good");
}

// ---- controls ----
slider(ctrls, { label: "conditioning resolution B", min: 1, max: BMAX, step: 1, value: state.B,
  fmt: v => `${v}` }, v => { state.B = Math.round(v); draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha,
  fmt: v => v.toFixed(2) }, v => { state.alpha = v; draw(); });
slider(ctrls, { label: "heteroscedasticity", min: 0, max: 1.0, step: 0.05, value: state.hetero,
  fmt: v => v.toFixed(2) }, v => { state.hetero = v; draw(); });
slider(ctrls, { label: "sample size N", min: 200, max: 2000, step: 50, value: state.n,
  fmt: v => `${v}` }, v => { state.n = Math.round(v); draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(trade, () => {});
draw();
