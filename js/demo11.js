// Demo 11 — Guaranteed recall for retrieval and screening.
// The deliverable is a shortlist, and the objective is recall: the kept set should
// contain a genuine hit at least 1-alpha of the time. A conformal threshold on the
// score gives that guarantee distribution-free. How *short* the list can be at that
// recall is the model's job, not the guarantee's.
import { mulberry32, sampleNormal, normPdf, linspace, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const main = new Plot(document.getElementById("main"), {
  xlim: [-5, 9], ylim: [0, 0.5], xlabel: "model score s(x)", ylabel: "density",
});

const setRO = readouts(document.getElementById("readouts"),
  ["target recall 1−α", "empirical recall", "precision", "shortlist kept"]);

const ctrls = document.getElementById("controls");
let seed = 41;

const state = { alpha: 0.1, mu: 3.0, prev: 0.15, n: 500 };

function simulate() {
  const rng = mulberry32(seed);
  const mu = state.mu;
  // calibration set of genuine hits (relevant items), score ~ N(mu, 1)
  const calPos = [];
  for (let i = 0; i < state.n; i++) calPos.push(sampleNormal(rng, mu, 1));
  calPos.sort((a, b) => a - b);
  // conformal threshold: keep score >= t so a new hit is missed at most alpha of the time
  const k = Math.floor(state.alpha * (state.n + 1));
  const t = k >= 1 ? calPos[k - 1] : -Infinity;
  // test pool: relevant with prob prev (score ~ N(mu,1)); irrelevant ~ N(0,1)
  const M = 4000;
  let hits = 0, hitsKept = 0, kept = 0, keptHits = 0;
  for (let i = 0; i < M; i++) {
    const rel = rng() < state.prev;
    const s = sampleNormal(rng, rel ? mu : 0, 1);
    if (rel) { hits++; if (s >= t) hitsKept++; }
    if (s >= t) { kept++; if (rel) keptHits++; }
  }
  return {
    t, mu,
    recall: hits ? hitsKept / hits : 1,
    precision: kept ? keptHits / kept : 0,
    keptFrac: kept / M,
  };
}

function draw() {
  const S = simulate();
  const lo = -5, hi = S.mu + 5;
  main.setLimits([lo, hi], [0, 0.5]);
  main.clear("#fff");
  main.axes({ grid: true });

  // shade the kept region (score >= t)
  if (isFinite(S.t)) main.vspan(S.t, hi, { color: "rgba(21,128,61,0.10)" });

  const gx = linspace(lo, hi, 240);
  // irrelevant items (the haystack) and relevant items (the needles)
  main.line(gx, gx.map(x => (1 - state.prev) * normPdf(x, 0, 1)), { color: "rgba(120,120,120,0.85)", width: 2 });
  main.line(gx, gx.map(x => state.prev * normPdf(x, S.mu, 1)), { color: "#15803d", width: 2 });

  if (isFinite(S.t)) {
    main.vline(S.t, { color: "var(--warn)", dash: [6, 4], width: 2 });
    main.text(S.t, 0.49, "keep s ≥ t →", { color: "#c2410c", align: "left" });
  }
  main.legend([
    { label: "irrelevant (haystack)", color: "rgba(120,120,120,0.85)" },
    { label: "relevant (needles)", color: "#15803d" },
    { label: "conformal threshold t", color: "var(--warn)", dash: [6, 4] },
  ], { x: main.X(lo) + 8, y: main.Y(0.5) + 8 });

  setRO("target recall 1−α", pct(1 - state.alpha, 0));
  setRO("empirical recall", pct(S.recall, 1), S.recall >= 1 - state.alpha - 0.02 ? "good" : "warn");
  setRO("precision", pct(S.precision, 0));
  setRO("shortlist kept", pct(S.keptFrac, 0));
}

slider(ctrls, { label: "miss budget α", min: 0.01, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
slider(ctrls, { label: "model separability", min: 1.0, max: 6.0, step: 0.1, value: state.mu, fmt: v => v.toFixed(1) },
  v => { state.mu = v; draw(); });
slider(ctrls, { label: "prevalence", min: 0.02, max: 0.5, step: 0.01, value: state.prev, fmt: v => v.toFixed(2) },
  v => { state.prev = v; draw(); });
slider(ctrls, { label: "calibration n", min: 50, max: 2000, step: 25, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
draw();
