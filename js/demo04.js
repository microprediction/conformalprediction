// Demo 04 — Coverage ⊥ log-score: the constructive orthogonality.
//
// Fix outcomes y ~ N(0,1). Take the point forecast as μ̂ ≡ 0 for everyone, so the
// nonconformity score is |y|. The split-conformal band is [−q, +q] with
// q = conformalQuantile(|y|, α). Crucially, q depends ONLY on the outcomes — not
// on the forecaster's claimed spread s. So as we slide s, the conformal SET and its
// marginal coverage are FROZEN, while the predictive log-score swings (best near s=1).
import { mulberry32, sampleNormal, linspace, conformalQuantile, coverage,
  histogram, normPdf, meanLogScoreNormal, clamp, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const N = 2000;

const main = new Plot(document.getElementById("main"), {
  xlim: [-4, 4], ylim: [0, 0.6], xlabel: "outcome  y", ylabel: "density",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});
const meter = new Plot(document.getElementById("meter"), {
  xlim: [0.3, 3.0], ylim: [-3, 0], xlabel: "forecaster spread  s",
  ylabel: "mean log-score", margin: { l: 56, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["marginal coverage", "conformal band [−q,+q]", "predictive log-score", "best log-score (s=1)"]);

const ctrls = document.getElementById("controls");
let seed = 20260601;

const state = { s: 1.0, alpha: 0.1 };

// The outcomes y depend only on the seed — never on s or α. This is the whole point.
function drawSample() {
  const rng = mulberry32(seed);
  const y = new Array(N);
  for (let i = 0; i < N; i++) y[i] = sampleNormal(rng, 0, 1);
  return y;
}
let y = drawSample();

function draw() {
  // ---- the construction ----
  // μ̂ ≡ 0, so nonconformity scores are |y|. Band is [−q, +q]. None of this sees s.
  const scores = y.map(Math.abs);
  const q = conformalQuantile(scores, state.alpha);
  // Marginal coverage of the FIXED band against the same outcomes — frozen w.r.t. s.
  const lo = y.map(() => -q), hi = y.map(() => q);
  const cov = coverage(lo, hi, y);

  // The forecaster's claimed density N(0, s) is what moves. It changes the log-score only.
  const logScore = meanLogScoreNormal(y, 0, state.s);
  const bestScore = meanLogScoreNormal(y, 0, 1); // truth s=1 maximizes it (in expectation)

  // ---- top panel: outcomes + claimed density + fixed band ----
  main.clear("#fff");
  main.axes({ grid: true });
  // FIXED conformal band [−q, +q] — drawn first so the density sits on top.
  if (isFinite(q)) main.vspan(-q, q, { color: "rgba(31,78,216,0.10)" });
  // histogram of the (immovable) outcomes
  const H = histogram(y, 48, -4, 4);
  const peak = Math.max(...H.density, normPdf(0, 0, 0.3), 0.45);
  main.setLimits([-4, 4], [0, peak * 1.12]);
  main.clear("#fff");
  main.axes({ grid: true });
  if (isFinite(q)) main.vspan(-q, q, { color: "rgba(31,78,216,0.10)" });
  main.bars(H.centers, H.density, H.width, { color: "rgba(120,120,120,0.35)", stroke: "rgba(120,120,120,0.5)" });
  // forecaster's claimed density N(0,s) — the only thing that moves with the slider
  const gx = linspace(-4, 4, 220);
  main.line(gx, gx.map(x => normPdf(x, 0, state.s)), { color: "#1f4ed8", width: 2.4 });
  // band edges
  if (isFinite(q)) {
    main.vline(-q, { color: "var(--accent)", dash: [6, 4], width: 2 });
    main.vline(q, { color: "var(--accent)", dash: [6, 4], width: 2 });
    main.text(q, peak * 1.05, "+q", { color: "#1f4ed8", align: "center" });
    main.text(-q, peak * 1.05, "−q", { color: "#1f4ed8", align: "center" });
  }
  main.text(0, peak * 1.05, "band fixed — does not move with s", { color: "var(--muted)", align: "center" });
  main.legend([
    { label: "outcomes  y ~ N(0,1)", color: "rgba(120,120,120,0.55)" },
    { label: "claimed density  N(0,s)", color: "#1f4ed8" },
    { label: "fixed conformal band", color: "rgba(31,78,216,0.35)" },
  ], { x: main.X(-4) + 8, y: main.Y(peak * 1.12) + 8 });

  // ---- bottom panel: log-score(s) curve with current-s marker; coverage flat ----
  const sx = linspace(0.3, 3.0, 160);
  const sy = sx.map(s => meanLogScoreNormal(y, 0, s));
  const ymin = Math.min(...sy), ymax = Math.max(...sy);
  meter.setLimits([0.3, 3.0], [ymin - 0.1 * (ymax - ymin) - 0.05, ymax + 0.08 * (ymax - ymin) + 0.05]);
  meter.clear("#fff");
  meter.axes({ grid: true });
  meter.line(sx, sy, { color: "#1f4ed8", width: 2.4 });
  meter.vline(1, { color: "var(--good)", dash: [4, 4], width: 1.5 });
  // current-s marker
  meter.vline(state.s, { color: "var(--warn)", width: 2 });
  meter.points([state.s], [logScore], { color: "var(--warn)", radius: 5 });
  meter.text(state.s, logScore, "  s = " + fmt(state.s, 2), { color: "var(--warn)", align: "left", baseline: "bottom" });
  meter.text(1, ymax + 0.04 * (ymax - ymin) + 0.02, "truth s=1", { color: "var(--good)", align: "center", baseline: "bottom" });
  meter.text(0.3, ymin - 0.05, "  coverage ≡ " + pct(1 - state.alpha, 0) + " for every s", { color: "var(--muted)", align: "left", baseline: "bottom" });

  // ---- readouts ----
  // Coverage is pinned: emphasize it does not change. Always neutral/good.
  setRO("marginal coverage", pct(cov, 1) + " (pinned)", "good");
  setRO("conformal band [−q,+q]", isFinite(q) ? "±" + fmt(q, 2) : "∞");
  // log-score: good near the max, bad when far below it.
  const gap = bestScore - logScore; // ≥ 0
  const lsCls = gap < 0.05 ? "good" : gap < 0.4 ? "warn" : "bad";
  setRO("predictive log-score", fmt(logScore, 3), lsCls);
  setRO("best log-score (s=1)", fmt(bestScore, 3), "good");
}

// ---- controls ----
slider(ctrls, { label: "forecaster spread s", min: 0.3, max: 3.0, step: 0.01, value: state.s, fmt: v => v.toFixed(2) },
  v => { state.s = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.01, max: 0.4, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ new sample", () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  y = drawSample();
  draw();
});

autoResize(main, draw);
autoResize(meter, () => {});
draw();
