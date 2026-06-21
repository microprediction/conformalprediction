// Demo 18 — The conformal fan: how dependence sets the variance of realized coverage.
//
// Visualizes the inequalities of the companion note "The Width of the Conformal Fan."
// The star control is the cross-sample dependence. With equicorrelated scores at
// correlation rho, drag rho from the floor -1/(n-1) (the fan collapses) up through 0
// (the classical Beta fan) to +0.9 (the fan blows up), and watch three things:
//
//   (1) the distribution of the realized coverage c = U_(k) breathe (top panel);
//   (2) the per-level variances Var(U_(k)) move below the iid Beta curve for rho<0 and
//       above for rho>0 (bottom panel) -- the per-level contraction, and its sum is the
//       aggregate fan bound (Theorem 4: proved for negative association);
//   (3) the exact Gaussian-scale affine law Var(Z_(k)) = v_k + rho(1-v_k) (Prop 2),
//       shown as a readout, matched by simulation to a few percent.
//
// Everything is Monte Carlo; the curves are estimates. The equicorrelated Gaussian copula
// is sampled via Z_i = sqrt(1-rho)(xi_i - xi_bar) + sqrt(1+(n-1)rho) xi_bar, valid for all
// rho in [-1/(n-1), 1], then U_i = Phi(Z_i).
import { mulberry32, sampleNormal, normCdf, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, button, readouts } from "./lib/ui.js";

const fan = new Plot(document.getElementById("fan"), {
  xlim: [0, 1], ylim: [0, 1], xlabel: "realized coverage  c = U_(k)", ylabel: "density",
  margin: { l: 52, r: 16, t: 14, b: 40 },
});
const perlevel = new Plot(document.getElementById("perlevel"), {
  xlim: [1, 20], ylim: [0, 1], xlabel: "order statistic k", ylabel: "Var(U_(k))",
  margin: { l: 62, r: 16, t: 14, b: 42 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "E[c]", "Var(c) / iid fan", "Σ_k Var(U_(k)) / iid  (Thm 4)",
   "tail asymmetry  low-k | high-k", "Var(Z_(k)): affine (Gaussian)"]);

const COL = { iid: "#1f4ed8", dep: "#c2410c", oracle: "rgba(120,120,120,0.85)" };
const META = {
  gauss:   { name: "equicorrelated Gaussian", dep: true },
  clayton: { name: "Clayton (lower-tail)", dep: true },
  gumbel:  { name: "Gumbel (upper-tail)", dep: true },
  ma:      { name: "MA(1), corr −½", dep: false },
  contest: { name: "contest / grid floor", dep: false },
  lhs:     { name: "Latin hypercube", dep: false },
};

// --- Archimedean copula samplers via the Marshall-Olkin frailty (the de Finetti
//     directing variable W): U_i = psi(E_i / W), E_i iid Exp(1). ---
function gammaRV(rng, k) {                 // shape k, scale 1 (Marsaglia-Tsang)
  if (k < 1) return gammaRV(rng, k + 1) * Math.pow(rng(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v; do { x = sampleNormal(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function posStable(rng, a) {               // positive a-stable, 0<a<1 (Kanter)
  const U = Math.PI * rng(), E = -Math.log(rng());
  return Math.sin(a * U) / Math.pow(Math.sin(U), 1 / a)
       * Math.pow(Math.sin((1 - a) * U) / E, (1 - a) / a);
}
const exp1 = rng => -Math.log(rng());
// slider value -> Kendall tau (positive) -> Archimedean parameter theta
const tauOf = dep => Math.min(0.85, Math.max(0.02, dep));
const claytonTheta = tau => 2 * tau / (1 - tau);
const gumbelTheta = tau => 1 / (1 - tau);
const state = { rho: -0.05, n: 20, alpha: 0.10, struct: "gauss", M: 4000 };
let seed = 3;

function softFill(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function betaVar(k, n) { return k * (n - k + 1) / ((n + 1) ** 2 * (n + 2)); }

// ---- draw one calibration sample of n scores on the uniform scale ----
function sampleScores(rng, n, struct, rho) {
  if (struct === "clayton") {
    const th = claytonTheta(tauOf(rho)), W = gammaRV(rng, 1 / th);
    const u = []; for (let i = 0; i < n; i++) u.push(Math.pow(1 + exp1(rng) / W, -1 / th));
    return u;
  }
  if (struct === "gumbel") {
    const th = gumbelTheta(tauOf(rho)), W = posStable(rng, 1 / th);
    const u = []; for (let i = 0; i < n; i++) u.push(Math.exp(-Math.pow(exp1(rng) / W, 1 / th)));
    return u;
  }
  if (struct === "contest") {
    const grid = []; for (let i = 1; i <= n; i++) grid.push(i / (n + 1));
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
    return grid;
  }
  if (struct === "lhs") {
    const perm = []; for (let i = 0; i < n; i++) perm.push(i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    return perm.map(p => (p + rng()) / n);
  }
  if (struct === "ma") {
    const e = []; for (let i = 0; i <= n; i++) e.push(sampleNormal(rng));
    const u = []; for (let i = 0; i < n; i++) u.push(normCdf((e[i + 1] - e[i]) / Math.SQRT2));
    return u;
  }
  // equicorrelated Gaussian copula
  const xi = []; let m = 0;
  for (let i = 0; i < n; i++) { const x = sampleNormal(rng); xi.push(x); m += x; }
  m /= n;
  const a = Math.sqrt(Math.max(1 - rho, 0)), bb = Math.sqrt(Math.max(1 + (n - 1) * rho, 0));
  return xi.map(x => normCdf(a * (x - m) + bb * m));
}

function simulate() {
  const { n, alpha, struct, rho, M } = state;
  const k = Math.ceil((n + 1) * (1 - alpha));
  const rng = mulberry32(seed);
  // running mean/M2 of every order statistic, and collected c values for the histogram
  const sum = new Float64Array(n + 1), sum2 = new Float64Array(n + 1);
  const cVals = new Float64Array(M), cIid = new Float64Array(M);
  // also estimate v_k (iid N(0,1) k-th order-stat variance) and simulated Var(Z_(k))
  let zSum = 0, zSum2 = 0, vkSum = 0, vkSum2 = 0;
  const aCo = Math.sqrt(Math.max(1 - rho, 0)), bCo = Math.sqrt(Math.max(1 + (n - 1) * rho, 0));
  for (let t = 0; t < M; t++) {
    const u = sampleScores(rng, n, struct, rho).sort((x, y) => x - y);
    for (let j = 1; j <= n; j++) { sum[j] += u[j - 1]; sum2[j] += u[j - 1] * u[j - 1]; }
    cVals[t] = u[k - 1];
    // iid reference draw
    const ui = []; for (let i = 0; i < n; i++) ui.push(rng());
    ui.sort((x, y) => x - y); cIid[t] = ui[k - 1];
    // Gaussian-scale check (equicorrelated): Z_(k) and an iid-normal order stat for v_k
    const xi = []; let mm = 0; for (let i = 0; i < n; i++) { const x = sampleNormal(rng); xi.push(x); mm += x; }
    mm /= n;
    const z = xi.map(x => aCo * (x - mm) + bCo * mm).sort((x, y) => x - y)[k - 1];
    zSum += z; zSum2 += z * z;
    const xs = xi.slice().sort((x, y) => x - y)[k - 1]; vkSum += xs; vkSum2 += xs * xs;
  }
  const varK = new Float64Array(n + 1), meanK = new Float64Array(n + 1);
  for (let j = 1; j <= n; j++) { meanK[j] = sum[j] / M; varK[j] = sum2[j] / M - meanK[j] * meanK[j]; }
  const varC = sum2[k] / M - (sum[k] / M) ** 2;
  let aggDep = 0, aggIid = 0;
  for (let j = 1; j <= n; j++) { aggDep += varK[j]; aggIid += betaVar(j, n); }
  const vkSim = vkSum2 / M - (vkSum / M) ** 2;
  const zVarSim = zSum2 / M - (zSum / M) ** 2;
  return {
    k, n, cVals, cIid, meanK, varK,
    eC: sum[k] / M, varC, betaC: betaVar(k, n), aggRatio: aggDep / aggIid,
    vkAffine: vkSim + rho * (1 - vkSim), zVarSim,
  };
}

function density(vals, lo, hi, nb) {
  const h = new Float64Array(nb); const w = (hi - lo) / nb;
  for (const v of vals) { let b = Math.floor((v - lo) / w); if (b < 0) b = 0; if (b >= nb) b = nb - 1; h[b]++; }
  const xs = [], ys = [];
  for (let i = 0; i < nb; i++) { xs.push(lo + (i + 0.5) * w); ys.push(h[i] / (vals.length * w)); }
  return { xs, ys };
}

function draw() {
  const S = simulate();
  const target = 1 - state.alpha;

  // ===== fan panel: density of c (dep) vs iid =====
  let lo = 1, hi = 0;
  for (let i = 0; i < S.cVals.length; i++) { lo = Math.min(lo, S.cVals[i], S.cIid[i]); hi = Math.max(hi, S.cVals[i], S.cIid[i]); }
  const pad = 0.04 * (hi - lo || 0.1); lo = Math.max(0, lo - pad); hi = Math.min(1, hi + pad);
  const nb = 44;
  const dIid = density(S.cIid, lo, hi, nb), dDep = density(S.cVals, lo, hi, nb);
  const ymax = Math.max(...dIid.ys, ...dDep.ys) * 1.12 || 1;
  fan.setLimits([lo, hi], [0, ymax]); fan.clear("#fff"); fan.axes({ grid: true });
  fan.band(dIid.xs, dIid.xs.map(() => 0), dIid.ys, { color: softFill(COL.iid, 0.12) });
  fan.line(dIid.xs, dIid.ys, { color: COL.iid, width: 1.8 });
  fan.band(dDep.xs, dDep.xs.map(() => 0), dDep.ys, { color: softFill(COL.dep, 0.14) });
  fan.line(dDep.xs, dDep.ys, { color: COL.dep, width: 2 });
  fan.vline(target, { color: "rgba(0,0,0,0.55)", dash: [5, 4], width: 1.4 });
  fan.text(target, ymax, " 1−α", { color: "rgba(0,0,0,0.6)", baseline: "top" });
  fan.legend([
    { label: "iid fan  Beta(k, n−k+1)", color: COL.iid },
    { label: META[state.struct].name, color: COL.dep },
  ], { x: fan.X(lo) + 8, y: fan.Y(ymax) + 8 });

  // ===== per-level panel: Var(U_(k)) vs k, dep vs iid Beta =====
  const ks = []; for (let j = 1; j <= S.n; j++) ks.push(j);
  const betaCurve = ks.map(j => betaVar(j, S.n));
  const depCurve = ks.map(j => S.varK[j]);
  const vmax = Math.max(...betaCurve, ...depCurve) * 1.15 || 1;
  perlevel.setLimits([1, S.n], [0, vmax]); perlevel.clear("#fff"); perlevel.axes({ grid: true });
  perlevel.band(ks, ks.map(() => 0), betaCurve, { color: softFill(COL.iid, 0.10) });
  perlevel.line(ks, betaCurve, { color: COL.iid, width: 1.8 });
  perlevel.line(ks, depCurve, { color: COL.dep, width: 2 });
  perlevel.points(ks, depCurve, { color: COL.dep, radius: 2 });
  perlevel.vline(S.k, { color: "rgba(0,0,0,0.4)", dash: [3, 3], width: 1.2 });
  perlevel.text(S.k, vmax, " conformal k", { color: "rgba(0,0,0,0.55)", baseline: "top" });
  perlevel.legend([
    { label: "iid Beta variance", color: COL.iid },
    { label: "Var(U_(k)) under dependence", color: COL.dep },
  ], { x: perlevel.X(1) + 8, y: perlevel.Y(vmax) + 8 });

  // ===== readouts =====
  setRO("target 1−α", pct(target, 0));
  const eCls = state.struct === "contest" ? "good" : "";
  setRO("E[c]", fmt(S.eC, 3), eCls);
  setRO("Var(c) / iid fan", fmt(S.varC / S.betaC, 2), S.varC <= S.betaC + 1e-9 ? "good" : "bad");
  setRO("Σ_k Var(U_(k)) / iid  (Thm 4)", fmt(S.aggRatio, 2), S.aggRatio <= 1.01 ? "good" : "bad");
  const loK = S.varK[2] / betaVar(2, S.n), hiK = S.varK[S.n - 1] / betaVar(S.n - 1, S.n);
  setRO("tail asymmetry  low-k | high-k", `${fmt(loK, 2)} | ${fmt(hiK, 2)}`);
  if (state.struct === "gauss")
    setRO("Var(Z_(k)): affine (Gaussian)", `${fmt(S.vkAffine, 3)} vs ${fmt(S.zVarSim, 3)}`, "good");
  else setRO("Var(Z_(k)): affine (Gaussian)", "—");
}

// ---- controls ----
const ctrls = document.getElementById("controls");
const selWrap = document.createElement("div"); selWrap.className = "control";
const selLab = document.createElement("label"); const selSpan = document.createElement("span");
selSpan.textContent = "dependence structure"; selLab.appendChild(selSpan); selWrap.appendChild(selLab);
const btnRow = document.createElement("div"); btnRow.style.display = "flex"; btnRow.style.gap = "6px"; btnRow.style.flexWrap = "wrap";
selWrap.appendChild(btnRow); ctrls.appendChild(selWrap);
const selBtns = {};
let rhoSlider;
function refresh() {
  for (const kk in META) {
    const b = selBtns[kk], on = kk === state.struct;
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
  if (rhoSlider) rhoSlider.style.opacity = META[state.struct].dep ? "1" : "0.35";
}
for (const kk in META) selBtns[kk] = button(btnRow, META[kk].name, () => { state.struct = kk; refresh(); draw(); });

const rhoFloor = () => -1 / (state.n - 1);
rhoSlider = slider(ctrls, { label: "dependence  (ρ for Gaussian; Kendall τ for Archimedean)", min: -0.052, max: 0.9, step: 0.002, value: state.rho, fmt: v => v.toFixed(3) },
  v => { state.rho = Math.max(rhoFloor(), v); draw(); });
slider(ctrls, { label: "sample size n", min: 6, max: 40, step: 1, value: state.n, fmt: v => v.toFixed(0) },
  v => { state.n = v; perlevel.xlim = [1, v]; state.rho = Math.max(rhoFloor(), state.rho); draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.4, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });
refresh();

autoResize(fan, draw);
autoResize(perlevel, () => {});
draw();
