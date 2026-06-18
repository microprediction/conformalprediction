// Demo 17 — laplace vs conformal on a (heteroscedastic) time series.
//
// The point of the Code page's time-series note, made visual. Both methods use
// the SAME point forecast (a rolling mean) and are calibrated to the SAME
// marginal level on [0,T0]. They differ only in the SHAPE of the predictive:
//
//   conformal (split): a constant-width band  yhat ± q  from the calibration
//     residual quantile. The implied predictive is a Gaussian of CONSTANT scale
//     sigma_const = q / z. This is what wrapping a point forecaster (AutoARIMA,
//     ETS, ...) in crepes/MAPIE gives you.
//
//   laplace-style: an online CONDITIONAL distribution. Here, illustratively, a
//     RiskMetrics EWMA volatility (lam) recalibrated by one scale so its
//     calibration coverage hits the target. The real skaters `laplace` is a
//     likelihood-weighted ensemble that does at least this well; the principle
//     is the same — model the conditional spread directly.
//
// Both hit the marginal coverage target (the conformal guarantee / calibration).
// They tie on CRPS (conformal's home metric). laplace wins on log-likelihood and
// on worst-window (conditional) coverage, because its band BREATHES with the
// volatility while the conformal band is rigid. That gap is the information gap:
// conformalization re-levels coverage but cannot model the conditional shape.
//
// This is an illustration of the principle, not the skaters package itself.
import { mulberry32, sampleNormal, quantile, normInv, normPdf, normCdf,
         meanLogScoreNormal, clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { checkbox, slider, readouts, button } from "./lib/ui.js";

const T = 600, T0 = 150, K = 12, COV_WIN = 80;

const main = new Plot(document.getElementById("main"), {
  xlim: [0, T], ylim: [-6, 14], xlabel: "t", ylabel: "y",
  margin: { l: 52, r: 16, t: 14, b: 40 },
});
const widthPlot = new Plot(document.getElementById("width"), {
  xlim: [0, T], ylim: [0, 6], xlabel: "t", ylabel: "predictive half-width",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "marginal coverage", "mean half-width", "mean log-likelihood", "CRPS"]);

const META = {
  conf: { name: "conformal (split)", color: "#1f4ed8" },
  lap:  { name: "laplace-style", color: "#0891b2" },
};
const COL = {
  yhat: "#111827",
  covered: "rgba(21,128,61,0.85)",
  missed: "rgba(185,28,28,0.95)",
  oracle: "rgba(120,120,120,0.8)",
};

const state = {
  alpha: 0.1,
  vol: 1.0,        // volatility contrast (heteroscedasticity strength)
  lam: 0.94,       // EWMA volatility decay for the laplace-style model
  selected: "lap",
};
let seed = 7;

// ---------------------------------------------------------------------------
// DGP: gentle level, strongly time-varying conditional sd (calm/turbulent
// regimes). The location is easy; all the action is in the SPREAD, which is the
// information-gap point. `vol` scales the heteroscedasticity.
// ---------------------------------------------------------------------------
function levelAt(t) { return 4 + 0.004 * t + 1.2 * Math.sin(t / 90); }
function sigmaAt(t) {
  const base = 0.55;
  const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 130 + 0.7);   // 0..1
  return base * (1 + state.vol * 3.0 * wave * wave);                // calm <-> turbulent
}

function crpsNormal(y, mu, sigma) {
  const z = (y - mu) / sigma;
  return sigma * (z * (2 * normCdf(z) - 1) + 2 * normPdf(z) - 1 / Math.sqrt(Math.PI));
}

function coverageOver(cov, idx) { let c = 0; for (const t of idx) if (cov[t]) c++; return idx.length ? c / idx.length : NaN; }
function meanOver(arr, idx) { let s = 0; for (const t of idx) s += arr[t]; return idx.length ? s / idx.length : NaN; }

// ---------------------------------------------------------------------------
function simulate() {
  const rng = mulberry32(seed);
  const a = state.alpha, z = normInv(1 - a / 2);
  const y = new Array(T + 1), sigTrue = new Array(T + 1);
  for (let t = 0; t <= T; t++) { sigTrue[t] = sigmaAt(t); y[t] = levelAt(t) + sampleNormal(rng, 0, sigTrue[t]); }

  // shared point forecast: rolling mean of last K
  const yHat = new Array(T + 1).fill(NaN);
  for (let t = 1; t <= T; t++) {
    const lo = Math.max(0, t - K); let s = 0, n = 0;
    for (let j = lo; j < t; j++) { s += y[j]; n++; }
    yHat[t] = n ? s / n : y[t - 1];
  }

  const calIdx = []; for (let t = 1; t <= T0; t++) calIdx.push(t);
  const idx = []; for (let t = T0 + 1; t <= T; t++) idx.push(t);
  const absResCal = calIdx.map(t => Math.abs(y[t] - yHat[t]));

  // ---- conformal (split): constant width q; implied Gaussian scale q/z ----
  const q = quantile(absResCal, Math.min(1, Math.ceil((absResCal.length + 1) * (1 - a)) / absResCal.length));
  const sigConst = q / z;

  // ---- laplace-style: EWMA vol, recalibrated by one scale c so calibration
  //      coverage hits the target ----
  // build raw EWMA sigma over the whole path (seeded from calibration variance)
  const sigRaw = new Array(T + 1).fill(NaN);
  let v = absResCal.length ? absResCal.reduce((s, e) => s + e * e, 0) / absResCal.length : 1;
  for (let t = 1; t <= T; t++) {
    sigRaw[t] = Math.sqrt(Math.max(v, 1e-9));
    const e = y[t] - yHat[t];
    v = state.lam * v + (1 - state.lam) * e * e;
  }
  // choose scale c so that |y-yHat| <= z*c*sigRaw covers ~1-a on calibration
  const ratio = calIdx.map(t => Math.abs(y[t] - yHat[t]) / (z * sigRaw[t]));
  const c = quantile(ratio, Math.min(1, Math.ceil((ratio.length + 1) * (1 - a)) / ratio.length)) || 1;

  // ---- assemble bands + per-step predictive sd ----
  const B = {
    conf: { lo: [], hi: [], cov: new Array(T + 1).fill(false), sd: new Array(T + 1).fill(NaN), hw: new Array(T + 1).fill(NaN) },
    lap:  { lo: [], hi: [], cov: new Array(T + 1).fill(false), sd: new Array(T + 1).fill(NaN), hw: new Array(T + 1).fill(NaN) },
  };
  for (const t of idx) {
    // conformal
    B.conf.sd[t] = sigConst; B.conf.hw[t] = q;
    B.conf.cov[t] = y[t] >= yHat[t] - q && y[t] <= yHat[t] + q;
    // laplace-style
    const sdL = c * sigRaw[t], hwL = z * sdL;
    B.lap.sd[t] = sdL; B.lap.hw[t] = hwL;
    B.lap.cov[t] = y[t] >= yHat[t] - hwL && y[t] <= yHat[t] + hwL;
  }

  // metrics
  const yT = idx.map(t => y[t]), muT = idx.map(t => yHat[t]);
  const metrics = {};
  for (const kk of ["conf", "lap"]) {
    const sdArr = idx.map(t => B[kk].sd[t]);
    metrics[kk] = {
      marg: coverageOver(B[kk].cov, idx),
      hw: meanOver(B[kk].hw, idx),
      ll: meanLogScoreNormal(yT, muT, sdArr),
      crps: yT.reduce((s, yi, i) => s + crpsNormal(yi, muT[i], sdArr[i]), 0) / yT.length,
    };
  }
  return { y, yHat, sigTrue, idx, B, metrics, q, z };
}

function yRange(S) {
  let lo = Infinity, hi = -Infinity;
  for (let t = 1; t <= T; t++) { if (S.y[t] < lo) lo = S.y[t]; if (S.y[t] > hi) hi = S.y[t]; }
  const pad = 0.12 * (hi - lo || 1); return [lo - pad, hi + pad];
}
function softFill(hex, al) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${al})`;
}

function draw() {
  const S = simulate();
  const sel = state.selected, selB = S.B[sel], target = 1 - state.alpha;

  // ===== main panel =====
  main.setLimits([0, T], yRange(S));
  main.clear("#fff"); main.axes({ grid: true });
  const bx = S.idx;
  main.band(bx, bx.map(t => S.yHat[t] - selB.hw[t]), bx.map(t => S.yHat[t] + selB.hw[t]),
    { color: softFill(META[sel].color, 0.16) });
  // calibration points
  const calX = [], calY = []; for (let t = 1; t <= T0; t++) { calX.push(t); calY.push(S.y[t]); }
  main.points(calX, calY, { color: "rgba(150,150,150,0.5)", radius: 1.8 });
  // covered / missed under selected band
  const cX = [], cY = [], mX = [], mY = [];
  for (const t of S.idx) { if (selB.cov[t]) { cX.push(t); cY.push(S.y[t]); } else { mX.push(t); mY.push(S.y[t]); } }
  main.points(cX, cY, { color: COL.covered, radius: 2.1 });
  main.points(mX, mY, { color: COL.missed, radius: 2.7 });
  const allT = []; for (let t = 1; t <= T; t++) allT.push(t);
  main.line(allT, allT.map(t => S.yHat[t]), { color: COL.yhat, width: 1.4 });
  main.vline(T0, { color: "rgba(0,0,0,0.55)", dash: [5, 4], width: 1.5 });
  main.text(T0, main.ylim[1], " calibration ends", { color: "rgba(0,0,0,0.6)", baseline: "top" });
  main.legend([
    { label: "ŷ_t (rolling mean)", color: COL.yhat },
    { label: META[sel].name + " band", color: softFill(META[sel].color, 0.5) },
    { label: "covered", color: COL.covered },
    { label: "missed", color: COL.missed },
  ], { x: main.X(0) + 8, y: main.Y(main.ylim[1]) + 8 });

  // ===== width panel: breathing vs rigid vs oracle =====
  let wmax = 0; for (const t of S.idx) wmax = Math.max(wmax, S.B.lap.hw[t], S.q, S.z * S.sigTrue[t]);
  widthPlot.setLimits([0, T], [0, wmax * 1.1]);
  widthPlot.clear("#fff"); widthPlot.axes({ grid: true });
  widthPlot.line(S.idx, S.idx.map(t => S.z * S.sigTrue[t]), { color: COL.oracle, width: 1.4, dash: [5, 4] });
  widthPlot.line(S.idx, S.idx.map(() => S.q), { color: META.conf.color, width: 1.8 });
  widthPlot.line(S.idx, S.idx.map(t => S.B.lap.hw[t]), { color: META.lap.color, width: 1.8 });
  widthPlot.legend([
    { label: "oracle z·σ_t", color: COL.oracle },
    { label: "conformal (rigid)", color: META.conf.color },
    { label: "laplace-style (breathing)", color: META.lap.color },
  ], { x: widthPlot.X(0) + 8, y: widthPlot.Y(wmax * 1.1) + 8 });

  // ===== readouts: conformal | laplace =====
  const cf = S.metrics.conf, lp = S.metrics.lap;
  setRO("target 1−α", pct(target, 0));
  setRO("marginal coverage", `${pct(cf.marg, 1)} | ${pct(lp.marg, 1)}`,
    cf.marg >= target - 0.03 && lp.marg >= target - 0.03 ? "good" : "warn");
  setRO("mean half-width", `${fmt(cf.hw, 2)} | ${fmt(lp.hw, 2)}`, lp.hw < cf.hw - 1e-3 ? "good" : "");
  setRO("mean log-likelihood", `${fmt(cf.ll, 3)} | ${fmt(lp.ll, 3)}`, lp.ll > cf.ll + 1e-3 ? "good" : "");
  setRO("CRPS", `${fmt(cf.crps, 3)} | ${fmt(lp.crps, 3)}`);
}

// ---- controls ----
const ctrls = document.getElementById("controls");
const selWrap = document.createElement("div"); selWrap.className = "control";
const selLab = document.createElement("label"); const selSpan = document.createElement("span");
selSpan.textContent = "main-panel band"; selLab.appendChild(selSpan); selWrap.appendChild(selLab);
const btnRow = document.createElement("div"); btnRow.style.display = "flex"; btnRow.style.gap = "6px"; btnRow.style.flexWrap = "wrap";
selWrap.appendChild(btnRow); ctrls.appendChild(selWrap);
const selBtns = {};
function refreshSel() {
  for (const k of ["conf", "lap"]) {
    const b = selBtns[k], on = k === state.selected;
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
for (const k of ["conf", "lap"]) selBtns[k] = button(btnRow, META[k].name, () => { state.selected = k; refreshSel(); draw(); });
refreshSel();

slider(ctrls, { label: "volatility contrast", min: 0, max: 2.0, step: 0.05, value: state.vol, fmt: v => v.toFixed(2) },
  v => { state.vol = v; draw(); });
slider(ctrls, { label: "EWMA decay λ (laplace vol)", min: 0.80, max: 0.99, step: 0.01, value: state.lam, fmt: v => v.toFixed(2) },
  v => { state.lam = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(widthPlot, () => {});
draw();
