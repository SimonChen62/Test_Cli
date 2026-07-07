const params = new URLSearchParams(window.location.search);
const workId = params.get("work") || "work_003";
const DATA_URL = `../data/${workId}/annotation.json`;
const IMAGE_BASE = `../data/${workId}/`;

const typeMeta = {
  qi_flow: { name: "气脉", markClass: "qiPath", recommendedLayer: "original" },
  void_solid: { name: "虚实", markClass: "voidBox", recommendedLayer: "original" },
  brush_ink: { name: "笔墨", markClass: "inkBox", recommendedLayer: "original" },
};

const state = {
  layer: "original",
  filter: "all",
  selectedId: null,
  data: null,
};

const els = {
  title: document.querySelector("#workTitle"),
  image: document.querySelector("#workImage"),
  fallback: document.querySelector("#imageFallback"),
  overlay: document.querySelector("#overlay"),
  guideList: document.querySelector("#guideList"),
  detailType: document.querySelector("#detailType"),
  annotationTitle: document.querySelector("#annotationTitle"),
  where: document.querySelector("#whereText"),
  formal: document.querySelector("#formalText"),
  perception: document.querySelector("#perceptionText"),
  aesthetic: document.querySelector("#aestheticText"),
  speak: document.querySelector("#speakButton"),
  clear: document.querySelector("#clearButton"),
  prev: document.querySelector("#prevButton"),
  next: document.querySelector("#nextButton"),
};

async function boot() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`无法加载 ${DATA_URL}: ${response.status}`);
    state.data = await response.json();
    els.title.textContent = state.data.title || "单作品书法导览";
    renderAll();
  } catch (error) {
    els.fallback.hidden = false;
    showEmptyDetail("数据加载失败", error.message);
    console.error(error);
  }
}

function annotations() {
  return state.data?.annotations || [];
}

function visibleAnnotations() {
  if (state.filter === "all") return annotations();
  return annotations().filter((item) => item.type === state.filter);
}

function selectedAnnotation() {
  return annotations().find((item) => item.id === state.selectedId) || null;
}

function renderAll() {
  renderImage();
  renderGuideList();
  renderOverlay();
  renderDetail();
}

function renderImage() {
  if (!state.data) return;
  const images = state.data.images || {};
  els.image.src = IMAGE_BASE + (images[state.layer] || images.original || "original.png");
  els.image.onerror = () => {
    els.fallback.hidden = false;
    positionOverlay();
  };
  els.image.onload = () => {
    els.fallback.hidden = true;
    positionOverlay();
  };
  document.querySelectorAll(".layerButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === state.layer);
  });
}

function renderGuideList() {
  const items = visibleAnnotations();
  els.guideList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "emptyList";
    empty.textContent = "当前分类还没有观察点。";
    els.guideList.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "guideCard";
    button.classList.toggle("active", item.id === state.selectedId);
    button.addEventListener("click", () => selectItem(item.id));

    const badge = document.createElement("span");
    badge.className = `typeBadge ${item.type}`;
    badge.textContent = typeMeta[item.type]?.name || item.type;

    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(2, "0")} · ${item.label}`;

    const summary = document.createElement("span");
    summary.textContent = summarize(item.formal);

    button.append(badge, title, summary);
    els.guideList.append(button);
  });
}

function renderOverlay() {
  els.overlay.replaceChildren();
  const item = selectedAnnotation();
  if (!item) return;
  if (item.type === "qi_flow") renderPath(item);
  if (item.type === "void_solid") renderBox(item, "voidBox");
  if (item.type === "brush_ink") renderBox(item, "inkBox");
}

function renderPath(item) {
  const halo = svg("path", { d: item.path, class: "qiHalo" });
  const path = svg("path", { d: item.path, class: "annotationShape qiPath", tabindex: "0" });
  els.overlay.append(halo, path);
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
  els.overlay.append(rect);
  addLabel(item.label, item.box.x, Math.max(4, item.box.y - 2));
}

function renderDetail() {
  const item = selectedAnnotation();
  if (!item) {
    showEmptyDetail("先看原作整体", "右侧列表不是检测结果，而是少量代表性观察点。点击其中一项后，左侧才会点亮对应位置。");
    setStepButtonsDisabled(true);
    return;
  }

  els.detailType.textContent = `${typeMeta[item.type]?.name || item.type} · ${item.id}`;
  els.annotationTitle.textContent = item.label;
  els.where.textContent = whereText(item);
  els.formal.textContent = item.formal;
  els.perception.textContent = item.perception;
  els.aesthetic.textContent = item.aesthetic;
  setStepButtonsDisabled(false);
}

function showEmptyDetail(title, message) {
  els.detailType.textContent = "导览说明";
  els.annotationTitle.textContent = title;
  els.where.textContent = message;
  els.formal.textContent = "先观察作品整体，再逐个打开观察点。";
  els.perception.textContent = "这样可以避免一开始就被标注压住，只保留自己的第一印象。";
  els.aesthetic.textContent = "CalliLens 的目标是辅助鉴赏，不是自动判断书法好坏。";
}

function selectItem(id) {
  state.selectedId = id;
  const item = selectedAnnotation();
  if (item) {
    state.layer = typeMeta[item.type]?.recommendedLayer || "original";
  }
  renderAll();
}

function clearSelection() {
  state.selectedId = null;
  state.layer = "original";
  renderAll();
}

function stepSelection(delta) {
  const items = visibleAnnotations();
  if (!items.length) return;
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === state.selectedId));
  const nextIndex = (currentIndex + delta + items.length) % items.length;
  selectItem(items[nextIndex].id);
}

function setFilter(filter) {
  state.filter = filter;
  const selected = selectedAnnotation();
  if (selected && filter !== "all" && selected.type !== filter) {
    state.selectedId = null;
  }
  document.querySelectorAll(".filterButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
  renderAll();
}

function setLayer(layer) {
  state.layer = layer;
  renderImage();
}

function setStepButtonsDisabled(disabled) {
  els.prev.disabled = disabled;
  els.next.disabled = disabled;
}

function positionOverlay() {
  const imageRect = els.image.getBoundingClientRect();
  const shellRect = els.image.parentElement.getBoundingClientRect();
  els.overlay.style.left = `${imageRect.left - shellRect.left}px`;
  els.overlay.style.top = `${imageRect.top - shellRect.top}px`;
  els.overlay.style.width = `${imageRect.width}px`;
  els.overlay.style.height = `${imageRect.height}px`;
}

function whereText(item) {
  if (item.type === "qi_flow") return "看左侧被点亮的红色路径：它不是笔顺还原，而是人工确认的观看趋势。";
  if (item.type === "void_solid") return "看左侧被轻微罩出的空白区域：重点是空白如何参与结构。";
  if (item.type === "brush_ink") return "看左侧被点亮的笔墨区域：它提示粗细、浓淡或视觉重量。";
  return "看左侧当前高亮位置。";
}

function summarize(text) {
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function addLabel(text, x, y) {
  const label = svg("text", { x, y, class: "shapeLabel" });
  label.textContent = text;
  els.overlay.append(label);
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

document.querySelectorAll(".filterButton").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll(".layerButton").forEach((button) => {
  button.addEventListener("click", () => setLayer(button.dataset.layer));
});

els.clear.addEventListener("click", clearSelection);
els.speak.addEventListener("click", speakGuide);
els.prev.addEventListener("click", () => stepSelection(-1));
els.next.addEventListener("click", () => stepSelection(1));
window.addEventListener("resize", positionOverlay);

boot();
