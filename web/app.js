const params = new URLSearchParams(window.location.search);
let activeWorkId = params.get("work") || "";
const initialSelectId = params.get("select");
const initialProbe = params.get("probe");
const initialView = params.get("view");
const WORKS_URL = "../data/works.json";
const THREE_MODULE_URL = "./vendor/three.module.js";
const spacePalette = {
  qi_flow: 0xc6a05b,
  void_solid: 0x70a08d,
  brush_ink: 0xd07a63,
  selected: 0xf2eadf,
};

const typeMeta = {
  qi_flow: { name: "气脉", markClass: "qiRegion", recommendedLayer: "original" },
  void_solid: { name: "虚实", markClass: "voidBox", recommendedLayer: "original" },
  brush_ink: { name: "笔墨", markClass: "inkBox", recommendedLayer: "original" },
};

const modeMeta = {
  original: {
    layer: "original",
    filter: "all",
    detail: ["先看原作整体", "先判断哪里有运动感，哪里疏朗或紧密，再进入证据图层。"],
  },
  qi: {
    layer: "skeleton",
    filter: "qi_flow",
    detail: ["气脉模式", "骨架图层只帮助观察方向和承接，虚线圈仍以人工标注为准。"],
  },
  solid: {
    layer: "binary",
    filter: "void_solid",
    detail: ["墨迹模式", "黑白图层把墨迹从背景中分离出来，适合观察密集程度和结构重心。"],
  },
  void: {
    layer: "voidCandidates",
    filter: "void_solid",
    detail: ["留白模式", "留白候选图层帮助定位字间、列间和题名旁的空间。"],
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
  space: {
    layer: "original",
    filter: "all",
    detail: ["三维气韵空间", "把原作、虚实和笔势拉进同一层空间里看，作为辅助观察，不替代二维证据。"],
  },
};

const reflectionTasks = {
  motion: "任务：指出一处你觉得最有运动感的位置，并说明是方向、距离还是转折让你这样判断。",
  space: "任务：指出一块参与结构的空白，并说明它如何影响疏密、停顿或呼吸感。",
  evidence: "任务：用“形式证据 -> 观看感受 -> 审美概念”的顺序解释一个观察点。",
};

const state = {
  screen: "home",
  worksIndex: null,
  layer: "original",
  mode: "original",
  filter: "all",
  selectedId: null,
  data: null,
  probe: null,
  layerCanvases: {},
  layout: "landscape",
  firstLook: readFirstLook(),
  introComplete: false,
  editingFirstLook: false,
  reflections: readReflections(),
  space: {
    ready: false,
    sceneReady: false,
    importing: false,
    failed: false,
    THREE: null,
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    plane: null,
    annotationsGroup: null,
    particles: null,
    texture: null,
    renderKey: "",
    running: false,
    targetRotationX: -0.26,
    targetRotationY: 0.22,
    pointer: { active: false, x: 0, y: 0, rotX: -0.26, rotY: 0.22 },
  },
};

state.introComplete = firstLookComplete(state.firstLook);

const els = {
  entryScreen: document.querySelector("#entryScreen"),
  uploadEntry: document.querySelector("#uploadEntryButton"),
  storedWorks: document.querySelector("#storedWorksButton"),
  backHomeFromLibrary: document.querySelector("#backHomeFromLibraryButton"),
  storedWorksPanel: document.querySelector("#storedWorksPanel"),
  storedWorksList: document.querySelector("#storedWorksList"),
  uploadPanel: document.querySelector("#uploadPanel"),
  backHomeFromUpload: document.querySelector("#backHomeFromUploadButton"),
  browseFromUpload: document.querySelector("#browseFromUploadButton"),
  backToLibrary: document.querySelector("#backToLibraryButton"),
  app: document.querySelector(".app"),
  title: document.querySelector("#workTitle"),
  image: document.querySelector("#workImage"),
  fallback: document.querySelector("#imageFallback"),
  overlay: document.querySelector("#overlay"),
  spaceCanvas: document.querySelector("#spaceCanvas"),
  spaceLabel: document.querySelector("#spaceLabel"),
  guideList: document.querySelector("#guideList"),
  detailType: document.querySelector("#detailType"),
  annotationTitle: document.querySelector("#annotationTitle"),
  where: document.querySelector("#whereText"),
  formal: document.querySelector("#formalText"),
  perception: document.querySelector("#perceptionText"),
  aesthetic: document.querySelector("#aestheticText"),
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
    const shouldOpenDemo = initialView === "demo" || Boolean(params.get("work")) || Boolean(initialSelectId) || Boolean(initialProbe);
    if (shouldOpenDemo) {
      await openWork(activeWorkId || state.worksIndex?.defaultWorkId || "work_003", { updateUrl: false });
      return;
    }
    renderEntry();
    handleEntryScroll();
  } catch (error) {
    console.error(error);
    if (els.fallback) els.fallback.hidden = false;
    showEmptyDetail("数据加载失败", error.message);
  }
}

async function loadWorksIndex() {
  const response = await fetch(WORKS_URL);
  if (!response.ok) throw new Error(`无法加载 ${WORKS_URL}: ${response.status}`);
  state.worksIndex = await response.json();
  if (!activeWorkId) activeWorkId = state.worksIndex.defaultWorkId || "work_003";
}

function setScreen(screen, options = {}) {
  state.screen = screen;
  renderEntry();
  if (options.updateUrl !== false && screen !== "demo") {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("work");
    nextUrl.searchParams.delete("view");
    nextUrl.searchParams.delete("select");
    nextUrl.searchParams.delete("probe");
    window.history.pushState({}, "", nextUrl);
  }
}

function renderEntry() {
  renderWorkCards();
  document.body.dataset.screen = state.screen;
  els.entryScreen.dataset.screen = state.screen;
  els.entryScreen.classList.toggle("scrolled", state.screen === "home" && window.scrollY > 12);
  els.entryScreen.hidden = state.screen === "demo";
  els.app.hidden = state.screen !== "demo";
  els.storedWorksPanel.hidden = state.screen !== "library";
  els.uploadPanel.hidden = state.screen !== "upload";
}

function renderWorkCards() {
  if (!els.storedWorksList) return;
  const works = (state.worksIndex?.works || []).filter((work) => work.id === "work_003" && work.status === "ready");
  els.storedWorksList.replaceChildren();
  works.forEach((work) => {
    const card = document.createElement("article");
    card.className = "workCard ready";

    const image = document.createElement("img");
    image.alt = work.title;
    image.src = `../data/${work.id}/${work.thumbnail || "original.png"}`;

    const body = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "可导览";
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
    button.textContent = "进入观察";
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
  state.space.renderKey = "";
  state.space.sceneReady = false;
  state.firstLook = readFirstLook();
  state.introComplete = firstLookComplete(state.firstLook);
  state.editingFirstLook = false;
  state.reflections = readReflections();
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
  renderSpaceScene();
  renderDetail();
  renderProbePanel();
  renderReflectionPanel();
  renderFilterButtons();
}

function renderLayout() {
  els.app.dataset.layout = "landscape";
  els.app.dataset.mode = state.mode;
  els.app.dataset.hasSelection = state.selectedId ? "true" : "false";
  els.app.dataset.introComplete = state.introComplete ? "true" : "false";
  els.canvasShell.dataset.view = state.mode === "space" && state.space.sceneReady ? "space" : "image";
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
  };
  document.querySelectorAll(".modeButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  syncCanvasVisibility();
}

function syncCanvasVisibility() {
  const useSpace = state.mode === "space" && state.space.sceneReady;
  if (els.spaceCanvas) els.spaceCanvas.hidden = !useSpace;
  if (els.spaceLabel) els.spaceLabel.hidden = !useSpace;
  if (els.image) els.image.hidden = false;
  if (els.overlay) els.overlay.hidden = false;
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

    const number = document.createElement("span");
    number.className = "guideNumber";
    number.textContent = String(index + 1).padStart(2, "0");

    const content = document.createElement("span");
    content.className = "guideCardText";
    const title = document.createElement("strong");
    title.textContent = item.label;
    const summary = document.createElement("span");
    summary.textContent = summarize(item.formal);
    content.append(title, summary);

    button.append(number, content);
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
    rx: 8,
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
  if (!els.detailType) return;
  els.detailType.textContent = "导览说明";
  els.annotationTitle.textContent = title;
  els.where.textContent = message;
  els.formal.textContent = "先观察作品整体，再逐个打开观察点。";
  els.perception.textContent = "这样可以避免一开始就被标注压住，保留自己的第一印象。";
  els.aesthetic.textContent = "CalliLens 的目标是辅助鉴赏，不是自动判断书法好坏。";
}

function selectItem(id) {
  if (!state.introComplete) return;
  state.selectedId = id;
  const item = selectedAnnotation();
  if (item) state.layer = typeMeta[item.type]?.recommendedLayer || "original";
  renderAll();
}

function setMode(mode) {
  if (!state.introComplete) return;
  const nextMode = modeMeta[mode] ? mode : "original";
  state.mode = nextMode;
  if (nextMode === "space") {
    state.layer = "original";
  } else {
    const config = modeMeta[nextMode];
    state.layer = config.layer;
    state.filter = config.filter;
    const matching = config.filter === "all" ? null : annotations().find((item) => item.type === config.filter);
    state.selectedId = matching?.id || null;
  }
  renderAll();
}

function clearSelection() {
  state.selectedId = null;
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  state.probe = null;
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
  if (!state.introComplete) return;
  state.filter = filter;
  state.mode = "original";
  const selected = selectedAnnotation();
  if (selected && filter !== "all" && selected.type !== filter) state.selectedId = null;
  renderAll();
}

function renderFilterButtons() {
  document.querySelectorAll(".filterButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function clearThreeGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    clearThreeObject(child);
  }
}

function clearThreeObject(object) {
  if (!object) return;
  if (object.geometry) object.geometry.dispose?.();
  if (object.material) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material?.map) material.map.dispose?.();
      material?.dispose?.();
    });
  }
  if (object.children?.length) {
    while (object.children.length) {
      clearThreeObject(object.children.pop());
    }
  }
}

function renderSpaceScene() {
  if (state.mode !== "space") {
    state.space.running = false;
    syncCanvasVisibility();
    return;
  }
  ensureSpaceScene();
  if (!state.space.ready || !state.space.renderer || !state.space.scene || !state.space.camera) return;

  updateSpaceSceneContent();
  syncCanvasVisibility();
  const width = els.spaceCanvas.clientWidth || els.canvasShell.clientWidth || 1;
  const height = els.spaceCanvas.clientHeight || els.canvasShell.clientHeight || 1;
  state.space.renderer.setSize(width, height, false);
  state.space.camera.aspect = width / height;
  state.space.camera.updateProjectionMatrix();
  if (!state.space.running) {
    state.space.running = true;
    requestAnimationFrame(animateSpaceScene);
  }
  state.space.root.rotation.x += (state.space.targetRotationX - state.space.root.rotation.x) * 0.04;
  state.space.root.rotation.y += (state.space.targetRotationY - state.space.root.rotation.y) * 0.04;
  state.space.renderer.render(state.space.scene, state.space.camera);
}

function ensureSpaceScene() {
  if (state.space.ready || state.space.importing || state.space.failed) return;
  state.space.importing = true;
  import(THREE_MODULE_URL)
    .then((module) => {
      state.space.THREE = module;
      initSpaceScene(module);
      state.space.ready = true;
      state.space.importing = false;
      syncCanvasVisibility();
      renderSpaceScene();
    })
    .catch((error) => {
      console.error("Three.js load failed", error);
      state.space.importing = false;
      state.space.failed = true;
      syncCanvasVisibility();
    });
}

function initSpaceScene(THREE) {
  if (!els.spaceCanvas) return;
  const width = els.spaceCanvas.clientWidth || els.canvasShell.clientWidth || 1;
  const height = els.spaceCanvas.clientHeight || els.canvasShell.clientHeight || 1;

  const renderer = new THREE.WebGLRenderer({
    canvas: els.spaceCanvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e0d0b, 0.055);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 0.22, 7.4);

  const root = new THREE.Group();
  root.position.y = 0.08;
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xf7ead6, 1.05);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffe0b6, 2.1);
  key.position.set(3.5, 5.5, 8);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x86b5c7, 1.25);
  rim.position.set(-5, 3, -3);
  scene.add(rim);

  const fill = new THREE.PointLight(0xe9cfa9, 0.9, 20);
  fill.position.set(0, 1.4, 5.2);
  scene.add(fill);

  root.add(createSpaceField(THREE));

  const annotationsGroup = new THREE.Group();
  root.add(annotationsGroup);

  state.space.renderer = renderer;
  state.space.scene = scene;
  state.space.camera = camera;
  state.space.root = root;
  state.space.plane = null;
  state.space.particles = null;
  state.space.annotationsGroup = annotationsGroup;
  state.space.renderKey = "";
  state.space.sceneReady = true;
  state.space.running = true;

  els.canvasShell.addEventListener("pointerdown", handleSpacePointerDown);
  window.addEventListener("pointermove", handleSpacePointerMove, { passive: true });
  window.addEventListener("pointerup", handleSpacePointerUp, { passive: true });
  animateSpaceScene();
}

function createSpaceField(THREE) {
  const group = new THREE.Group();
  const backPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 4.7, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x18140f,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  backPlate.position.z = -0.36;
  group.add(backPlate);

  const guideMaterial = new THREE.LineBasicMaterial({
    color: 0xd8c5a4,
    transparent: true,
    opacity: 0.23,
  });
  for (let i = 0; i <= 5; i += 1) {
    const y = -2.1 + i * 0.84;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.55, y, -0.1),
      new THREE.Vector3(4.55, y, -0.1),
    ]);
    group.add(new THREE.Line(geometry, guideMaterial.clone()));
  }
  for (let i = 0; i <= 8; i += 1) {
    const x = -4.2 + i * 1.05;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -2.18, -0.08),
      new THREE.Vector3(x, 2.18, -0.08),
    ]);
    const line = new THREE.Line(geometry, guideMaterial.clone());
    line.material.opacity = i % 2 === 0 ? 0.17 : 0.1;
    group.add(line);
  }

  const baseline = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.65, 0, 0.02),
    new THREE.Vector3(4.65, 0, 0.02),
  ]);
  group.add(
    new THREE.Line(
      baseline,
      new THREE.LineBasicMaterial({ color: 0xa33a2c, transparent: true, opacity: 0.38 })
    )
  );
  return group;
}

function updateSpacePlane(THREE) {
  void THREE;
  return true;
}

function annotationVector(item, point, planeWidth, planeHeight, depthBias, THREE, index = 0, sourceData = null) {
  void item;
  void sourceData;
  const x = (point.x / 100 - 0.5) * planeWidth;
  const y = (0.5 - point.y / 100) * planeHeight;
  let z = depthBias + Math.sin((index + 1) * 0.62) * 0.045;
  return new THREE.Vector3(x, y, z);
}

function annotationCenter(item) {
  if (item.box) {
    return {
      x: item.box.x + item.box.width / 2,
      y: item.box.y + item.box.height / 2,
    };
  }
  const points = pathPoints(item.path || "");
  if (!points.length) return { x: 50, y: 50 };
  const sum = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function spaceDepth(type, index, selected) {
  const base = type === "qi_flow" ? 0.42 : type === "void_solid" ? 0.08 : 0.24;
  return base + (index % 5) * 0.055 + (selected ? 0.18 : 0);
}

function spaceOpacity(selected, muted) {
  if (selected) return 0.92;
  return muted ? 0.22 : 0.56;
}

function addSpaceQi(THREE, group, annotation, color, selected, muted, index) {
  const points = pathPoints(annotation.path || "");
  const sourcePoints = points.length >= 2 ? points : [annotationCenter(annotation), { x: annotationCenter(annotation).x, y: annotationCenter(annotation).y + 12 }];
  const depth = spaceDepth(annotation.type, index, selected);
  const vectors = sourcePoints.map((point, pointIndex) =>
    annotationVector(annotation, point, 9.2, 4.45, depth, THREE, pointIndex)
  );
  const curve = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.45);
  const opacity = spaceOpacity(selected, muted);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: selected ? 0.24 : 0.09,
    depthWrite: false,
  });
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: selected ? spacePalette.selected : color,
    emissive: selected ? spacePalette.selected : color,
    emissiveIntensity: selected ? 0.75 : 0.22,
    transparent: true,
    opacity,
    roughness: 0.58,
    metalness: 0.04,
  });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, selected ? 0.075 : 0.042, 10, false), lineMaterial));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, selected ? 0.14 : 0.09, 10, false), haloMaterial));

  const beadGeometry = new THREE.SphereGeometry(selected ? 0.072 : 0.045, 16, 10);
  for (let beadIndex = 0; beadIndex < 5; beadIndex += 1) {
    const beadMaterial = new THREE.MeshBasicMaterial({
      color: selected ? spacePalette.selected : color,
      transparent: true,
      opacity: selected ? 0.74 : 0.32,
      depthWrite: false,
    });
    const bead = new THREE.Mesh(beadGeometry, beadMaterial);
    bead.userData = {
      pulse: "qi",
      curve,
      phase: beadIndex / 5,
      speed: selected ? 0.115 : 0.072,
      baseScale: selected ? 1 : 0.72,
      baseOpacity: selected ? 0.82 : 0.36,
      muted,
    };
    bead.position.copy(curve.getPoint(bead.userData.phase));
    group.add(bead);
  }
}

function addSpaceVoid(THREE, group, annotation, color, selected, muted, index) {
  if (!annotation.box) return;
  const depth = spaceDepth(annotation.type, index, selected);
  const width = Math.max((annotation.box.width / 100) * 9.2, 0.12);
  const height = Math.max((annotation.box.height / 100) * 4.45, 0.16);
  const center = annotationCenter(annotation);
  const x = (center.x / 100 - 0.5) * 9.2;
  const y = (0.5 - center.y / 100) * 4.45;
  const panel = new THREE.Group();
  panel.position.set(x, y, depth);
  panel.userData = { pulse: "void", phase: index * 0.34, selected, muted };

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height, 1, 1),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: selected ? 0.34 : muted ? 0.1 : 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  panel.add(fill);

  const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-width / 2, -height / 2, 0.018),
    new THREE.Vector3(width / 2, -height / 2, 0.018),
    new THREE.Vector3(width / 2, height / 2, 0.018),
    new THREE.Vector3(-width / 2, height / 2, 0.018),
    new THREE.Vector3(-width / 2, -height / 2, 0.018),
  ]);
  panel.add(
    new THREE.Line(
      outlineGeometry,
      new THREE.LineBasicMaterial({
        color: selected ? spacePalette.selected : color,
        transparent: true,
        opacity: selected ? 0.9 : muted ? 0.18 : 0.45,
      })
    )
  );
  group.add(panel);
}

function addSpaceInk(THREE, group, annotation, color, selected, muted, index) {
  const center = annotationCenter(annotation);
  const depth = spaceDepth(annotation.type, index, selected);
  const x = (center.x / 100 - 0.5) * 9.2;
  const y = (0.5 - center.y / 100) * 4.45;
  const local = new THREE.Group();
  local.position.set(x, y, depth);
  local.userData = { pulse: "ink", phase: index * 0.27, selected, muted };

  const opacity = spaceOpacity(selected, muted);
  const material = new THREE.MeshStandardMaterial({
    color: selected ? spacePalette.selected : color,
    emissive: color,
    emissiveIntensity: selected ? 0.4 : 0.12,
    transparent: true,
    opacity,
    roughness: 0.7,
    metalness: 0.04,
  });
  const width = annotation.box ? Math.max((annotation.box.width / 100) * 9.2, 0.18) : 0.72;
  for (let i = 0; i < 5; i += 1) {
    const height = (selected ? 0.46 : 0.28) + Math.sin(i * 1.7 + index) * 0.08;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, height, 16), material.clone());
    column.rotation.x = Math.PI / 2;
    column.position.set((i - 2) * (width / 4), 0, height / 2);
    local.add(column);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(width * 0.56, 0.26), selected ? 0.026 : 0.018, 8, 42),
    new THREE.MeshBasicMaterial({
      color: selected ? spacePalette.selected : color,
      transparent: true,
      opacity: selected ? 0.8 : muted ? 0.17 : 0.36,
      depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2;
  local.add(ring);
  group.add(local);
}

function updateSpaceSceneContent() {
  if (!state.space.THREE || !state.data) return;
  const THREE = state.space.THREE;
  const item = selectedAnnotation();
  const key = `${activeWorkId}:${state.mode}:${state.filter}:${state.selectedId || "none"}`;
  if (key === state.space.renderKey) return;
  state.space.renderKey = key;
  clearThreeGroup(state.space.annotationsGroup);
  state.space.sceneReady = updateSpacePlane(THREE) || state.space.sceneReady;

  const selectedColor = new THREE.Color(spacePalette.selected);
  const qiColor = new THREE.Color(spacePalette.qi_flow);
  const voidColor = new THREE.Color(spacePalette.void_solid);
  const inkColor = new THREE.Color(spacePalette.brush_ink);
  const items = visibleAnnotations();
  const hasSelection = Boolean(item);

  items.forEach((annotation, index) => {
    const color = annotation.type === "qi_flow" ? qiColor : annotation.type === "void_solid" ? voidColor : inkColor;
    const isSelected = item?.id === annotation.id;
    const muted = hasSelection && !isSelected;
    if (annotation.type === "qi_flow") addSpaceQi(THREE, state.space.annotationsGroup, annotation, color, isSelected, muted, index);
    if (annotation.type === "void_solid") addSpaceVoid(THREE, state.space.annotationsGroup, annotation, color, isSelected, muted, index);
    if (annotation.type === "brush_ink") addSpaceInk(THREE, state.space.annotationsGroup, annotation, color, isSelected, muted, index);
  });

  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(9.1, 0.11, 1, 1),
    new THREE.MeshBasicMaterial({ color: selectedColor, transparent: true, opacity: 0.055, depthWrite: false })
  );
  sweep.position.set(0, 0.92, 0.02);
  sweep.userData = { pulse: "sweep", phase: 0 };
  state.space.annotationsGroup.add(sweep);
  state.space.annotationsGroup.rotation.x = -0.08;
  state.space.annotationsGroup.rotation.y = 0.12;
  state.space.annotationsGroup.rotation.z = 0.03;
}

function animateSpaceScene() {
  if (!state.space.running || !state.space.renderer || !state.space.scene || !state.space.camera) return;
  if (state.mode === "space") {
    const time = performance.now() / 1000;
    state.space.root.rotation.x += (state.space.targetRotationX - state.space.root.rotation.x) * 0.03;
    state.space.root.rotation.y += (state.space.targetRotationY - state.space.root.rotation.y) * 0.03;
    if (state.space.annotationsGroup) {
      state.space.annotationsGroup.traverse((object) => {
        const pulse = object.userData?.pulse;
        if (pulse === "qi" && object.userData.curve) {
          const t = (object.userData.phase + time * object.userData.speed) % 1;
          object.position.copy(object.userData.curve.getPoint(t));
          const glow = 0.58 + Math.sin((t + object.userData.phase) * Math.PI * 2) * 0.28;
          object.scale.setScalar(object.userData.baseScale * (0.8 + glow * 0.35));
          if (object.material) object.material.opacity = object.userData.muted ? 0.12 : object.userData.baseOpacity * glow;
        }
        if (pulse === "void") {
          const breath = 1 + Math.sin(time * 1.2 + object.userData.phase) * (object.userData.selected ? 0.025 : 0.012);
          object.scale.set(breath, breath, 1);
        }
        if (pulse === "ink") {
          object.position.z += (spaceDepth("brush_ink", 0, object.userData.selected) - object.position.z) * 0.02;
          object.rotation.z = Math.sin(time * 0.8 + object.userData.phase) * 0.025;
        }
        if (pulse === "sweep") {
          object.position.y = 1.3 - ((time * 0.34) % 1) * 2.6;
        }
      });
    }
    state.space.renderer.render(state.space.scene, state.space.camera);
  }
  if (state.space.running) requestAnimationFrame(animateSpaceScene);
}

function handleSpacePointerDown(event) {
  if (state.mode !== "space" || !state.space.ready) return;
  state.space.pointer.active = true;
  els.canvasShell.setPointerCapture?.(event.pointerId);
}

function handleSpacePointerMove(event) {
  if (state.mode !== "space" || !state.space.ready || !state.space.pointer.active) return;
  const rect = els.canvasShell.getBoundingClientRect();
  const dx = (event.clientX - rect.left) / rect.width - 0.5;
  const dy = (event.clientY - rect.top) / rect.height - 0.5;
  state.space.targetRotationY = 0.22 + dx * 0.9;
  state.space.targetRotationX = -0.26 + dy * 0.6;
}

function handleSpacePointerUp() {
  state.space.pointer.active = false;
  state.space.targetRotationX = clamp(state.space.targetRotationX, -0.7, 0.15);
  state.space.targetRotationY = clamp(state.space.targetRotationY, -0.9, 0.9);
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
      applyInitialProbe();
      renderSpaceScene();
    };
    image.src = imageBase() + filename;
  });
}

function handleImageClick(event) {
  if (!state.introComplete) return;
  if (!state.data || !els.image.naturalWidth || !els.image.naturalHeight) return;
  const imageRect = els.image.getBoundingClientRect();
  if (event.clientX < imageRect.left || event.clientX > imageRect.right || event.clientY < imageRect.top || event.clientY > imageRect.bottom) return;

  const percentX = ((event.clientX - imageRect.left) / imageRect.width) * 100;
  const percentY = ((event.clientY - imageRect.top) / imageRect.height) * 100;
  const pixelX = Math.round((percentX / 100) * els.image.naturalWidth);
  const pixelY = Math.round((percentY / 100) * els.image.naturalHeight);
  state.probe = analyzeProbe(pixelX, pixelY, percentX, percentY);
  renderOverlay();
  renderProbePanel();
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

function analyzeProbe(pixelX, pixelY, percentX, percentY) {
  const width = els.image.naturalWidth || state.layerCanvases.original?.canvas.width || 100;
  const height = els.image.naturalHeight || state.layerCanvases.original?.canvas.height || 100;
  const shortSide = Math.min(width, height);
  const sampleWidth = Math.min(width, Math.round(clamp(shortSide * 0.1, 56, 160)));
  const sampleHeight = Math.min(height, Math.round(clamp(shortSide * 0.28, 120, 320)));
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
  if (binary) return samplePixels(binary.context, sample, (r, g, b) => luminance(r, g, b) < 150);
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
  for (let i = 0; i < data.length; i += 16) values.push(luminance(data[i], data[i + 1], data[i + 2]));
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
    parts.push("可能适合作为“虚实 / 疏密平衡”观察候选：附近墨迹较密，同时辅助图层提示有明显空白参与结构。");
  }
  if (metrics.inkRatio > 0.08 && metrics.inkRatio < 0.34 && metrics.strokeVariation > 0.18) {
    parts.push("可能适合作为“笔墨轻重”观察候选：局部粗细或色彩变化较明显，可继续对照原作判断。");
  }
  if (metrics.skeletonCue > 0.025 && metrics.inkRatio > 0.06) {
    parts.push("可能适合作为“气脉”观察候选：骨架或墨迹线索较集中，可观察上下是否存在方向承接。");
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
    x1: percentXToPixel(Math.max(0, percentX - 2.8)),
    y1: percentYToPixel(percentY),
    x2: percentXToPixel(Math.min(100, percentX + 2.8)),
    y2: percentYToPixel(percentY),
    class: "probeCross",
  });
  const vLine = svg("line", {
    x1: percentXToPixel(percentX),
    y1: percentYToPixel(Math.max(0, percentY - 7)),
    x2: percentXToPixel(percentX),
    y2: percentYToPixel(Math.min(100, percentY + 7)),
    class: "probeCross",
  });
  els.overlay.append(rect, hLine, vLine);
}

function renderProbePanel() {
  const probe = state.probe;
  if (!probe) {
    els.probeTitle.textContent = "点击图像任意位置";
    els.probeSummary.textContent = "按书法竖列取样，只给出候选线索。";
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

function reflectionKey() {
  return selectedAnnotation()?.id || "free_reflection";
}

function insertReflection(text) {
  const key = reflectionKey();
  const saved = state.reflections[key];
  if (saved?.submitted) return;
  const current = els.reflectionInput.value.trim();
  els.reflectionInput.value = current ? `${current}\n${text}` : text;
  state.reflections[key] = { text: els.reflectionInput.value, submitted: false };
  saveReflections();
  els.reflectionInput.focus();
}

function setReflectionTask(task) {
  const item = selectedAnnotation();
  const key = reflectionKey();
  if (state.reflections[key]?.submitted) return;
  const prompt = reflectionTasks[task] || reflectionTasks.motion;
  els.reflectionInput.placeholder = prompt;
  if (!els.reflectionInput.value.trim()) els.reflectionInput.value = `${prompt}\n`;
  document.querySelectorAll(".taskButton").forEach((button) => {
    button.classList.toggle("active", button.dataset.task === task);
  });
  state.reflections[key] = { text: els.reflectionInput.value, submitted: false };
  saveReflections();
  els.reflectionInput.focus();
}

function renderReflectionPanel() {
  const item = selectedAnnotation();
  const key = reflectionKey();
  const saved = state.reflections[key] || {};
  const hasReflection = item?.reflection;

  const typeToTask = {
    qi_flow: "motion",
    void_solid: "space",
    brush_ink: "evidence",
  };
  document.querySelectorAll(".taskButton").forEach((button) => {
    const lockedTask = item ? typeToTask[item.type] : null;
    button.classList.toggle("active", lockedTask ? button.dataset.task === lockedTask : button.dataset.task === "motion");
    button.disabled = Boolean(saved.submitted);
  });

  if (hasReflection && item) {
    els.reflectionPrompt.hidden = false;
    els.reflectionConcept.textContent = item.reflection.concept;
    els.reflectionConcept.className = `reflectionConceptTag ${item.type}`;
    els.reflectionPromptText.textContent = item.reflection.prompt;
  } else {
    els.reflectionPrompt.hidden = true;
  }

  els.reflectionInput.value = saved.text || "";
  els.reflectionInput.disabled = Boolean(saved.submitted);
  els.reflectionInput.placeholder = item ? reflectionTasks[typeToTask[item.type] || "motion"] : "可以先写自由观察，也可以选择一个观察点后再修改。";
  els.reflectionSubmit.hidden = Boolean(saved.submitted);
  els.reflectionSubmit.disabled = false;
  els.reflectionEdit.hidden = !saved.submitted;

  if (saved.submitted && hasReflection) {
    els.expertFeedbackPanel.hidden = false;
    els.feedbackUserText.textContent = saved.text || "（未填写）";
    els.feedbackExpertText.textContent = item.reflection.expertFeedback;
  } else if (saved.submitted && item) {
    els.expertFeedbackPanel.hidden = false;
    els.feedbackUserText.textContent = saved.text || "（未填写）";
    els.feedbackExpertText.textContent = item.aesthetic || "请继续对照形式证据和自己的观看感受。";
  } else if (saved.submitted) {
    els.expertFeedbackPanel.hidden = false;
    els.feedbackUserText.textContent = saved.text || "（未填写）";
    els.feedbackExpertText.textContent = "已收到你的自由反思。下一步可以选择一个观察点，再把这段感受和具体形式证据对照起来。";
  } else {
    els.expertFeedbackPanel.hidden = true;
  }
}

function submitReflection() {
  const key = reflectionKey();
  const text = els.reflectionInput.value.trim();
  if (!text) {
    els.reflectionInput.focus();
    els.reflectionInput.placeholder = "请先写下你的理解，再提交。";
    return;
  }
  state.reflections[key] = { text, submitted: true };
  saveReflections();
  renderReflectionPanel();
  requestAnimationFrame(() => els.expertFeedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}

function editReflection() {
  const key = reflectionKey();
  if (state.reflections[key]) state.reflections[key].submitted = false;
  saveReflections();
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
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => els.firstOverall.focus());
}

function returnHome() {
  setScreen("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToLibrary() {
  setScreen("library");
  requestAnimationFrame(() => els.storedWorksPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function whereText(item) {
  const hintByType = {
    qi_flow: "看作品上虚线圈出的纵向区域：它不是笔顺还原，也不是自动判定气脉，只提示这里适合观察上下承接。",
    void_solid: "看作品上虚线框出的留白区域：重点是空白如何参与结构、停顿和疏密节奏。",
    brush_ink: "看作品上虚线框出的笔墨区域：它提示粗细、浓淡或视觉重量。",
  };
  return hintByType[item.type] || "看作品上当前高亮位置。";
}

function summarize(text = "") {
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
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
  for (let i = 0; i < numbers.length - 1; i += 2) points.push({ x: numbers[i], y: numbers[i + 1] });
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

function svg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function handleEntryScroll() {
  if (state.screen !== "home") return;
  els.entryScreen.classList.toggle("scrolled", window.scrollY > 12);
}

function handleViewportResize() {
  positionOverlay();
  renderSpaceScene();
}

document.querySelectorAll(".filterButton").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll(".modeButton").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

els.storedWorks.addEventListener("click", () => {
  setScreen("library");
  requestAnimationFrame(() => els.storedWorksPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.backHomeFromLibrary.addEventListener("click", returnHome);

els.uploadEntry.addEventListener("click", () => {
  setScreen("upload");
  requestAnimationFrame(() => els.uploadPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.backHomeFromUpload.addEventListener("click", returnHome);

els.browseFromUpload.addEventListener("click", () => {
  setScreen("library");
  requestAnimationFrame(() => els.storedWorksPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.firstLookForm.addEventListener("submit", handleFirstLookSubmit);
els.editFirstLook.addEventListener("click", editFirstLook);
els.backToLibrary.addEventListener("click", returnToLibrary);
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
  const key = reflectionKey();
  if (!state.reflections[key]) state.reflections[key] = { text: "", submitted: false };
  if (!state.reflections[key].submitted) {
    state.reflections[key].text = els.reflectionInput.value;
    saveReflections();
  }
});
window.addEventListener("resize", handleViewportResize);
window.addEventListener("scroll", handleEntryScroll, { passive: true });

boot();
