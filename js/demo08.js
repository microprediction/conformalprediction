// Demo 08 — Subgroup coverage buys only a wider band.
// Illustrates the no-go theorem of Foygel Barber, Candès, Ramdas & Tibshirani
// (2021), Thm 3.1: distribution-free coverage on EVERY subgroup of mass >= delta
// is attainable only by the trivial solution — a single FLAT band at the inflated
// marginal level 1 - alpha*delta. It buys no adaptivity; as delta -> 0 it just
// gets uniformly wider. Genuine adaptivity (the oracle) needs a distributional
// assumption about sigma(x).
import { mulberry32, sampleNormal, linspace, polyfit, polyval, conformalQuantile,
  normInv, clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, checkbox, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 4], ylim: [-4, 10], xlabel: "x", ylabel: "y",
});
const cov = new Plot(document.getElementById("cov"), {
  xlim: [0, 4], ylim: [0, 1.05], xlabel: "x  (subgroup = x-bin)", ylabel: "subgroup coverage",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["subgroup floor δ", "distribution-free level 1−αδ", "flat band half-width",
   "worst-subgroup coverage: flat", "avg width: flat ÷ oracle"]);

const ctrls = document.getElementById("controls");
let seed = 23;

const state = {
  delta: 0.3,   // subgroup mass floor
  alpha: 0.1,   // marginal miscoverage
  n: 1200,
  showOracle: true,
  showFlat: true,
};

const NBINS = 8;

const truth = (x) => Math.sin(x * 1.3) * 2 + 3;
const sigmaX = (x) => 0.15 + 0.7 * x;

function simulate() {
  const rng = mulberry32(seed);
  const N = Math.round(state.n);
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 4;
    xs.push(x);
    ys.push(truth(x) + sampleNormal(rng, 0, sigmaX(x)));
  }
  // split: 40% train, 30% calibration, 30% test
  const idx = [...Array(N).keys()];
  const nTr = Math.floor(N * 0.4), nCal = Math.floor(N * 0.3);
  const trI = idx.slice(0, nTr), calI = idx.slice(nTr, nTr + nCal), teI = idx.slice(nTr + nCal);
  const coef = polyfit(trI.map(i => xs[i]), trI.map(i => ys[i]), 3);
  const muHat = (x) => polyval(coef, x);

  const teX = teI.map(i => xs[i]), teY = teI.map(i => ys[i]);

  // --- (B) distribution-free FLAT bands via absolute-residual scores ---
  const scores = calI.map(i => Math.abs(ys[i] - muHat(xs[i])));
  // ordinary marginal band (delta = 1): target 1 - alpha
  const qMarginal = conformalQuantile(scores, state.alpha);
  // inflated flat band: target 1 - alpha*delta (the Thm 3.1 trivial solution)
  const alphaInfl = state.alpha * state.delta;
  const qInflated = conformalQuantile(scores, alphaInfl);

  // --- (A) ORACLE adaptive band: uses the TRUE sigma(x) (a distributional assumption) ---
  const z = normInv(1 - state.alpha / 2);
  const oracleHalf = (x) => z * sigmaX(x);

  // membership / coverage helpers on the test set
  const inMarg = teX.map((x, k) => Math.abs(teY[k] - muHat(x)) <= qMarginal);
  const inFlat = teX.map((x, k) => Math.abs(teY[k] - muHat(x)) <= qInflated);
  const inOracle = teX.map((x, k) => Math.abs(teY[k] - muHat(x)) <= oracleHalf(x));

  // per-bin (subgroup) coverage
  const edges = linspace(0, 4, NBINS + 1);
  const w = 4 / NBINS;
  const binCenters = [], covMarg = [], covFlat = [], covOracle = [], binCount = [];
  for (let b = 0; b < NBINS; b++) {
    const c0 = edges[b], c1 = edges[b + 1];
    let n = 0, cm = 0, cf = 0, co = 0;
    for (let k = 0; k < teX.length; k++) {
      if (teX[k] >= c0 && (b === NBINS - 1 ? teX[k] <= c1 : teX[k] < c1)) {
        n++;
        if (inMarg[k]) cm++;
        if (inFlat[k]) cf++;
        if (inOracle[k]) co++;
      }
    }
    binCenters.push((c0 + c1) / 2);
    binCount.push(n);
    covMarg.push(n > 0 ? cm / n : NaN);
    covFlat.push(n > 0 ? cf / n : NaN);
    covOracle.push(n > 0 ? co / n : NaN);
  }

  // worst-subgroup coverage (over bins with points)
  const worst = (arr) => Math.min(...arr.filter(isFinite));
  const worstMarg = worst(covMarg);
  const worstFlat = worst(covFlat);

  // average band widths over test points: flat is constant 2q; oracle varies
  const avgFlat = 2 * qInflated;
  let sOracle = 0;
  for (let k = 0; k < teX.length; k++) sOracle += 2 * oracleHalf(teX[k]);
  const avgOracle = sOracle / teX.length;

  return { xs, ys, calI, muHat, teX, teY, inFlat, inOracle,
    qMarginal, qInflated, oracleHalf, z, alphaInfl,
    binCenters, covMarg, covFlat, covOracle, binCount, w,
    worstMarg, worstFlat, avgFlat, avgOracle };
}

function covClass(c) {
  const target = 1 - state.alpha;
  if (!isFinite(c)) return "";
  const d = c - target;
  if (d >= -0.02) return "good";        // at or above target
  if (d >= -0.08) return "warn";
  return "bad";
}

function draw() {
  const S = simulate();
  const gx = linspace(0, 4, 200);

  // ---- main panel ----
  main.clear("#fff");
  main.axes({ grid: true });

  // distribution-free FLAT inflated band (orange slab)
  if (state.showFlat) {
    const flo = gx.map(x => S.muHat(x) - S.qInflated);
    const fhi = gx.map(x => S.muHat(x) + S.qInflated);
    main.band(gx, flo, fhi, { color: "rgba(234,88,12,0.12)",
      stroke: "rgba(234,88,12,0.55)", strokeWidth: 1.2 });
  }
  // oracle adaptive band (blue, varying width)
  if (state.showOracle) {
    const olo = gx.map(x => S.muHat(x) - S.oracleHalf(x));
    const ohi = gx.map(x => S.muHat(x) + S.oracleHalf(x));
    main.band(gx, olo, ohi, { color: "rgba(31,78,216,0.16)",
      stroke: "rgba(31,78,216,0.6)", strokeWidth: 1.2 });
  }
  // faint calibration points
  main.points(S.calI.map(i => S.xs[i]), S.calI.map(i => S.ys[i]),
    { color: "rgba(160,160,160,0.4)", radius: 1.8 });
  // test points
  main.points(S.teX, S.teY, { color: "rgba(40,40,40,0.55)", radius: 2.2 });
  // fitted mean
  main.line(gx, gx.map(x => S.muHat(x)), { color: "#111", width: 1.8 });

  const leg = [{ label: "μ̂(x)", color: "#111" }];
  if (state.showOracle) leg.push({ label: "oracle adaptive (uses σ(x))", color: "rgba(31,78,216,0.7)" });
  if (state.showFlat) leg.push({ label: "distribution-free flat (1−αδ)", color: "rgba(234,88,12,0.8)" });
  main.legend(leg, { x: main.X(0) + 8, y: main.Y(10) + 8 });

  // ---- per-subgroup coverage panel ----
  cov.clear("#fff");
  cov.axes({ grid: true });
  const bw = S.w * 0.26;
  // grouped bars: ordinary marginal | flat inflated | oracle
  const offM = -bw, offF = 0, offO = bw;
  const centersM = S.binCenters.map(c => c + offM);
  const centersF = S.binCenters.map(c => c + offF);
  const centersO = S.binCenters.map(c => c + offO);
  cov.bars(centersM, S.covMarg.map(c => isFinite(c) ? c : 0), bw,
    { color: "rgba(120,120,120,0.55)", base: 0 });
  cov.bars(centersF, S.covFlat.map(c => isFinite(c) ? c : 0), bw,
    { color: "rgba(234,88,12,0.6)", base: 0 });
  cov.bars(centersO, S.covOracle.map(c => isFinite(c) ? c : 0), bw,
    { color: "rgba(31,78,216,0.6)", base: 0 });
  // target reference
  cov.hline(1 - state.alpha, { color: "var(--bad)", dash: [6, 4], width: 1.8,
    label: "target 1−α" });
  cov.legend([
    { label: "ordinary marginal (δ=1)", color: "rgba(120,120,120,0.7)" },
    { label: "flat inflated (1−αδ)", color: "rgba(234,88,12,0.75)" },
    { label: "oracle adaptive", color: "rgba(31,78,216,0.75)" },
    { label: "target 1−α", color: "#b91c1c", dash: [6, 4] },
  ], { x: cov.X(0) + 8, y: cov.Y(1.05) + 8 });

  // ---- readouts ----
  const target = 1 - state.alpha;
  setRO("subgroup floor δ", fmt(state.delta, 2));
  setRO("distribution-free level 1−αδ", pct(1 - S.alphaInfl, 2));
  setRO("flat band half-width", isFinite(S.qInflated) ? fmt(S.qInflated, 2) : "∞",
    isFinite(S.qInflated) ? "" : "bad");
  setRO("worst-subgroup coverage: flat",
    isFinite(S.worstFlat) ? pct(S.worstFlat, 1) : "–", covClass(S.worstFlat));
  const ratio = S.avgOracle > 0 ? S.avgFlat / S.avgOracle : Infinity;
  setRO("avg width: flat ÷ oracle", isFinite(ratio) ? fmt(ratio, 2) + "×" : "∞×",
    ratio > 1.5 ? "bad" : ratio > 1.1 ? "warn" : "good");
}

// ---- controls ----
slider(ctrls, { label: "subgroup floor δ", min: 0.02, max: 1.0, step: 0.01, value: state.delta,
  fmt: v => v.toFixed(2) }, v => { state.delta = clamp(v, 0.02, 1.0); draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha,
  fmt: v => v.toFixed(2) }, v => { state.alpha = v; draw(); });
slider(ctrls, { label: "sample size N", min: 300, max: 3000, step: 100, value: state.n,
  fmt: v => String(Math.round(v)) }, v => { state.n = v; draw(); });
checkbox(ctrls, { label: "show oracle band", checked: state.showOracle },
  v => { state.showOracle = v; draw(); });
checkbox(ctrls, { label: "show flat band", checked: state.showFlat },
  v => { state.showFlat = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(cov, () => {});
draw();
