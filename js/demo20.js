// Demo 20 — Same coverage, different price.
//
// Two predictive densities pinned to the SAME central 90% interval [-c, c]:
//   A: standard Gaussian.
//   B: a Gaussian scale mixture (1-w) N(0, s^2) + w N(0, (k s)^2), with s chosen
//      (by bisection) so that P_B(|Y| <= c) = 1 - alpha exactly.
// Both pass the same coverage audit; the price of a call struck beyond the
// interval, E[(Y-K)^+], separates by orders of magnitude. All quantities are
// closed-form Gaussian expressions — no simulation.
import { normCdf, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts } from "./lib/ui.js";

const ALPHA = 0.10;
const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
const npdf = (y, s) => phi(y / s) / s;
// E[(Y-K)^+] for Y ~ N(0, s^2)
const callN = (K, s) => s * phi(K / s) - K * (1 - normCdf(K / s));

const COL = { A: "#1f4ed8", B: "#c2410c" };
const state = { w: 0.05, k: 4, m: 2.0 };

// c: the 90% half-width of forecast A (standard normal)
let c = 1.6448536269514722;
(function refineC() { // solve 2*Phi(c)-1 = 1-ALPHA by bisection, so it is exact for our normCdf
  let lo = 0.5, hi = 4;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; (2 * normCdf(mid) - 1 < 1 - ALPHA) ? lo = mid : hi = mid; }
  c = (lo + hi) / 2;
})();

function coverB(s, w, k) { return (1 - w) * (2 * normCdf(c / s) - 1) + w * (2 * normCdf(c / (k * s)) - 1); }
function solveS(w, k) {
  let lo = 0.01, hi = 2;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; coverB(mid, w, k) > 1 - ALPHA ? lo = mid : hi = mid; }
  return (lo + hi) / 2;
}
const priceA = (K) => callN(K, 1);
const priceB = (K, s, w, k) => (1 - w) * callN(K, s) + w * callN(K, k * s);

const dens = new Plot(document.getElementById("dens"), {
  xlim: [-4 * c, 4 * c], ylim: [0, 0.5], xlabel: "outcome  y", ylabel: "predictive density",
  margin: { l: 56, r: 16, t: 14, b: 42 },
});
const price = new Plot(document.getElementById("price"), {
  xlim: [1, 3.5], ylim: [-8, -1], xlabel: "strike, in interval half-widths  K/c", ylabel: "log10 call price",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});
const setRO = readouts(document.getElementById("readouts"),
  ["coverage A | B  (both audited)", "strike  K/c", "price A (Gaussian)", "price B (heavy tail)", "price ratio  B / A"]);

function softFill(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function draw() {
  const { w, k, m } = state;
  const s = solveS(w, k);
  const K = m * c;

  // ---- density panel ----
  const xs = [], fA = [], fB = [];
  const NX = 481;
  for (let i = 0; i < NX; i++) {
    const y = -4 * c + (8 * c * i) / (NX - 1);
    xs.push(y); fA.push(npdf(y, 1)); fB.push((1 - w) * npdf(y, s) + w * npdf(y, k * s));
  }
  const ymax = Math.max(...fA, ...fB) * 1.12;
  dens.setLimits([-4 * c, 4 * c], [0, ymax]); dens.clear("#fff"); dens.axes({ grid: true });
  // shared 90% interval
  dens.band([-c, c], [0, 0], [ymax, ymax], { color: "rgba(120,120,120,0.08)" });
  dens.vline(-c, { color: "rgba(0,0,0,0.35)", dash: [4, 4], width: 1.2 });
  dens.vline(c, { color: "rgba(0,0,0,0.35)", dash: [4, 4], width: 1.2 });
  dens.text(0, ymax * 0.98, "the shared 90% interval", { color: "rgba(0,0,0,0.55)", align: "center", baseline: "top" });
  dens.line(xs, fA, { color: COL.A, width: 2 });
  dens.line(xs, fB, { color: COL.B, width: 2 });
  dens.vline(K, { color: "#b91c1c", width: 1.6 });
  dens.text(K, ymax * 0.6, " strike K", { color: "#b91c1c" });
  dens.legend([
    { label: "A: Gaussian", color: COL.A },
    { label: `B: heavy tail (w=${fmt(w, 2)}, k=${fmt(k, 1)})`, color: COL.B },
  ], { x: dens.X(-4 * c) + 8, y: dens.Y(ymax) + 8 });

  // ---- price panel: log10 price vs K/c ----
  const ms = [], lA = [], lB = [];
  for (let i = 0; i <= 200; i++) {
    const mm = 1 + (2.5 * i) / 200;
    ms.push(mm);
    lA.push(Math.log10(Math.max(priceA(mm * c), 1e-300)));
    lB.push(Math.log10(Math.max(priceB(mm * c, s, w, k), 1e-300)));
  }
  const lo = Math.min(...lA, ...lB) - 0.4, hi = Math.max(...lA, ...lB) + 0.4;
  price.setLimits([1, 3.5], [lo, hi]); price.clear("#fff"); price.axes({ grid: true });
  price.line(ms, lA, { color: COL.A, width: 2 });
  price.line(ms, lB, { color: COL.B, width: 2 });
  price.vline(m, { color: "#b91c1c", width: 1.4, dash: [4, 3] });
  price.band(ms, lA, lB, { color: softFill(COL.B, 0.08) });
  price.text(3.45, (lA[200] + lB[200]) / 2, "the gap coverage cannot see", { color: "rgba(0,0,0,0.55)", align: "right" });
  price.legend([
    { label: "log10 price, A", color: COL.A },
    { label: "log10 price, B", color: COL.B },
  ], { x: price.X(1) + 8, y: price.Y(hi) + 8 });

  // ---- readouts ----
  const covA = 2 * normCdf(c) - 1, covB = coverB(s, w, k);
  setRO("coverage A | B  (both audited)", `${pct(covA, 1)} | ${pct(covB, 1)}`, "good");
  setRO("strike  K/c", fmt(m, 2));
  const pA = priceA(K), pB = priceB(K, s, w, k);
  setRO("price A (Gaussian)", pA.toExponential(2));
  setRO("price B (heavy tail)", pB.toExponential(2));
  const ratio = pB / pA;
  setRO("price ratio  B / A", ratio >= 100 ? `${fmt(ratio, 0)}×` : `${fmt(ratio, 1)}×`, ratio > 10 ? "bad" : "");
}

const ctrls = document.getElementById("controls");
slider(ctrls, { label: "strike  K, in interval half-widths", min: 1, max: 3.5, step: 0.05, value: state.m, fmt: v => `${v.toFixed(2)}·c` },
  v => { state.m = v; draw(); });
slider(ctrls, { label: "tail weight  w  (forecast B)", min: 0.005, max: 0.2, step: 0.005, value: state.w, fmt: v => v.toFixed(3) },
  v => { state.w = v; draw(); });
slider(ctrls, { label: "tail scale  k  (forecast B)", min: 2, max: 8, step: 0.25, value: state.k, fmt: v => v.toFixed(2) },
  v => { state.k = v; draw(); });

autoResize(dens, draw);
autoResize(price, () => {});
draw();
