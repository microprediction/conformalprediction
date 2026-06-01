// Demo 03 — The fence is the horizon (trivial validity).
// Three "predictors", all valid at the same α on the same data:
//  (A) good model + conformal     → tight band, ~1−α coverage
//  (B) garbage constant + conformal → enormous band, STILL ~1−α coverage
//  (C) trivial randomized set     → whole line w.p. 1−α else empty; coverage → 1−α, vacuous
import { mulberry32, sampleNormal, linspace, polyfit, polyval, conformalQuantile,
  coverage, mean, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const VIEW_Y = [-1, 7]; // the visible window; "the horizon" for option C

const main = new Plot(document.getElementById("main"), {
  xlim: [0, 4], ylim: VIEW_Y, xlabel: "x", ylabel: "y",
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "empirical coverage", "band half-width", "information"]);

const ctrls = document.getElementById("controls");
let seed = 11;

const state = {
  predictor: "A", // "A" | "B" | "C"
  alpha: 0.1,
  n: 300,
  sigma: 0.6,
};

const truth = (x) => Math.sin(x * 1.3) * 2 + 3;

function simulate() {
  const rng = mulberry32(seed);
  const N = state.n;
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 4;
    xs.push(x);
    ys.push(truth(x) + sampleNormal(rng, 0, state.sigma));
  }
  // split: 40% train, 30% calibration, 30% test (mirrors demo01)
  const idx = [...Array(N).keys()];
  const nTr = Math.floor(N * 0.4), nCal = Math.floor(N * 0.3);
  const trI = idx.slice(0, nTr), calI = idx.slice(nTr, nTr + nCal), teI = idx.slice(nTr + nCal);
  const teX = teI.map(i => xs[i]), teY = teI.map(i => ys[i]);

  if (state.predictor === "C") {
    // Trivial randomized set: ignore x entirely. Per test point, output the whole
    // space w.p. 1−α (covered) else the empty set (miss). Validity by construction.
    const wholeAt = teX.map(() => rng() < (1 - state.alpha));
    const cov = mean(wholeAt.map(b => (b ? 1 : 0)));
    return {
      xs, ys, calI, teI, teX, teY, cov,
      kind: "C", wholeAt, muHat: null, q: Infinity,
    };
  }

  // A and B both run the *same* split-conformal procedure; only μ̂ differs.
  let muHat;
  if (state.predictor === "A") {
    const coef = polyfit(trI.map(i => xs[i]), trI.map(i => ys[i]), 3);
    muHat = (x) => polyval(coef, x);
  } else {
    // Garbage: a deliberately wrong constant (shifted off the global train mean).
    const trMean = mean(trI.map(i => ys[i]));
    const cst = trMean + 2.0; // off-target on purpose; conformal still fixes coverage
    muHat = () => cst;
  }
  const scores = calI.map(i => Math.abs(ys[i] - muHat(xs[i])));
  const q = conformalQuantile(scores, state.alpha);
  const lo = teX.map(x => muHat(x) - q), hi = teX.map(x => muHat(x) + q);
  const cov = coverage(lo, hi, teY);
  return {
    xs, ys, calI, teI, teX, teY, cov,
    kind: state.predictor, wholeAt: null, muHat, q,
  };
}

function draw() {
  const S = simulate();
  main.clear("#fff");
  main.axes({ grid: true });

  // background: calibration points, faint
  main.points(S.calI.map(i => S.xs[i]), S.calI.map(i => S.ys[i]),
    { color: "rgba(160,160,160,0.5)", radius: 2.2 });

  let halfWidthStr, infoTag, infoCls, legendItems;

  if (S.kind === "C") {
    // Per test point: a full-height vertical span (covered) or nothing (miss).
    const dx = 4 / Math.max(20, S.teX.length); // visual width of each "fence"
    for (let k = 0; k < S.teX.length; k++) {
      if (S.wholeAt[k]) {
        main.vspan(S.teX[k] - dx, S.teX[k] + dx, { color: "rgba(21,128,61,0.10)" });
      }
    }
    // test points: green if covered (whole-line emitted), red if missed (empty set)
    const covered = [], missed = [];
    for (let k = 0; k < S.teX.length; k++) (S.wholeAt[k] ? covered : missed).push(k);
    main.points(covered.map(k => S.teX[k]), covered.map(k => S.teY[k]),
      { color: "rgba(21,128,61,0.8)", radius: 2.8 });
    main.points(missed.map(k => S.teX[k]), missed.map(k => S.teY[k]),
      { color: "rgba(185,28,28,0.95)", radius: 3.2 });
    main.text(2, 6.4, "set = whole line (covered)  or  ∅ (miss) — x is ignored",
      { align: "center", color: "rgba(0,0,0,0.55)" });
    halfWidthStr = "∞ / ∅";
    infoTag = "vacuous";
    infoCls = "bad";
    legendItems = [
      { label: "whole-line set (covered)", color: "rgba(21,128,61,0.85)" },
      { label: "empty set (missed)", color: "rgba(185,28,28,0.95)" },
    ];
  } else {
    // A and B: a constant-or-curved μ̂ ± q band.
    const gx = linspace(0, 4, 120);
    const glo = gx.map(x => S.muHat(x) - S.q);
    const ghi = gx.map(x => S.muHat(x) + S.q);
    main.band(gx, glo, ghi, { color: "rgba(31,78,216,0.13)" });
    main.line(gx, gx.map(x => S.muHat(x)), { color: "#1f4ed8", width: 2 });

    const covered = [], missed = [];
    for (let k = 0; k < S.teX.length; k++) {
      const inside = S.teY[k] >= S.muHat(S.teX[k]) - S.q && S.teY[k] <= S.muHat(S.teX[k]) + S.q;
      (inside ? covered : missed).push(k);
    }
    main.points(covered.map(k => S.teX[k]), covered.map(k => S.teY[k]),
      { color: "rgba(21,128,61,0.8)", radius: 2.8 });
    main.points(missed.map(k => S.teX[k]), missed.map(k => S.teY[k]),
      { color: "rgba(185,28,28,0.95)", radius: 3.2 });

    halfWidthStr = isFinite(S.q) ? fmt(S.q, 2) : "∞";
    if (S.kind === "A") { infoTag = "informative"; infoCls = "good"; }
    else {
      infoTag = "useless but valid"; infoCls = "warn";
      // band likely spills past the view — note it in the panel
      if (isFinite(S.q) && (S.muHat(0) + S.q > VIEW_Y[1] || S.muHat(0) - S.q < VIEW_Y[0])) {
        main.text(2, 6.4, "band spills past the view (half-width = " + fmt(S.q, 1) + ")",
          { align: "center", color: "rgba(0,0,0,0.55)" });
      }
    }
    legendItems = [
      { label: S.kind === "A" ? "μ̂(x) (deg-3 fit)" : "μ̂ = wrong constant", color: "#1f4ed8" },
      { label: "conformal band", color: "rgba(31,78,216,0.4)" },
      { label: "test, covered", color: "rgba(21,128,61,0.85)" },
      { label: "test, missed", color: "rgba(185,28,28,0.95)" },
    ];
  }

  main.legend(legendItems, { x: main.X(0) + 8, y: main.Y(VIEW_Y[1]) + 8 });

  // readouts: coverage is the same story everywhere; usefulness is not.
  setRO("target 1−α", pct(1 - state.alpha, 0));
  const covCls = Math.abs(S.cov - (1 - state.alpha)) < 0.06 ? "good" : "warn";
  setRO("empirical coverage", pct(S.cov, 1), covCls);
  setRO("band half-width", halfWidthStr);
  setRO("information", infoTag, infoCls);
}

// ---- controls ----
// Predictor selector: three buttons that set state (ui.js style).
const selWrap = document.createElement("div");
selWrap.className = "control";
const selLab = document.createElement("label");
const selSpan = document.createElement("span");
selSpan.textContent = "predictor";
selLab.appendChild(selSpan);
selWrap.appendChild(selLab);
const btnRow = document.createElement("div");
btnRow.style.display = "flex";
btnRow.style.gap = "6px";
btnRow.style.flexWrap = "wrap";
selWrap.appendChild(btnRow);
ctrls.appendChild(selWrap);

const PRED = [
  ["A", "A · good + conformal"],
  ["B", "B · garbage + conformal"],
  ["C", "C · trivial random set"],
];
const predBtns = {};
function refreshSel() {
  for (const k of Object.keys(predBtns)) {
    const b = predBtns[k];
    const on = k === state.predictor;
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
for (const [k, label] of PRED) {
  const b = button(btnRow, label, () => { state.predictor = k; refreshSel(); draw(); });
  predBtns[k] = b;
}
refreshSel();

slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "sample size N", min: 60, max: 1200, step: 20, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
draw();
