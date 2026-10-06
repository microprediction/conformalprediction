// Demo 33 — Certified uncertainty bounds. Karimi and Samavi (AAAI SSS 2023,
// arXiv:2306.00876) certify per-input bounds on a "conformal model
// uncertainty" U_C(x) from the size m of the conformal set at x:
//   u = (m + delta - 1)/K,
//   L = u(1-delta) + delta - 1/(n+1),  H = u(n+2)/(n+1) + delta(1-u),
// by inserting the MARGINAL coverage bounds into their eq. (13),
//   U_C(x) = u P(y in C(x)) + P(y not in C(x)).
// Two groups of inputs with valid marginal coverage and different
// conditional coverage put every input outside [L, H].
import { mulberry32, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const K = 10;
const N_TEST = 20000;
const COL = { A: "#1f4ed8", B: "#b91c1c", band: "#111827", grey: "#94a3b8" };

const P = { pB: 0.25, ptop: 0.65, delta: 0.1, n: 1000, seed: 1 };

// ---------- the certified bounds, exactly as stated ----------
function bounds(m, delta, n) {
  if (m === 0) return { u: NaN, L: 1, H: 1 };
  const u = (m + delta - 1) / K;
  return { u, L: u * (1 - delta) + delta - 1 / (n + 1), H: Math.min(u * (n + 2) / (n + 1) + delta * (1 - u), 1) };
}

// ---------- population calculation (no sampling) ----------
// Scores: group A always 0.1; group B 1-ptop when the favoured class is right,
// 1-(1-ptop)/9 when it is wrong. Threshold = population (1-delta) quantile.
function population(pB, ptop, delta, n) {
  const pA = 1 - pB, pOther = (1 - ptop) / 9;
  const atoms = [[0.1, pA], [1 - ptop, pB * ptop], [1 - pOther, pB * (1 - ptop)]].sort((a, b) => a[0] - b[0]);
  let c = 0, q = 1;
  for (const [s, w] of atoms) { c += w; if (c >= 1 - delta) { q = s; break; } }
  const thr = 1 - q - 1e-9;                           // a class is in the set iff its probability >= 1 - q (tolerance for float ties)
  const mA = (0.9 >= thr ? 1 : 0) + (0.1 / 9 >= thr ? K - 1 : 0);
  const mB = (ptop >= thr ? 1 : 0) + (pOther >= thr ? K - 1 : 0);
  const covA = 0.9 >= thr ? 1 : 0;                    // the true class is the 0.9 class
  const covB = pOther >= thr ? 1 : (ptop >= thr ? ptop : 0);
  const marg = pA * covA + pB * covB;
  const bA = bounds(mA, delta, n), bB = bounds(mB, delta, n);
  const U = (b, cov) => (Number.isNaN(b.u) ? 1 : b.u * cov + (1 - cov));
  return { q, mA, mB, covA, covB, marg, bA, bB, UA: U(bA, covA), UB: U(bB, covB) };
}

// ---------- Monte Carlo with a finite calibration set ----------
function simulate(pB, ptop, delta, n, seed) {
  const rng = mulberry32(seed);
  const pOther = (1 - ptop) / 9;
  const draw = () => {
    const B = rng() < pB;
    const y = Math.floor(rng() * K);
    const probs = new Array(K).fill(B ? pOther : 0.1 / 9);
    let fav = y;
    if (B && rng() >= ptop) fav = (y + 1 + Math.floor(rng() * (K - 1))) % K;
    probs[fav] = B ? ptop : 0.9;
    return { B, y, probs };
  };
  const scores = [];
  for (let i = 0; i < n; i++) { const d = draw(); scores.push(1 - d.probs[d.y]); }
  scores.sort((a, b) => a - b);
  const k = Math.ceil((n + 1) * (1 - delta));
  const q = k <= n ? scores[k - 1] : Infinity;
  const thr = 1 - q - 1e-9;
  const acc = { A: {}, B: {} };                        // group -> m -> [covered, count]
  let cov = 0;
  for (let i = 0; i < N_TEST; i++) {
    const d = draw();
    let m = 0, inSet = false;
    for (let h = 0; h < K; h++) if (d.probs[h] >= thr) { m++; if (h === d.y) inSet = true; }
    const g = d.B ? "B" : "A";
    (acc[g][m] ??= [0, 0]);
    acc[g][m][0] += inSet ? 1 : 0; acc[g][m][1] += 1;
    cov += inSet ? 1 : 0;
  }
  return { q, marg: cov / N_TEST, acc };
}

// ---------- page ----------
const plotNow = new Plot(document.getElementById("k-now"), { xlabel: "input group", ylabel: "U_C and the certified interval", margin: { l: 56, r: 16, t: 14, b: 40 } });
const plotSweep = new Plot(document.getElementById("k-sweep"), { xlabel: "group B favoured-class probability", ylabel: "U_C", margin: { l: 56, r: 16, t: 14, b: 40 } });
const out = readouts(document.getElementById("k-readouts"),
  ["threshold q̂", "marginal coverage", "set size A / B", "coverage A / B", "certified [L, H]", "U_C(A) / U_C(B)"]);

function drawNow() {
  const sim = simulate(P.pB, P.ptop, P.delta, P.n, P.seed);
  const pop = population(P.pB, P.ptop, P.delta, P.n);
  const rows = [];
  for (const g of ["A", "B"]) {
    const ms = Object.keys(sim.acc[g]).map(Number).sort((a, b) => sim.acc[g][b][1] - sim.acc[g][a][1]);
    const m = ms[0];
    const [c, t] = sim.acc[g][m];
    const b = bounds(m, P.delta, P.n);
    const covg = c / t;
    rows.push({ g, m, cov: covg, b, U: Number.isNaN(b.u) ? 1 : b.u * covg + (1 - covg) });
  }
  const [rA, rB] = rows;
  out("threshold q̂", fmt(sim.q, 3));
  out("marginal coverage", pct(sim.marg));
  out("set size A / B", `${rA.m} / ${rB.m}`);
  out("coverage A / B", `${fmt(rA.cov, 3)} / ${fmt(rB.cov, 3)}`);
  out("certified [L, H]", rA.m === rB.m ? `[${fmt(rA.b.L, 4)}, ${fmt(rA.b.H, 4)}]` : `A [${fmt(rA.b.L, 3)}, ${fmt(rA.b.H, 3)}]  B [${fmt(rB.b.L, 3)}, ${fmt(rB.b.H, 3)}]`);
  const inside = (r) => (r.U >= r.b.L - 1e-12 && r.U <= r.b.H + 1e-12);
  out("U_C(A) / U_C(B)", `${fmt(rA.U, 3)} (${inside(rA) ? "inside" : "outside"}) / ${fmt(rB.U, 3)} (${inside(rB) ? "inside" : "outside"})`, inside(rA) && inside(rB) ? "" : "bad");

  plotNow.setLimits([0.3, 2.7], [0, 1]);
  plotNow.clear();
  plotNow.axes({ xticks: [1, 2], xfmt: (v) => (v === 1 ? "group A" : "group B"), yfmt: (v) => v.toFixed(1) });
  for (const [i, r] of rows.entries()) {
    const x = i + 1, mid = (r.b.L + r.b.H) / 2, col = r.g === "A" ? COL.A : COL.B;
    // certified interval as a thick bar (its width is at most 2/(n+1), so it is a line)
    plotNow.line([x - 0.3, x + 0.3], [mid, mid], { color: COL.band, width: 5 });
    if (rA.m !== rB.m) plotNow.text(x, mid + 0.03, `[${fmt(r.b.L, 3)}, ${fmt(r.b.H, 3)}]`, { color: COL.band, align: "center", baseline: "bottom" });
    plotNow.points([x], [r.U], { color: col, radius: 7 });
    if (r.U > mid + 0.1) plotNow.text(x, r.U + 0.035, `U_C = ${fmt(r.U, 3)}, coverage ${fmt(r.cov, 3)}`, { color: col, align: "center", baseline: "bottom" });
    else plotNow.text(x + 0.08, r.U, `U_C = ${fmt(r.U, 3)}, coverage ${fmt(r.cov, 3)}`, { color: col, align: "left", baseline: "middle" });
  }
  if (rA.m === rB.m) plotNow.text(1.5, (rA.b.L + rA.b.H) / 2 + 0.03, `Theorem 2, m = ${rA.m}: [${fmt(rA.b.L, 3)}, ${fmt(rA.b.H, 3)}] for every input`, { color: COL.band, align: "center", baseline: "bottom" });
  plotNow.legend([{ label: "certified interval (Theorem 2)", color: COL.band }, { label: "U_C by eq. (13), group A", color: COL.A }, { label: "U_C by eq. (13), group B", color: COL.B }], { x: plotNow.X(0.35), y: plotNow.Y(1) + 8 });
  void pop;
}

function drawSweep() {
  const xs = [], UA = [], UB = [], LA = [], HA = [], LB = [], HB = [];
  for (let p = 0.30; p <= 0.951; p += 0.005) {
    const r = population(P.pB, p, P.delta, P.n);
    xs.push(p); UA.push(r.UA); UB.push(r.UB); LA.push(r.bA.L); HA.push(r.bA.H); LB.push(r.bB.L); HB.push(r.bB.H);
  }
  plotSweep.setLimits([0.3, 0.95], [0, 1]);
  plotSweep.clear();
  plotSweep.axes({ yfmt: (v) => v.toFixed(1) });
  plotSweep.line(xs, LB, { color: COL.band, width: 2, dash: [5, 4] });
  plotSweep.line(xs, HB, { color: COL.band, width: 2, dash: [5, 4] });
  plotSweep.line(xs, UA, { color: COL.A, width: 2.5 });
  plotSweep.line(xs, UB, { color: COL.B, width: 2.5 });
  plotSweep.vline(P.ptop, { color: COL.grey, dash: [3, 3] });
  plotSweep.legend([{ label: "certified bounds for a group B input", color: COL.band, dash: [5, 4] }, { label: "U_C of a group A input", color: COL.A }, { label: "U_C of a group B input", color: COL.B }], { x: plotSweep.X(0.31), y: plotSweep.Y(1) + 8 });
}

function redraw() { drawNow(); drawSweep(); }

const ctl = document.getElementById("k-controls");
slider(ctl, { label: "share of inputs in group B", min: 0.05, max: 0.5, step: 0.01, value: P.pB, fmt: (v) => pct(v, 0) }, (v) => { P.pB = v; redraw(); });
slider(ctl, { label: "group B favoured-class probability", min: 0.3, max: 0.95, step: 0.01, value: P.ptop, fmt: (v) => fmt(v, 2) }, (v) => { P.ptop = v; redraw(); });
slider(ctl, { label: "error level δ", min: 0.05, max: 0.3, step: 0.01, value: P.delta, fmt: (v) => fmt(v, 2) }, (v) => { P.delta = v; redraw(); });
slider(ctl, { label: "calibration points n", min: 200, max: 5000, step: 100, value: P.n, fmt: (v) => String(v) }, (v) => { P.n = v; redraw(); });
button(ctl, "Resample", () => { P.seed += 1; redraw(); });

autoResize(plotNow, redraw);
autoResize(plotSweep, redraw);
redraw();
