// plot.js — a minimal, dependency-free canvas plotting helper.
// Data-coordinate drawing with crisp DPR-aware rendering. Enough for
// scatter, lines, filled bands, bars, markers, and a small legend.

const FONT = "13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export class Plot {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.margin = Object.assign({ l: 52, r: 16, t: 14, b: 40 }, opts.margin || {});
    this.xlim = opts.xlim || [0, 1];
    this.ylim = opts.ylim || [0, 1];
    this.xlabel = opts.xlabel || "";
    this.ylabel = opts.ylabel || "";
    this._resize();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.width || 600;
    const h = rect.height || this.canvas.height || 360;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  setLimits(xlim, ylim) {
    if (xlim) this.xlim = xlim;
    if (ylim) this.ylim = ylim;
  }

  // Data -> pixel transforms.
  X(x) {
    const { l, r } = this.margin;
    const innerW = this.w - l - r;
    return l + ((x - this.xlim[0]) / (this.xlim[1] - this.xlim[0])) * innerW;
  }
  Y(y) {
    const { t, b } = this.margin;
    const innerH = this.h - t - b;
    return t + (1 - (y - this.ylim[0]) / (this.ylim[1] - this.ylim[0])) * innerH;
  }

  clear(bg) {
    this._resize();
    if (bg) {
      this.ctx.fillStyle = bg;
      this.ctx.fillRect(0, 0, this.w, this.h);
    } else {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }

  axes(opts = {}) {
    const ctx = this.ctx;
    const { l, r, t, b } = this.margin;
    const x0 = l, x1 = this.w - r, y0 = t, y1 = this.h - b;
    const xticks = opts.xticks || niceTicks(this.xlim[0], this.xlim[1], 6);
    const yticks = opts.yticks || niceTicks(this.ylim[0], this.ylim[1], 5);
    ctx.save();
    ctx.font = FONT;
    ctx.lineWidth = 1;
    // grid
    if (opts.grid !== false) {
      ctx.strokeStyle = "rgba(0,0,0,0.06)";
      for (const xt of xticks) {
        ctx.beginPath();
        ctx.moveTo(this.X(xt), y0);
        ctx.lineTo(this.X(xt), y1);
        ctx.stroke();
      }
      for (const yt of yticks) {
        ctx.beginPath();
        ctx.moveTo(x0, this.Y(yt));
        ctx.lineTo(x1, this.Y(yt));
        ctx.stroke();
      }
    }
    // frame
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // tick labels
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xfmt = opts.xfmt || tickFmt(this.xlim);
    for (const xt of xticks) ctx.fillText(xfmt(xt), this.X(xt), y1 + 6);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yfmt = opts.yfmt || tickFmt(this.ylim);
    for (const yt of yticks) ctx.fillText(yfmt(yt), x0 - 8, this.Y(yt));
    // axis labels
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    if (this.xlabel) ctx.fillText(this.xlabel, (x0 + x1) / 2, this.h - 4);
    if (this.ylabel) {
      ctx.save();
      ctx.translate(12, (y0 + y1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = "top";
      ctx.fillText(this.ylabel, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  _clipInner(fn) {
    const ctx = this.ctx;
    const { l, r, t, b } = this.margin;
    ctx.save();
    ctx.beginPath();
    ctx.rect(l, t, this.w - l - r, this.h - t - b);
    ctx.clip();
    fn();
    ctx.restore();
  }

  line(xs, ys, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.strokeStyle = opts.color || "#1f4ed8";
      ctx.lineWidth = opts.width || 2;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.globalAlpha = opts.alpha ?? 1;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < xs.length; i++) {
        if (!isFinite(ys[i])) { started = false; continue; }
        const px = this.X(xs[i]), py = this.Y(ys[i]);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  points(xs, ys, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.fillStyle = opts.color || "rgba(20,20,20,0.7)";
      ctx.globalAlpha = opts.alpha ?? 1;
      const rad = opts.radius || 2.5;
      for (let i = 0; i < xs.length; i++) {
        if (!isFinite(xs[i]) || !isFinite(ys[i])) continue;
        ctx.beginPath();
        ctx.arc(this.X(xs[i]), this.Y(ys[i]), rad, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // Filled band between ylo and yhi over xs. Infinite bounds clamp to view.
  band(xs, ylo, yhi, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.fillStyle = opts.color || "rgba(31,78,216,0.15)";
      ctx.globalAlpha = opts.alpha ?? 1;
      ctx.beginPath();
      const clampY = (y) => (y === Infinity ? this.ylim[1] + 1e6 : y === -Infinity ? this.ylim[0] - 1e6 : y);
      for (let i = 0; i < xs.length; i++) ctx.lineTo(this.X(xs[i]), this.Y(clampY(yhi[i])));
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(this.X(xs[i]), this.Y(clampY(ylo[i])));
      ctx.closePath();
      ctx.fill();
      if (opts.stroke) {
        ctx.strokeStyle = opts.stroke;
        ctx.lineWidth = opts.strokeWidth || 1;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // Vertical bars centered at xs with given heights (data coords) sharing baseline y0.
  bars(centers, heights, width, opts = {}) {
    const ctx = this.ctx;
    const base = opts.base ?? this.ylim[0];
    this._clipInner(() => {
      ctx.save();
      ctx.fillStyle = opts.color || "rgba(31,78,216,0.5)";
      ctx.globalAlpha = opts.alpha ?? 1;
      for (let i = 0; i < centers.length; i++) {
        const x0 = this.X(centers[i] - width / 2);
        const x1 = this.X(centers[i] + width / 2);
        const yTop = this.Y(base + heights[i]);
        const yBot = this.Y(base);
        ctx.fillRect(x0, Math.min(yTop, yBot), Math.max(1, x1 - x0 - 1), Math.abs(yBot - yTop));
      }
      if (opts.stroke) {
        ctx.strokeStyle = opts.stroke;
        ctx.lineWidth = 1;
        for (let i = 0; i < centers.length; i++) {
          const x0 = this.X(centers[i] - width / 2);
          const x1 = this.X(centers[i] + width / 2);
          const yTop = this.Y(base + heights[i]);
          const yBot = this.Y(base);
          ctx.strokeRect(x0, Math.min(yTop, yBot), Math.max(1, x1 - x0 - 1), Math.abs(yBot - yTop));
        }
      }
      ctx.restore();
    });
  }

  hline(y, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.strokeStyle = opts.color || "rgba(200,0,0,0.8)";
      ctx.lineWidth = opts.width || 1.5;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(this.X(this.xlim[0]), this.Y(y));
      ctx.lineTo(this.X(this.xlim[1]), this.Y(y));
      ctx.stroke();
      ctx.restore();
    });
    if (opts.label) {
      ctx.save();
      ctx.font = FONT;
      ctx.fillStyle = opts.color || "rgba(200,0,0,0.9)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(opts.label, this.X(this.xlim[1]) - 4, this.Y(y) - 2);
      ctx.restore();
    }
  }

  vline(x, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.strokeStyle = opts.color || "rgba(0,0,0,0.6)";
      ctx.lineWidth = opts.width || 1.5;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(this.X(x), this.Y(this.ylim[0]));
      ctx.lineTo(this.X(x), this.Y(this.ylim[1]));
      ctx.stroke();
      ctx.restore();
    });
  }

  // Shade a vertical x-range (e.g. a selection window).
  vspan(xa, xb, opts = {}) {
    const ctx = this.ctx;
    this._clipInner(() => {
      ctx.save();
      ctx.fillStyle = opts.color || "rgba(255,193,7,0.18)";
      const x0 = this.X(xa), x1 = this.X(xb);
      ctx.fillRect(Math.min(x0, x1), this.Y(this.ylim[1]), Math.abs(x1 - x0), this.Y(this.ylim[0]) - this.Y(this.ylim[1]));
      ctx.restore();
    });
  }

  text(x, y, str, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = opts.font || FONT;
    ctx.fillStyle = opts.color || "rgba(0,0,0,0.8)";
    ctx.textAlign = opts.align || "left";
    ctx.textBaseline = opts.baseline || "alphabetic";
    ctx.fillText(str, this.X(x), this.Y(y));
    ctx.restore();
  }

  legend(items, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = FONT;
    const pad = 8, lh = 18, sw = 16;
    let maxW = 0;
    for (const it of items) maxW = Math.max(maxW, ctx.measureText(it.label).width);
    const boxW = sw + 8 + maxW + pad * 2;
    const boxH = items.length * lh + pad * 2 - 4;
    const x = opts.x ?? this.X(this.xlim[1]) - boxW - 8;
    const y = opts.y ?? this.Y(this.ylim[1]) + 8;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.textBaseline = "middle";
    for (let i = 0; i < items.length; i++) {
      const yy = y + pad + i * lh + 6;
      const it = items[i];
      ctx.fillStyle = it.color;
      if (it.dash) {
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(it.dash);
        ctx.beginPath();
        ctx.moveTo(x + pad, yy);
        ctx.lineTo(x + pad + sw, yy);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillRect(x + pad, yy - 5, sw, 10);
      }
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.textAlign = "left";
      ctx.fillText(it.label, x + pad + sw + 8, yy);
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function niceTicks(lo, hi, target = 6) {
  if (lo === hi) return [lo];
  const span = hi - lo;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / target)));
  const err = (span / target) / step0;
  let step = step0;
  if (err >= 7.5) step = step0 * 10;
  else if (err >= 3.5) step = step0 * 5;
  else if (err >= 1.5) step = step0 * 2;
  const start = Math.ceil(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

function tickFmt(lim) {
  const span = Math.abs(lim[1] - lim[0]);
  const d = span >= 100 ? 0 : span >= 10 ? 0 : span >= 1 ? 1 : 2;
  return (v) => v.toFixed(d);
}

// Make a canvas redraw on container resize. Pass a draw() callback.
export function autoResize(plot, draw) {
  let raf = null;
  const ro = new ResizeObserver(() => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  ro.observe(plot.canvas);
  return ro;
}
