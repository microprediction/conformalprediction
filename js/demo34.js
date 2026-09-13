// Demo 34 — Set size as model uncertainty. Ye et al. (NeurIPS 2024 Datasets
// and Benchmarks) rank language models by the mean size of their conformal
// prediction sets at nominal 90% coverage, averaged over the LAC and APS
// score functions, and read the size as the model's uncertainty.
//
//   Panel A   temperature. Dividing every logit by T changes no argmax and no
//             accuracy, and changes the set size.
//   Panel B   score function. A sharp model and a soft model with the same
//             accuracy are ranked one way by LAC and the other way by APS,
//             because APS over-covers on the sharp model.
//   Panel C   same sets, different accuracy. Two models with identical LAC
//             sets on every input, hence identical set size and coverage,
//             with accuracy 90% and 5%.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const K = 6;
const N_CAL = 2000;
const N_TEST = 6000;
const COL = { lac: "#1f4ed8", aps: "#b45309", cov: "#94a3b8", m1: "#1f4ed8", m2: "#b91c1c", grey: "#94a3b8" };

function softmax(z) {
  const mx = Math.max(...z);
  let s = 0;
  const e = z.map((v) => { const x = Math.exp(v - mx); s += x; return x; });
  return e.map((x) => x / s);
}
const argmax = (p) => p.reduce((b, v, i) => (v > p[b] ? i : b), 0);

// ---------- Ye et al.'s two set constructions (their script, non-randomized) ----------
function conformalQ(scores, alpha) {
  const s = [...scores].sort((a, b) => a - b);
  const n = s.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  return s[Math.min(k, n) - 1];
}
function lacSets(Pc, yc, Pt, alpha) {
  const q = conformalQ(Pc.map((p, i) => 1 - p[yc[i]]), alpha);
  return Pt.map((p) => {
    const set = [];
    for (let h = 0; h < K; h++) if (p[h] >= 1 - q) set.push(h);
    return set.length ? set : [argmax(p)];
  });
}
function apsScore(p, y) {
  const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
  let c = 0;
  for (const h of order) { c += p[h]; if (h === y) return c; }
  return c;
}
function apsSets(Pc, yc, Pt, alpha) {
  const q = conformalQ(Pc.map((p, i) => apsScore(p, yc[i])), alpha);
  return Pt.map((p) => {
    const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
    const set = [];
    let c = 0;
    for (const h of order) { c += p[h]; if (c <= q) set.push(h); else break; }
    return set.length ? set : [order[0]];
  });
}
function summarize(sets, yt) {
  let ss = 0, cov = 0;
  for (let i = 0; i < sets.length; i++) { ss += sets[i].length; if (sets[i].includes(yt[i])) cov++; }
  return { ss: ss / sets.length, cov: cov / sets.length };
}

// ---------- a synthetic model: margin a on a chosen class, Gaussian noise ----------
// The chosen class is the true class with probability acc0, else a random other class.
// exact = true: the chosen class beats the best other option by exactly a, so
// the realized accuracy equals acc0 whatever a and sigma are (panel B).
function drawModel(rng, n, acc0, a, sigma, exact = false) {
  const ys = new Int32Array(n), Z = new Array(n);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(rng() * K); ys[i] = y;
    const star = rng() < acc0 ? y : (y + 1 + Math.floor(rng() * (K - 1))) % K;
    const z = new Array(K);
    for (let h = 0; h < K; h++) z[h] = sigma * randn(rng);
    if (exact) { let mx = -Infinity; for (let h = 0; h < K; h++) if (h !== star) mx = Math.max(mx, z[h]); z[star] = mx + a; }
    else z[star] += a;
    Z[i] = z;
  }
  return { ys, Z };
}
const withT = (Z, T) => Z.map((z) => softmax(z.map((v) => v / T)));

// ================= Panel A: temperature =================
const A = { acc: 0.9, a: 3, sigma: 1, alpha: 0.1, T: 1, seed: 1 };
const plotA = new Plot(document.getElementById("t-plot"), { xlabel: "temperature T (logits divided by T)", ylabel: "mean set size", margin: { l: 56, r: 16, t: 14, b: 40 } });
const outA = readouts(document.getElementById("t-readouts"), ["accuracy", "set size LAC / APS", "coverage LAC / APS"]);

function drawA() {
  const rng = mulberry32(A.seed);
  const cal = drawModel(rng, N_CAL, A.acc, A.a, A.sigma), te = drawModel(rng, N_TEST, A.acc, A.a, A.sigma);
  const acc = te.Z.reduce((s, z, i) => s + (argmax(z) === te.ys[i] ? 1 : 0), 0) / N_TEST;
  const Ts = [], lac = [], aps = [], covL = [], covA = [];
  for (let lt = Math.log(0.25); lt <= Math.log(4) + 1e-9; lt += (Math.log(4) - Math.log(0.25)) / 24) {
    const T = Math.exp(lt);
    const Pc = withT(cal.Z, T), Pt = withT(te.Z, T);
    const L = summarize(lacSets(Pc, cal.ys, Pt, A.alpha), te.ys), P = summarize(apsSets(Pc, cal.ys, Pt, A.alpha), te.ys);
    Ts.push(T); lac.push(L.ss); aps.push(P.ss); covL.push(L.cov); covA.push(P.cov);
  }
  const Pc = withT(cal.Z, A.T), Pt = withT(te.Z, A.T);
  const L = summarize(lacSets(Pc, cal.ys, Pt, A.alpha), te.ys), P = summarize(apsSets(Pc, cal.ys, Pt, A.alpha), te.ys);
  outA("accuracy", pct(acc));
  outA("set size LAC / APS", `${fmt(L.ss, 2)} / ${fmt(P.ss, 2)}`);
  outA("coverage LAC / APS", `${pct(L.cov)} / ${pct(P.cov)}`);
  const xs = Ts.map((t) => Math.log2(t));
  plotA.setLimits([-2, 2], [1, K]);
  plotA.clear();
  plotA.axes({ xticks: [-2, -1, 0, 1, 2], xfmt: (v) => fmt(Math.pow(2, v), 2) });
  plotA.line(xs, lac, { color: COL.lac, width: 2.5 });
  plotA.line(xs, aps, { color: COL.aps, width: 2.5 });
  // coverage on a secondary scale drawn as dashed lines mapped into [1, K]
  const map = (c) => 1 + (K - 1) * (c - 0.85) / 0.15;
  plotA.line(xs, covL.map(map), { color: COL.lac, width: 1.5, dash: [4, 4] });
  plotA.line(xs, covA.map(map), { color: COL.aps, width: 1.5, dash: [4, 4] });
  plotA.hline(map(1 - A.alpha), { color: COL.grey, dash: [2, 3], width: 1 });
  plotA.vline(Math.log2(A.T), { color: COL.grey, dash: [3, 3] });
  plotA.text(1.95, map(1) - 0.12, "coverage 100%", { color: COL.grey, align: "right", baseline: "top" });
  plotA.text(1.95, map(1 - A.alpha) + 0.08, `coverage ${pct(1 - A.alpha, 0)}`, { color: COL.grey, align: "right", baseline: "bottom" });
  plotA.text(1.95, map(0.85) + 0.08, "coverage 85%", { color: COL.grey, align: "right", baseline: "bottom" });
  plotA.legend([{ label: "set size, LAC", color: COL.lac }, { label: "set size, APS", color: COL.aps }, { label: "realized coverage (right scale)", color: COL.grey, dash: [4, 4] }], { x: plotA.X(-1.95), y: plotA.Y(K) + 8 });
}
const ctlA = document.getElementById("t-controls");
slider(ctlA, { label: "temperature T", min: -2, max: 2, step: 0.05, value: 0, fmt: (v) => fmt(Math.pow(2, v), 2) }, (v) => { A.T = Math.pow(2, v); drawA(); });
slider(ctlA, { label: "accuracy of the chosen class", min: 0.2, max: 0.98, step: 0.01, value: A.acc, fmt: (v) => pct(v, 0) }, (v) => { A.acc = v; drawA(); });
slider(ctlA, { label: "logit margin a", min: 1, max: 8, step: 0.25, value: A.a, fmt: (v) => fmt(v, 2) }, (v) => { A.a = v; drawA(); });
slider(ctlA, { label: "error level α", min: 0.05, max: 0.3, step: 0.01, value: A.alpha, fmt: (v) => fmt(v, 2) }, (v) => { A.alpha = v; drawA(); });
button(ctlA, "Resample", () => { A.seed += 1; drawA(); });

// ================= Panel B: score function =================
const B = { acc: 0.9, a1: 7, a2: 2, sigma: 0.7, alpha: 0.15, seed: 1 };
const plotB = new Plot(document.getElementById("s-plot"), { xlabel: "", ylabel: "mean set size", margin: { l: 56, r: 16, t: 14, b: 40 } });
const outB = readouts(document.getElementById("s-readouts"), ["accuracy sharp / soft", "LAC set size sharp / soft", "APS set size sharp / soft", "APS coverage sharp / soft"]);

function drawB() {
  const rng = mulberry32(B.seed + 100);
  const res = {};
  for (const [name, a] of [["sharp", B.a1], ["soft", B.a2]]) {
    const cal = drawModel(rng, N_CAL, B.acc, a, B.sigma, true), te = drawModel(rng, N_TEST, B.acc, a, B.sigma, true);
    const Pc = withT(cal.Z, 1), Pt = withT(te.Z, 1);
    res[name] = { acc: te.Z.reduce((s, z, i) => s + (argmax(z) === te.ys[i] ? 1 : 0), 0) / N_TEST,
      L: summarize(lacSets(Pc, cal.ys, Pt, B.alpha), te.ys), P: summarize(apsSets(Pc, cal.ys, Pt, B.alpha), te.ys) };
  }
  const s = res.sharp, o = res.soft;
  outB("accuracy sharp / soft", `${pct(s.acc)} / ${pct(o.acc)}`);
  outB("LAC set size sharp / soft", `${fmt(s.L.ss, 2)} / ${fmt(o.L.ss, 2)}`);
  outB("APS set size sharp / soft", `${fmt(s.P.ss, 2)} / ${fmt(o.P.ss, 2)}`);
  outB("APS coverage sharp / soft", `${pct(s.P.cov)} / ${pct(o.P.cov)}`);
  plotB.setLimits([0, 6], [0, K]);
  plotB.clear();
  plotB.axes({ xticks: [1.5, 4.5], xfmt: (v) => (v < 3 ? "LAC" : "APS"), grid: false });
  const bars = [[1, s.L, "sharp"], [2, o.L, "soft"], [4, s.P, "sharp"], [5, o.P, "soft"]];
  for (const [x, r, name] of bars) {
    const col = name === "sharp" ? COL.m1 : COL.m2;
    plotB.band([x - 0.4, x + 0.4], [0, 0], [r.ss, r.ss], { color: col, alpha: 0.85 });
    plotB.text(x, r.ss + 0.12, `${fmt(r.ss, 2)}`, { color: col, align: "center", baseline: "bottom" });
    plotB.text(x, 0.12, `cov ${pct(r.cov, 1)}`, { color: "#ffffff", align: "center", baseline: "bottom", font: "11px ui-sans-serif, system-ui, sans-serif" });
  }
  plotB.legend([{ label: "sharp model", color: COL.m1 }, { label: "soft model, same accuracy", color: COL.m2 }], { x: plotB.X(0.1), y: plotB.Y(K) + 8 });
}
const ctlB = document.getElementById("s-controls");
slider(ctlB, { label: "accuracy of both models", min: 0.3, max: 0.98, step: 0.01, value: B.acc, fmt: (v) => pct(v, 0) }, (v) => { B.acc = v; drawB(); });
slider(ctlB, { label: "sharp model margin", min: 3, max: 12, step: 0.25, value: B.a1, fmt: (v) => fmt(v, 2) }, (v) => { B.a1 = v; drawB(); });
slider(ctlB, { label: "soft model margin", min: 0.5, max: 4, step: 0.25, value: B.a2, fmt: (v) => fmt(v, 2) }, (v) => { B.a2 = v; drawB(); });
slider(ctlB, { label: "error level α", min: 0.05, max: 0.3, step: 0.01, value: B.alpha, fmt: (v) => fmt(v, 2) }, (v) => { B.alpha = v; drawB(); });
button(ctlB, "Resample", () => { B.seed += 1; drawB(); });

// ================= Panel C: same sets, different accuracy =================
// 85% "medium" inputs: probabilities (0.5, 0.4, 0.1, 0, 0, 0) on three classes.
// Model 1 puts 0.5 on the true class, model 2 puts 0.4 on it, both put 0.1 on a
// third class. 15% "hard" inputs: (0.4, 0.3, 0.3) with the true class uniformly
// among the three, identical under both models. LAC sets at 90%.
const C = { medium: 0.85, alpha: 0.1, seed: 1 };
const outC = readouts(document.getElementById("c-readouts"), ["threshold q̂ model 1 / 2", "sets identical on", "set size 1 / 2", "coverage 1 / 2", "accuracy 1 / 2"]);
function drawC() {
  const rng = mulberry32(C.seed + 200);
  const gen = (n) => {
    const ys = new Int32Array(n), P1 = new Array(n), P2 = new Array(n);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(rng() * K); ys[i] = y;
      const o1 = (y + 1 + Math.floor(rng() * (K - 1))) % K;
      let o2 = o1; while (o2 === o1 || o2 === y) o2 = Math.floor(rng() * K);
      const p1 = new Array(K).fill(0), p2 = new Array(K).fill(0);
      if (rng() < C.medium) {
        p1[y] = 0.5; p1[o1] = 0.4; p1[o1 === y ? o2 : o2] = 0.1;
        p2[o1] = 0.5; p2[y] = 0.4; p2[o2] = 0.1;
      } else {
        const r = rng();
        const slots = [y, o1, o2], vals = r < 1 / 3 ? [0.4, 0.3, 0.3] : r < 2 / 3 ? [0.3, 0.4, 0.3] : [0.3, 0.3, 0.4];
        for (let j = 0; j < 3; j++) { p1[slots[j]] = vals[j]; p2[slots[j]] = vals[j]; }
      }
      P1[i] = p1; P2[i] = p2;
    }
    return { ys, P1, P2 };
  };
  const cal = gen(N_CAL), te = gen(N_TEST);
  const q1 = conformalQ(cal.P1.map((p, i) => 1 - p[cal.ys[i]]), C.alpha), q2 = conformalQ(cal.P2.map((p, i) => 1 - p[cal.ys[i]]), C.alpha);
  const S1 = lacSets(cal.P1, cal.ys, te.P1, C.alpha), S2 = lacSets(cal.P2, cal.ys, te.P2, C.alpha);
  let same = 0;
  for (let i = 0; i < N_TEST; i++) if (S1[i].length === S2[i].length && S1[i].every((h, j) => h === S2[i][j])) same++;
  const r1 = summarize(S1, te.ys), r2 = summarize(S2, te.ys);
  const acc1 = te.P1.reduce((s, p, i) => s + (argmax(p) === te.ys[i] ? 1 : 0), 0) / N_TEST;
  const acc2 = te.P2.reduce((s, p, i) => s + (argmax(p) === te.ys[i] ? 1 : 0), 0) / N_TEST;
  outC("threshold q̂ model 1 / 2", `${fmt(q1, 2)} / ${fmt(q2, 2)}`);
  outC("sets identical on", pct(same / N_TEST, 1));
  outC("set size 1 / 2", `${fmt(r1.ss, 3)} / ${fmt(r2.ss, 3)}`);
  outC("coverage 1 / 2", `${pct(r1.cov)} / ${pct(r2.cov)}`);
  outC("accuracy 1 / 2", `${pct(acc1)} / ${pct(acc2)}`, "bad");
}
const ctlC = document.getElementById("c-controls");
slider(ctlC, { label: "share of medium inputs", min: 0.5, max: 0.95, step: 0.01, value: C.medium, fmt: (v) => pct(v, 0) }, (v) => { C.medium = v; drawC(); });
slider(ctlC, { label: "error level α", min: 0.05, max: 0.3, step: 0.01, value: C.alpha, fmt: (v) => fmt(v, 2) }, (v) => { C.alpha = v; drawC(); });
button(ctlC, "Resample", () => { C.seed += 1; drawC(); });

autoResize(plotA, drawA);
autoResize(plotB, drawB);
drawA(); drawB(); drawC();
