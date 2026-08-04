// Demo 30 — Past the stop. A warped AR(1): z_t = phi z_{t-1} + eps,
// y_t = sign(z_t) |z_t|^gamma. Three online forecasters, all prequential and
// all scored by the exact change of variables (no particles):
//   STOP     gaussianize the stream and quote N(0,1) where you stand
//            (the conformal pattern's terminal forecast);
//   THROUGH  gaussianize, then refit AR(1) on the transformed stream;
//   WITHOUT  the same AR(1) refit on a scale-standardized stream, no
//            rank map.
// When the warp is on, the linear representation lives in the transformed
// coordinates: THROUGH beats both the stop and the chain without the map.
import { mulberry32, randn, normCdf, normInv, normPdf, fmt }
  from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const COL = { stop: "#b45309", through: "#1f4ed8", without: "#15803d" };
const T = 1600, BURN = 200, WARM = 30;

const seriesPlot = new Plot(document.getElementById("series"), {
  xlim: [0, 300], ylim: [-4, 4], xlabel: "t (first 300 shown)", ylabel: "y",
});
const racePlot = new Plot(document.getElementById("race"), {
  xlim: [BURN, T], ylim: [-2.6, -0.8], xlabel: "t", ylabel: "running mean log score (nats)",
});

const setRO = readouts(document.getElementById("readouts"),
  ["stop at the map", "refit through the map", "same refit, no map", "through − stop", "through − without"]);
const ctrls = document.getElementById("controls");

const state = { gamma: 1.5, phi: 0.8 };
let seed = 11;

// Full-grid fence-post map over a sorted buffer: level (i+1)/(n+1) at the
// i-th order statistic, linear between, edge slopes in the tails, expanding
// moments during warmup. Returns z and dz/dy.
function makeGaussianizer() {
  const buf = [];
  let n = 0, mu = 0, m2 = 0;
  return {
    eval(y) {
      if (n < WARM) {
        const varv = n > 2 ? m2 / (n - 1) : 1;
        const sd = Math.sqrt(Math.max(varv, 1e-12));
        return [(y - mu) / sd, 1 / sd];
      }
      const zAt = (i) => normInv((i + 1) / (n + 1));
      let lo = -1, hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (buf[mid] <= y) lo = mid; else hi = mid;
      }
      let i0, i1;
      if (lo < 0) { i0 = 0; i1 = 1; }
      else if (lo >= n - 1) { i0 = n - 2; i1 = n - 1; }
      else { i0 = lo; i1 = lo + 1; }
      let d = buf[i1] - buf[i0];
      if (d <= 0) d = 1e-9;
      const s = (zAt(i1) - zAt(i0)) / d;
      return [zAt(i0) + s * (y - buf[i0]), s];
    },
    update(y) {
      let lo = -1, hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (buf[mid] <= y) lo = mid; else hi = mid;
      }
      buf.splice(lo + 1, 0, y);
      n += 1;
      const d0 = y - mu;
      mu += d0 / n;
      m2 += d0 * (y - mu);
    },
  };
}

// Honest EWMA scale: emit against the prior standard deviation, update after.
function makeScaler(alpha = 0.05) {
  let v = 0, seen = 0;
  return {
    eval(y) {
      if (seen < 2 || v <= 1e-12) {
        const sd = Math.max(Math.abs(y), 1e-6);
        return [y / sd, 1 / sd];
      }
      const sd = Math.sqrt(v);
      return [y / sd, 1 / sd];
    },
    update(y) {
      seen += 1;
      v = seen === 1 ? y * y : (1 - alpha) * v + alpha * y * y;
    },
  };
}

// RLS AR(1) with forgetting, plus an EWMA residual variance for the leaf.
function makeAR(lam = 0.99, alpha = 0.05) {
  let phi = 0, P = 1.0, zPrev = null, v = 1, seen = 0;
  return {
    predict() { return zPrev === null ? 0 : phi * zPrev; },
    variance() { return Math.max(v, 1e-8); },
    update(z) {
      if (zPrev !== null) {
        const resid = z - phi * zPrev;
        const Px = P * zPrev;
        const denom = lam + zPrev * Px;
        if (Math.abs(denom) > 1e-12) {
          phi += (Px / denom) * resid;
          P = (P - (Px * Px) / denom) / lam;
          if (!Number.isFinite(P) || P > 1e8) P = 1.0;
        }
        seen += 1;
        v = seen === 1 ? resid * resid : (1 - alpha) * v + alpha * resid * resid;
      }
      zPrev = z;
    },
  };
}

function run() {
  const rng = mulberry32(seed);
  const ys = [];
  let z = 0;
  for (let t = 0; t < T; t++) {
    z = state.phi * z + randn(rng);
    ys.push(Math.sign(z) * Math.pow(Math.abs(z), state.gamma));
  }

  const g1 = makeGaussianizer(), g2 = makeGaussianizer();
  const sc = makeScaler();
  const arE = makeAR(), arF = makeAR();
  let muY = 0, m2Y = 0;

  const cum = { stop: 0, through: 0, without: 0 };
  const nsc = { v: 0 };
  const track = { t: [], stop: [], through: [], without: [] };

  const blend = (p, y, t) => {
    // 1% expanding-Gaussian reference, as in the papers
    if (t < 3 || m2Y <= 0) return Math.log(Math.max(p, 1e-12));
    const varY = m2Y / (t - 1);
    const gref = normPdf(y, muY, Math.sqrt(varY));
    return Math.log(Math.max(0.99 * p + 0.01 * gref, 1e-300));
  };

  for (let t = 0; t < T; t++) {
    const y = ys[t];
    if (t > BURN) {
      const [z1, d1] = g1.eval(y);
      const pStop = normPdf(z1) * Math.abs(d1);
      const [z2, d2] = g2.eval(y);
      const pThrough = normPdf(z2, arE.predict(), Math.sqrt(arE.variance())) * Math.abs(d2);
      const [s3, d3] = sc.eval(y);
      const pWithout = normPdf(s3, arF.predict(), Math.sqrt(arF.variance())) * Math.abs(d3);
      cum.stop += blend(pStop, y, t);
      cum.through += blend(pThrough, y, t);
      cum.without += blend(pWithout, y, t);
      nsc.v += 1;
      if (nsc.v % 5 === 0) {
        track.t.push(t);
        track.stop.push(cum.stop / nsc.v);
        track.through.push(cum.through / nsc.v);
        track.without.push(cum.without / nsc.v);
      }
    }
    // updates, emit-before-absorb throughout
    const [z1u] = g1.eval(y);
    g1.update(y);
    const [z2u] = g2.eval(y);
    g2.update(y);
    arE.update(Math.max(-8, Math.min(8, z2u)));
    const [s3u] = sc.eval(y);
    sc.update(y);
    arF.update(Math.max(-8, Math.min(8, s3u)));
    const d0 = y - muY;
    muY += d0 / (t + 1);
    m2Y += d0 * (y - muY);
    void z1u;
  }
  return { ys, track };
}

function draw() {
  const { ys, track } = run();

  seriesPlot.clear();
  const lim = Math.max(4, ...ys.slice(0, 300).map(Math.abs)) * 1.05;
  seriesPlot.setLimits([0, 300], [-lim, lim]);
  seriesPlot.axes();
  seriesPlot.line(Array.from({ length: 300 }, (_, i) => i), ys.slice(0, 300),
    { color: "rgba(0,0,0,0.6)", width: 1.1 });

  const all = [...track.stop, ...track.through, ...track.without];
  const lo = Math.min(...all), hi = Math.max(...all);
  racePlot.setLimits([BURN, T], [lo - 0.08, hi + 0.08]);
  racePlot.clear();
  racePlot.axes();
  racePlot.line(track.t, track.stop, { color: COL.stop, width: 2 });
  racePlot.line(track.t, track.through, { color: COL.through, width: 2 });
  racePlot.line(track.t, track.without, { color: COL.without, width: 2 });
  racePlot.legend([
    { label: "stop at the map", color: COL.stop },
    { label: "refit through the map", color: COL.through },
    { label: "same refit, no map", color: COL.without },
  ]);

  const last = (a) => a[a.length - 1];
  setRO([
    fmt(last(track.stop), 3),
    fmt(last(track.through), 3),
    fmt(last(track.without), 3),
    fmt(last(track.through) - last(track.stop), 3),
    fmt(last(track.through) - last(track.without), 3),
  ]);
}

slider(ctrls, { label: "warp exponent γ", min: 1.0, max: 2.5, step: 0.1, value: state.gamma, fmt: (v) => v.toFixed(1) },
  (v) => { state.gamma = v; draw(); });
slider(ctrls, { label: "serial dependence φ", min: 0, max: 0.95, step: 0.05, value: state.phi, fmt: (v) => v.toFixed(2) },
  (v) => { state.phi = v; draw(); });
button(ctrls, "resample", () => { seed += 1; draw(); });

autoResize(seriesPlot, draw);
autoResize(racePlot, draw);
draw();
