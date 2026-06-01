// Demo 05 — Exchangeability & time series, judged on a proper score.
//
// The old version of this demo pitted ONE adaptive method (plain ACI) against a
// fixed split band and declared time-series conformal a straw man. That was
// unfair. Here we run the strong online conformal methods (ACI, conformal PID,
// NexCP/weighted) AND a probabilistic baseline that models the conditional
// spread directly (EWMA-vol Gaussian), and we score them on the interval
// (Winkler) score, not marginal coverage alone. The honest finding (see
// ../benchmark.html): the adaptive conformal methods are NOT straw men — they
// recover long-run coverage where fixed split collapses — but a simple
// volatility model matches them on the proper score and returns a full
// predictive distribution. None of them gives per-step CONDITIONAL coverage.
//
// Method formulas are ported to match benchmark/ts_methods.py exactly.
import { mulberry32, sampleNormal, quantile, normInv, clamp, pct, fmt } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, checkbox, readouts, button } from "./lib/ui.js";

const T = 600;        // series length
const T0 = 150;       // calibration ends here (online stream is t > T0)
const K = 12;         // rolling-mean forecast window
const COV_WIN = 80;   // trailing window for rolling / worst-window coverage
const JUMP_AT = 380;  // regime jump location

const main = new Plot(document.getElementById("main"), {
  xlim: [0, T], ylim: [-6, 14], xlabel: "t", ylabel: "y",
  margin: { l: 52, r: 16, t: 14, b: 40 },
});
const covPlot = new Plot(document.getElementById("cov"), {
  xlim: [0, T], ylim: [0, 1], xlabel: "t", ylabel: "rolling coverage",
  margin: { l: 52, r: 16, t: 14, b: 44 },
});

const setRO = readouts(document.getElementById("readouts"),
  ["target 1−α", "marginal coverage", "worst-window coverage", "interval (Winkler) score"]);

const ctrls = document.getElementById("controls");
let seed = 11;

// ---------------------------------------------------------------------------
// Methods. Each is identified by a key; META carries display name + colour.
// ---------------------------------------------------------------------------
const META = {
  fixed: { name: "fixed split (CP)", color: "#1f4ed8" },
  aci:   { name: "ACI", color: "#c2410c" },
  pid:   { name: "conformal PID", color: "#15803d" },
  nexcp: { name: "NexCP (weighted)", color: "#7c3aed" },
  ewma:  { name: "EWMA-vol Gaussian", color: "#0891b2" },
};
const METHOD_KEYS = ["fixed", "aci", "pid", "nexcp", "ewma"];

const state = {
  alpha: 0.1,
  drift: 1.0,     // 0 = stationary/exchangeable; larger = stronger nonstationarity
  gamma: 0.03,    // ACI learning rate (matches ts_methods default)
  rho: 0.99,      // NexCP recency weight
  selected: "fixed",                 // method drawn in the main panel
  overlay: { fixed: true, aci: true, pid: false, nexcp: false, ewma: true },
};

// ---------------------------------------------------------------------------
// Data-generating process: known, time-varying conditional sd sigma_t.
// Calibration block [0,T0] is near-stationary; afterwards a trend ramps up, a
// regime jump lands at JUMP_AT, and the post-jump innovation variance inflates
// (a high-volatility block). So exchangeability breaks in BOTH location and
// scale. drift scales every nonstationary effect.
// ---------------------------------------------------------------------------
function levelAt(t) {
  const ramp = Math.max(0, t - 200);
  const trend = state.drift * 0.02 * ramp;
  const jump = t >= JUMP_AT ? state.drift * 5.0 : 0;
  return 4 + trend + jump;
}
function sigmaAt(t) {
  // baseline 1.0; high-volatility block after the regime jump
  return 1.0 * (1 + (t >= JUMP_AT ? state.drift * 1.2 : 0));
}

// ---------------------------------------------------------------------------
// Local helpers (NOT in lib/): weighted quantile + proper-score metrics.
// ---------------------------------------------------------------------------

// Weighted quantile, q in [0,1]. Mirrors _wquantile in ts_methods.py: sort by
// value, normalise cumulative weights, interpolate.
function wquantile(vals, weights, q) {
  const idx = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
  const v = idx.map(i => vals[i]);
  const w = idx.map(i => weights[i]);
  const cw = [];
  let acc = 0;
  for (const wi of w) { acc += wi; cw.push(acc); }
  const total = cw[cw.length - 1];
  if (!(total > 0)) return quantile(vals, q);
  for (let i = 0; i < cw.length; i++) cw[i] /= total;
  // np.interp(q, cw, v)
  if (q <= cw[0]) return v[0];
  if (q >= cw[cw.length - 1]) return v[v.length - 1];
  for (let i = 1; i < cw.length; i++) {
    if (q <= cw[i]) {
      const f = (q - cw[i - 1]) / ((cw[i] - cw[i - 1]) || 1e-12);
      return v[i - 1] + f * (v[i] - v[i - 1]);
    }
  }
  return v[v.length - 1];
}

// Interval (Winkler) score at level 1-alpha, averaged over the test stream.
// IS_t = (hi-lo) + (2/alpha)(lo-y)1{y<lo} + (2/alpha)(y-hi)1{y>hi}. Lower is
// better. Infinite widths are guarded so 0*inf never appears.
function intervalScore(lo, hi, y, idx, alpha) {
  let s = 0, n = 0;
  for (const t of idx) {
    const l = lo[t], h = hi[t], yt = y[t];
    if (!isFinite(l) || !isFinite(h)) { s += 1e6; n++; continue; } // infinite band: huge penalty
    let v = h - l;
    if (yt < l) v += (2 / alpha) * (l - yt);
    else if (yt > h) v += (2 / alpha) * (yt - h);
    s += v; n++;
  }
  return n ? s / n : NaN;
}

// Marginal coverage over a set of indices.
function coverageOver(covered, idx) {
  let c = 0, n = 0;
  for (const t of idx) { if (covered[t]) c++; n++; }
  return n ? c / n : NaN;
}

// Worst trailing-window coverage: min over all length-COV_WIN windows fully
// inside the test stream. This is what exposes local collapse the marginal hides.
function worstWindowCoverage(covered, idx) {
  if (idx.length < COV_WIN) return coverageOver(covered, idx);
  let worst = Infinity;
  for (let s = 0; s + COV_WIN <= idx.length; s++) {
    let c = 0;
    for (let j = s; j < s + COV_WIN; j++) if (covered[idx[j]]) c++;
    worst = Math.min(worst, c / COV_WIN);
  }
  return worst;
}

// Trailing-window rolling-coverage series aligned to the test indices.
function rollingCoverage(covered, idx) {
  const out = new Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const lo = Math.max(0, i - COV_WIN + 1);
    let c = 0, n = 0;
    for (let j = lo; j <= i; j++) { if (covered[idx[j]]) c++; n++; }
    out[i] = n ? c / n : NaN;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Online methods. All consume the SAME yHat and the SAME realized residuals,
// running over t = T0+1 .. T. warm = absolute calibration residuals.
// Each returns { lo, hi, covered } as full-length arrays (NaN before T0+1).
// ---------------------------------------------------------------------------

function emptyBands() {
  return {
    lo: new Array(T + 1).fill(NaN),
    hi: new Array(T + 1).fill(NaN),
    covered: new Array(T + 1).fill(false),
  };
}

// fixed_split: constant width q from the initial calibration block. Straw man.
function methodFixed(y, yHat, warm, idx, alpha) {
  const B = emptyBands();
  const n = warm.length;
  const k = Math.ceil((n + 1) * (1 - alpha));
  const sorted = warm.slice().sort((a, b) => a - b);
  const q = k > n ? Infinity : sorted[k - 1];
  for (const t of idx) {
    B.lo[t] = yHat[t] - q;
    B.hi[t] = yHat[t] + q;
    B.covered[t] = isFinite(q) && y[t] >= B.lo[t] && y[t] <= B.hi[t];
  }
  return B;
}

// aci: online alpha_t; width = (1-alpha_t) quantile of a trailing window of
// absolute residuals. Matches ts_methods.aci (window=250, clip alpha to (1e-3,1-1e-3)).
function methodACI(y, yHat, warm, idx, alpha, gamma) {
  const B = emptyBands();
  const window = 250;
  const hist = warm.slice();
  let aT = alpha;
  for (const t of idx) {
    let q;
    if (hist.length >= 10 && aT > 0 && aT < 1) {
      q = quantile(hist.slice(-window), 1 - aT);
    } else if (aT <= 0) {
      q = Infinity;
    } else if (aT >= 1) {
      q = 0;
    } else {
      q = hist.length ? quantile(hist, 0.9) : 0;
    }
    B.lo[t] = yHat[t] - q;
    B.hi[t] = yHat[t] + q;
    const inside = isFinite(q) && y[t] >= B.lo[t] && y[t] <= B.hi[t];
    B.covered[t] = inside;
    const err = inside ? 0 : 1;
    aT = Math.min(1 - 1e-3, Math.max(1e-3, aT + gamma * (alpha - err)));
    hist.push(Math.abs(y[t] - yHat[t]));
  }
  return B;
}

// conformal_pid: trailing-quantile base radius + integral correction on the
// running coverage error. Matches ts_methods.conformal_pid (Kp=0.10, Ki=0.02).
function methodPID(y, yHat, warm, idx, alpha) {
  const B = emptyBands();
  const window = 250, Kp = 0.10, Ki = 0.02;
  const hist = warm.slice();
  let integral = 0;
  for (const t of idx) {
    const recent = hist.slice(-window);
    let base;
    if (hist.length >= 10) base = quantile(recent, 1 - alpha);
    else base = hist.length ? quantile(hist, 0.9) : 1.0;
    let scale;
    if (hist.length >= 20) scale = quantile(recent, 0.95) - quantile(recent, 0.5);
    else scale = base;
    scale = Math.max(scale, 1e-3);
    const r = Math.max(0, base + Kp * integral * scale);
    B.lo[t] = yHat[t] - r;
    B.hi[t] = yHat[t] + r;
    const inside = y[t] >= B.lo[t] && y[t] <= B.hi[t];
    B.covered[t] = inside;
    const err = inside ? 0 : 1;
    integral += (err - alpha);
    integral = clamp(integral, -1 / Math.max(Ki, 1e-6), 1 / Math.max(Ki, 1e-6));
    hist.push(Math.abs(y[t] - yHat[t]));
  }
  return B;
}

// nexcp: recency-weighted quantile of trailing absolute residuals, weights
// rho**age. Matches ts_methods.nexcp (window=400).
function methodNexCP(y, yHat, warm, idx, alpha, rho) {
  const B = emptyBands();
  const window = 400;
  const hist = warm.slice();
  for (const t of idx) {
    let q;
    if (hist.length >= 10) {
      const recent = hist.slice(-window);
      const m = recent.length;
      const w = new Array(m);
      for (let i = 0; i < m; i++) w[i] = Math.pow(rho, m - 1 - i); // age = m-1-i
      q = wquantile(recent, w, 1 - alpha);
    } else {
      q = hist.length ? quantile(hist, 0.9) : 1.0;
    }
    B.lo[t] = yHat[t] - q;
    B.hi[t] = yHat[t] + q;
    B.covered[t] = y[t] >= B.lo[t] && y[t] <= B.hi[t];
    hist.push(Math.abs(y[t] - yHat[t]));
  }
  return B;
}

// ewma_vol: RiskMetrics EWMA of squared residuals (lam=0.94); Gaussian band
// yHat ± z*sigma_t, z = normInv(1-alpha/2). Matches ts_methods.ewma_vol.
// Also returns sigma_t so the full predictive distribution is available.
function methodEWMA(y, yHat, warm, idx, alpha) {
  const B = emptyBands();
  B.sigma = new Array(T + 1).fill(NaN);
  const lam = 0.94;
  let varEst = warm.length
    ? warm.reduce((s, e) => s + e * e, 0) / warm.length
    : 1.0;
  const z = normInv(1 - alpha / 2);
  for (const t of idx) {
    const s = Math.sqrt(Math.max(varEst, 1e-9));
    B.sigma[t] = s;
    B.lo[t] = yHat[t] - z * s;
    B.hi[t] = yHat[t] + z * s;
    B.covered[t] = y[t] >= B.lo[t] && y[t] <= B.hi[t];
    const e = y[t] - yHat[t];
    varEst = lam * varEst + (1 - lam) * e * e;
  }
  return B;
}

// ---------------------------------------------------------------------------
// Simulate everything once per draw.
// ---------------------------------------------------------------------------
function simulate() {
  const rng = mulberry32(seed);
  const y = new Array(T + 1);
  for (let t = 0; t <= T; t++) y[t] = levelAt(t) + sampleNormal(rng, 0, sigmaAt(t));

  // Online point forecast: rolling mean of the last K observations.
  const yHat = new Array(T + 1).fill(NaN);
  for (let t = 1; t <= T; t++) {
    const lo = Math.max(0, t - K);
    let s = 0, n = 0;
    for (let j = lo; j < t; j++) { s += y[j]; n++; }
    yHat[t] = n ? s / n : y[t - 1];
  }

  // calibration residuals (absolute) and test indices
  const warm = [];
  for (let t = 1; t <= T0; t++) warm.push(Math.abs(y[t] - yHat[t]));
  const idx = [];
  for (let t = T0 + 1; t <= T; t++) idx.push(t);

  const a = state.alpha;
  const bands = {
    fixed: methodFixed(y, yHat, warm, idx, a),
    aci:   methodACI(y, yHat, warm, idx, a, state.gamma),
    pid:   methodPID(y, yHat, warm, idx, a),
    nexcp: methodNexCP(y, yHat, warm, idx, a, state.rho),
    ewma:  methodEWMA(y, yHat, warm, idx, a),
  };

  // metrics per method
  const metrics = {};
  for (const k of METHOD_KEYS) {
    const B = bands[k];
    metrics[k] = {
      marg: coverageOver(B.covered, idx),
      worst: worstWindowCoverage(B.covered, idx),
      is: intervalScore(B.lo, B.hi, y, idx, a),
      roll: rollingCoverage(B.covered, idx),
    };
  }

  return { y, yHat, idx, bands, metrics };
}

function yRange(S) {
  let lo = Infinity, hi = -Infinity;
  for (let t = 1; t <= T; t++) { if (S.y[t] < lo) lo = S.y[t]; if (S.y[t] > hi) hi = S.y[t]; }
  const pad = 0.12 * (hi - lo || 1);
  return [lo - pad, hi + pad];
}

const COL = {
  y: "rgba(60,60,60,0.7)",
  yhat: "#111827",
  covered: "rgba(21,128,61,0.85)",
  missed: "rgba(185,28,28,0.95)",
};

function softFill(hex, a) {
  // hex like "#1f4ed8" -> rgba(..., a)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------------------
// Drawing.
// ---------------------------------------------------------------------------
function draw() {
  const S = simulate();
  const sel = state.selected;
  const selB = S.bands[sel];
  const selM = S.metrics[sel];
  const target = 1 - state.alpha;

  // ===== main panel =====
  main.setLimits([0, T], yRange(S));
  main.clear("#fff");
  main.axes({ grid: true });

  // selected method's band over the test stream
  const bx = S.idx;
  main.band(bx, bx.map(t => selB.lo[t]), bx.map(t => selB.hi[t]),
    { color: softFill(META[sel].color, 0.15) });

  // calibration-region points (grey)
  const calX = [], calY = [];
  for (let t = 1; t <= T0; t++) { calX.push(t); calY.push(S.y[t]); }
  main.points(calX, calY, { color: "rgba(150,150,150,0.5)", radius: 1.8 });

  // covered / missed relative to the SELECTED band
  const cX = [], cY = [], mX = [], mY = [];
  for (const t of S.idx) {
    if (selB.covered[t]) { cX.push(t); cY.push(S.y[t]); }
    else { mX.push(t); mY.push(S.y[t]); }
  }
  main.points(cX, cY, { color: COL.covered, radius: 2.2 });
  main.points(mX, mY, { color: COL.missed, radius: 2.8 });

  // forecast line
  const allT = [];
  for (let t = 1; t <= T; t++) allT.push(t);
  main.line(allT, allT.map(t => S.yHat[t]), { color: COL.yhat, width: 1.4 });

  // markers
  main.vline(T0, { color: "rgba(0,0,0,0.55)", dash: [5, 4], width: 1.5 });
  main.text(T0, main.ylim[1], " calibration ends", { color: "rgba(0,0,0,0.6)", baseline: "top" });
  main.vline(JUMP_AT, { color: "rgba(194,65,12,0.7)", dash: [3, 3], width: 1.5 });
  main.text(JUMP_AT, main.ylim[1], " regime jump", { color: "rgba(194,65,12,0.85)", baseline: "top" });

  main.legend([
    { label: "ŷ_t (rolling mean)", color: COL.yhat },
    { label: META[sel].name + " band", color: softFill(META[sel].color, 0.5) },
    { label: "covered", color: COL.covered },
    { label: "missed", color: COL.missed },
  ], { x: main.X(0) + 8, y: main.Y(main.ylim[1]) + 8 });

  // ===== coverage panel =====
  covPlot.setLimits([0, T], [0, 1]);
  covPlot.clear("#fff");
  covPlot.axes({ grid: true });
  covPlot.hline(target, { color: "rgba(0,0,0,0.55)", dash: [6, 4], width: 1.5, label: "target 1−α" });
  covPlot.vline(JUMP_AT, { color: "rgba(194,65,12,0.6)", dash: [3, 3], width: 1.2 });

  const covLegend = [];
  for (const k of METHOD_KEYS) {
    if (!state.overlay[k]) continue;
    covPlot.line(S.idx, S.metrics[k].roll, { color: META[k].color, width: 1.7, alpha: 0.9 });
    covLegend.push({ label: META[k].name, color: META[k].color });
  }
  if (covLegend.length) covPlot.legend(covLegend, { x: covPlot.X(0) + 8, y: covPlot.Y(1) + 8 });

  // ===== readouts (selected method) =====
  setRO("target 1−α", pct(target, 0));
  const margCls = Math.abs(selM.marg - target) < 0.05 ? "good" : "bad";
  setRO("marginal coverage", pct(selM.marg, 1), margCls);
  const worstCls = selM.worst >= target - 0.08 ? "good" : selM.worst >= target - 0.2 ? "warn" : "bad";
  setRO("worst-window coverage", pct(selM.worst, 1), worstCls);
  setRO("interval (Winkler) score", isFinite(selM.is) ? fmt(selM.is, 2) : "∞");
}

// ---------------------------------------------------------------------------
// Controls.
// ---------------------------------------------------------------------------

// Method selector (buttons, demo03 style) for the main panel.
const selWrap = document.createElement("div");
selWrap.className = "control";
const selLab = document.createElement("label");
const selSpan = document.createElement("span");
selSpan.textContent = "main-panel method";
selLab.appendChild(selSpan);
selWrap.appendChild(selLab);
const btnRow = document.createElement("div");
btnRow.style.display = "flex";
btnRow.style.gap = "6px";
btnRow.style.flexWrap = "wrap";
selWrap.appendChild(btnRow);
ctrls.appendChild(selWrap);

const selBtns = {};
function refreshSel() {
  for (const k of METHOD_KEYS) {
    const b = selBtns[k];
    const on = k === state.selected;
    b.style.borderColor = on ? "var(--accent)" : "var(--line)";
    b.style.color = on ? "var(--accent)" : "var(--ink)";
    b.style.background = on ? "var(--accent-soft)" : "var(--panel)";
  }
}
for (const k of METHOD_KEYS) {
  selBtns[k] = button(btnRow, META[k].name, () => { state.selected = k; refreshSel(); draw(); });
}
refreshSel();

// Overlay checkboxes: one per method's rolling coverage in the second panel.
const ovWrap = document.createElement("div");
ovWrap.className = "control";
const ovLab = document.createElement("label");
const ovSpan = document.createElement("span");
ovSpan.textContent = "overlay rolling coverage";
ovLab.appendChild(ovSpan);
ovWrap.appendChild(ovLab);
ctrls.appendChild(ovWrap);
const ovRow = document.createElement("div");
ovRow.style.display = "flex";
ovRow.style.gap = "10px";
ovRow.style.flexWrap = "wrap";
ctrls.appendChild(ovRow);
for (const k of METHOD_KEYS) {
  checkbox(ovRow, { label: META[k].name, checked: state.overlay[k] },
    v => { state.overlay[k] = v; draw(); });
}

// Sliders.
slider(ctrls, { label: "drift magnitude", min: 0, max: 2.5, step: 0.05, value: state.drift, fmt: v => v.toFixed(2) },
  v => { state.drift = v; draw(); });
slider(ctrls, { label: "ACI learning rate γ", min: 0.005, max: 0.2, step: 0.005, value: state.gamma, fmt: v => v.toFixed(3) },
  v => { state.gamma = v; draw(); });
slider(ctrls, { label: "NexCP recency ρ", min: 0.90, max: 0.999, step: 0.001, value: state.rho, fmt: v => v.toFixed(3) },
  v => { state.rho = v; draw(); });
slider(ctrls, { label: "miscoverage α", min: 0.02, max: 0.3, step: 0.01, value: state.alpha, fmt: v => v.toFixed(2) },
  v => { state.alpha = v; draw(); });
button(ctrls, "↻ new sample", () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; draw(); });

autoResize(main, draw);
autoResize(covPlot, () => {});
draw();
