// Demo 35 — Constant-width intervals. Stankeviciute, Alaa and van der Schaar
// (NeurIPS 2021) build H-step forecast intervals by adding to a point
// forecast one calibration quantile per horizon, the k-th smallest absolute
// residual with k = ceil((m+1)(1-alpha/H)) (Bonferroni over horizons). The
// half-width does not depend on the input. They judge methods by joint
// coverage and mean width.
//
// Here the same point forecast gets two interval constructions on a series
// whose noise scale moves with the state:
//   CF     : point +/- q_h(|residuals|)                (one width for every state)
//   scaled : point +/- sigma_t * q_h(|residuals| / sigma) (width follows a running scale)
// Both are split-conformal quantiles over a rolling window, both aim at the
// same nominal level, and both are scored by the interval score
//   IS_a(l, u; y) = (u - l) + (2/a)(l - y)_+ + (2/a)(y - u)_+ ,
// the proper score for the (a/2, 1-a/2) quantile pair.
import { mulberry32, randn, fmt, pct } from "./lib/stats.js";
import { Plot, autoResize } from "./lib/plot.js";
import { slider, readouts, button } from "./lib/ui.js";

const N = 3000, BURN = 600, SHOW = 160;
const COL = { y: "#111827", cf: "#b91c1c", sc: "#1f4ed8", grey: "#94a3b8" };
const P = { H: 5, alpha: 0.1, win: 400, phi: 0.6, vol: 0.9, seed: 1 };

function interval_score(lo, hi, y, a) {
  let s = hi - lo;
  if (y < lo) s += (2 / a) * (lo - y);
  else if (y > hi) s += (2 / a) * (y - hi);
  return s;
}
function kth(buf, a) {                               // k-th smallest, k = ceil((m+1)(1-a)); +inf if k > m
  const m = buf.length, k = Math.ceil((m + 1) * (1 - a));
  if (k > m) return Infinity;
  const s = [...buf].sort((x, y) => x - y);
  return s[k - 1];
}

// y_t = phi y_{t-1} + s_t e_t, log s_t an AR(1) with persistence vol: a
// stochastic-volatility series. The point forecast at horizon h is phi^h y_t,
// the exact conditional mean.
function simulate() {
  const rng = mulberry32(P.seed), y = new Float64Array(N), s = new Float64Array(N);
  let ls = 0, yy = 0;
  for (let t = 0; t < N; t++) {
    ls = P.vol * ls + Math.sqrt(1 - P.vol * P.vol) * 0.8 * randn(rng);
    s[t] = Math.exp(ls);
    yy = P.phi * yy + s[t] * randn(rng);
    y[t] = yy;
  }
  return { y, s };
}

function run() {
  const { y } = simulate();
  const H = P.H, levels = { bonf: P.alpha / H, marg: P.alpha };
  const raw = Array.from({ length: H }, () => []), std = Array.from({ length: H }, () => []);
  const means = new Map(), scales = new Map();
  let ewma = 1;                                       // running scale of one-step residuals
  const acc = {};                                     // method -> level -> [IS, width, covered, n]
  for (const m of ["cf", "sc"]) { acc[m] = {}; for (const lv in levels) acc[m][lv] = [0, 0, 0, 0]; }
  const joint = { cf: [0, 0], sc: [0, 0] };
  const pend = new Map();
  const bands = [];                                   // for the picture: last SHOW origins, h = 1
  for (let t = 0; t < N; t++) {
    const yt = y[t];
    for (let h = 1; h <= H; h++) {
      const o = t - h;
      if (means.has(o)) {
        const r = Math.abs(yt - means.get(o)[h - 1]);
        raw[h - 1].push(r); if (raw[h - 1].length > P.win) raw[h - 1].shift();
        std[h - 1].push(r / scales.get(o)); if (std[h - 1].length > P.win) std[h - 1].shift();
      }
      if (pend.has(o)) {
        const p = pend.get(o);
        for (const m of ["cf", "sc"]) for (const lv in levels) {
          const [lo, hi] = p[m][lv][h - 1], a = levels[lv], cov = lo <= yt && yt <= hi;
          const s = acc[m][lv]; s[0] += interval_score(lo, hi, yt, a); s[1] += hi - lo; s[2] += cov ? 1 : 0; s[3]++;
          if (lv === "bonf") p.jc[m] = p.jc[m] && cov;
        }
        if (h === H) { for (const m of ["cf", "sc"]) { joint[m][0] += p.jc[m] ? 1 : 0; joint[m][1]++; } pend.delete(o); }
      }
    }
    if (means.has(t - 1)) { const r = yt - means.get(t - 1)[0]; ewma = 0.94 * ewma + 0.06 * r * r; }
    for (const o of [...means.keys()]) if (o < t - H) { means.delete(o); scales.delete(o); }
    const mu = []; for (let h = 1; h <= H; h++) mu.push(Math.pow(P.phi, h) * yt);
    const sig = Math.sqrt(ewma);
    means.set(t, mu); scales.set(t, sig);
    if (t >= BURN && t + H < N && raw[H - 1].length >= 100) {
      const p = { jc: { cf: true, sc: true }, cf: {}, sc: {} };
      for (const lv in levels) {
        const a = levels[lv]; p.cf[lv] = []; p.sc[lv] = [];
        for (let h = 1; h <= H; h++) {
          const e = kth(raw[h - 1], a), es = kth(std[h - 1], a) * sig;
          p.cf[lv].push([mu[h - 1] - e, mu[h - 1] + e]); p.sc[lv].push([mu[h - 1] - es, mu[h - 1] + es]);
        }
      }
      pend.set(t, p);
      if (t >= N - H - SHOW) bands.push({ t: t + 1, y: y[t + 1], cf: p.cf.marg[0], sc: p.sc.marg[0] });
    }
  }
  return { acc, joint, bands, levels };
}

const plot = new Plot(document.getElementById("w-plot"), { xlabel: "time (one step ahead intervals, per-horizon level 1 - α)", ylabel: "y", margin: { l: 56, r: 16, t: 14, b: 40 } });
const out = readouts(document.getElementById("w-readouts"), ["joint coverage CF / scaled", "mean width CF / scaled", "interval score CF / scaled (Bonferroni)", "interval score CF / scaled (per horizon)", "per-horizon coverage CF / scaled"]);

function draw() {
  const r = run();
  const b = r.acc, n = (m, lv, i) => b[m][lv][i] / b[m][lv][3];
  out("joint coverage CF / scaled", `${pct(r.joint.cf[0] / r.joint.cf[1])} / ${pct(r.joint.sc[0] / r.joint.sc[1])}`);
  out("mean width CF / scaled", `${fmt(n("cf", "bonf", 1), 2)} / ${fmt(n("sc", "bonf", 1), 2)}`);
  const isb = [n("cf", "bonf", 0), n("sc", "bonf", 0)], ism = [n("cf", "marg", 0), n("sc", "marg", 0)];
  out("interval score CF / scaled (Bonferroni)", `${fmt(isb[0], 2)} / ${fmt(isb[1], 2)}`);
  out("interval score CF / scaled (per horizon)", `${fmt(ism[0], 2)} / ${fmt(ism[1], 2)}`);
  out("per-horizon coverage CF / scaled", `${pct(n("cf", "marg", 2))} / ${pct(n("sc", "marg", 2))}`);
  const xs = r.bands.map((d) => d.t), ys = r.bands.map((d) => d.y);
  let lo = Infinity, hi = -Infinity;
  for (const d of r.bands) { lo = Math.min(lo, d.cf[0], d.sc[0], d.y); hi = Math.max(hi, d.cf[1], d.sc[1], d.y); }
  plot.setLimits([xs[0], xs[xs.length - 1]], [lo - 0.05 * (hi - lo), hi + 0.05 * (hi - lo)]);
  plot.clear();
  plot.axes();
  plot.band(xs, r.bands.map((d) => d.cf[0]), r.bands.map((d) => d.cf[1]), { color: COL.cf, alpha: 0.13 });
  plot.line(xs, r.bands.map((d) => d.cf[0]), { color: COL.cf, width: 1.2 }); plot.line(xs, r.bands.map((d) => d.cf[1]), { color: COL.cf, width: 1.2 });
  plot.line(xs, r.bands.map((d) => d.sc[0]), { color: COL.sc, width: 1.6 }); plot.line(xs, r.bands.map((d) => d.sc[1]), { color: COL.sc, width: 1.6 });
  plot.line(xs, ys, { color: COL.y, width: 1 });
  plot.points(xs, ys, { color: COL.y, radius: 1.8 });
  plot.legend([{ label: "series", color: COL.y }, { label: "CF: point ± one quantile of |residual|", color: COL.cf }, { label: "scaled: point ± scale × quantile of |residual|/scale", color: COL.sc }]);
}

const ctl = document.getElementById("w-controls");
slider(ctl, { label: "volatility persistence", min: 0, max: 0.98, step: 0.02, value: P.vol, fmt: (v) => fmt(v, 2) }, (v) => { P.vol = v; draw(); });
slider(ctl, { label: "AR coefficient φ", min: 0, max: 0.95, step: 0.05, value: P.phi, fmt: (v) => fmt(v, 2) }, (v) => { P.phi = v; draw(); });
slider(ctl, { label: "horizons H", min: 1, max: 10, step: 1, value: P.H, fmt: (v) => String(v) }, (v) => { P.H = v; draw(); });
slider(ctl, { label: "error level α", min: 0.05, max: 0.3, step: 0.01, value: P.alpha, fmt: (v) => fmt(v, 2) }, (v) => { P.alpha = v; draw(); });
slider(ctl, { label: "calibration window", min: 100, max: 1000, step: 50, value: P.win, fmt: (v) => String(v) }, (v) => { P.win = v; draw(); });
button(ctl, "Resample", () => { P.seed += 1; draw(); });
autoResize(plot, draw);
draw();
