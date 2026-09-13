// Demo 32 — Conformal correlation. Three experiments on the "conformal
// correlation matrix" (Perlo, Chiasserini, De Veciana and Malandrino, Computer
// Communications 2026): the phi coefficient between class-membership indicators
// of conformal prediction sets.
//
// A synthetic H-class classifier with known confusability generates softmax
// vectors. Adaptive prediction sets (APS, Romano et al. 2020) are calibrated
// on a labeled set, evaluated on a test set, and the CCM is computed exactly
// as the paper defines it. Alongside it we compute the statistics the paper
// never compares against: the soft confusion matrix and the pairwise product
// of probabilities.
//
//   Panel A   the off-diagonal entries are pinned by inclusion rates. For pairs
//             that never share a set, rho = -sqrt(p_i p_j / ((1-p_i)(1-p_j)))
//             exactly, so the "hard to confuse" entries measure prevalence.
//   Panel B   the CCM is symmetric; it cannot tell which way a confusion runs.
//   Panel C   as alpha grows and sets shrink to singletons, the CCM loses its
//             ability to rank pairs by true confusability. The soft statistic
//             does not.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, checkbox, readouts, button } from "./lib/ui.js";

const H = 10;
const N_CAL = 1000;
const N_TEST = 3000;
const COL = { ccm: "#1f4ed8", soft: "#b45309", pair: "#b91c1c", formula: "#111827", grey: "#94a3b8" };

// ---------- synthetic classifier ----------

function softmax(l) {
  const mx = Math.max(...l);
  let s = 0;
  const e = l.map((v) => { const x = Math.exp(v - mx); s += x; return x; });
  return e.map((x) => x / s);
}

function classPrior(kappa) {
  const w = [];
  for (let h = 0; h < H; h++) w.push(Math.exp(-kappa * h / (H - 1)));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

function drawClass(rng, pi) {
  const u = rng();
  let c = 0;
  for (let h = 0; h < H; h++) { c += pi[h]; if (u < c) return h; }
  return H - 1;
}

// logits: margin on the true class, plus a directional confusion term G[y][h],
// plus unit Gaussian noise. p = softmax(logits).
function generate(rng, n, pi, G, margin, hard = 0) {
  const ys = new Int32Array(n), P = new Array(n);
  for (let i = 0; i < n; i++) {
    const y = drawClass(rng, pi);
    ys[i] = y;
    // a "hard" input: the classifier has no margin on it, so its set is large
    const mg = hard > 0 && rng() < hard ? 0 : margin;
    const l = new Array(H);
    for (let h = 0; h < H; h++) l[h] = (h === y ? mg : 0) + G[y][h] + randn(rng);
    P[i] = softmax(l);
  }
  return { ys, P };
}

function zeroG() { return Array.from({ length: H }, () => new Array(H).fill(0)); }

// ---------- adaptive prediction sets ----------

// Per sample: classes in descending probability, and cumulative masses.
function prep(P) {
  return P.map((p) => {
    const ord = [...p.keys()].sort((a, b) => p[b] - p[a]);
    const cum = new Array(H);
    let c = 0;
    for (let k = 0; k < H; k++) { c += p[ord[k]]; cum[k] = c; }
    return { ord, cum };
  });
}

// APS score of the true label: cumulative mass through it, minus u times its
// own mass when randomized (Romano, Sesia and Candes 2020).
function apsScores(pre, ys, randomize, rng) {
  return pre.map((s, i) => {
    const r = s.ord.indexOf(ys[i]);
    const pr = r > 0 ? s.cum[r] - s.cum[r - 1] : s.cum[r];
    return s.cum[r] - (randomize ? rng() * pr : 0);
  });
}

function conformalQ(scores, alpha) {
  const a = scores.slice().sort((x, y) => x - y);
  const n = a.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  return k > n ? 1 : a[k - 1];
}

// Include classes in descending order while the mass before them is below q.
// Randomized: keep the boundary class with probability (q - mass before) / its mass.
function apsSets(pre, q, randomize, rng) {
  return pre.map((s) => {
    const z = new Uint8Array(H);
    let k = 0;
    while (k < H && (k === 0 || s.cum[k - 1] < q)) { z[s.ord[k]] = 1; k++; }
    if (randomize && k > 1) {
      const L = k - 1, before = s.cum[L - 1], pL = s.cum[L] - before;
      if (rng() > (q - before) / pL) z[s.ord[L]] = 0;
    }
    return z;
  });
}

// ---------- the statistics ----------

// The conformal correlation matrix, exactly as defined: phi coefficients of
// the membership indicators. Also returns inclusion rates and co-occurrence rates.
function ccm(Z) {
  const n = Z.length;
  const p = new Float64Array(H);
  const co = Array.from({ length: H }, () => new Float64Array(H));
  let size = 0;
  for (const z of Z) {
    for (let i = 0; i < H; i++) {
      if (!z[i]) continue;
      p[i]++; size++;
      for (let j = i; j < H; j++) if (z[j]) co[i][j]++;
    }
  }
  for (let i = 0; i < H; i++) { p[i] /= n; for (let j = i; j < H; j++) { co[i][j] /= n; co[j][i] = co[i][j]; } }
  const rho = Array.from({ length: H }, () => new Float64Array(H).fill(NaN));
  for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) {
    const v = p[i] * (1 - p[i]) * p[j] * (1 - p[j]);
    rho[i][j] = v > 0 ? (co[i][j] - p[i] * p[j]) / Math.sqrt(v) : NaN;
  }
  return { rho, p, co, meanSize: size / n };
}

// What the paper never computes: soft confusion C[a][b] = mean prob on b for
// images of a (directional), and the pairwise co-mass S[i][j] = mean p_i p_j.
function softConfusion(P, ys) {
  const C = Array.from({ length: H }, () => new Float64Array(H));
  const cnt = new Float64Array(H);
  for (let i = 0; i < P.length; i++) { cnt[ys[i]]++; for (let h = 0; h < H; h++) C[ys[i]][h] += P[i][h]; }
  for (let a = 0; a < H; a++) if (cnt[a] > 0) for (let h = 0; h < H; h++) C[a][h] /= cnt[a];
  return C;
}
function coMass(P) {
  const S = Array.from({ length: H }, () => new Float64Array(H));
  for (const p of P) for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) S[i][j] += p[i] * p[j];
  for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) S[i][j] /= P.length;
  return S;
}

// -sqrt(p_i p_j / ((1-p_i)(1-p_j))): the phi coefficient of two indicators
// that never co-occur, a function of the inclusion rates only.
function pinned(pi, pj) { return -Math.sqrt((pi * pj) / ((1 - pi) * (1 - pj))); }

function spearman(x, y) {
  const rank = (v) => {
    const idx = [...v.keys()].sort((a, b) => v[a] - v[b]);
    const r = new Float64Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x), ry = rank(y), n = x.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// ---------- a small heat map ----------

function heatmap(canvas, M, opts) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 400, h = rect.height || 320;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  const top = 26, left = 22;
  const cell = Math.floor(Math.min((w - left - 6) / H, (h - top - 6) / H));
  const x0 = left + Math.max(0, (w - left - cell * H) / 2);
  ctx.font = "700 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(opts.title, x0, 4);
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) {
    const v = M[i][j];
    const x = x0 + j * cell, y = top + i * cell;
    if (!isFinite(v)) { ctx.fillStyle = "#e5e7eb"; }
    else if (opts.diverging) {
      const a = Math.min(1, Math.abs(v) / opts.vmax);
      ctx.fillStyle = v < 0 ? `rgba(31,78,216,${0.08 + 0.85 * a})` : `rgba(185,28,28,${0.08 + 0.85 * a})`;
    } else {
      const a = Math.min(1, v / opts.vmax);
      ctx.fillStyle = `rgba(180,83,9,${0.06 + 0.9 * a})`;
    }
    ctx.fillRect(x, y, cell - 1, cell - 1);
    if (cell >= 26 && isFinite(v)) {
      const a = Math.min(1, Math.abs(v) / opts.vmax);
      ctx.fillStyle = a > 0.55 ? "#fff" : "rgba(0,0,0,0.75)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(opts.fmt(v), x + cell / 2, y + cell / 2);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i < H; i++) ctx.fillText(String(i), x0 - 4, top + i * cell + cell / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  for (let j = 0; j < H; j++) ctx.fillText(String(j), x0 + j * cell + cell / 2, top - 1);
  if (opts.highlight) {
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
    for (const [i, j] of opts.highlight) ctx.strokeRect(x0 + j * cell - 0.5, top + i * cell - 0.5, cell, cell);
  }
}

// Fit a full pipeline: generate cal and test, calibrate, build sets, score.
function pipeline(seed, pi, G, margin, alpha, randomize, hard = 0) {
  const rng = mulberry32(seed);
  const cal = generate(rng, N_CAL, pi, G, margin, hard);
  const test = generate(rng, N_TEST, pi, G, margin, hard);
  const preCal = prep(cal.P), preTest = prep(test.P);
  const scores = apsScores(preCal, cal.ys, randomize, rng);
  const q = conformalQ(scores, alpha);
  const Z = apsSets(preTest, q, randomize, rng);
  return { test, preTest, q, Z, rngState: rng };
}

// =====================================================================
// Panel A: pinned by prevalence
// =====================================================================
{
  const st = { alpha: 0.10, kappa: 0, c: 4.5, margin: 6, hard: 0, randomize: true };
  let seed = 11;
  const ccmCanvas = document.getElementById("a-ccm");
  const softCanvas = document.getElementById("a-soft");
  const sweep = new Plot(document.getElementById("a-sweep"), {
    xlim: [0, 0.5], ylim: [-0.6, 1], xlabel: "miscoverage α", ylabel: "CCM entry ρ",
  });
  const setRO = readouts(document.getElementById("a-readouts"),
    ["ρ, the confusable pair (0,1)", "ρ, mean of the other 44 pairs", "pinned value from inclusion rates", "mean set size"]);
  const ctrls = document.getElementById("a-controls");
  let sim = null;

  function run() {
    const G = zeroG(); G[0][1] = st.c; G[1][0] = st.c;
    const pi = classPrior(st.kappa);
    const out = pipeline(seed, pi, G, st.margin, st.alpha, st.randomize, st.hard);
    const m = ccm(out.Z);
    const soft = softConfusion(out.test.P, out.test.ys);
    let sum = 0, pin = 0, cnt = 0;
    for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) {
      if (i === 0 && j === 1) continue;
      if (!isFinite(m.rho[i][j])) continue;
      sum += m.rho[i][j]; pin += pinned(m.p[i], m.p[j]); cnt++;
    }
    // sweep alpha with the same data
    const rng2 = mulberry32(seed);
    const cal = generate(rng2, N_CAL, pi, G, st.margin, st.hard);
    const test = generate(rng2, N_TEST, pi, G, st.margin, st.hard);
    const preCal = prep(cal.P), preTest = prep(test.P);
    const scores = apsScores(preCal, cal.ys, st.randomize, rng2);
    const xs = [], pair = [], other = [], form = [];
    for (let a = 0.02; a <= 0.5001; a += 0.02) {
      const q = conformalQ(scores, a);
      const Z = apsSets(preTest, q, st.randomize, rng2);
      const mm = ccm(Z);
      let s = 0, f = 0, k = 0;
      for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) {
        if (i === 0 && j === 1) continue;
        if (!isFinite(mm.rho[i][j])) continue;
        s += mm.rho[i][j]; f += pinned(mm.p[i], mm.p[j]); k++;
      }
      xs.push(a); pair.push(mm.rho[0][1]); other.push(k ? s / k : NaN); form.push(k ? f / k : NaN);
    }
    sim = { m, soft, other: cnt ? sum / cnt : NaN, pin: cnt ? pin / cnt : NaN, xs, pair, otherCurve: other, form };
  }

  function draw() {
    if (!sim) return;
    heatmap(ccmCanvas, sim.m.rho, { title: `conformal correlation matrix, α = ${fmt(st.alpha, 2)}`, diverging: true, vmax: 1, fmt: (v) => fmt(v, 2), highlight: [[0, 1], [1, 0]] });
    heatmap(softCanvas, sim.soft, { title: "soft confusion matrix (mean probability)", diverging: false, vmax: 1, fmt: (v) => fmt(v, 2), highlight: [[0, 1], [1, 0]] });
    sweep.setLimits([0, 0.5], [-0.6, 1]);
    sweep.clear("#fff");
    sweep.axes({});
    sweep.hline(0, { color: "#d4d4d4", width: 1 });
    sweep.line(sim.xs, sim.pair, { color: COL.pair, width: 2.2 });
    sweep.line(sim.xs, sim.otherCurve, { color: COL.ccm, width: 2.2 });
    sweep.line(sim.xs, sim.form, { color: COL.formula, width: 1.6, dash: [5, 4] });
    sweep.vline(st.alpha, { color: "rgba(0,0,0,0.35)", width: 1, dash: [3, 3] });
    sweep.legend([
      { label: "ρ for the one confusable pair", color: COL.pair },
      { label: "mean ρ over the 44 dissimilar pairs", color: COL.ccm },
      { label: "−√(p·p′/((1−p)(1−p′))) from inclusion rates", color: COL.formula, dash: [5, 4] },
    ], {});
    setRO("ρ, the confusable pair (0,1)", fmt(sim.m.rho[0][1], 2));
    setRO("ρ, mean of the other 44 pairs", fmt(sim.other, 3));
    setRO("pinned value from inclusion rates", fmt(sim.pin, 3));
    setRO("mean set size", fmt(sim.m.meanSize, 2));
  }
  const refresh = () => { run(); draw(); };
  slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.5, step: 0.01, value: st.alpha, fmt: (v) => fmt(v, 2) }, (v) => { st.alpha = v; refresh(); });
  slider(ctrls, { label: "class imbalance (log ratio, most to least common)", min: 0, max: 3, step: 0.1, value: st.kappa, fmt: (v) => fmt(v, 1) }, (v) => { st.kappa = v; refresh(); });
  slider(ctrls, { label: "confusion strength, pair (0,1)", min: 0, max: 8, step: 0.1, value: st.c, fmt: (v) => fmt(v, 1) }, (v) => { st.c = v; refresh(); });
  slider(ctrls, { label: "classifier margin (accuracy)", min: 0, max: 10, step: 0.1, value: st.margin, fmt: (v) => fmt(v, 1) }, (v) => { st.margin = v; refresh(); });
  slider(ctrls, { label: "share of hard inputs (no margin, large sets)", min: 0, max: 0.5, step: 0.02, value: st.hard, fmt: (v) => pct(v, 0) }, (v) => { st.hard = v; refresh(); });
  checkbox(ctrls, { label: "randomized APS (Romano et al.)", checked: st.randomize }, (v) => { st.randomize = v; refresh(); });
  button(ctrls, "resample", () => { seed += 1; refresh(); });
  autoResize(sweep, draw);
  new ResizeObserver(draw).observe(ccmCanvas);
  refresh();
}

// =====================================================================
// Panel B: symmetric object, directional confusion
// =====================================================================
{
  const st = { theta: 1, c: 5, alpha: 0.10, margin: 6, randomize: true };
  let seed = 23;
  const plot = new Plot(document.getElementById("b-plot"), {
    xlim: [0, 1], ylim: [-0.1, 1], xlabel: "θ: share of the confusion that runs from class 0 to class 1", ylabel: "",
  });
  const setRO = readouts(document.getElementById("b-readouts"),
    ["CCM entry ρ(0,1) at θ", "ρ(0,1) at 1 − θ", "soft confusion 0 → 1", "soft confusion 1 → 0"]);
  const ctrls = document.getElementById("b-controls");
  let sim = null;

  function at(theta, rngSeed) {
    const G = zeroG(); G[0][1] = theta * st.c; G[1][0] = (1 - theta) * st.c;
    const pi = classPrior(0);
    const out = pipeline(rngSeed, pi, G, st.margin, st.alpha, st.randomize);
    const m = ccm(out.Z);
    const C = softConfusion(out.test.P, out.test.ys);
    return { rho: m.rho[0][1], c01: C[0][1], c10: C[1][0] };
  }
  function run() {
    const xs = [], rho = [], c01 = [], c10 = [];
    for (let t = 0; t <= 1.0001; t += 0.05) { const r = at(t, seed); xs.push(t); rho.push(r.rho); c01.push(r.c01); c10.push(r.c10); }
    const here = at(st.theta, seed), mirror = at(1 - st.theta, seed);
    sim = { xs, rho, c01, c10, here, mirror };
  }
  function draw() {
    if (!sim) return;
    plot.setLimits([0, 1], [-0.1, 1]);
    plot.clear("#fff");
    plot.axes({});
    plot.hline(0, { color: "#d4d4d4", width: 1 });
    plot.line(sim.xs, sim.c01, { color: COL.soft, width: 2.2 });
    plot.line(sim.xs, sim.c10, { color: COL.soft, width: 2.2, dash: [6, 4] });
    plot.line(sim.xs, sim.rho, { color: COL.ccm, width: 2.6 });
    plot.vline(st.theta, { color: "rgba(0,0,0,0.35)", width: 1, dash: [3, 3] });
    plot.legend([
      { label: "CCM entry ρ(0,1)", color: COL.ccm },
      { label: "soft confusion, images of 0 given mass on 1", color: COL.soft },
      { label: "soft confusion, images of 1 given mass on 0", color: COL.soft, dash: [6, 4] },
    ], { x: plot.X(0.03), y: plot.Y(1) + 8 });
    setRO("CCM entry ρ(0,1) at θ", fmt(sim.here.rho, 3));
    setRO("ρ(0,1) at 1 − θ", fmt(sim.mirror.rho, 3));
    setRO("soft confusion 0 → 1", fmt(sim.here.c01, 3));
    setRO("soft confusion 1 → 0", fmt(sim.here.c10, 3));
  }
  const refresh = () => { run(); draw(); };
  slider(ctrls, { label: "direction θ (1 = all 0→1, 0 = all 1→0)", min: 0, max: 1, step: 0.05, value: st.theta, fmt: (v) => fmt(v, 2) }, (v) => { st.theta = v; refresh(); });
  slider(ctrls, { label: "total confusion strength", min: 0, max: 8, step: 0.1, value: st.c, fmt: (v) => fmt(v, 1) }, (v) => { st.c = v; refresh(); });
  slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.5, step: 0.01, value: st.alpha, fmt: (v) => fmt(v, 2) }, (v) => { st.alpha = v; refresh(); });
  slider(ctrls, { label: "classifier margin (accuracy)", min: 0, max: 10, step: 0.1, value: st.margin, fmt: (v) => fmt(v, 1) }, (v) => { st.margin = v; refresh(); });
  checkbox(ctrls, { label: "randomized APS (Romano et al.)", checked: st.randomize }, (v) => { st.randomize = v; refresh(); });
  button(ctrls, "resample", () => { seed += 1; refresh(); });
  autoResize(plot, draw);
  refresh();
}

// =====================================================================
// Panel C: resolution. Can the statistic rank pairs by true confusability?
// =====================================================================
{
  const st = { alpha: 0.10, margin: 6, cmax: 5, randomize: true };
  let seed = 37;
  const scCCM = new Plot(document.getElementById("c-ccm"), { xlim: [0, 1], ylim: [-0.4, 1], xlabel: "true confusability of the pair", ylabel: "CCM entry ρ" });
  const scSoft = new Plot(document.getElementById("c-soft"), { xlim: [0, 1], ylim: [0, 1], xlabel: "true confusability of the pair", ylabel: "mean p·p′ (rescaled)" });
  const curve = new Plot(document.getElementById("c-curve"), { xlim: [0, 0.5], ylim: [-0.2, 1], xlabel: "miscoverage α", ylabel: "rank correlation with the truth" });
  const setRO = readouts(document.getElementById("c-readouts"),
    ["rank correlation, CCM", "rank correlation, soft statistic", "share of singleton sets", "mean set size"]);
  const ctrls = document.getElementById("c-controls");
  let sim = null;

  function truth(rngSeed) {
    const rng = mulberry32(rngSeed);
    const G = zeroG(), g = [];
    for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) { const v = st.cmax * rng() ** 2; G[i][j] = v; G[j][i] = v; g.push(v / st.cmax); }
    return { G, g };
  }
  function pairs(M) { const out = []; for (let i = 0; i < H; i++) for (let j = i + 1; j < H; j++) out.push(M[i][j]); return out; }

  function run() {
    const { G, g } = truth(seed);
    const pi = classPrior(0);
    const rng = mulberry32(seed + 1000);
    const cal = generate(rng, N_CAL, pi, G, st.margin);
    const test = generate(rng, N_TEST, pi, G, st.margin);
    const preCal = prep(cal.P), preTest = prep(test.P);
    const scores = apsScores(preCal, cal.ys, st.randomize, rng);
    const S = pairs(coMass(test.P));
    const smax = Math.max(...S);
    const Sn = S.map((v) => v / smax);
    const rSoft = spearman(g, S);
    const q = conformalQ(scores, st.alpha);
    const Z = apsSets(preTest, q, st.randomize, rng);
    const m = ccm(Z);
    const R = pairs(m.rho);
    const ok = R.map((v) => isFinite(v));
    const rCCM = spearman(g.filter((_, i) => ok[i]), R.filter((_, i) => ok[i]));
    let singles = 0;
    for (const z of Z) { let s = 0; for (let h = 0; h < H; h++) s += z[h]; if (s === 1) singles++; }
    const xs = [], rc = [];
    for (let a = 0.02; a <= 0.5001; a += 0.02) {
      const qq = conformalQ(scores, a);
      const ZZ = apsSets(preTest, qq, st.randomize, rng);
      const RR = pairs(ccm(ZZ).rho);
      const okk = RR.map((v) => isFinite(v));
      const n = okk.filter(Boolean).length;
      xs.push(a); rc.push(n > 5 ? spearman(g.filter((_, i) => okk[i]), RR.filter((_, i) => okk[i])) : NaN);
    }
    sim = { g, R, Sn, rSoft, rCCM, singles: singles / N_TEST, meanSize: m.meanSize, xs, rc };
  }
  function draw() {
    if (!sim) return;
    scCCM.setLimits([0, 1], [-0.4, 1]); scCCM.clear("#fff"); scCCM.axes({});
    scCCM.hline(0, { color: "#d4d4d4", width: 1 });
    scCCM.points(sim.g, sim.R, { color: COL.ccm, radius: 3.5, alpha: 0.85 });
    scSoft.setLimits([0, 1], [0, 1]); scSoft.clear("#fff"); scSoft.axes({});
    scSoft.points(sim.g, sim.Sn, { color: COL.soft, radius: 3.5, alpha: 0.85 });
    curve.setLimits([0, 0.5], [-0.2, 1]); curve.clear("#fff"); curve.axes({});
    curve.hline(0, { color: "#d4d4d4", width: 1 });
    curve.line([0, 0.5], [sim.rSoft, sim.rSoft], { color: COL.soft, width: 2.2 });
    curve.line(sim.xs, sim.rc, { color: COL.ccm, width: 2.4 });
    curve.vline(st.alpha, { color: "rgba(0,0,0,0.35)", width: 1, dash: [3, 3] });
    curve.legend([
      { label: "CCM at each α", color: COL.ccm },
      { label: "soft statistic", color: COL.soft },
    ], { x: curve.X(0.03), y: curve.Y(-0.2) - 58 });
    setRO("rank correlation, CCM", fmt(sim.rCCM, 2), sim.rCCM < 0.5 ? "bad" : sim.rCCM < 0.8 ? "warn" : "good");
    setRO("rank correlation, soft statistic", fmt(sim.rSoft, 2), "good");
    setRO("share of singleton sets", pct(sim.singles, 0));
    setRO("mean set size", fmt(sim.meanSize, 2));
  }
  const refresh = () => { run(); draw(); };
  slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.5, step: 0.01, value: st.alpha, fmt: (v) => fmt(v, 2) }, (v) => { st.alpha = v; refresh(); });
  slider(ctrls, { label: "classifier margin (accuracy)", min: 0, max: 10, step: 0.1, value: st.margin, fmt: (v) => fmt(v, 1) }, (v) => { st.margin = v; refresh(); });
  slider(ctrls, { label: "spread of true confusabilities", min: 0.5, max: 8, step: 0.1, value: st.cmax, fmt: (v) => fmt(v, 1) }, (v) => { st.cmax = v; refresh(); });
  checkbox(ctrls, { label: "randomized APS (Romano et al.)", checked: st.randomize }, (v) => { st.randomize = v; refresh(); });
  button(ctrls, "new truth", () => { seed += 1; refresh(); });
  autoResize(scCCM, draw); autoResize(scSoft, draw); autoResize(curve, draw);
  refresh();
}
