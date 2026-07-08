const params = new URLSearchParams(window.location.search);
let activeWorkId = params.get("work") || "";
const initialSelectId = params.get("select");
const initialProbe = params.get("probe");
const initialView = params.get("view");
const WORKS_URL = "../data/works.json";

const typeMeta = {
  qi_flow: { name: "气脉", markClass: "qiRegion", recommendedLayer: "original" },
  void_solid: { name: "虚实", markClass: "voidBox", recommendedLayer: "original" },
  brush_ink: { name: "笔墨", markClass: "inkBox", recommendedLayer: "original" },
};

const modeMeta = {
  original: {
    layer: "original",
    filter: "all",
    detail: ["先看原作整体", "不急着看答案。先判断哪里有运动感，哪里疏朗或紧密。"],
  },
  qi: {
    layer: "skeleton",
    filter: "qi_flow",
    detail: ["气脉模式", "骨架图帮助观察笔画方向和上下承接；虚线圈只提示人工选择的观察区域。"],
  },
  solid: {
    layer: "binary",
    filter: "void_solid",
    detail: ["实：墨迹", "黑白图把墨迹从背景中分离出来，适合看密集程度、字距和结构重心。"],
  },
  void: {
    layer: "voidCandidates",
    filter: "void_solid",
    detail: ["虚：留白", "留白候选图帮助定位字间、列间和题名旁的空白。"],
  },
  relation: {
    layer: "original",
    filter: "void_solid",
    detail: ["虚实关系", "回到原作上看空白和墨迹如何互相组织，而不是只看空白本身。"],
  },
  ink: {
    layer: "inkDensity",
    filter: "brush_ink",
    detail: ["笔墨模式", "墨色和粗细图层只能提示视觉轻重，不能等同于真实书写力道。"],
  },
};

const reflectionTasks = {
  motion: "任务：指出一处你觉得最有运动感的位置，并说明是方向、距离还是转折让你这样判断。",
  space: "任务：指出一块参与结构的空白，并说明它如何影响疏密、停顿或呼吸感。",
  evidence: "任务：用“形式证据 -> 观看感受 -> 审美概念”的顺序解释一个观察点。",
};

const state = {
  screen: "entry",
  worksIndex: null,
  layer: "original",
  mode: "original",
  filter: "all",
  selectedId: null,
  data: null,
  probe: null,
  layerCanvases: {},
  layout: localStorage.getItem("callilens-layout") || "portrait",
  firstLook: readFirstLook(),
  introComplete: false,
  editingFirstLook: false,
  reflections: readReflections(), // { [id]: { text, submitted } }
};

state.introComplete = firstLookComplete(state.firstLook);

const els = {
  entryScreen: document.querySelector("#entryScreen"),
  uploadEntry: document.querySelector("#uploadEntryButton"),
  storedWorks: document.querySelector("#storedWorksButton"),
  storedWorksPanel: document.querySelector("#storedWorksPanel"),
  storedWorksList: document.querySelector("#storedWorksList"),
  uploadPanel: document.querySelector("#uploadPanel"),
  browseFromUpload: document.querySelector("#browseFromUploadButton"),
  app: document.querySelector(".app"),
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
  canvasShell: document.querySelector(".canvasShell"),
  probeTitle: document.querySelector("#probeTitle"),
  probeSummary: document.querySelector("#probeSummary"),
  inkMetric: document.querySelector("#inkMetric"),
  voidMetric: document.querySelector("#voidMetric"),
  strokeMetric: document.querySelector("#strokeMetric"),
  densityMetric: document.querySelector("#densityMetric"),
  probeCandidate: document.querySelector("#probeCandidate"),
  reflectionInput: document.querySelector("#reflectionInput"),
  reflectionSubmit: document.querySelector("#reflectionSubmitButton"),
  reflectionEdit: document.querySelector("#reflectionEditButton"),
  reflectionPrompt: document.querySelector("#reflectionPrompt"),
  reflectionConcept: document.querySelector("#reflectionConcept"),
  reflectionPromptText: document.querySelector("#reflectionPromptText"),
  expertFeedbackPanel: document.querySelector("#expertFeedbackPanel"),
  feedbackUserText: document.querySelector("#feedbackUserText"),
  feedbackExpertText: document.querySelector("#feedbackExpertText"),
  firstLookForm: document.querySelector("#firstLookForm"),
  firstResponseSummary: document.querySelector("#firstResponseSummary"),
  returnFirstLook: document.querySelector("#returnFirstLookButton"),
  firstOverall: document.querySelector("#firstOverall"),
  firstMotion: document.querySelector("#firstMotion"),
  firstDensity: document.querySelector("#firstDensity"),
  firstLookError: document.querySelector("#firstLookError"),
  editFirstLook: document.querySelector("#editFirstLookButton"),
  summaryOverall: document.querySelector("#summaryOverall"),
  summaryMotion: document.querySelector("#summaryMotion"),
  summaryDensity: document.querySelector("#summaryDensity"),
  summaryOverallInput: document.querySelector("#summaryOverallInput"),
  summaryMotionInput: document.querySelector("#summaryMotionInput"),
  summaryDensityInput: document.querySelector("#summaryDensityInput"),
  summaryEditError: document.querySelector("#summaryEditError"),
};

function dataUrl() {
  return `../data/${activeWorkId}/annotation.json`;
}

function imageBase() {
  return `../data/${activeWorkId}/`;
}

function firstLookStorageKey() {
  return `callilens-first-look:${activeWorkId || "work_003"}`;
}

function reflectionsStorageKey() {
  return `callilens-reflections:${activeWorkId || "work_003"}`;
}

async function boot() {
  try {
    await loadWorksIndex();
    renderEntry();
    const shouldOpenDemo = initialView === "demo" || Boolean(params.get("work")) || Boolean(initialSelectId) || Boolean(initialProbe);
    if (shouldOpenDemo) {
      await openWork(activeWorkId || state.worksIndex?.defaultWorkId || "work_003", { updateUrl: false });
    }
  } catch (error) {
    els.fallback.hidden = false;
    showEmptyDetail("数据加载失败", error.message);
    console.error(error);
  }
}

async function loadWorksIndex() {
  const response = await fetch(WORKS_URL);
  if (!response.ok) throw new Error(`无法加载 ${WORKS_URL}: ${response.status}`);
  state.worksIndex = await response.json();
  if (!activeWorkId) activeWorkId = state.worksIndex.defaultWorkId || state.worksIndex.works?.[0]?.id || "work_003";
}

function renderEntry() {
  renderWorkCards();
  els.entryScreen.hidden = state.screen === "demo";
  els.app.hidden = state.screen !== "demo";
  els.storedWorksPanel.hidden = state.screen !== "stored";
  els.uploadPanel.hidden = state.screen !== "upload";
}

function renderWorkCards() {
  const works = state.worksIndex?.works || [];
  els.storedWorksList.replaceChildren();
  works.forEach((work) => {
    const card = document.createElement("article");
    card.className = `workCard ${work.status === "ready" ? "ready" : "draft"}`;

    const image = document.createElement("img");
    image.alt = work.title;
    image.src = `../data/${work.id}/${work.thumbnail || "original.png"}`;

    const body = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = work.status === "ready" ? "可导览" : "草稿样例";
    const title = document.createElement("h3");
    title.textContent = work.title;
    const meta = document.createElement("p");
    meta.className = "workMeta";
    meta.textContent = work.style || "书法作品";
    const description = document.createElement("p");
    description.textContent = work.description || "进入观察式导览。";
    const button = document.createElement("button");
    button.className = "primaryButton";
    button.type = "button";
    button.textContent = work.status === "ready" ? "进入导览" : "查看草稿";
    button.addEventListener("click", () => openWork(work.id));

    body.append(eyebrow, title, meta, description, button);
    card.append(image, body);
    els.storedWorksList.append(card);
  });
}

async function openWork(workId, options = {}) {
  activeWorkId = workId;
  state.screen = "demo";
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  state.selectedId = null;
  state.probe = null;
  state.data = null;
  state.layerCanvases = {};
  state.firstLook = readFirstLook();
  state.introComplete = firstLookComplete(state.firstLook);
  state.editingFirstLook = false;
  state.reflections = readReflections();
  els.fallback.hidden = true;
  renderEntry();

  if (options.updateUrl !== false) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("work", activeWorkId);
    nextUrl.searchParams.set("view", "demo");
    nextUrl.searchParams.delete("select");
    nextUrl.searchParams.delete("probe");
    window.history.pushState({}, "", nextUrl);
  }

  const response = await fetch(dataUrl());
  if (!response.ok) throw new Error(`无法加载 ${dataUrl()}: ${response.status}`);
  state.data = await response.json();
  if (initialSelectId && state.data.annotations?.some((item) => item.id === initialSelectId)) {
    state.selectedId = initialSelectId;
    const item = state.data.annotations.find((entry) => entry.id === initialSelectId);
    state.filter = item.type;
  }
  els.title.textContent = state.data.title || "单作品书法导览";
  renderAll();
  loadAnalysisCanvases();
  applyInitialProbe();
}

function applyInitialProbe() {
  if (!initialProbe || !els.image.naturalWidth || !els.image.naturalHeight) return;
  const [x, y] = initialProbe.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const percentX = clamp(x, 0, 100);
  const percentY = clamp(y, 0, 100);
  const pixelX = Math.round((percentX / 100) * els.image.naturalWidth);
  const pixelY = Math.round((percentY / 100) * els.image.naturalHeight);
  state.probe = analyzeProbe(pixelX, pixelY, percentX, percentY);
  renderOverlay();
  renderProbePanel();
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
  enforceIntroGate();
  renderLayout();
  renderFirstLook();
  renderImage();
  renderGuideList();
  renderOverlay();
  renderDetail();
  renderProbePanel();
  renderReflectionPanel();
}

function renderLayout() {
  const layout = state.layout === "landscape" ? "landscape" : "portrait";
  els.app.dataset.layout = layout;
  els.app.dataset.mode = state.mode;
  els.app.dataset.hasSelection = state.selectedId ? "true" : "false";
  els.app.dataset.introComplete = state.introComplete ? "true" : "false";
  document.querySelectorAll(".layoutButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.layout === layout);
  });
  requestAnimationFrame(positionOverlay);
}

function enforceIntroGate() {
  if (state.introComplete) return;
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  state.selectedId = null;
  state.probe = null;
}

function renderFirstLook() {
  els.firstOverall.value = state.firstLook.overall;
  els.firstMotion.value = state.firstLook.motion;
  els.firstDensity.value = state.firstLook.density;
  els.summaryOverall.textContent = state.firstLook.overall || "尚未填写";
  els.summaryMotion.textContent = state.firstLook.motion || "尚未填写";
  els.summaryDensity.textContent = state.firstLook.density || "尚未填写";
  els.summaryOverallInput.value = state.firstLook.overall;
  els.summaryMotionInput.value = state.firstLook.motion;
  els.summaryDensityInput.value = state.firstLook.density;
  els.firstResponseSummary.classList.toggle("editing", state.editingFirstLook);
  els.editFirstLook.textContent = state.editingFirstLook ? "保存" : "修改";
}

function renderImage() {
  if (!state.data) return;
  const images = state.data.images || {};
  els.image.src = imageBase() + (images[state.layer] || images.original || "original.png");
  els.image.onerror = () => {
    els.fallback.hidden = false;
    positionOverlay();
  };
  els.image.onload = () => {
    els.fallback.hidden = true;
    positionOverlay();
    renderOverlay();
    applyInitialProbe();
  };
  document.querySelectorAll(".modeButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
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

    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(2, "0")} · ${item.label}`;

    const summary = document.createElement("span");
    summary.textContent = summarize(item.formal);

    button.append(title, summary);
    els.guideList.append(button);
  });
}

function renderOverlay() {
  els.overlay.replaceChildren();
  const item = selectedAnnotation();
  if (item) {
    if (item.type === "qi_flow") renderQiRegion(item);
    if (item.type === "void_solid") renderBox(item, "voidBox");
    if (item.type === "brush_ink") renderBox(item, "inkBox");
  }
  renderProbeMark();
}

function renderQiRegion(item) {
  if (item.box) {
    renderEllipseBox(item, "qiRegion");
    return;
  }

  const points = pathPoints(item.path);
  if (!points.length) return;

  const region = regionFromPoints(points, {
    minWidth: 4.4,
    minHeight: 15,
    padX: 1.1,
    padY: 2.4,
  });
  let offsetX = -4.4;
  let offsetY = 7.8;
  const scale = 0.6;
  if (item.id === "qi_2" || item.label === "形断势连") {
    offsetX += region.width * scale * 5;
    offsetY -= region.height * scale * 0.25;
  }
  const ellipse = svg("ellipse", {
    cx: percentXToPixel(clamp(region.cx + offsetX, 0, 100)),
    cy: percentYToPixel(clamp(region.cy + offsetY, 0, 100)),
    rx: percentXToPixel((region.width / 2) * scale),
    ry: percentYToPixel((region.height / 2) * scale),
    class: "annotationShape qiRegion",
    tabindex: "0",
  });
  els.overlay.append(ellipse);
}

function renderEllipseBox(item, className) {
  const cx = item.box.x + item.box.width / 2;
  const cy = item.box.y + item.box.height / 2;
  const ellipse = svg("ellipse", {
    cx: percentXToPixel(cx),
    cy: percentYToPixel(cy),
    rx: percentXToPixel(item.box.width / 2),
    ry: percentYToPixel(item.box.height / 2),
    class: `annotationShape ${className}`,
    tabindex: "0",
  });
  els.overlay.append(ellipse);
}

function renderBox(item, className) {
  if (!item.box) return;
  const rect = svg("rect", {
    x: percentXToPixel(item.box.x),
    y: percentYToPixel(item.box.y),
    width: percentXToPixel(item.box.width),
    height: percentYToPixel(item.box.height),
    rx: 6,
    class: `annotationShape ${className}`,
    tabindex: "0",
  });
  els.overlay.append(rect);
}

function renderDetail() {
  const item = selectedAnnotation();
  if (!item) {
    const detail = modeMeta[state.mode]?.detail || modeMeta.original.detail;
    showEmptyDetail(detail[0], detail[1]);
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
  if (!state.introComplete) return;
  state.selectedId = id;
  const item = selectedAnnotation();
  if (item) {
    state.layer = typeMeta[item.type]?.recommendedLayer || "original";
  }
  renderAll();
  // 切换观察点后，滚动反思区到顶部
  els.reflectionInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setMode(mode) {
  if (!state.introComplete) return;
  const nextMode = modeMeta[mode] ? mode : "original";
  const config = modeMeta[nextMode];
  state.mode = nextMode;
  state.layer = config.layer;
  state.filter = config.filter;
  const matching = config.filter === "all" ? null : annotations().find((item) => item.type === config.filter);
  state.selectedId = matching?.id || null;
  renderAll();
  renderFilterButtons();
}

function clearSelection() {
  state.selectedId = null;
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  state.probe = null;
  renderAll();
  renderFilterButtons();
}

function stepSelection(delta) {
  const items = visibleAnnotations();
  if (!items.length) return;
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === state.selectedId));
  const nextIndex = (currentIndex + delta + items.length) % items.length;
  selectItem(items[nextIndex].id);
}

function setFilter(filter) {
  if (!state.introComplete) return;
  state.filter = filter;
  state.mode = "original";
  const selected = selectedAnnotation();
  if (selected && filter !== "all" && selected.type !== filter) {
    state.selectedId = null;
  }
  renderAll();
  renderFilterButtons();
}

function renderFilterButtons() {
  document.querySelectorAll(".filterButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function setLayout(layout) {
  state.layout = layout === "landscape" ? "landscape" : "portrait";
  localStorage.setItem("callilens-layout", state.layout);
  renderLayout();
  // 延迟 50ms 重新计算覆盖图层的大小和坐标，防止网格重排延迟导致偏移
  setTimeout(positionOverlay, 50);
}

function setStepButtonsDisabled(disabled) {
  els.prev.disabled = disabled;
  els.next.disabled = disabled;
}

function positionOverlay() {
  const imageRect = els.image.getBoundingClientRect();
  const shellRect = els.image.parentElement.getBoundingClientRect();
  if (els.image.naturalWidth && els.image.naturalHeight) {
    els.overlay.setAttribute("viewBox", `0 0 ${els.image.naturalWidth} ${els.image.naturalHeight}`);
  }
  els.overlay.style.left = `${imageRect.left - shellRect.left}px`;
  els.overlay.style.top = `${imageRect.top - shellRect.top}px`;
  els.overlay.style.width = `${imageRect.width}px`;
  els.overlay.style.height = `${imageRect.height}px`;
}

function loadAnalysisCanvases() {
  const images = state.data?.images || {};
  ["original", "binary", "skeleton", "strokeWidth", "inkDensity", "voidCandidates"].forEach((layer) => {
    const filename = images[layer];
    if (!filename) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      state.layerCanvases[layer] = { canvas, context };
    };
    image.onerror = () => {
      console.warn(`无法加载探针图层: ${layer}`);
    };
    image.src = imageBase() + filename;
  });
}

function handleImageClick(event) {
  if (!state.introComplete) return;
  if (!state.data || !els.image.naturalWidth || !els.image.naturalHeight) return;
  const imageRect = els.image.getBoundingClientRect();
  if (
    event.clientX < imageRect.left ||
    event.clientX > imageRect.right ||
    event.clientY < imageRect.top ||
    event.clientY > imageRect.bottom
  ) {
    return;
  }

  const percentX = ((event.clientX - imageRect.left) / imageRect.width) * 100;
  const percentY = ((event.clientY - imageRect.top) / imageRect.height) * 100;
  const pixelX = Math.round((percentX / 100) * els.image.naturalWidth);
  const pixelY = Math.round((percentY / 100) * els.image.naturalHeight);
  state.probe = analyzeProbe(pixelX, pixelY, percentX, percentY);
  renderOverlay();
  renderProbePanel();
}

function analyzeProbe(pixelX, pixelY, percentX, percentY) {
  const original = state.layerCanvases.original;
  const width = original?.canvas.width || els.image.naturalWidth;
  const height = original?.canvas.height || els.image.naturalHeight;
  const base = Math.min(width, height);
  const sampleWidth = clamp(Math.round(base * 0.08), 42, 120);
  const sampleHeight = clamp(Math.round(base * 0.34), 150, 360);
  const x = clamp(Math.round(pixelX - sampleWidth / 2), 0, Math.max(0, width - sampleWidth));
  const y = clamp(Math.round(pixelY - sampleHeight / 2), 0, Math.max(0, height - sampleHeight));
  const sample = { x, y, width: sampleWidth, height: sampleHeight };

  const inkRatio = measureInkRatio(sample);
  const voidRatio = 1 - inkRatio;
  const strokeVariation = measureColorVariation("strokeWidth", sample);
  const inkContrast = measureContrast(sample);
  const voidCue = measureVoidCue(sample);
  const skeletonCue = measureSkeletonCue(sample);
  const candidate = makeCandidateText({ inkRatio, voidRatio, strokeVariation, inkContrast, voidCue, skeletonCue });

  return {
    percentX,
    percentY,
    box: {
      x: (x / width) * 100,
      y: (y / height) * 100,
      width: (sampleWidth / width) * 100,
      height: (sampleHeight / height) * 100,
    },
    sample,
    inkRatio,
    voidRatio,
    strokeVariation,
    inkContrast,
    voidCue,
    skeletonCue,
    candidate,
  };
}

function measureInkRatio(sample) {
  const binary = state.layerCanvases.binary;
  if (binary) {
    return samplePixels(binary.context, sample, (r, g, b) => luminance(r, g, b) < 150);
  }
  const original = state.layerCanvases.original;
  if (!original) return 0;
  return samplePixels(original.context, sample, (r, g, b) => luminance(r, g, b) < 185);
}

function measureVoidCue(sample) {
  const layer = state.layerCanvases.voidCandidates;
  if (!layer) return 0;
  return samplePixels(layer.context, sample, (r, g, b) => g > r * 1.12 && g > b * 1.12 && g > 90);
}

function measureSkeletonCue(sample) {
  const layer = state.layerCanvases.skeleton;
  if (!layer) return 0;
  return samplePixels(layer.context, sample, (r, g, b) => luminance(r, g, b) < 120);
}

function measureColorVariation(layerName, sample) {
  const layer = state.layerCanvases[layerName] || state.layerCanvases.original;
  if (!layer) return 0;
  const data = layer.context.getImageData(sample.x, sample.y, sample.width, sample.height).data;
  const values = [];
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 238 && g > 238 && b > 238) continue;
    values.push(Math.max(r, g, b) - Math.min(r, g, b));
  }
  return normalizedStdDev(values);
}

function measureContrast(sample) {
  const layer = state.layerCanvases.inkDensity || state.layerCanvases.original;
  if (!layer) return 0;
  const data = layer.context.getImageData(sample.x, sample.y, sample.width, sample.height).data;
  const values = [];
  for (let i = 0; i < data.length; i += 16) {
    values.push(luminance(data[i], data[i + 1], data[i + 2]));
  }
  return normalizedStdDev(values);
}

function samplePixels(context, sample, predicate) {
  const data = context.getImageData(sample.x, sample.y, sample.width, sample.height).data;
  let hits = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 16) {
    total += 1;
    if (predicate(data[i], data[i + 1], data[i + 2])) hits += 1;
  }
  return total ? hits / total : 0;
}

function normalizedStdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return clamp(Math.sqrt(variance) / 95, 0, 1);
}

function makeCandidateText(metrics) {
  const parts = [];
  if (metrics.inkRatio > 0.24 && metrics.voidCue > 0.08) {
    parts.push("可能适合作为“虚实 / 疏密平衡”观察候选：附近墨迹较密，同时辅助图提示有明显空白参与结构。");
  }
  if (metrics.inkRatio > 0.08 && metrics.inkRatio < 0.34 && metrics.strokeVariation > 0.18) {
    parts.push("可能适合作为“笔墨轻重”观察候选：局部粗细热力变化较明显，可继续对照原作判断。");
  }
  if (metrics.skeletonCue > 0.025 && metrics.inkRatio > 0.06) {
    parts.push("可能适合作为“气脉”观察候选：骨架或墨迹线索较集中，可以观察上下左右是否存在方向承接。");
  }
  if (metrics.inkContrast > 0.2) {
    parts.push("这里存在一定墨色或明暗变化，可以辅助观察枯润、轻重和节奏。");
  }
  if (!parts.length) {
    parts.push("这里暂时只显示基础证据。它不一定是典型标注点，可以换到墨迹边缘、列间空白或粗细变化明显的位置再试。");
  }
  return parts.join(" ");
}

function renderProbeMark() {
  if (!state.probe) return;
  const { box, percentX, percentY } = state.probe;
  const rect = svg("rect", {
    x: percentXToPixel(box.x),
    y: percentYToPixel(box.y),
    width: percentXToPixel(box.width),
    height: percentYToPixel(box.height),
    rx: 6,
    class: "probeBox",
  });
  const hLine = svg("line", {
    x1: percentXToPixel(Math.max(0, percentX - 4.2)),
    y1: percentYToPixel(percentY),
    x2: percentXToPixel(Math.min(100, percentX + 4.2)),
    y2: percentYToPixel(percentY),
    class: "probeCross",
  });
  const vLine = svg("line", {
    x1: percentXToPixel(percentX),
    y1: percentYToPixel(Math.max(0, percentY - 9)),
    x2: percentXToPixel(percentX),
    y2: percentYToPixel(Math.min(100, percentY + 9)),
    class: "probeCross",
  });
  els.overlay.append(rect, hLine, vLine);
}

function renderProbePanel() {
  const probe = state.probe;
  if (!probe) {
    els.probeTitle.textContent = "点击图像任意位置";
    els.probeSummary.textContent = "按书法竖列取样，只给候选线索。";
    els.inkMetric.textContent = "--";
    els.voidMetric.textContent = "--";
    els.strokeMetric.textContent = "--";
    els.densityMetric.textContent = "--";
    els.probeCandidate.textContent = "尚未选择局部。";
    return;
  }
  els.probeTitle.textContent = `局部 ${Math.round(probe.percentX)}%, ${Math.round(probe.percentY)}%`;
  els.probeSummary.textContent = "竖向取样结果，请结合原作判断。";
  els.inkMetric.textContent = formatPercent(probe.inkRatio);
  els.voidMetric.textContent = formatPercent(probe.voidRatio);
  els.strokeMetric.textContent = scoreLabel(probe.strokeVariation);
  els.densityMetric.textContent = scoreLabel(probe.inkContrast);
  els.probeCandidate.textContent = probe.candidate;
}

function insertReflection(text) {
  const saved = state.reflections[state.selectedId];
  if (saved?.submitted) return; // 已提交则不允许插入
  const current = els.reflectionInput.value.trim();
  els.reflectionInput.value = current ? `${current}\n${text}` : text;
  els.reflectionInput.focus();
}

function setReflectionTask(task) {
  const saved = state.reflections[state.selectedId];
  if (saved?.submitted) return; // 已提交则不允许切换任务
  const prompt = reflectionTasks[task] || reflectionTasks.motion;
  els.reflectionInput.placeholder = prompt;
  if (!els.reflectionInput.value.trim()) {
    els.reflectionInput.value = `${prompt}\n`;
  }
  document.querySelectorAll(".taskButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.task === task);
  });
  els.reflectionInput.focus();
}

function renderReflectionPanel() {
  const item = selectedAnnotation();
  const saved = item ? (state.reflections[item.id] || {}) : {};
  const hasReflection = item?.reflection;

  // 根据当前观察点的类型自动选择并锁定对应任务（气脉对应运动感，虚实对应空白，笔墨对应证据）
  const typeToTask = {
    qi_flow: "motion",
    void_solid: "space",
    brush_ink: "evidence",
  };

  if (item && typeToTask[item.type]) {
    const activeTask = typeToTask[item.type];
    document.querySelectorAll(".taskButton").forEach((button) => {
      button.classList.toggle("active", button.dataset.task === activeTask);
      button.style.pointerEvents = "none"; // 锁定以指向特定任务
      button.style.opacity = "0.75";
    });
    const prompt = reflectionTasks[activeTask];
    els.reflectionInput.placeholder = prompt;
  } else {
    // 恢复全局或自由选择模式
    document.querySelectorAll(".taskButton").forEach((button) => {
      button.style.pointerEvents = "auto";
      button.style.opacity = "1";
    });
  }

  // 显示/隐藏观察点专属提示
  if (hasReflection && item) {
    els.reflectionPrompt.hidden = false;
    els.reflectionConcept.textContent = item.reflection.concept;
    els.reflectionConcept.className = `reflectionConceptTag ${item.type}`;
    els.reflectionPromptText.textContent = item.reflection.prompt;
  } else {
    els.reflectionPrompt.hidden = true;
  }

  // 恢复该观察点已保存的笔记
  els.reflectionInput.value = saved.text || "";
  els.reflectionInput.disabled = !!saved.submitted;

  // 提交/编辑按钮状态
  els.reflectionSubmit.hidden = !!saved.submitted;
  els.reflectionEdit.hidden = !saved.submitted;

  // 专家反馈区
  if (saved.submitted && hasReflection) {
    els.expertFeedbackPanel.hidden = false;
    els.feedbackUserText.textContent = saved.text || "（未填写）";
    els.feedbackExpertText.textContent = item.reflection.expertFeedback;
  } else {
    els.expertFeedbackPanel.hidden = true;
  }
}

function submitReflection() {
  const item = selectedAnnotation();
  if (!item) return;
  const text = els.reflectionInput.value.trim();
  if (!text) {
    els.reflectionInput.focus();
    els.reflectionInput.placeholder = "请先写下你的理解，再提交。";
    return;
  }
  // 保存到 state
  state.reflections[item.id] = { text, submitted: true };
  saveReflections();
  
  // 重新渲染反思面板，揭示专家结论
  renderReflectionPanel();
  
  // 滚动到反馈区
  requestAnimationFrame(() => els.expertFeedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}

function editReflection() {
  const item = selectedAnnotation();
  if (!item) return;
  if (state.reflections[item.id]) {
    state.reflections[item.id].submitted = false;
  }
  saveReflections();
  
  // 编辑时重新隐藏对照区
  renderReflectionPanel();
  
  requestAnimationFrame(() => els.reflectionInput.focus());
}

function readReflections() {
  try {
    return JSON.parse(localStorage.getItem(reflectionsStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function saveReflections() {
  localStorage.setItem(reflectionsStorageKey(), JSON.stringify(state.reflections));
}

function readFirstLook() {
  try {
    const stored = JSON.parse(localStorage.getItem(firstLookStorageKey()) || "{}");
    return {
      overall: stored.overall || "",
      motion: stored.motion || "",
      density: stored.density || "",
    };
  } catch {
    return { overall: "", motion: "", density: "" };
  }
}

function collectFirstLook() {
  return {
    overall: els.firstOverall.value.trim(),
    motion: els.firstMotion.value.trim(),
    density: els.firstDensity.value.trim(),
  };
}

function collectFirstLookSummary() {
  return {
    overall: els.summaryOverallInput.value.trim(),
    motion: els.summaryMotionInput.value.trim(),
    density: els.summaryDensityInput.value.trim(),
  };
}

function firstLookComplete(firstLook) {
  return ["overall", "motion", "density"].every((key) => firstLook[key]?.trim());
}

function handleFirstLookSubmit(event) {
  event.preventDefault();
  const firstLook = collectFirstLook();
  if (!firstLookComplete(firstLook)) {
    els.firstLookError.hidden = false;
    return;
  }
  state.firstLook = firstLook;
  state.introComplete = true;
  localStorage.setItem(firstLookStorageKey(), JSON.stringify(firstLook));
  els.firstLookError.hidden = true;
  renderAll();
  renderFilterButtons();
}

function editFirstLook() {
  if (!state.editingFirstLook) {
    state.editingFirstLook = true;
    els.summaryEditError.hidden = true;
    renderFirstLook();
    requestAnimationFrame(() => els.summaryOverallInput.focus());
    return;
  }

  const firstLook = collectFirstLookSummary();
  if (!firstLookComplete(firstLook)) {
    els.summaryEditError.hidden = false;
    return;
  }

  state.firstLook = firstLook;
  state.editingFirstLook = false;
  localStorage.setItem(firstLookStorageKey(), JSON.stringify(firstLook));
  els.summaryEditError.hidden = true;
  renderFirstLook();
}

function returnToFirstLook() {
  if (state.editingFirstLook) {
    state.firstLook = collectFirstLookSummary();
    localStorage.setItem(firstLookStorageKey(), JSON.stringify(state.firstLook));
  }
  state.editingFirstLook = false;
  state.introComplete = false;
  state.selectedId = null;
  state.probe = null;
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  els.firstLookError.hidden = true;
  els.summaryEditError.hidden = true;
  renderAll();
  renderFilterButtons();
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => els.firstOverall.focus());
}

function whereText(item) {
  const hintByType = {
    qi_flow: "看左侧虚线圈出的观察区域：它不是笔顺还原，也不是自动判定气脉，只提示这里适合观察上下承接。",
    void_solid: "看左侧虚线框出的留白区域：重点是空白如何参与结构和节奏。",
    brush_ink: "看左侧虚线框出的笔墨区域：它提示粗细、浓淡或视觉重量。",
  };
  if (hintByType[item.type]) return hintByType[item.type];
  if (item.type === "qi_flow") return "看左侧虚线圈出的观察区域：它不是笔顺还原，而是人工确认的观看趋势。";
  if (item.type === "void_solid") return "看左侧被轻微罩出的绿色窄带：重点是空白如何参与结构和节奏。";
  if (item.type === "brush_ink") return "看左侧被点亮的笔墨区域：它提示粗细、浓淡或视觉重量。";
  return "看左侧当前高亮位置。";
}

function summarize(text) {
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function scoreLabel(value) {
  if (value > 0.32) return "明显";
  if (value > 0.16) return "中等";
  if (value > 0.06) return "轻微";
  return "较弱";
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function naturalWidth() {
  return els.image.naturalWidth || state.layerCanvases.original?.canvas.width || 100;
}

function naturalHeight() {
  return els.image.naturalHeight || state.layerCanvases.original?.canvas.height || 100;
}

function percentXToPixel(value) {
  return (value / 100) * naturalWidth();
}

function percentYToPixel(value) {
  return (value / 100) * naturalHeight();
}

function pathPoints(path) {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  const points = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

function regionFromPoints(points, options = {}) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(options.minWidth || 0, maxX - minX + (options.padX || 0) * 2);
  const height = Math.max(options.minHeight || 0, maxY - minY + (options.padY || 0) * 2);

  return {
    cx: clamp((minX + maxX) / 2, width / 2, 100 - width / 2),
    cy: clamp((minY + maxY) / 2, height / 2, 100 - height / 2),
    width,
    height,
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

document.querySelectorAll(".modeButton").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll(".layoutButton").forEach((button) => {
  button.addEventListener("click", () => setLayout(button.dataset.layout));
});

els.storedWorks.addEventListener("click", () => {
  state.screen = "stored";
  renderEntry();
  requestAnimationFrame(() => els.storedWorksPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.uploadEntry.addEventListener("click", () => {
  state.screen = "upload";
  renderEntry();
  requestAnimationFrame(() => els.uploadPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.browseFromUpload.addEventListener("click", () => {
  state.screen = "stored";
  renderEntry();
  requestAnimationFrame(() => els.storedWorksPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.firstLookForm.addEventListener("submit", handleFirstLookSubmit);
els.editFirstLook.addEventListener("click", editFirstLook);
els.returnFirstLook.addEventListener("click", returnToFirstLook);
[els.firstOverall, els.firstMotion, els.firstDensity].forEach((input) => {
  input.addEventListener("input", () => {
    els.firstLookError.hidden = true;
  });
});
[els.summaryOverallInput, els.summaryMotionInput, els.summaryDensityInput].forEach((input) => {
  input.addEventListener("input", () => {
    els.summaryEditError.hidden = true;
  });
});
els.clear.addEventListener("click", clearSelection);
els.speak.addEventListener("click", speakGuide);
els.prev.addEventListener("click", () => stepSelection(-1));
els.next.addEventListener("click", () => stepSelection(1));
els.canvasShell.addEventListener("click", handleImageClick);
document.querySelectorAll(".reflectionChip").forEach((button) => {
  button.addEventListener("click", () => insertReflection(button.dataset.text));
});
document.querySelectorAll(".taskButton").forEach((button) => {
  button.addEventListener("click", () => setReflectionTask(button.dataset.task));
});
els.reflectionSubmit.addEventListener("click", submitReflection);
els.reflectionEdit.addEventListener("click", editReflection);
els.reflectionInput.addEventListener("input", () => {
  const item = selectedAnnotation();
  if (item && state.reflections[item.id] && !state.reflections[item.id].submitted) {
    state.reflections[item.id].text = els.reflectionInput.value;
  }
});
window.addEventListener("resize", positionOverlay);

boot();
