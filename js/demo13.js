// Demo 13 - The coverage-score plane (the information gap).
// Two independent moves. Conformalizing a fixed model resizes its SET to hit coverage:
// a purely horizontal move to zero coverage error, leaving the reported density (its
// log-score) untouched. Climbing toward the oracle is a VERTICAL move, bought only by
// conditioning the spread on x. The leftover height is the residual-information gap.
import { mulberry32, sampleNormal, normInv, conformalQuantile, mean, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, checkbox, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [-0.35, 0.35], ylim: [-1.6, 0.12],
  xlabel: "coverage error  (0 = calibrated)", ylabel: "log-score gap to oracle  (0 = best)",
});

const setRO = readouts(document.getElementById("readouts"),
  ["coverage error", "after conformal", "information gap", "conformal closes it?"]);

const ctrls = document.getElementById("controls");
let seed = 31;
const state = { lambda: 0.0, scale: 0.8, conformalize: true };
const ALPHA = 0.1;
const Z = normInv(1 - ALPHA / 2);

const sigma = (x) => 0.6 + 0.7 * (1 + Math.sin(1.2 * x)); // true conditional sd, ~0.6..2.0

function simulate() {
  const rng = mulberry32(seed);
  const N = 4000;
  const xs = [], ys = [], sg = [];
  for (let i = 0; i < N; i++) {
    const x = rng() * 5;
    const s = sigma(x);
    xs.push(x); sg.push(s); ys.push(sampleNormal(rng, 0, s));
  }
  const sBar = mean(sg);
  const lam = state.lambda, c = state.scale;
  const sHat = xs.map((x, i) => (1 - lam) * sBar + lam * sg[i]); // blended model sd
  // reported density N(0, c*sHat): its log-score, and the oracle's
  const lsModel = mean(ys.map((y, i) => logN(y, c * sHat[i])));
  const lsOracle = mean(ys.map((y, i) => logN(y, sg[i])));
  const gap = lsOracle - lsModel; // >= 0
  // raw set coverage from the density's own (1-alpha) interval
  const covRaw = mean(ys.map((y, i) => (Math.abs(y) <= Z * c * sHat[i] ? 1 : 0)));
  // conformalized (normalized) set: half-width q*sHat, q = conformal quantile of |y|/sHat
  const q = conformalQuantile(ys.map((y, i) => Math.abs(y) / sHat[i]), ALPHA);
  const covConf = mean(ys.map((y, i) => (Math.abs(y) <= q * sHat[i] ? 1 : 0)));
  return { errRaw: covRaw - (1 - ALPHA), errConf: covConf - (1 - ALPHA), gap };
}
function logN(y, v) { return -0.5 * Math.log(2 * Math.PI * v * v) - (y * y) / (2 * v * v); }

function draw() {
  const S = simulate();
  const ylo = Math.min(-1.6, -S.gap * 1.15);
  main.setLimits([-0.35, 0.35], [ylo, 0.12]);
  main.clear("#fff");
  main.axes({ grid: true });

  // reference lines: oracle row (y=0) and calibrated column (x=0)
  main.hline(0, { color: "rgba(217,119,6,0.9)", dash: [6, 4], width: 2 });
  main.text(0.34, 0.03, "oracle", { color: "#b45309", align: "right" });
  main.vline(0, { color: "rgba(0,0,0,0.35)", dash: [5, 4], width: 1.5 });

  const yModel = -S.gap;
  // conformalize = horizontal move to x=0, same height
  if (state.conformalize) {
    main.line([S.errRaw, S.errConf], [yModel, yModel], { color: "rgba(31,78,216,0.5)", width: 2, dash: [2, 3] });
    // remaining vertical gap to the oracle
    main.line([S.errConf, S.errConf], [yModel, 0], { color: "rgba(185,28,28,0.7)", width: 2, dash: [3, 3] });
    main.text(S.errConf + 0.01, yModel / 2, "info gap", { color: "#b91c1c", align: "left" });
    main.points([S.errConf], [yModel], { color: "#1f4ed8", radius: 5 });
  }
  // raw model point
  main.points([S.errRaw], [yModel], { color: state.conformalize ? "rgba(31,78,216,0.4)" : "#1f4ed8", radius: 5 });
  // the oracle
  main.points([0], [0], { color: "#d97706", radius: 6 });

  main.legend([
    { label: "your model (density)", color: "#1f4ed8" },
    { label: "oracle", color: "#d97706" },
    { label: "conformalize (set)", color: "rgba(31,78,216,0.5)", dash: [2, 3] },
    { label: "information gap", color: "rgba(185,28,28,0.7)", dash: [3, 3] },
  ], { x: main.X(-0.35) + 8, y: main.Y(ylo) - 92 });

  setRO("coverage error", (S.errRaw >= 0 ? "+" : "") + pct(S.errRaw, 1));
  setRO("after conformal", (S.errConf >= 0 ? "+" : "") + pct(S.errConf, 1),
    Math.abs(S.errConf) < 0.02 ? "good" : "warn");
  setRO("information gap", fmt(S.gap, 2) + " nats", S.gap < 0.05 ? "good" : "warn");
  setRO("conformal closes it?", "no", "bad");
}

slider(ctrls, { label: "conditioning  (constant → oracle σ(x))", min: 0, max: 1, step: 0.02, value: state.lambda, fmt: v => v.toFixed(2) },
  v => { state.lambda = v; draw(); });
slider(ctrls, { label: "predictive spread (mis)calibration", min: 0.5, max: 1.8, step: 0.02, value: state.scale, fmt: v => v.toFixed(2) },
  v => { state.scale = v; draw(); });
checkbox(ctrls, { label: "conformalize the set", checked: state.conformalize },
  v => { state.conformalize = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
draw();
