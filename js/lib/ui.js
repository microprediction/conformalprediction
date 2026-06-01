// ui.js — tiny helpers to wire sliders/checkboxes/readouts without boilerplate.

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// Build a labelled range slider. Returns an object with .value and .el.
// Calls onInput(value) on every change. `fmt` formats the displayed value.
export function slider(container, { label, min, max, step, value, fmt = (v) => v }, onInput) {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const lab = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = label;
  const val = document.createElement("span");
  val.className = "val";
  lab.appendChild(span);
  lab.appendChild(val);
  const input = document.createElement("input");
  input.type = "range";
  input.min = min; input.max = max; input.step = step; input.value = value;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  container.appendChild(wrap);
  const state = { value: parseFloat(value), el: input };
  const update = () => {
    state.value = parseFloat(input.value);
    val.textContent = fmt(state.value);
    onInput(state.value);
  };
  input.addEventListener("input", update);
  val.textContent = fmt(state.value);
  return state;
}

export function checkbox(container, { label, checked = false }, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "control checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.id = "cb-" + Math.random().toString(36).slice(2, 8);
  const lab = document.createElement("label");
  lab.setAttribute("for", input.id);
  lab.textContent = label;
  lab.style.color = "var(--ink)";
  wrap.appendChild(input);
  wrap.appendChild(lab);
  container.appendChild(wrap);
  const state = { value: checked, el: input };
  input.addEventListener("change", () => { state.value = input.checked; onChange(state.value); });
  return state;
}

export function button(container, label, onClick) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  container.appendChild(b);
  return b;
}

// A grid of readout tiles. Returns a setter: set(key, value, cls?).
export function readouts(container, keys) {
  const els = {};
  for (const k of keys) {
    const tile = document.createElement("div");
    tile.className = "readout";
    const kdiv = document.createElement("div");
    kdiv.className = "k";
    kdiv.textContent = k;
    const vdiv = document.createElement("div");
    vdiv.className = "v";
    vdiv.textContent = "–";
    tile.appendChild(kdiv);
    tile.appendChild(vdiv);
    container.appendChild(tile);
    els[k] = vdiv;
  }
  return (k, value, cls) => {
    if (!els[k]) return;
    els[k].textContent = value;
    els[k].className = "v" + (cls ? " " + cls : "");
  };
}
