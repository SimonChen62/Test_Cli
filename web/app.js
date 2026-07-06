const params = new URLSearchParams(window.location.search);
const workId = params.get("work") || "work_003";
const DATA_URL = `../data/${workId}/annotation.json`;
const IMAGE_BASE = `../data/${workId}/`;

const state = {
  mode: "qi_flow",
  layer: "skeleton",
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
    setMode(state.mode);
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
  if (!state.data || state.mode === "original" || state.mode === "layers") {
    showEmptyPanel();
    return;
  }

  const visible = state.data.annotations.filter((item) => item.type === state.mode);
  visible.forEach((item) => {
    if (item.type === "qi_flow") renderPath(item);
    if (item.type === "void_solid") renderBox(item, "voidBox");
    if (item.type === "brush_ink") renderBox(item, "inkBox");
  });
  if (visible[0]) {
    selectAnnotation(visible[0]);
  } else {
    showEmptyPanel();
  }
}

function renderPath(item) {
  const path = svg("path", {
    d: item.path,
    class: "annotationShape qiPath",
    tabindex: "0",
  });
  path.addEventListener("click", () => selectAnnotation(item));
  els.overlay.append(path);
  const labelPosition = pathLabelPosition(item.path);
  addLabel(item.label, labelPosition.x, labelPosition.y);
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

function showEmptyPanel() {
  els.annotationTitle.textContent = "选择一个标注";
  els.formal.textContent = "切换到气脉、虚实或笔墨模式后，点击图中的路径或区域查看人工解释。";
  els.perception.textContent = "这里会显示普通观众可能产生的观看感受。";
  els.aesthetic.textContent = "这里会说明该观察如何帮助理解气脉、虚实或笔墨节奏。";
}

function pathLabelPosition(path) {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length < 2) return { x: 6, y: 9 };
  return {
    x: Math.max(2, Math.min(94, numbers[0] + 1.5)),
    y: Math.max(4, Math.min(96, numbers[1] - 2)),
  };
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
