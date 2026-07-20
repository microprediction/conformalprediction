// Demo 28 — The price of a dumb model, on real data.
// Motorcycle-crash data (mcycle: head acceleration vs time, n=133), the canonical
// heteroscedastic 1-D dataset. Two conditional-distribution estimators, both
// conformalized (CQR-style) so both carry the exact coverage certificate:
//   (A) regressogram — the universally consistent construction of demo 27: bin x,
//       use the within-cell empirical distribution of y. Crude, blocky, starved.
//   (B) a smooth heteroscedastic kernel estimate — Nadaraya-Watson local mean and
//       local scale, a Gaussian predictive. Sensible density estimation.
// Both hit the coverage target; the regressogram pays for it in width and CRPS.
// The second panel sweeps the regressogram's cell width: no setting reaches the
// smooth estimator's proper score. That gap is the price.
import { mulberry32, normCdf, normPdf, normInv, quantile, mean, fmt, pct, clamp, linspace }
  from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const MCYCLE = [[2.4,0],[2.6,-1.3],[3.2,-2.7],[3.6,0],[4,-2.7],[6.2,-2.7],[6.6,-2.7],[6.8,-1.3],[7.8,-2.7],[8.2,-2.7],[8.8,-1.3],[8.8,-2.7],[9.6,-2.7],[10,-2.7],[10.2,-5.4],[10.6,-2.7],[11,-5.4],[11.4,0],[13.2,-2.7],[13.6,-2.7],[13.8,0],[14.6,-13.3],[14.6,-5.4],[14.6,-5.4],[14.6,-9.3],[14.6,-16],[14.6,-22.8],[14.8,-2.7],[15.4,-22.8],[15.4,-32.1],[15.4,-53.5],[15.4,-54.9],[15.6,-40.2],[15.6,-21.5],[15.8,-21.5],[15.8,-50.8],[16,-42.9],[16,-26.8],[16.2,-21.5],[16.2,-50.8],[16.2,-61.7],[16.4,-5.4],[16.4,-80.4],[16.6,-59],[16.8,-71],[16.8,-91.1],[16.8,-77.7],[17.6,-37.5],[17.6,-85.6],[17.6,-123.1],[17.6,-101.9],[17.8,-99.1],[17.8,-104.4],[18.6,-112.5],[18.6,-50.8],[19.2,-123.1],[19.4,-85.6],[19.4,-72.3],[19.6,-127.2],[20.2,-123.1],[20.4,-117.9],[21.2,-134],[21.4,-101.9],[21.8,-108.4],[22,-123.1],[23.2,-123.1],[23.4,-128.5],[24,-112.5],[24.2,-95.1],[24.2,-81.8],[24.6,-53.5],[25,-64.4],[25,-57.6],[25.4,-72.3],[25.4,-44.3],[25.6,-26.8],[26,-5.4],[26.2,-107.1],[26.2,-21.5],[26.4,-65.6],[27,-16],[27.2,-45.6],[27.2,-24.2],[27.2,9.5],[27.6,4],[28.2,12],[28.4,-21.5],[28.4,37.5],[28.6,46.9],[29.4,-17.4],[30.2,36.2],[31,75],[31.2,8.1],[32,54.9],[32,48.2],[32.8,46.9],[33.4,16],[33.8,45.6],[34.4,1.3],[34.8,75],[35.2,-16],[35.2,-54.9],[35.4,69.6],[35.6,34.8],[35.6,32.1],[36.2,-37.5],[36.2,22.8],[38,46.9],[38,10.7],[39.2,5.4],[39.4,-1.3],[40,-21.5],[40.4,-13.3],[41.6,30.8],[41.6,-10.7],[42.4,29.4],[42.8,0],[42.8,-10.7],[43,14.7],[44,-1.3],[44.4,0],[45,10.7],[46.6,10.7],[47.8,-26.8],[47.8,-14.7],[48.8,-13.3],[50.6,0],[52,10.7],[53.2,-14.7],[55,-2.7],[55,10.7],[55.4,-2.7],[57.6,10.7]];
const XS = MCYCLE.map(d => d[0]), YS = MCYCLE.map(d => d[1]);
const XLO = 0, XHI = 60, YLO = -160, YHI = 100;

const scatter = new Plot(document.getElementById("scatter"), {
  xlim: [XLO, XHI], ylim: [YLO, YHI], xlabel: "time (ms)", ylabel: "head acceleration (g)",
});
const price = new Plot(document.getElementById("price"), {
  xlim: [1.5, 12], ylim: [0, 40], xlabel: "regressogram cell width (ms)", ylabel: "CRPS on held-out data (lower = sharper)",
});
const setRO = readouts(document.getElementById("readouts"),
  ["coverage: regressogram | KDE", "mean width: regressogram | KDE", "CRPS: regressogram | KDE", "CRPS penalty for the regressogram"]);
const ctrls = document.getElementById("controls");

const state = { alpha: 0.1, h: 8, bx: 2.5 };
let seed = 28;

function sdOf(a) { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) * (v - m)))); }
const GX = sdOf(XS);

// ---- split-conformal split of the real data ----
function split(rng) {
  const idx = [...Array(XS.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const nTr = Math.floor(idx.length * 0.4), nCal = Math.floor(idx.length * 0.3);
  return { tr: idx.slice(0, nTr), cal: idx.slice(nTr, nTr + nCal), te: idx.slice(nTr + nCal) };
}

// ---- (B) smooth heteroscedastic kernel estimate: NW local mean + local scale ----
function kdeModel(tr, bx) {
  const tx = tr.map(i => XS[i]), ty = tr.map(i => YS[i]);
  return (x) => {
    let W = 0, sm = 0;
    const w = new Array(tx.length);
    for (let i = 0; i < tx.length; i++) { const z = (x - tx[i]) / bx; const k = Math.exp(-0.5 * z * z); w[i] = k; W += k; sm += k * ty[i]; }
    const m = sm / W;
    let v = 0; for (let i = 0; i < tx.length; i++) v += w[i] * (ty[i] - m) * (ty[i] - m);
    const s = Math.max(Math.sqrt(v / W), 2);
    return { m, s };
  };
}
// CRPS of a Gaussian predictive (Gneiting & Raftery closed form)
function crpsGauss(m, s, y) {
  const z = (y - m) / s;
  return s * (z * (2 * normCdf(z) - 1) + 2 * normPdf(z) - 1 / Math.sqrt(Math.PI));
}

// ---- (A) regressogram: within-cell empirical distribution ----
const MINCELL = 8; // a regressogram cell needs enough members to estimate a distribution;
                   // sparser cells borrow the global training shape (standard, and generous to the regressogram)
function binOf(x, h) { return Math.floor((x - XLO) / h); }
function regModel(tr, h) {
  const cells = new Map();
  for (const i of tr) { const k = binOf(XS[i], h); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(YS[i]); }
  for (const a of cells.values()) a.sort((p, q) => p - q);
  const all = tr.map(i => YS[i]).sort((p, q) => p - q);
  return (x) => { const c = cells.get(binOf(x, h)); return c && c.length >= MINCELL ? c : all; };
}
// CRPS of an empirical distribution (sorted members): mean|v-y| - 0.5 E|v-v'|
function crpsEmp(sorted, y) {
  const m = sorted.length;
  let t1 = 0; for (const v of sorted) t1 += Math.abs(v - y); t1 /= m;
  let t2 = 0; for (let i = 0; i < m; i++) t2 += (2 * (i + 1) - m - 1) * sorted[i];
  t2 = (2 * t2) / (m * m);
  return t1 - 0.5 * t2;
}

// conformal quantile: ceil((n+1)(1-alpha))-th smallest, clipped
function conf(scores, alpha) {
  const a = scores.slice().sort((p, q) => p - q);
  const k = Math.ceil((a.length + 1) * (1 - alpha));
  return k > a.length ? Infinity : a[k - 1];
}

// Evaluate one model family on one split: returns {cov, width, crps}
function evalModel(sp, alpha, base, interval, crps) {
  const z = normInv(1 - alpha / 2);
  // CQR-style conformity on calibration
  const E = sp.cal.map(i => { const [lo, hi] = interval(XS[i]); return Math.max(lo - YS[i], YS[i] - hi); });
  const Q = conf(E, alpha);
  let cov = 0, wid = 0, cr = 0;
  for (const i of sp.te) {
    const [lo, hi] = interval(XS[i]);
    const L = lo - Q, H = hi + Q;
    if (YS[i] >= L && YS[i] <= H) cov++;
    wid += H - L;
    cr += crps(XS[i], YS[i]);
  }
  const n = sp.te.length;
  return { cov: cov / n, width: wid / n, crps: cr / n, Q };
}

function regEval(sp, alpha, h) {
  const bin = regModel(sp.tr, h);
  const interval = (x) => { const b = bin(x); return [quantile(b, alpha / 2), quantile(b, 1 - alpha / 2)]; };
  const crps = (x, y) => crpsEmp(bin(x), y);
  return evalModel(sp, alpha, null, interval, crps);
}
function kdeEval(sp, alpha, bx) {
  const md = kdeModel(sp.tr, bx);
  const z = normInv(1 - alpha / 2);
  const interval = (x) => { const { m, s } = md(x); return [m - z * s, m + z * s]; };
  const crps = (x, y) => { const { m, s } = md(x); return crpsGauss(m, s, y); };
  return evalModel(sp, alpha, null, interval, crps);
}

// ---- Monte Carlo scoreboard, cached per (seed, alpha, bx) ----
const HGRID = linspace(2, 11, 19);
let board = null;
function buildBoard() {
  const REPS = 40;
  const kde = { cov: 0, width: 0, crps: 0 };
  const regByH = HGRID.map(() => ({ cov: 0, width: 0, crps: 0 }));
  for (let r = 0; r < REPS; r++) {
    const sp = split(mulberry32(seed + r * 7919));
    const ke = kdeEval(sp, state.alpha, state.bx);
    kde.cov += ke.cov; kde.width += ke.width; kde.crps += ke.crps;
    for (let hi = 0; hi < HGRID.length; hi++) {
      const re = regEval(sp, state.alpha, HGRID[hi]);
      regByH[hi].cov += re.cov; regByH[hi].width += re.width; regByH[hi].crps += re.crps;
    }
  }
  const norm = (o) => ({ cov: o.cov / REPS, width: o.width / REPS, crps: o.crps / REPS });
  return { kde: norm(kde), regByH: regByH.map(norm) };
}
const nearestH = () => HGRID.reduce((b, h, i) => Math.abs(h - state.h) < Math.abs(HGRID[b] - state.h) ? i : b, 0);

function draw() {
  if (!board) board = buildBoard();
  const alpha = state.alpha, target = 1 - alpha;
  const hi = nearestH();
  const reg = board.regByH[hi], kde = board.kde;

  // ===== panel 1: the data with both conformal bands (one reference split) =====
  const sp = split(mulberry32(seed));
  const bin = regModel(sp.tr, state.h);
  const md = kdeModel(sp.tr, state.bx);
  const z = normInv(1 - alpha / 2);
  const Ereg = sp.cal.map(i => { const b = bin(XS[i]); return Math.max(quantile(b, alpha / 2) - YS[i], YS[i] - quantile(b, 1 - alpha / 2)); });
  const Qreg = conf(Ereg, alpha);
  const Ekde = sp.cal.map(i => { const { m, s } = md(XS[i]); return Math.max((m - z * s) - YS[i], YS[i] - (m + z * s)); });
  const Qkde = conf(Ekde, alpha);

  scatter.clear("#fff");
  scatter.axes({ grid: true });
  // KDE smooth band
  const gx = linspace(XLO + 0.5, XHI - 0.5, 160);
  const kloArr = [], khiArr = [];
  for (const x of gx) { const { m, s } = md(x); kloArr.push(m - z * s - Qkde); khiArr.push(m + z * s + Qkde); }
  scatter.band(gx, kloArr, khiArr, { color: "rgba(31,78,216,0.12)" });
  // regressogram blocky band (step per cell)
  const rlo = [], rhi = [], rgx = [];
  for (const x of gx) { const b = bin(x); rgx.push(x); rlo.push(quantile(b, alpha / 2) - Qreg); rhi.push(quantile(b, 1 - alpha / 2) + Qreg); }
  scatter.line(rgx, rlo, { color: "rgba(180,83,9,0.9)", width: 1.5 });
  scatter.line(rgx, rhi, { color: "rgba(180,83,9,0.9)", width: 1.5 });
  scatter.line(gx, kloArr, { color: "rgba(31,78,216,0.85)", width: 1.5 });
  scatter.line(gx, khiArr, { color: "rgba(31,78,216,0.85)", width: 1.5 });
  scatter.points(sp.tr.map(i => XS[i]), sp.tr.map(i => YS[i]), { color: "rgba(150,150,150,0.55)", radius: 2.4 });
  scatter.points(sp.te.map(i => XS[i]), sp.te.map(i => YS[i]), { color: "rgba(20,20,20,0.9)", radius: 3 });
  scatter.legend([
    { label: "regressogram band (blocky)", color: "rgba(180,83,9,0.9)" },
    { label: "kernel-density band (smooth)", color: "rgba(31,78,216,0.85)" },
    { label: "training / test points", color: "rgba(120,120,120,0.8)" },
  ], { x: scatter.X(XLO) + 8, y: scatter.Y(YHI) + 8 });

  // ===== panel 2: CRPS vs regressogram cell width, KDE as the flat floor =====
  const crpsH = board.regByH.map(o => o.crps);
  const ymax = 1.15 * Math.max(...crpsH, kde.crps);
  price.setLimits([HGRID[0], HGRID[HGRID.length - 1]], [0, ymax]);
  price.clear("#fff");
  price.axes({ grid: true });
  price.hline(kde.crps, { color: "rgba(31,78,216,0.9)", dash: [6, 4], width: 2, label: "kernel density" });
  price.line(HGRID, crpsH, { color: "rgba(180,83,9,0.95)", width: 2 });
  const bestI = crpsH.reduce((b, v, i) => v < crpsH[b] ? i : b, 0);
  price.points([HGRID[bestI]], [crpsH[bestI]], { color: "rgba(180,83,9,0.95)", radius: 4 });
  price.vline(state.h, { color: "rgba(0,0,0,0.35)", dash: [3, 4], width: 1 });
  price.text(HGRID[Math.floor(HGRID.length / 2)], ymax * 0.12,
    "no cell width reaches the smooth floor", { align: "center", color: "rgba(0,0,0,0.5)" });

  // ===== readouts =====
  const covCls = (c) => Math.abs(c - target) < 0.06 ? "good" : "warn";
  setRO("coverage: regressogram | KDE", `${pct(reg.cov, 0)} | ${pct(kde.cov, 0)}`, covCls(Math.min(reg.cov, kde.cov)));
  setRO("mean width: regressogram | KDE", `${fmt(reg.width, 0)} | ${fmt(kde.width, 0)} g`, reg.width > kde.width * 1.1 ? "bad" : "warn");
  setRO("CRPS: regressogram | KDE", `${fmt(reg.crps, 1)} | ${fmt(kde.crps, 1)}`, "warn");
  setRO("CRPS penalty for the regressogram", "×" + fmt(reg.crps / kde.crps, 2), reg.crps > kde.crps * 1.1 ? "bad" : "good");
}

slider(ctrls, { label: "target coverage 1−α", min: 0.8, max: 0.95, step: 0.05, value: 1 - state.alpha, fmt: v => pct(v, 0) },
  v => { state.alpha = 1 - v; board = null; draw(); });
slider(ctrls, { label: "regressogram cell width (ms)", min: 2, max: 11, step: 0.5, value: state.h, fmt: v => v.toFixed(1) },
  v => { state.h = v; draw(); });
slider(ctrls, { label: "kernel bandwidth (ms)", min: 1, max: 5, step: 0.5, value: state.bx, fmt: v => v.toFixed(1) },
  v => { state.bx = v; board = null; draw(); });
button(ctrls, "↻ new split", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; board = null; draw(); });

autoResize(scatter, draw);
autoResize(price, draw);
draw();
