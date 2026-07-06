const DATA_URL = "../data/work_001/annotation.json";
const IMAGE_BASE = "../data/work_001/";

const state = {
  mode: "original",
  layer: "original",
  data: null,
};

const els = {
  title: document.querySelector("#workTitle"),
  image: document.querySelector("#workImage"),
  fallback: document.querySelector("#imageFallback"),
  overlay: document.querySelector("#overlay"),
  layerPicker: document.querySelector("#layerPicker"),
  annotationTitle: document.querySelector("#annotationTitle"),
  formal: document.querySelector("#formalText"),
  perception: document.querySelector("#perceptionText"),
  aesthetic: document.querySelector("#aestheticText"),
  speak: document.querySelector("#speakButton"),
};

const layerForMode = {
  original: "original",
  qi_flow: "skeleton",
  void_solid: "voidCandidates",
  brush_ink: "strokeWidth",
};

async function boot() {
  try {
    const response = await fetch(DATA_URL);
    state.data = await response.json();
    els.title.textContent = state.data.title || "单作品书法导览";
    render();
  } catch (error) {
    els.fallback.hidden = false;
    console.error(error);
  }
}

function setMode(mode) {
  state.mode = mode;
  if (mode !== "layers") {
    state.layer = layerForMode[mode] || "original";
  }
  document.querySelectorAll(".modeButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  els.layerPicker.classList.toggle("visible", mode === "layers");
  render();
}

function setLayer(layer) {
  state.layer = layer;
  document.querySelectorAll(".layerButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === layer);
  });
  render();
}

function imageForLayer(layer) {
  const images = state.data?.images || {};
  return IMAGE_BASE + (images[layer] || images.original || "original.png");
}

function render() {
  if (!state.data) return;
  els.image.src = imageForLayer(state.layer);
  els.image.onerror = () => {
    els.fallback.hidden = false;
    positionOverlay();
  };
  els.image.onload = () => {
    els.fallback.hidden = true;
    positionOverlay();
  };
  renderOverlay();
}

function positionOverlay() {
  const imageRect = els.image.getBoundingClientRect();
  const shellRect = els.image.parentElement.getBoundingClientRect();
  const left = imageRect.left - shellRect.left;
  const top = imageRect.top - shellRect.top;
  els.overlay.style.left = `${left}px`;
  els.overlay.style.top = `${top}px`;
  els.overlay.style.width = `${imageRect.width}px`;
  els.overlay.style.height = `${imageRect.height}px`;
}

function renderOverlay() {
  els.overlay.replaceChildren();
  if (!state.data || state.mode === "original" || state.mode === "layers") return;

  const visible = state.data.annotations.filter((item) => item.type === state.mode);
  visible.forEach((item) => {
    if (item.type === "qi_flow") renderPath(item);
    if (item.type === "void_solid") renderBox(item, "voidBox");
    if (item.type === "brush_ink") renderBox(item, "inkBox");
  });
}

function renderPath(item) {
  const path = svg("path", {
    d: item.path,
    class: "annotationShape qiPath",
    tabindex: "0",
  });
  path.addEventListener("click", () => selectAnnotation(item));
  els.overlay.append(path);
  addLabel(item.label, 6, 9);
}

function renderBox(item, className) {
  if (!item.box) return;
  const rect = svg("rect", {
    x: item.box.x,
    y: item.box.y,
    width: item.box.width,
    height: item.box.height,
    rx: 0.8,
    class: `annotationShape ${className}`,
    tabindex: "0",
  });
  rect.addEventListener("click", () => selectAnnotation(item));
  els.overlay.append(rect);
  addLabel(item.label, item.box.x, Math.max(4, item.box.y - 2));
}

function addLabel(text, x, y) {
  const label = svg("text", {
    x,
    y,
    class: "shapeLabel",
  });
  label.textContent = text;
  els.overlay.append(label);
}

function selectAnnotation(item) {
  els.annotationTitle.textContent = `${item.label} · ${item.id}`;
  els.formal.textContent = item.formal;
  els.perception.textContent = item.perception;
  els.aesthetic.textContent = item.aesthetic;
}

function speakGuide() {
  if (!state.data?.guideText || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(state.data.guideText);
  utterance.lang = "zh-CN";
  window.speechSynthesis.speak(utterance);
}

function svg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

document.querySelectorAll(".modeButton").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll(".layerButton").forEach((button) => {
  button.addEventListener("click", () => setLayer(button.dataset.layer));
});

els.speak.addEventListener("click", speakGuide);
window.addEventListener("resize", positionOverlay);

boot();
