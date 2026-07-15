const initialRoute = readRoute();
let activeWorkId = initialRoute.workId || "";
const WORKS_URL = "../data/works.json";
const AUTH_TOKEN_KEY = "callilens-auth-token";
const API_BASE =
  window.CALLILENS_API_BASE ||
  (["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port && window.location.port !== "8000"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : `${window.location.protocol}//${window.location.host}`);
const THREE_MODULE_URL = "./vendor/three.module.js";
const GLYPHS_MANIFEST = "glyphs/glyphs.json";
const FULL_SCROLL_DATA = "full_scroll_3d_data.json";
const FULL_SCROLL_IMAGE_BATCH_SIZE = 32;
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
    detail: ["整卷 3D 浮雕", "把全卷候选墨迹合成为平滑高度图，重墨更突出，飞白和细线更低；这不是笔顺恢复，也不是书法水平评分。"],
  },
};

const reflectionTasks = {
  motion: "任务：指出一处你觉得最有运动感的位置，并说明是方向、距离还是转折让你这样判断。",
  space: "任务：指出一块参与结构的空白，并说明它如何影响疏密、停顿或呼吸感。",
  evidence: "任务：用“形式证据 -> 观看感受 -> 审美概念”的顺序解释一个观察点。",
};

const inkverseLiteSteps = {
  original: {
    title: "Original：回到原作",
    text: "先看整幅长卷，不急着进入特效。注意哪里有运动感、哪里疏朗或紧密。",
    mode: "original",
  },
  ink: {
    title: "Enter the Ink：进入墨迹",
    text: "进入当前平滑浮雕 3D。系统把可见墨迹深浅转成高度：重墨更突出，飞白和细线更低。",
    mode: "space",
  },
  qi: {
    title: "Follow the Qi：追随气脉",
    text: "切换到气脉观察。这里用人工标注和骨架线索提示“形断势连”，不是自动判断书法气韵。",
    mode: "qi",
  },
  return: {
    title: "Return：回到原作反思",
    text: "回到静态原作。请选择一个反思标签，或在右侧“我的反思”里写下你重新注意到的地方。",
    mode: "original",
  },
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
    fullScrollAsset: null,
    fullScrollLoading: false,
    fullScrollFailed: false,
    fullScrollPlane: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    fullRotationX: 0,
    fullRotationY: 0,
    renderKey: "",
    pendingProbe: "",
    running: false,
    targetRotationX: -0.26,
    targetRotationY: 0.22,
    pointer: { active: false, mode: "pan", x: 0, y: 0, panX: 0, panY: 0, rotX: 0, rotY: 0 },
  },
  glyphs: [],
  fullScrollRecords: [],
  selectedGlyphId: null,
  glyphAssets: {},
  inkverseLite: {
    active: false,
    step: "original",
  },
  ragUseAi: false,
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) || "",
  user: null,
  authMode: "login",
  userRecordsOpen: false,
  manualAnnotations: [],
  manualAnnotationDraft: null,
  manualAnnotationObjectUrl: "",
};

const els = {
  entryScreen: document.querySelector("#entryScreen"),
  entryReveal: document.querySelector(".entryReveal"),
  entryUserCard: document.querySelector("#entryUserCard"),
  uploadEntry: document.querySelector("#uploadEntryButton"),
  storedWorks: document.querySelector("#storedWorksButton"),
  storedWorksHint: document.querySelector("#storedWorksHint"),
  backHomeFromLibrary: document.querySelector("#backHomeFromLibraryButton"),
  storedWorksPanel: document.querySelector("#storedWorksPanel"),
  storedWorksList: document.querySelector("#storedWorksList"),
  uploadPanel: document.querySelector("#uploadPanel"),
  backHomeFromUpload: document.querySelector("#backHomeFromUploadButton"),
  browseFromUpload: document.querySelector("#browseFromUploadButton"),
  userAuthForm: document.querySelector("#userAuthForm"),
  userAuthTitle: document.querySelector("#userAuthTitle"),
  userAuthSubtitle: document.querySelector("#userAuthSubtitle"),
  userUsername: document.querySelector("#userUsername"),
  userPassword: document.querySelector("#userPassword"),
  userStatusText: document.querySelector("#userStatusText"),
  userLogin: document.querySelector("#userLoginButton"),
  userRegister: document.querySelector("#userRegisterButton"),
  userLogout: document.querySelector("#userLogoutButton"),
  userBadge: document.querySelector("#userBadgeButton"),
  userBadgeName: document.querySelector("#userBadgeName"),
  userBadgeId: document.querySelector("#userBadgeId"),
  userRecordsPanel: document.querySelector("#userRecordsPanel"),
  userRecordsClose: document.querySelector("#userRecordsCloseButton"),
  userRecordsList: document.querySelector("#userRecordsList"),
  userRecordsMeta: document.querySelector("#userRecordsMeta"),
  userLogoutPanel: document.querySelector("#userLogoutPanelButton"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLoginError: document.querySelector("#adminLoginError"),
  adminWorkspace: document.querySelector("#adminWorkspace"),
  adminTabs: document.querySelectorAll(".adminTabButton[data-admin-tab]"),
  adminPanes: document.querySelectorAll(".adminPane[data-admin-pane]"),
  adminLogout: document.querySelector("#adminLogoutButton"),
  adminRefreshWorks: document.querySelector("#adminRefreshWorksButton"),
  adminWorksList: document.querySelector("#adminWorksList"),
  adminRefreshRecords: document.querySelector("#adminRefreshRecordsButton"),
  adminRecordsList: document.querySelector("#adminRecordsList"),
  adminGenerateQuestions: document.querySelector("#adminGenerateQuestionsButton"),
  adminQuestionDraftResult: document.querySelector("#adminQuestionDraftResult"),
  adminGenerateAppreciation: document.querySelector("#adminGenerateAppreciationButton"),
  adminAppreciationDraftResult: document.querySelector("#adminAppreciationDraftResult"),
  manualAnnotationEditor: document.querySelector("#manualAnnotationEditor"),
  manualAnnotationStage: document.querySelector("#manualAnnotationStage"),
  manualAnnotationImage: document.querySelector("#manualAnnotationImage"),
  manualAnnotationOverlay: document.querySelector("#manualAnnotationOverlay"),
  manualAnnotationType: document.querySelector("#manualAnnotationType"),
  manualAnnotationClear: document.querySelector("#manualAnnotationClearButton"),
  manualAnnotationList: document.querySelector("#manualAnnotationList"),
  llmForm: document.querySelector("#llmForm"),
  llmStatus: document.querySelector("#llmStatus"),
  llmTest: document.querySelector("#llmTestButton"),
  llmBindingsList: document.querySelector("#llmBindingsList"),
  uploadWorkForm: document.querySelector("#uploadWorkForm"),
  uploadResult: document.querySelector("#uploadResult"),
  backToLibrary: document.querySelector("#backToLibraryButton"),
  qiverseEntry: document.querySelector("#qiverseEntryButton"),
  app: document.querySelector(".app"),
  title: document.querySelector("#workTitle"),
  image: document.querySelector("#workImage"),
  fallback: document.querySelector("#imageFallback"),
  overlay: document.querySelector("#overlay"),
  spaceCanvas: document.querySelector("#spaceCanvas"),
  spaceLabel: document.querySelector("#spaceLabel"),
  spaceZoomControls: document.querySelector("#spaceZoomControls"),
  spacePanX: document.querySelector("#spacePanX"),
  spaceZoomIn: document.querySelector("#spaceZoomIn"),
  spaceZoomOut: document.querySelector("#spaceZoomOut"),
  spaceRotateLeft: document.querySelector("#spaceRotateLeft"),
  spaceRotateRight: document.querySelector("#spaceRotateRight"),
  spaceViewReset: document.querySelector("#spaceViewReset"),
  glyphPanel: document.querySelector("#glyphPanel"),
  glyphList: document.querySelector("#glyphList"),
  glyphTitle: document.querySelector("#glyphTitle"),
  glyphSummary: document.querySelector("#glyphSummary"),
  inkverseLiteButton: document.querySelector("#inkverseLiteButton"),
  inkverseLitePanel: document.querySelector("#inkverseLitePanel"),
  inkverseLiteClose: document.querySelector("#inkverseLiteClose"),
  inkverseLiteTitle: document.querySelector("#inkverseLiteTitle"),
  inkverseLiteText: document.querySelector("#inkverseLiteText"),
  inkverseLiteSteps: document.querySelector("#inkverseLitePanel .inkverseLiteSteps"),
  inkverseReflectionTags: document.querySelector("#inkverseLitePanel .inkverseReflectionTags"),
  guidePanelTitle: document.querySelector("#guidePanelTitle"),
  guidePanelNote: document.querySelector("#guidePanelNote"),
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
  ragQuickQuestions: document.querySelector("#ragQuickQuestions"),
  workDataQualityNotice: document.querySelector("#workDataQualityNotice"),
  ragQuestionInput: document.querySelector("#ragQuestionInput"),
  ragUseAiToggle: document.querySelector("#ragUseAiToggle"),
  ragModeNote: document.querySelector("#ragModeNote"),
  ragAskButton: document.querySelector("#ragAskButton"),
  ragAnswer: document.querySelector("#ragAnswer"),
  ragSources: document.querySelector("#ragSources"),
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

function glyphDataUrl() {
  return `${imageBase()}${GLYPHS_MANIFEST}`;
}

function fullScrollDataUrl() {
  return `${imageBase()}${FULL_SCROLL_DATA}`;
}

function glyphBase() {
  return `${imageBase()}glyphs/`;
}

function firstLookStorageKey() {
  return `callilens-first-look:${activeWorkId || "work_003"}`;
}

function reflectionsStorageKey() {
  return `callilens-reflections:${activeWorkId || "work_003"}`;
}

function readRoute() {
  const routeParams = new URLSearchParams(window.location.search);
  return {
    view: routeParams.get("view") || "",
    workId: routeParams.get("work") || "",
    selectId: routeParams.get("select") || "",
    probe: routeParams.get("probe") || "",
  };
}

function writeEntryRoute(screen, options = {}) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("work");
  nextUrl.searchParams.delete("select");
  nextUrl.searchParams.delete("probe");
  if (screen === "home") {
    nextUrl.searchParams.delete("view");
  } else {
    nextUrl.searchParams.set("view", screen);
  }
  if (nextUrl.href === window.location.href) return;
  const method = options.replaceUrl ? "replaceState" : "pushState";
  window.history[method]({ screen }, "", nextUrl);
}

function writeDemoRoute(workId, options = {}) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("work", workId);
  nextUrl.searchParams.set("view", "demo");
  nextUrl.searchParams.delete("select");
  nextUrl.searchParams.delete("probe");
  if (nextUrl.href === window.location.href) return;
  const method = options.replaceUrl ? "replaceState" : "pushState";
  window.history[method]({ screen: "demo", workId }, "", nextUrl);
}

async function boot() {
  try {
    await loadCurrentUser();
    await loadWorksIndex();
    const route = readRoute();
    const shouldOpenDemo = route.view === "demo" || Boolean(route.workId) || Boolean(route.selectId) || Boolean(route.probe);
    if (!state.user && (shouldOpenDemo || route.view === "library")) {
      setAuthMode("login", "请先登录后再进入书画库。");
      setScreen("home", { updateUrl: false });
      writeEntryRoute("home", { replaceUrl: true });
      return;
    }
    if (shouldOpenDemo) {
      await openWork(route.workId || activeWorkId || state.worksIndex?.defaultWorkId || "work_003", {
        updateUrl: false,
        selectId: route.selectId,
        probe: route.probe,
      });
      return;
    }
    if (route.view === "library" || route.view === "upload") {
      setScreen(route.view, { updateUrl: false });
      if (route.view === "upload") setAdminLoggedIn(localStorage.getItem("callilens-admin-logged-in") === "true");
      requestAnimationFrame(() => {
        const target = route.view === "library" ? els.storedWorksPanel : els.uploadPanel;
        target?.scrollIntoView({ block: "start" });
      });
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
  let response;
  try {
    response = await fetch(`${API_BASE}/api/works`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    response = await fetch(`${WORKS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`无法加载 ${WORKS_URL}: ${response.status}`);
  }
  state.worksIndex = await response.json();
  if (!activeWorkId) activeWorkId = state.worksIndex.defaultWorkId || "work_003";
}

function setScreen(screen, options = {}) {
  state.screen = screen;
  renderEntry();
  if (options.updateUrl !== false && screen !== "demo") {
    writeEntryRoute(screen, options);
  }
}

function renderEntry() {
  renderWorkCards();
  document.body.dataset.screen = state.screen;
  els.entryScreen.dataset.screen = state.screen;
  els.entryScreen.classList.toggle("scrolled", state.screen === "home" && window.scrollY > 12);
  els.entryReveal?.classList.toggle("authenticated", Boolean(state.user));
  els.entryScreen.hidden = state.screen === "demo";
  els.app.hidden = state.screen !== "demo";
  els.storedWorksPanel.hidden = state.screen !== "library";
  els.uploadPanel.hidden = state.screen !== "upload";
  if (els.storedWorks) els.storedWorks.hidden = !state.user;
  if (els.storedWorksHint) {
    els.storedWorksHint.textContent = state.user
      ? "进入当前样例作品，开始分层观察与反思任务。"
      : "请先登录；登录后可进入作品库并同步观察记录。";
  }
}

function renderWorkCards() {
  if (!els.storedWorksList) return;
  const works = (state.worksIndex?.works || []).filter((work) => work.status === "ready");
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
    meta.textContent = work.style || [work.dynasty, work.script_type, work.museum].filter(Boolean).join(" · ") || "书法作品";
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
  const routeSelectId = options.selectId || "";
  state.space.pendingProbe = options.probe || "";
  state.screen = "demo";
  state.layer = "original";
  state.mode = "original";
  state.filter = "all";
  state.selectedId = null;
  state.probe = null;
  state.data = null;
  state.layerCanvases = {};
  state.glyphs = [];
  state.fullScrollRecords = [];
  state.selectedGlyphId = null;
  state.glyphAssets = {};
  state.space.fullScrollAsset = null;
  state.space.fullScrollLoading = false;
  state.space.fullScrollFailed = false;
  state.space.fullScrollPlane = null;
  state.space.zoom = 1;
  state.space.panX = 0;
  state.space.panY = 0;
  state.space.fullRotationX = 0;
  state.space.fullRotationY = 0;
  state.space.renderKey = "";
  state.space.sceneReady = false;
  state.inkverseLite.active = false;
  state.inkverseLite.step = "original";
  state.firstLook = readFirstLook();
  state.introComplete = false;
  state.editingFirstLook = false;
  state.reflections = readReflections();
  renderEntry();
  startWorkSession();

  if (options.updateUrl !== false) {
    writeDemoRoute(activeWorkId, options);
  }

  const response = activeWorkId === "work_003" ? await fetch(dataUrl()) : null;
  if (response?.ok) {
    state.data = await response.json();
  } else {
    state.data = await loadGeneratedWorkData(workId);
  }
  if (routeSelectId && state.data.annotations?.some((item) => item.id === routeSelectId)) {
    state.selectedId = routeSelectId;
    const item = state.data.annotations.find((entry) => entry.id === routeSelectId);
    state.filter = item.type;
  }
  const workMeta = currentWorkMeta();
  els.title.textContent = workMeta?.title || state.data.title || "单作品书法导览";
  if (els.qiverseEntry) {
    els.qiverseEntry.href = `../qiverse/?work=${encodeURIComponent(activeWorkId)}`;
  }
  renderQuickQuestions(workMeta);
  await loadGlyphs();
  renderAll();
  loadAnalysisCanvases();
  applyInitialProbe();
}

function currentWorkMeta() {
  return (state.worksIndex?.works || []).find((work) => work.id === activeWorkId) || null;
}

function renderQuickQuestions(workMeta) {
  if (!els.ragQuickQuestions) return;
  els.ragQuickQuestions.replaceChildren();
  const missingFields = missingWorkQualityFields(workMeta);
  renderWorkQualityNotice(workMeta, missingFields);

  const work003Questions = [
    "赵孟頫是谁？",
    "《光福重建塔记》是什么？",
    "什么是飞白？",
    "这件作品是什么时候写的？",
    "这件作品现藏在哪里？",
    "这件作品的风格特点是什么？",
    "光福寺和重建塔有什么背景？",
    "什么是行书？",
    "什么是赵体？",
    "QiVerse 和 CalliLens 怎么结合？"
  ];

  const exampleQuestions = [
    "这件作品可以从哪些角度了解？",
    "作者和时代背景有什么信息？",
    "这件作品使用了什么书体？",
    "可以怎样观察墨色、飞白和留白？",
    "OpenCV 在这个项目里做了什么？",
    "RAG 为什么比直接问 AI 更可靠？",
    "如果资料不足，系统会怎么回答？",
    "QiVerse 和 CalliLens 怎么结合？"
  ];

  let questions = exampleQuestions;
  if (workMeta && Array.isArray(workMeta.quick_questions) && workMeta.quick_questions.length > 0) {
    questions = workMeta.quick_questions;
  } else if (workMeta?.id === "work_003") {
    questions = work003Questions;
  } else if (workMeta && missingFields.length) {
    questions = [
      "这件作品目前有哪些已上传资料？",
      "当前资料还缺哪些关键信息？",
      "可以怎样观察墨色、飞白和留白？",
      "OpenCV 如何生成 3D 浮雕数据？",
      "RAG 资料不足时会怎样回答？",
      "管理员应如何补充这件作品的知识库？",
    ];
  } else if (workMeta) {
    const title = workMeta.title ? `《${workMeta.title}》可以从哪些角度了解？` : "";
    const artist = workMeta.artist ? `${workMeta.artist}是谁？` : "";
    const scriptType = workMeta.script_type ? `什么是${workMeta.script_type}？` : "";
    questions = [title, artist, scriptType, ...exampleQuestions].filter(Boolean).slice(0, 8);
  }

  questions.forEach((q) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = q;
    els.ragQuickQuestions.appendChild(btn);
  });
}

function missingWorkQualityFields(workMeta) {
  if (!workMeta) return [];
  const missing = [];
  if (!String(workMeta.artist || "").trim()) missing.push("作者");
  if (!String(workMeta.dynasty || workMeta.date || "").trim()) missing.push("年代");
  const source = String(workMeta.source || "").trim();
  const genericSource = source.includes("管理员") || source.includes("上传");
  if (!String(workMeta.source_url || workMeta.museum || "").trim() && (!source || genericSource)) missing.push("资料来源");
  return missing;
}

function renderWorkQualityNotice(workMeta, missingFields = []) {
  if (!els.workDataQualityNotice) return;
  if (!workMeta || !missingFields.length) {
    els.workDataQualityNotice.hidden = true;
    els.workDataQualityNotice.textContent = "";
    return;
  }
  els.workDataQualityNotice.hidden = false;
  els.workDataQualityNotice.textContent = `资料不足：当前作品缺少${missingFields.join("、")}。本地 RAG 只能根据已上传资料回答，不能替你编造作者、年代、馆藏或来源。`;
}

async function loadGeneratedWorkData(workId) {
  const metaResponse = await fetch(`../data/${workId}/work-info.json`);
  if (!metaResponse.ok) throw new Error(`无法加载作品数据：${workId}`);
  const meta = await metaResponse.json();
  try {
    const manualResponse = await fetch(`../data/${workId}/annotation.json?t=${Date.now()}`, { cache: "no-store" });
    if (manualResponse.ok) {
      const manualGuide = await manualResponse.json();
      return {
        ...manualGuide,
        guideKind: manualGuide.guideKind || "admin_manual",
        annotations: Array.isArray(manualGuide.annotations) ? manualGuide.annotations : [],
      };
    }
  } catch {
    // Uploaded works can exist without manual annotations.
  }
  let aiGuide = null;
  try {
    const guideResponse = await fetch(`../data/${workId}/ai-guide-draft.json?t=${Date.now()}`, { cache: "no-store" });
    if (guideResponse.ok) aiGuide = await guideResponse.json();
  } catch {
    aiGuide = null;
  }
  const annotations = [];
  const guideText = aiGuide?.guideText
    ? `${aiGuide.warning || "AI 候选导览，需管理员确认。"}\n\n${aiGuide.guideText}`
    : meta.description ||
      "这是管理员上传作品。系统只展示原图、基础图层、平滑浮雕 3D 和 RAG 资料；未人工标注的作品不会自动生成专家导览点。";
  return {
    workId,
    title: meta.title,
    style: meta.script_type || meta.style || "书法作品",
    source: meta.source || "管理员上传资料",
    images: {
      original: "original.png",
      binary: "binary.png",
      inkDensity: "ink_density.png",
      strokeWidth: "height.png",
      skeleton: "binary.png",
      voidCandidates: "binary.png",
    },
    guideText,
    guideKind: "none",
    annotations,
  };
}

async function loadGlyphs() {
  state.glyphs = [];
  state.fullScrollRecords = [];
  state.selectedGlyphId = null;
  try {
    const fullScrollResponse = await fetch(fullScrollDataUrl());
    if (fullScrollResponse.ok) {
      const records = await fullScrollResponse.json();
      state.fullScrollRecords = Array.isArray(records) ? records : [];
      state.glyphs = state.fullScrollRecords.map((record) => ({
        id: record.id,
        label: record.char || record.id,
        description: `全文长卷候选：scroll_x=${record.scroll_x}, scroll_y=${record.scroll_y}, ROI=${record.width}x${record.height}`,
        pixelBox: {
          x: record.scroll_x,
          y: record.scroll_y,
          width: record.width,
          height: record.height,
        },
      }));
      state.selectedGlyphId = state.glyphs[0]?.id || null;
      return;
    }

    const floatingResponse = await fetch(`${imageBase()}floating_3d_data.json?t=${Date.now()}`, { cache: "no-store" });
    if (floatingResponse.ok) {
      const floating = await floatingResponse.json();
      const scrollSize = floating.scroll_size || {};
      const width = Number(scrollSize.width) || 1200;
      const height = Number(scrollSize.height) || 800;
      const cacheBust = Date.now();
      const record = {
        id: `${activeWorkId}_relief`,
        source: "floating_relief",
        char: "全图",
        scroll_x: 0,
        scroll_y: 0,
        width,
        height,
        img_path: `data/${activeWorkId}/${floating.mask || "mask.png"}?t=${cacheBust}`,
        height_path: `data/${activeWorkId}/${floating.height || "height.png"}?t=${cacheBust}`,
      };
      state.fullScrollRecords = [record];
      state.glyphs = [
        {
          id: record.id,
          label: "全图浮雕",
          description: "上传作品已根据 OpenCV mask 和 height map 生成整图平滑浮雕。",
          pixelBox: { x: 0, y: 0, width, height },
        },
      ];
      state.selectedGlyphId = record.id;
      return;
    }

    const response = await fetch(glyphDataUrl());
    if (!response.ok) return;
    const manifest = await response.json();
    state.glyphs = manifest.glyphs || [];
    state.selectedGlyphId = state.glyphs[0]?.id || null;
  } catch (error) {
    console.warn("Glyph manifest unavailable", error);
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

function selectedGlyph() {
  return state.glyphs.find((item) => item.id === state.selectedGlyphId) || state.glyphs[0] || null;
}

function glyphForAnnotation(annotationId) {
  return state.glyphs.find((glyph) => glyph.annotationId === annotationId) || null;
}

function renderAll() {
  enforceIntroGate();
  renderLayout();
  renderFirstLook();
  renderImage();
  renderGuideList();
  renderOverlay();
  renderSpaceScene();
  renderGlyphPanel();
  renderDetail();
  renderProbePanel();
  renderReflectionPanel();
  renderFilterButtons();
  renderInkverseLitePanel();
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
  if (els.canvasShell) els.canvasShell.dataset.view = useSpace ? "space" : "image";
  if (els.spaceCanvas) els.spaceCanvas.hidden = !useSpace;
  if (els.spaceLabel) els.spaceLabel.hidden = !useSpace;
  if (els.spaceZoomControls) els.spaceZoomControls.hidden = !(useSpace && state.fullScrollRecords.length);
  if (els.image) els.image.hidden = false;
  if (els.overlay) els.overlay.hidden = false;
}

function renderGuideList() {
  renderGuidePanelHeader();
  const items = visibleAnnotations();
  els.guideList.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "emptyList";
    empty.textContent =
      guideKind() === "ai_candidate"
        ? "当前分类还没有 AI 候选观察点。"
        : guideKind() === "none"
          ? "该上传作品尚未保存人工框选导览点；可先查看全文导览、原图、3D 和 RAG。"
          : "当前分类还没有观察点。";
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

function guideKind() {
  if (activeWorkId === "work_003") return "manual";
  return state.data?.guideKind || "none";
}

function renderGuidePanelHeader() {
  const kind = guideKind();
  if (!els.guidePanelTitle || !els.guidePanelNote) return;
  if (kind === "manual") {
    els.guidePanelTitle.textContent = "人工精选导览";
    els.guidePanelNote.textContent = "用于默认作品，来自项目整理的人工观察点。";
    return;
  }
  if (kind === "admin_manual") {
    els.guidePanelTitle.textContent = "管理员人工标注导览";
    els.guidePanelNote.textContent = "用于上传作品；由管理员在后台框选并确认保存。";
    return;
  }
  if (kind === "ai_candidate") {
    els.guidePanelTitle.textContent = "AI 候选导览";
    els.guidePanelNote.textContent = "用于上传作品；由 OpenCV 候选区域和 AI 草稿生成，尚未人工确认。";
    return;
  }
  els.guidePanelTitle.textContent = "AI 候选导览";
  els.guidePanelNote.textContent = "该上传作品暂未生成候选导览，不会伪装成人工或专家标注。";
}

function renderGlyphPanel() {
  if (!els.glyphPanel || !els.glyphList) return;
  const active = state.mode === "space";
  els.glyphPanel.hidden = !active;
  if (!active) return;

  if (state.fullScrollRecords.length) {
    els.glyphPanel.hidden = true;
    els.glyphList.replaceChildren();
    return;
  }

  const glyph = selectedGlyph();
  els.glyphList.replaceChildren();
  if (!state.glyphs.length) {
    els.glyphTitle.textContent = "没有可用字形";
    els.glyphSummary.textContent = "请先运行 python scripts/extract_glyphs.py --work data/work_003 --auto-full-scroll-source data/source/Zmf_full.jpg 生成全文长卷数据。";
    return;
  }

  if (state.fullScrollRecords.length) {
    els.glyphTitle.textContent = `全文长卷 3D：${state.fullScrollRecords.length} 个候选`;
    const statusText = state.space.fullScrollFailed
      ? " 全文 3D 资源加载失败，请重新运行全卷提取脚本。"
      : state.space.fullScrollLoading
        ? " 正在合成全文长卷 3D 贴图。"
        : " 已切换为全文平铺，不再是单字切换。";
    els.glyphSummary.textContent = `从 full_scroll_3d_data.json 读取全卷坐标，把所有候选墨迹块合成为一张 3D 高度长卷。${statusText}`;
    const note = document.createElement("p");
    note.className = "fullScrollNote";
    note.textContent = "画布会渲染全部候选；使用画布右下角的 + / - 放大或缩小查看局部。";
    els.glyphList.append(note);
    return;
  } else {
    els.glyphTitle.textContent = glyph ? `3D字形：${glyph.label}` : "选择一个字形";
    const assetState = glyph ? state.glyphAssets[glyph.id] : null;
    const statusText = assetState?.failed ? " 字形资源加载失败，请重新运行提取脚本。" : assetState?.loading ? " 正在载入 3D 字形资源。" : "";
    els.glyphSummary.textContent = `${glyph?.description || "从人工框选区域中提取墨迹 mask、骨架和厚度图，再生成 3D 浮雕。"}${statusText}`;
  }

  state.glyphs.slice(0, state.fullScrollRecords.length ? 96 : state.glyphs.length).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "glyphButton";
    button.classList.toggle("active", item.id === state.selectedGlyphId);
    button.innerHTML = `<strong>${item.label}</strong><span>${item.id}</span>`;
    button.addEventListener("click", () => selectGlyph(item.id));
    els.glyphList.append(button);
  });
  if (state.fullScrollRecords.length > 96) {
    const more = document.createElement("p");
    more.textContent = `已载入 ${state.fullScrollRecords.length} 个候选，列表仅显示前 96 个；画布会渲染全部候选。`;
    els.glyphList.append(more);
  }
}

function selectGlyph(id) {
  if (!state.glyphs.some((glyph) => glyph.id === id)) return;
  state.selectedGlyphId = id;
  state.space.renderKey = "";
  renderAll();
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
    if (activeWorkId !== "work_003" && state.data?.guideText) {
      showEmptyDetail("全文导览", state.data.guideText);
      setStepButtonsDisabled(true);
      return;
    }
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
  const glyph = item ? glyphForAnnotation(item.id) : null;
  if (glyph) state.selectedGlyphId = glyph.id;
  renderAll();
}

function setMode(mode) {
  if (!state.introComplete) return;
  const nextMode = modeMeta[mode] ? mode : "original";
  state.mode = nextMode;
  if (state.inkverseLite.active) {
    const matchingStep = Object.entries(inkverseLiteSteps).find(([, config]) => config.mode === nextMode);
    if (matchingStep && state.inkverseLite.step !== "return") state.inkverseLite.step = matchingStep[0];
  }
  if (nextMode === "space") {
    state.layer = "original";
    state.filter = "all";
    if (!selectedGlyph()) state.selectedGlyphId = state.glyphs[0]?.id || null;
  } else {
    const config = modeMeta[nextMode];
    state.layer = config.layer;
    state.filter = config.filter;
    const matching = config.filter === "all" ? null : annotations().find((item) => item.type === config.filter);
    state.selectedId = matching?.id || null;
  }
  renderAll();
}

function applyModeFromInkverseStep(step) {
  const config = inkverseLiteSteps[step] || inkverseLiteSteps.original;
  const nextMode = config.mode;
  state.mode = nextMode;
  state.selectedId = null;
  if (nextMode === "space") {
    state.layer = "original";
    state.filter = "all";
  } else {
    const modeConfig = modeMeta[nextMode] || modeMeta.original;
    state.layer = modeConfig.layer;
    state.filter = modeConfig.filter;
    const matching = modeConfig.filter === "all" ? null : annotations().find((item) => item.type === modeConfig.filter);
    state.selectedId = matching?.id || null;
  }
}

function openInkverseLite() {
  if (!state.introComplete) {
    els.firstOverall?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  state.inkverseLite.active = true;
  state.inkverseLite.step = "original";
  applyModeFromInkverseStep("original");
  renderAll();
  requestAnimationFrame(() => els.inkverseLitePanel?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}

function closeInkverseLite() {
  state.inkverseLite.active = false;
  renderInkverseLitePanel();
}

function setInkverseLiteStep(step) {
  if (!inkverseLiteSteps[step]) return;
  if (!state.inkverseLite.active) state.inkverseLite.active = true;
  state.inkverseLite.step = step;
  applyModeFromInkverseStep(step);
  if (step === "return") {
    const key = reflectionKey();
    if (!state.reflections[key]?.submitted && !els.reflectionInput.value.trim()) {
      els.reflectionInput.value = "我从浮雕和气脉线索回到原作后，重新注意到：";
      state.reflections[key] = { text: els.reflectionInput.value, submitted: false };
      saveReflections();
    }
  }
  renderAll();
}

function renderInkverseLitePanel() {
  if (!els.inkverseLitePanel) return;
  els.inkverseLitePanel.hidden = !state.inkverseLite.active;
  els.inkverseLiteButton?.classList.toggle("active", state.inkverseLite.active);
  if (!state.inkverseLite.active) return;

  const step = state.inkverseLite.step;
  const config = inkverseLiteSteps[step] || inkverseLiteSteps.original;
  els.inkverseLiteTitle.textContent = config.title;
  els.inkverseLiteText.textContent = config.text;
  els.inkverseLiteSteps?.querySelectorAll(".inkverseStep").forEach((button) => {
    button.classList.toggle("active", button.dataset.inkverseStep === step);
  });
  els.inkverseReflectionTags.hidden = step !== "return";
}

function insertInkverseReflectionTag(text) {
  if (!text) return;
  const prefix = "InkVerse Lite 反思：";
  const current = els.reflectionInput.value.trim();
  const next = current ? `${current}\n${prefix}${text}` : `${prefix}${text}`;
  els.reflectionInput.value = next;
  state.reflections[reflectionKey()] = { text: next, submitted: false };
  saveReflections();
  renderReflectionPanel();
  requestAnimationFrame(() => els.reflectionInput.focus());
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
  const availableTypes = new Set(annotations().map((item) => item.type));
  document.querySelectorAll(".filterButton").forEach((button) => {
    const filter = button.dataset.filter;
    const available = filter === "all" || availableTypes.has(filter);
    button.disabled = !available;
    button.classList.toggle("active", filter === state.filter);
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
  if (state.fullScrollRecords.length) {
    state.space.root.rotation.x += ((state.space.fullRotationX || 0) - state.space.root.rotation.x) * 0.08;
    state.space.root.rotation.y += ((state.space.fullRotationY || 0) - state.space.root.rotation.y) * 0.08;
  } else {
    state.space.root.rotation.x += (state.space.targetRotationX - state.space.root.rotation.x) * 0.04;
    state.space.root.rotation.y += (state.space.targetRotationY - state.space.root.rotation.y) * 0.04;
  }
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e0d0b, 0.012);

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 320);
  camera.position.set(0, -18, 44);
  camera.lookAt(0, 0, 0);

  const root = new THREE.Group();
  root.position.y = 0.08;
  scene.add(root);

  scene.add(new THREE.HemisphereLight(0xfff2df, 0x2f2a22, 0.78));
  scene.add(new THREE.AmbientLight(0xf7ead6, 0.58));

  const key = new THREE.DirectionalLight(0xffdfad, 1.65);
  key.position.set(-4, -6, 34);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 48;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.00022;
  key.shadow.normalBias = 0.035;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xb6c3ba, 0.42);
  rim.position.set(7, 5, 12);
  scene.add(rim);

  const fill = new THREE.PointLight(0xe9cfa9, 1.35, 26);
  fill.position.set(0, 1.4, 7.2);
  scene.add(fill);

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
  applySpaceZoom();

  els.spaceCanvas.addEventListener("pointerdown", handleSpacePointerDown);
  window.addEventListener("pointermove", handleSpacePointerMove, { passive: true });
  window.addEventListener("pointerup", handleSpacePointerUp, { passive: true });
  els.spaceCanvas.addEventListener("wheel", handleSpaceWheel, { passive: false });
  els.spaceCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
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

function loadImageCanvas(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      resolve({ canvas, context });
    };
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function ensureGlyphAssets(glyph) {
  if (!glyph) return false;
  const cached = state.glyphAssets[glyph.id];
  if (cached?.ready) return true;
  if (cached?.loading) return false;

  state.glyphAssets[glyph.id] = { loading: true, ready: false };
  Promise.all([
    loadImageCanvas(glyphBase() + glyph.mask),
    loadImageCanvas(glyphBase() + glyph.height),
    glyph.skeleton ? loadImageCanvas(glyphBase() + glyph.skeleton) : Promise.resolve(null),
  ])
    .then(([mask, height, skeleton]) => {
      state.glyphAssets[glyph.id] = {
        loading: false,
        ready: true,
        mask,
        height,
        skeleton,
        texture: null,
      };
      state.space.renderKey = "";
      renderSpaceScene();
      renderGlyphPanel();
    })
    .catch((error) => {
      console.warn("Glyph asset load failed", error);
      state.glyphAssets[glyph.id] = { loading: false, ready: false, failed: true };
      renderGlyphPanel();
    });
  return false;
}

function makeSmoothedGlyphCanvas(sourceCanvas, blurPx) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `blur(${blurPx}px)`;
  context.drawImage(sourceCanvas, 0, 0);
  return { canvas, context, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}

function sampleGlyphImage(imageData, width, height, u, v, channel = 0) {
  const x = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
  const y = Math.max(0, Math.min(height - 1, Math.round(v * (height - 1))));
  return imageData.data[(y * width + x) * 4 + channel] / 255;
}

function applyGlyphHeight(geometry, maskField, displacementScale, displacementBias) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let index = 0; index < position.count; index += 1) {
    const alpha = sampleGlyphImage(maskField.imageData, maskField.canvas.width, maskField.canvas.height, uv.getX(index), uv.getY(index), 3);
    const relief = Math.pow(alpha, 1.12);
    position.setZ(index, displacementBias + relief * displacementScale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createGlyphMesh(THREE, glyph, assets) {
  const maskCanvas = assets.mask.canvas;
  const maskField = makeSmoothedGlyphCanvas(maskCanvas, 1.4);
  const aspect = maskCanvas.width / Math.max(1, maskCanvas.height);
  const planeHeight = 3.45;
  const planeWidth = clamp(planeHeight * aspect, 1.8, 5.4);
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 512, 512);
  applyGlyphHeight(geometry, maskField, 0.34, 0);

  if (assets.texture) assets.texture.dispose?.();
  const texture = new THREE.CanvasTexture(maskField.canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(state.space.renderer?.capabilities.getMaxAnisotropy?.() || 8, 8);
  texture.needsUpdate = true;
  assets.texture = texture;

  const material = new THREE.MeshStandardMaterial({
    color: 0x1a1a14,
    map: texture,
    transparent: true,
    alphaTest: 0.025,
    roughness: 0.5,
    metalness: 0.02,
    bumpMap: texture,
    bumpScale: 0.13,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pulse: "glyphMesh", glyphId: glyph.id };
  return { mesh, planeWidth, planeHeight };
}

function createGlyphTrace(THREE, glyph, planeWidth, planeHeight) {
  const points = glyph.tracePath?.length
    ? glyph.tracePath
    : [
        { x: 50, y: 8 },
        { x: 48, y: 34 },
        { x: 55, y: 64 },
        { x: 50, y: 92 },
      ];
  const vectors = points.map((point) => {
    const x = (point.x / 100 - 0.5) * planeWidth;
    const y = (0.5 - point.y / 100) * planeHeight;
    return new THREE.Vector3(x, y, 0.95);
  });
  const curve = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.45);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.018, 8, false),
      new THREE.MeshBasicMaterial({
        color: 0xf0d8a8,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    )
  );
  const bead = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0xfff1d6,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  bead.userData = { pulse: "glyphTrace", curve, speed: 0.135, phase: 0 };
  group.add(bead);
  return group;
}

function fullScrollAssetUrl(path) {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("../")) return path;
  return `../${path.replace(/\\/g, "/").replace(/^\//, "")}`;
}

function fullScrollSize(records) {
  if (records.length === 1 && records[0].source === "floating_relief") {
    return {
      width: Math.max(1, records[0].width || 1),
      height: Math.max(1, records[0].height || 1),
    };
  }
  const width = Math.max(18332, ...records.map((record) => record.scroll_x + record.width));
  const height = Math.max(2100, ...records.map((record) => record.scroll_y + record.height));
  return { width, height };
}

function makeSpaceCanvasTexture(THREE, canvas, color = false) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(state.space.renderer?.capabilities.getMaxAnisotropy?.() || 8, 8);
  texture.needsUpdate = true;
  return texture;
}

async function buildFullScrollAsset(THREE) {
  const records = state.fullScrollRecords;
  const rendererLimit = state.space.renderer?.capabilities?.maxTextureSize || 4096;
  const scrollSize = fullScrollSize(records);
  const atlasWidth = Math.min(8192, Math.max(2048, rendererLimit));
  const atlasScale = atlasWidth / scrollSize.width;
  const atlasHeight = Math.max(256, Math.round(scrollSize.height * atlasScale));

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = atlasWidth;
  colorCanvas.height = atlasHeight;
  const colorContext = colorCanvas.getContext("2d");
  colorContext.fillStyle = "#ead8b3";
  colorContext.fillRect(0, 0, atlasWidth, atlasHeight);
  colorContext.globalAlpha = 0.18;
  colorContext.fillStyle = "#f7edcf";
  for (let y = 0; y < atlasHeight; y += 7) colorContext.fillRect(0, y, atlasWidth, 1);
  colorContext.globalAlpha = 1;

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = atlasWidth;
  heightCanvas.height = atlasHeight;
  const heightContext = heightCanvas.getContext("2d");
  heightContext.fillStyle = "#000";
  heightContext.fillRect(0, 0, atlasWidth, atlasHeight);

  for (let start = 0; start < records.length; start += FULL_SCROLL_IMAGE_BATCH_SIZE) {
    const batch = records.slice(start, start + FULL_SCROLL_IMAGE_BATCH_SIZE);
    await Promise.all(
      batch.map(async (record) => {
        const [mask, height] = await Promise.all([
          loadImageCanvas(fullScrollAssetUrl(record.img_path)),
          loadImageCanvas(fullScrollAssetUrl(record.height_path || record.img_path)),
        ]);
        const x = Math.round(record.scroll_x * atlasScale);
        const y = Math.round(record.scroll_y * atlasScale);
        const width = Math.max(1, Math.round(record.width * atlasScale));
        const itemHeight = Math.max(1, Math.round(record.height * atlasScale));
        colorContext.drawImage(mask.canvas, x, y, width, itemHeight);
        const heightPatch = document.createElement("canvas");
        heightPatch.width = width;
        heightPatch.height = itemHeight;
        const patchContext = heightPatch.getContext("2d");
        patchContext.imageSmoothingEnabled = true;
        patchContext.imageSmoothingQuality = "high";
        patchContext.fillStyle = "#000";
        patchContext.fillRect(0, 0, width, itemHeight);
        patchContext.filter = "blur(3.4px) contrast(112%) brightness(106%)";
        patchContext.drawImage(height.canvas, 0, 0, width, itemHeight);
        patchContext.filter = "blur(1.4px) contrast(126%) brightness(107%)";
        patchContext.globalAlpha = 0.28;
        patchContext.drawImage(height.canvas, 0, 0, width, itemHeight);
        patchContext.globalAlpha = 1;
        patchContext.filter = "none";
        patchContext.globalCompositeOperation = "destination-in";
        patchContext.filter = "blur(2px)";
        patchContext.drawImage(mask.canvas, 0, 0, width, itemHeight);
        patchContext.filter = "none";
        patchContext.globalCompositeOperation = "source-over";
        heightContext.drawImage(heightPatch, x, y);
      })
    );
  }

  return {
    colorTexture: makeSpaceCanvasTexture(THREE, colorCanvas, true),
    heightTexture: makeSpaceCanvasTexture(THREE, heightCanvas, false),
    scrollSize,
    atlasSize: { width: atlasWidth, height: atlasHeight },
  };
}

function ensureFullScrollAsset(THREE) {
  if (!state.fullScrollRecords.length) return false;
  if (state.space.fullScrollAsset?.ready) return true;
  if (state.space.fullScrollLoading) return false;

  state.space.fullScrollLoading = true;
  state.space.fullScrollFailed = false;
  buildFullScrollAsset(THREE)
    .then((asset) => {
      state.space.fullScrollAsset = { ready: true, ...asset };
      state.space.fullScrollLoading = false;
      state.space.renderKey = "";
      renderSpaceScene();
      renderGlyphPanel();
    })
    .catch((error) => {
      console.warn("Full-scroll asset load failed", error);
      state.space.fullScrollLoading = false;
      state.space.fullScrollFailed = true;
      renderGlyphPanel();
    });
  renderGlyphPanel();
  return false;
}

function createFullScrollMesh(THREE, asset) {
  const planeHeight = 4.8;
  const planeWidth = planeHeight * (asset.scrollSize.width / asset.scrollSize.height);
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 2048, 256);
  const material = new THREE.MeshStandardMaterial({
    map: asset.colorTexture,
    displacementMap: asset.heightTexture,
    displacementScale: 0.31,
    displacementBias: 0.006,
    bumpMap: asset.heightTexture,
    bumpScale: 0.022,
    roughness: 0.82,
    metalness: 0.01,
    color: 0xffffff,
    emissive: 0x241f17,
    emissiveIntensity: 0.08,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData = { pulse: "fullScroll" };
  state.space.fullScrollPlane = { width: planeWidth, height: planeHeight };
  return { mesh, planeWidth, planeHeight };
}

function fullScrollViewSize() {
  const camera = state.space.camera;
  if (!camera) return { width: 1, height: 1 };
  const distance = Math.max(0.1, Math.abs(camera.position.z));
  const fovRadians = (camera.fov * Math.PI) / 180;
  const height = 2 * Math.tan(fovRadians / 2) * distance;
  return { width: height * camera.aspect, height };
}

function fullScrollPanLimits() {
  const plane = state.space.fullScrollPlane;
  if (!plane) return { x: 0, y: 0 };
  const view = fullScrollViewSize();
  return {
    x: Math.max(0, (plane.width - view.width) / 2 + 0.35),
    y: Math.max(0, (plane.height - view.height) / 2 + 0.25),
  };
}

function syncSpacePanSlider(limitX) {
  if (!els.spacePanX) return;
  els.spacePanX.disabled = limitX <= 0.001;
  const percent = limitX > 0 ? Math.round(((state.space.panX || 0) / limitX) * 100) : 0;
  els.spacePanX.value = String(clamp(percent, -100, 100));
}

function applySpaceZoom() {
  if (!state.space.camera || !state.fullScrollRecords.length) return;
  const zoom = clamp(state.space.zoom || 1, 0.55, 3.8);
  state.space.zoom = zoom;
  state.space.camera.position.set(0, 0, 44 / zoom);
  state.space.camera.lookAt(0, 0, 0);
  const plane = state.space.fullScrollPlane;
  if (plane && state.space.annotationsGroup) {
    const panLimits = fullScrollPanLimits();
    state.space.panX = clamp(state.space.panX || 0, -panLimits.x, panLimits.x);
    state.space.panY = clamp(state.space.panY || 0, -panLimits.y, panLimits.y);
    state.space.annotationsGroup.position.set(state.space.panX, state.space.panY, 0);
    syncSpacePanSlider(panLimits.x);
  }
  if (els.spaceZoomControls) {
    els.spaceZoomControls.dataset.zoom = zoom.toFixed(2);
    els.spaceZoomControls.dataset.panX = (state.space.panX || 0).toFixed(2);
    els.spaceZoomControls.dataset.panY = (state.space.panY || 0).toFixed(2);
  }
}

function adjustSpaceZoom(direction) {
  if (state.mode !== "space" || !state.fullScrollRecords.length) return;
  const factor = direction > 0 ? 1.28 : 1 / 1.28;
  state.space.zoom = clamp((state.space.zoom || 1) * factor, 0.55, 3.8);
  applySpaceZoom();
  renderSpaceScene();
}

function setFullScrollView(rotationY = 0, rotationX = 0) {
  if (state.mode !== "space" || !state.fullScrollRecords.length) return;
  state.space.fullRotationY = clamp(rotationY, -1.05, 1.05);
  state.space.fullRotationX = clamp(rotationX, -0.55, 0.55);
  if (els.spaceZoomControls) {
    els.spaceZoomControls.dataset.rotateX = state.space.fullRotationX.toFixed(2);
    els.spaceZoomControls.dataset.rotateY = state.space.fullRotationY.toFixed(2);
  }
  renderSpaceScene();
}

function setFullScrollPanFromSlider(value) {
  if (state.mode !== "space" || !state.fullScrollRecords.length) return;
  const percent = clamp(Number(value) || 0, -100, 100) / 100;
  const panLimits = fullScrollPanLimits();
  state.space.panX = percent * panLimits.x;
  state.space.panY = 0;
  applySpaceZoom();
  renderSpaceScene();
}

function updateSpaceSceneContent() {
  if (!state.space.THREE || !state.data) return;
  const THREE = state.space.THREE;
  if (state.fullScrollRecords.length) {
    const asset = state.space.fullScrollAsset;
    const key = `${activeWorkId}:${state.mode}:full-scroll:${state.fullScrollRecords.length}:${asset?.ready ? "ready" : "loading"}`;
    if (key === state.space.renderKey) return;
    state.space.renderKey = key;
    clearThreeGroup(state.space.annotationsGroup);
    state.space.sceneReady = updateSpacePlane(THREE) || state.space.sceneReady;
    if (!ensureFullScrollAsset(THREE)) return;

    const stage = new THREE.Group();
    const { mesh, planeWidth, planeHeight } = createFullScrollMesh(THREE, state.space.fullScrollAsset);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(planeWidth + 0.46, planeHeight + 0.46, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xe8dcc8,
        transparent: true,
        opacity: 0.92,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      })
    );
    plate.position.z = -0.12;
    plate.receiveShadow = false;
    stage.add(plate, mesh);
    state.space.annotationsGroup.add(stage);
    return;
  }

  const glyph = selectedGlyph();
  const asset = glyph ? state.glyphAssets[glyph.id] : null;
  const key = `${activeWorkId}:${state.mode}:glyph:${glyph?.id || "none"}:${asset?.ready ? "ready" : "loading"}`;
  if (key === state.space.renderKey) return;
  state.space.renderKey = key;
  clearThreeGroup(state.space.annotationsGroup);
  state.space.sceneReady = updateSpacePlane(THREE) || state.space.sceneReady;

  if (!glyph) return;
  if (!ensureGlyphAssets(glyph)) return;
  const assets = state.glyphAssets[glyph.id];
  if (!assets?.ready) return;

  const stage = new THREE.Group();
  const { mesh, planeWidth, planeHeight } = createGlyphMesh(THREE, glyph, assets);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth + 0.52, planeHeight + 0.52, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xe8dcc8,
      transparent: true,
      opacity: 0.92,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  plate.position.z = -0.18;
  plate.receiveShadow = true;
  stage.add(plate, mesh);
  state.space.annotationsGroup.add(stage);
  state.space.annotationsGroup.rotation.x = -0.1;
  state.space.annotationsGroup.rotation.y = 0.16;
  state.space.annotationsGroup.rotation.z = 0.025;
}

function animateSpaceScene() {
  if (!state.space.running || !state.space.renderer || !state.space.scene || !state.space.camera) return;
  if (state.mode === "space") {
    const time = performance.now() / 1000;
    applySpaceZoom();
    if (state.fullScrollRecords.length) {
      state.space.root.rotation.x += ((state.space.fullRotationX || 0) - state.space.root.rotation.x) * 0.08;
      state.space.root.rotation.y += ((state.space.fullRotationY || 0) - state.space.root.rotation.y) * 0.08;
    } else {
      state.space.root.rotation.x += (state.space.targetRotationX - state.space.root.rotation.x) * 0.03;
      state.space.root.rotation.y += (state.space.targetRotationY - state.space.root.rotation.y) * 0.03;
    }
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
        if (pulse === "glyphMesh") {
          const breath = 1 + Math.sin(time * 1.4) * 0.035;
          object.scale.z = breath;
        }
        if (pulse === "glyphTrace" && object.userData.curve) {
          const t = (object.userData.phase + time * object.userData.speed) % 1;
          object.position.copy(object.userData.curve.getPoint(t));
          const glow = 0.78 + Math.sin(t * Math.PI * 2) * 0.2;
          object.scale.setScalar(glow);
          if (object.material) object.material.opacity = 0.62 + glow * 0.28;
        }
      });
    }
    state.space.renderer.render(state.space.scene, state.space.camera);
  }
  if (state.space.running) requestAnimationFrame(animateSpaceScene);
}

function handleSpacePointerDown(event) {
  if (state.mode !== "space" || !state.space.ready) return;
  if (event.target !== els.spaceCanvas) return;
  if (state.fullScrollRecords.length) event.preventDefault();
  state.space.pointer.active = true;
  state.space.pointer.mode = state.fullScrollRecords.length ? "rotate" : "pan";
  state.space.pointer.x = event.clientX;
  state.space.pointer.y = event.clientY;
  state.space.pointer.panX = state.space.panX || 0;
  state.space.pointer.panY = state.space.panY || 0;
  state.space.pointer.rotX = state.space.fullRotationX || 0;
  state.space.pointer.rotY = state.space.fullRotationY || 0;
  els.spaceCanvas.setPointerCapture?.(event.pointerId);
}

function handleSpacePointerMove(event) {
  if (state.mode !== "space" || !state.space.ready || !state.space.pointer.active) return;
  const rect = els.spaceCanvas.getBoundingClientRect();
  if (state.fullScrollRecords.length) {
    const dx = event.clientX - state.space.pointer.x;
    const dy = event.clientY - state.space.pointer.y;
    state.space.fullRotationY = clamp(state.space.pointer.rotY + dx * 0.006, -1.05, 1.05);
    state.space.fullRotationX = clamp(state.space.pointer.rotX + dy * 0.0045, -0.55, 0.55);
    if (els.spaceZoomControls) {
      els.spaceZoomControls.dataset.rotateX = state.space.fullRotationX.toFixed(2);
      els.spaceZoomControls.dataset.rotateY = state.space.fullRotationY.toFixed(2);
    }
    return;
  }
  const dx = (event.clientX - rect.left) / rect.width - 0.5;
  const dy = (event.clientY - rect.top) / rect.height - 0.5;
  state.space.targetRotationY = 0.22 + dx * 0.9;
  state.space.targetRotationX = -0.26 + dy * 0.6;
}

function handleSpacePointerUp() {
  state.space.pointer.active = false;
  state.space.pointer.mode = "pan";
  state.space.targetRotationX = clamp(state.space.targetRotationX, -0.7, 0.15);
  state.space.targetRotationY = clamp(state.space.targetRotationY, -0.9, 0.9);
}

function handleSpaceWheel(event) {
  if (state.mode !== "space" || !state.fullScrollRecords.length) return;
  event.preventDefault();
  adjustSpaceZoom(event.deltaY < 0 ? 1 : -1);
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
  if (!state.space.pendingProbe || !els.image.naturalWidth || !els.image.naturalHeight) return;
  const [x, y] = state.space.pendingProbe.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const percentX = clamp(x, 0, 100);
  const percentY = clamp(y, 0, 100);
  const pixelX = Math.round((percentX / 100) * els.image.naturalWidth);
  const pixelY = Math.round((percentY / 100) * els.image.naturalHeight);
  state.space.pendingProbe = "";
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

async function submitReflection() {
  const key = reflectionKey();
  const text = els.reflectionInput.value.trim();
  if (!text) {
    els.reflectionInput.focus();
    els.reflectionInput.placeholder = "请先写下你的理解，再提交。";
    return;
  }
  state.reflections[key] = { text, submitted: true };
  saveReflections();
  await syncReflection(key, text);
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
  syncFirstLook(firstLook);
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
  syncFirstLook(firstLook);
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

function requestLibraryAccess() {
  if (!state.user) {
    setAuthMode("login", "请先登录后再进入书画库。");
    setScreen("home");
    requestAnimationFrame(() => els.entryUserCard?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return;
  }
  setScreen("library");
  requestAnimationFrame(() => els.storedWorksPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function returnToLibrary() {
  requestLibraryAccess();
}

async function handleBrowserRouteChange() {
  const route = readRoute();
  try {
    if (!state.user && (route.view === "demo" || route.workId || route.selectId || route.probe || route.view === "library")) {
      setAuthMode("login", "请先登录后再进入书画库。");
      setScreen("home", { updateUrl: false });
      return;
    }
    if (route.view === "demo" || route.workId || route.selectId || route.probe) {
      await openWork(route.workId || state.worksIndex?.defaultWorkId || "work_003", {
        updateUrl: false,
        selectId: route.selectId,
        probe: route.probe,
      });
      return;
    }
    if (route.view === "library") {
      setScreen("library", { updateUrl: false });
      requestAnimationFrame(() => els.storedWorksPanel?.scrollIntoView({ block: "start" }));
      return;
    }
    if (route.view === "upload") {
      setScreen("upload", { updateUrl: false });
      setAdminLoggedIn(localStorage.getItem("callilens-admin-logged-in") === "true");
      requestAnimationFrame(() => els.uploadPanel?.scrollIntoView({ block: "start" }));
      return;
    }
    setScreen("home", { updateUrl: false });
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    showEmptyDetail("页面切换失败", error.message);
  }
}

function authHeaders() {
  return state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {};
}

function setAuthMode(mode = "login", message = "") {
  state.authMode = mode === "register" ? "register" : "login";
  if (els.userAuthTitle) els.userAuthTitle.textContent = state.authMode === "register" ? "请注册" : "请登录";
  if (els.userAuthSubtitle) {
    els.userAuthSubtitle.textContent =
      state.authMode === "register"
        ? "注册后会自动登录，并进入书画库开始保存观察记录。"
        : "登录后可进入书画库，并把第一印象与反思同步到数据库。";
  }
  if (els.userLogin) els.userLogin.classList.toggle("active", state.authMode === "login");
  if (els.userRegister) els.userRegister.classList.toggle("active", state.authMode === "register");
  if (message) renderUserStatus(message);
}

function renderUserStatus(message = "") {
  if (!els.userStatusText) return;
  if (message) {
    els.userStatusText.textContent = message;
  } else if (state.user) {
    els.userStatusText.textContent = `已登录：${state.user.username}，反思会同步到数据库。`;
  } else {
    els.userStatusText.textContent = "未登录：请先登录或注册。";
  }
  if (els.entryUserCard) els.entryUserCard.hidden = Boolean(state.user);
  if (els.userAuthForm) els.userAuthForm.hidden = Boolean(state.user);
  if (els.userLogout) els.userLogout.hidden = !state.user;
  if (els.userUsername) els.userUsername.disabled = Boolean(state.user);
  if (els.userPassword) els.userPassword.disabled = Boolean(state.user);
  if (els.userBadge) els.userBadge.hidden = !state.user;
  if (els.userBadgeName) els.userBadgeName.textContent = state.user ? `已登录：${state.user.username}` : "未登录";
  if (els.userBadgeId) els.userBadgeId.textContent = state.user ? `ID ${state.user.id}` : "ID -";
  if (!state.user) {
    state.userRecordsOpen = false;
    if (els.userRecordsPanel) els.userRecordsPanel.hidden = true;
  }
  renderEntry();
}

async function loadCurrentUser() {
  if (!state.authToken) {
    renderUserStatus();
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.authenticated) throw new Error(payload.detail || "登录已失效");
    state.user = payload.user;
  } catch {
    state.authToken = "";
    state.user = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  renderUserStatus();
}

async function submitUserAuth(mode) {
  setAuthMode(mode);
  if (!els.userUsername || !els.userPassword) return;
  const username = els.userUsername.value.trim();
  const password = els.userPassword.value;
  if (!username || !password) {
    renderUserStatus("请填写用户名和密码：用户名3-32位，密码至少6位。");
    return;
  }
  if (username.length < 3 || username.length > 32) {
    renderUserStatus("用户名长度需要在3-32位之间。");
    return;
  }
  if (password.length < 6) {
    renderUserStatus("密码至少需要6位。");
    return;
  }
  renderUserStatus(mode === "register" ? "正在注册..." : "正在登录...");
  try {
    const response = await fetch(`${API_BASE}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch (parseError) {
      payload = {};
    }
    if (response.status === 405) {
      throw new Error("当前后端没有启用用户接口。请确认后端已切到 codex/user-reflections-db 分支并重启，或 Render 已部署该分支/main合并后的版本。");
    }
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    state.authToken = payload.token;
    state.user = payload.user;
    localStorage.setItem(AUTH_TOKEN_KEY, state.authToken);
    els.userPassword.value = "";
    renderUserStatus();
    setScreen("library");
    requestAnimationFrame(() => els.storedWorksPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
  } catch (error) {
    renderUserStatus(`${mode === "register" ? "注册" : "登录"}失败：${error.message}`);
  }
}

function logoutUser() {
  state.authToken = "";
  state.user = null;
  state.userRecordsOpen = false;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  if (els.userUsername) els.userUsername.disabled = false;
  if (els.userPassword) {
    els.userPassword.disabled = false;
    els.userPassword.value = "";
  }
  renderUserStatus();
  setAuthMode("login");
  setScreen("home");
}

function formatRecordTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function workTitleForRecord(workId) {
  const work = (state.worksIndex?.works || []).find((item) => item.id === workId);
  return work?.title || workId || "未知作品";
}

function appendUserRecord(title, text, meta = "") {
  if (!els.userRecordsList) return;
  const item = document.createElement("article");
  item.className = "userRecordItem";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = text;
  item.append(heading, body);
  if (meta) {
    const small = document.createElement("p");
    small.textContent = meta;
    item.append(small);
  }
  els.userRecordsList.append(item);
}

function renderMyRecords(payload) {
  if (!els.userRecordsList) return;
  els.userRecordsList.replaceChildren();
  const firstLooks = payload.first_looks || [];
  const reflections = payload.reflections || [];
  const total = firstLooks.length + reflections.length;
  if (els.userRecordsMeta) {
    els.userRecordsMeta.textContent = `用户 ${payload.user?.username || state.user?.username || "-"}，共读取到 ${total} 条第一印象和反思。`;
  }
  if (!total) {
    appendUserRecord("暂无记录", "提交第一印象或反思后，这里会显示你的记录。");
    return;
  }
  firstLooks.slice(0, 5).forEach((record) => {
    appendUserRecord(
      `第一印象 · ${workTitleForRecord(record.work_id)}`,
      `整体：${record.overall || "未填写"}；运动感：${record.motion || "未填写"}；疏密：${record.density || "未填写"}`,
      formatRecordTime(record.updated_at || record.created_at),
    );
  });
  reflections.slice(0, 8).forEach((record) => {
    appendUserRecord(
      `我的反思 · ${workTitleForRecord(record.work_id)}`,
      record.content || "（未填写）",
      `${record.annotation_id || "free_reflection"} · ${formatRecordTime(record.created_at)}`,
    );
  });
}

async function toggleUserRecords() {
  if (!state.user || !els.userRecordsPanel) return;
  state.userRecordsOpen = !state.userRecordsOpen;
  els.userRecordsPanel.hidden = !state.userRecordsOpen;
  if (!state.userRecordsOpen) return;
  if (els.userRecordsList) els.userRecordsList.textContent = "正在读取你的记录...";
  try {
    const response = await fetch(`${API_BASE}/api/me/records`, { headers: authHeaders(), cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    renderMyRecords(payload);
  } catch (error) {
    if (els.userRecordsList) els.userRecordsList.textContent = `记录读取失败：${error.message}`;
  }
}

async function startWorkSession() {
  if (!state.authToken || !activeWorkId) return;
  try {
    await fetch(`${API_BASE}/api/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ work_id: activeWorkId }),
    });
  } catch {
    renderUserStatus("已登录，但本次进入作品未能写入服务器。");
  }
}

async function syncFirstLook(firstLook) {
  if (!state.authToken || !activeWorkId) return;
  try {
    await fetch(`${API_BASE}/api/first-look`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ work_id: activeWorkId, ...firstLook }),
    });
  } catch {
    renderUserStatus("第一印象已保存在本机，但未同步到服务器。");
  }
}

async function syncReflection(annotationId, text) {
  if (!state.authToken || !activeWorkId) return;
  const item = selectedAnnotation();
  try {
    await fetch(`${API_BASE}/api/reflections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        work_id: activeWorkId,
        annotation_id: annotationId || "free_reflection",
        reflection_type: item?.type || "free",
        content: text,
      }),
    });
  } catch {
    renderUserStatus("反思已保存在本机，但未同步到服务器。");
  }
}

function setAdminLoggedIn(loggedIn) {
  localStorage.setItem("callilens-admin-logged-in", loggedIn ? "true" : "false");
  if (els.adminWorkspace) els.adminWorkspace.hidden = !loggedIn;
  if (els.adminLoginForm) els.adminLoginForm.hidden = loggedIn;
  if (loggedIn) {
    setAdminTab("works");
    loadLlmStatus();
    renderAdminWorksList();
  }
}

function setAdminTab(tab) {
  const nextTab = ["works", "ai", "records"].includes(tab) ? tab : "works";
  els.adminTabs?.forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === nextTab);
  });
  els.adminPanes?.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.adminPane === nextTab);
  });
  if (nextTab === "ai") loadLlmStatus();
  if (nextTab === "works") renderAdminWorksList();
  if (nextTab === "records") loadAdminRecords();
}

function renderAdminWorksList() {
  if (!els.adminWorksList) return;
  const works = state.worksIndex?.works || [];
  els.adminWorksList.replaceChildren();
  if (!works.length) {
    els.adminWorksList.textContent = "还没有作品。";
    return;
  }

  works.forEach((work) => {
    const row = document.createElement("div");
    row.className = "adminWorkItem";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${work.id} · ${work.title || "未命名作品"}`;
    const meta = document.createElement("p");
    meta.textContent = [work.artist, work.dynasty, work.script_type, work.museum].filter(Boolean).join(" · ") || "管理员作品资料";
    info.append(title, meta);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const editBtn = document.createElement("button");
    editBtn.className = "secondaryButton";
    editBtn.type = "button";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", async () => {
      try {
        editBtn.textContent = "读取中...";
        editBtn.disabled = true;
        const res = await fetch(`${API_BASE}/api/works/${work.id}`, { cache: "no-store" });
        const detail = await res.json();
        editWorkInForm(detail);
      } catch (err) {
        alert("读取作品详情失败：" + err.message);
      } finally {
        editBtn.textContent = "编辑";
        editBtn.disabled = false;
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "secondaryButton dangerButton";
    deleteBtn.type = "button";
    deleteBtn.textContent = work.id === "work_003" ? "默认作品保留" : "删除";
    deleteBtn.disabled = work.id === "work_003";
    deleteBtn.addEventListener("click", () => deleteAdminWork(work.id, work.title || work.id));

    actions.append(editBtn, deleteBtn);
    row.append(info, actions);
    els.adminWorksList.append(row);
  });
}

async function refreshAdminWorks() {
  await loadWorksIndex();
  renderWorkCards();
  renderAdminWorksList();
}

function appendRecordGroup(title, records, renderItem) {
  if (!els.adminRecordsList) return;
  const group = document.createElement("section");
  group.className = "adminRecordGroup";
  const heading = document.createElement("h4");
  heading.textContent = `${title} (${records.length})`;
  group.append(heading);
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "adminEmpty";
    empty.textContent = "暂无记录。";
    group.append(empty);
  } else {
    records.slice(0, 20).forEach((record) => {
      const item = document.createElement("div");
      item.className = "adminRecordItem";
      renderItem(item, record);
      group.append(item);
    });
  }
  els.adminRecordsList.append(group);
}

function appendRecordText(item, title, detail) {
  const strong = document.createElement("strong");
  strong.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = detail;
  item.append(strong, paragraph);
}

async function loadAdminRecords() {
  if (!els.adminRecordsList) return;
  els.adminRecordsList.textContent = "正在读取用户记录...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/user-records`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.adminRecordsList.replaceChildren();
    const database = document.createElement("p");
    database.className = "adminEmpty";
    database.textContent = `数据库：${payload.database?.driver || "unknown"} ${payload.database?.path || ""}`;
    els.adminRecordsList.append(database);

    appendRecordGroup("用户账号", payload.users || [], (item, record) => {
      appendRecordText(item, record.username || "-", `角色：${record.role || "user"}；创建时间：${record.created_at || "-"}`);
    });
    appendRecordGroup("进入作品", payload.sessions || [], (item, record) => {
      appendRecordText(item, `${record.username || "-"} / ${record.work_id || "-"}`, record.started_at || "-");
    });
    appendRecordGroup("第一印象", payload.first_looks || [], (item, record) => {
      appendRecordText(
        item,
        `${record.username || "-"} / ${record.work_id || "-"}`,
        `整体：${record.overall || ""}\n运动：${record.motion || ""}\n疏密：${record.density || ""}`,
      );
    });
    appendRecordGroup("反思文字", payload.reflections || [], (item, record) => {
      appendRecordText(
        item,
        `${record.username || "-"} / ${record.work_id || "-"} / ${record.annotation_id || "-"}`,
        record.content || "",
      );
    });
  } catch (error) {
    els.adminRecordsList.textContent = `读取失败：${error.message}`;
  }
}

async function deleteAdminWork(workId, title) {
  if (!workId || workId === "work_003") return;
  const ok = window.confirm(`确定删除「${title}」吗？\n这会删除 data/${workId} 目录，并从 RAG 知识库移除它。`);
  if (!ok) return;
  if (els.uploadResult) {
    els.uploadResult.hidden = false;
    els.uploadResult.textContent = `正在删除 ${workId}...`;
  }
  try {
    const response = await fetch(`${API_BASE}/api/admin/works/${workId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    if (els.uploadResult) els.uploadResult.textContent = `删除完成：${payload.work_id}`;
    await refreshAdminWorks();
  } catch (error) {
    if (els.uploadResult) els.uploadResult.textContent = `删除失败：${error.message}`;
  }
}

async function generateAdminQuestionDraft() {
  if (!els.uploadWorkForm || !els.adminQuestionDraftResult) return;
  els.adminQuestionDraftResult.hidden = false;
  if (!state.adminEditingWorkId) {
    els.adminQuestionDraftResult.textContent = "请先在上方作品列表点击“编辑”，再为该作品生成推荐问题草稿。";
    return;
  }
  els.adminGenerateQuestions.disabled = true;
  els.adminQuestionDraftResult.textContent = "正在生成推荐问题草稿...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/works/${state.adminEditingWorkId}/question-draft`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    els.uploadWorkForm.elements["quick_questions"].value = questions.join(", ");
    const missing = Array.isArray(payload.missing_fields) && payload.missing_fields.length
      ? `\n资料不足提醒：缺少${payload.missing_fields.join("、")}。`
      : "";
    const source = payload.provider === "local_rag" ? "本地模板" : `AI：${payload.provider}`;
    els.adminQuestionDraftResult.textContent =
      `已生成草稿来源：${source}。请检查问题是否适合当前作品，确认后点击“保存修改”。${missing}`;
  } catch (error) {
    els.adminQuestionDraftResult.textContent = `生成失败：${error.message}`;
  } finally {
    els.adminGenerateQuestions.disabled = false;
  }
}

function annotationTypeName(type) {
  return typeMeta[type]?.name || type || "观察点";
}

function defaultManualAnnotation(type, box) {
  const name = annotationTypeName(type);
  const concept = type === "void_solid" ? "留白" : type === "qi_flow" ? "趋势" : "笔墨";
  const id = `manual_${Date.now()}_${state.manualAnnotations.length + 1}`;
  return {
    id,
    type,
    label: `${name}观察点`,
    evidenceLayers: ["original", "inkDensity"],
    box,
    formal: "请管理员根据框选区域补充可见的形式证据，例如墨色轻重、线条粗细、留白关系或上下承接。",
    perception: "请管理员补充普通观众可能产生的观看感受。",
    aesthetic: "请管理员补充文化或审美解释；避免直接判断书法好坏、真伪或真实笔顺。",
    reflection: {
      concept,
      prompt: "你在这个位置注意到了什么？",
      expertFeedback: "这是管理员人工确认的观察点，可作为观众反思的参考。",
    },
  };
}

function syncManualAnnotationForm() {
  const form = els.uploadWorkForm;
  if (!form) return;
  const annotationsInput = form.elements["manual_annotations_json"];
  if (annotationsInput) annotationsInput.value = JSON.stringify(state.manualAnnotations || []);
}

function revokeManualAnnotationObjectUrl() {
  if (state.manualAnnotationObjectUrl) {
    URL.revokeObjectURL(state.manualAnnotationObjectUrl);
    state.manualAnnotationObjectUrl = "";
  }
}

function setManualEditorVisible(visible, workId = "", imageUrl = "") {
  if (!els.manualAnnotationEditor) return;
  els.manualAnnotationEditor.hidden = !visible;
  if (!visible) {
    if (els.manualAnnotationImage) els.manualAnnotationImage.removeAttribute("src");
    return;
  }
  if (els.manualAnnotationImage && imageUrl) {
    els.manualAnnotationImage.src = imageUrl;
  } else if (els.manualAnnotationImage && workId) {
    els.manualAnnotationImage.src = `../data/${workId}/original.png?t=${Date.now()}`;
  }
}

function showManualEditorForUploadFile(file) {
  revokeManualAnnotationObjectUrl();
  state.manualAnnotations = [];
  state.manualAnnotationDraft = null;
  if (!file) {
    setManualEditorVisible(false);
    renderManualAnnotationEditor();
    return;
  }
  state.manualAnnotationObjectUrl = URL.createObjectURL(file);
  setManualEditorVisible(true, "", state.manualAnnotationObjectUrl);
  renderManualAnnotationEditor();
}

async function loadManualAnnotationDraft(workId) {
  state.manualAnnotations = [];
  const form = els.uploadWorkForm;
  if (form?.elements["manual_guide_text"]) form.elements["manual_guide_text"].value = "";
  try {
    const response = await fetch(`../data/${workId}/annotation.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.manualAnnotations = Array.isArray(payload.annotations) ? payload.annotations : [];
    if (form?.elements["manual_guide_text"]) form.elements["manual_guide_text"].value = payload.guideText || "";
  } catch {
    state.manualAnnotations = [];
  }
  syncManualAnnotationForm();
  renderManualAnnotationEditor();
}

function stagePercentPoint(event) {
  const rect = els.manualAnnotationStage.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
  };
}

function normalizedBox(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    width: Number(Math.abs(a.x - b.x).toFixed(2)),
    height: Number(Math.abs(a.y - b.y).toFixed(2)),
  };
}

function renderManualAnnotationEditor() {
  if (!els.manualAnnotationOverlay || !els.manualAnnotationList) return;
  els.manualAnnotationOverlay.replaceChildren();
  els.manualAnnotationList.replaceChildren();

  const drawBox = (box, className, label = "") => {
    const node = document.createElement("div");
    node.className = `manualAnnotationBox ${className}`;
    node.style.left = `${box.x}%`;
    node.style.top = `${box.y}%`;
    node.style.width = `${box.width}%`;
    node.style.height = `${box.height}%`;
    node.textContent = label;
    els.manualAnnotationOverlay.append(node);
  };

  state.manualAnnotations.forEach((item, index) => {
    if (item.box) drawBox(item.box, item.type || "brush_ink", String(index + 1));
  });
  if (state.manualAnnotationDraft) {
    drawBox(normalizedBox(state.manualAnnotationDraft.start, state.manualAnnotationDraft.end), "draft", "");
  }

  if (!state.manualAnnotations.length) {
    const empty = document.createElement("p");
    empty.className = "adminEmpty";
    empty.textContent = "还没有人工框选点。请在图片上拖拽框选区域。";
    els.manualAnnotationList.append(empty);
  }

  state.manualAnnotations.forEach((item, index) => {
    const card = document.createElement("section");
    card.className = "manualAnnotationItem";
    const heading = document.createElement("div");
    heading.className = "manualAnnotationItemHeader";
    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(2, "0")} · ${annotationTypeName(item.type)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondaryButton dangerButton";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      state.manualAnnotations.splice(index, 1);
      syncManualAnnotationForm();
      renderManualAnnotationEditor();
    });
    heading.append(title, remove);

    const label = document.createElement("input");
    label.value = item.label || "";
    label.placeholder = "导览点标题";
    label.addEventListener("input", () => {
      item.label = label.value.trim();
      syncManualAnnotationForm();
    });

    const formal = document.createElement("textarea");
    formal.rows = 2;
    formal.value = item.formal || "";
    formal.placeholder = "形式证据：这里看到了什么";
    formal.addEventListener("input", () => {
      item.formal = formal.value.trim();
      syncManualAnnotationForm();
    });

    const perception = document.createElement("textarea");
    perception.rows = 2;
    perception.value = item.perception || "";
    perception.placeholder = "观看感受：观众可能怎样感受";
    perception.addEventListener("input", () => {
      item.perception = perception.value.trim();
      syncManualAnnotationForm();
    });

    const aesthetic = document.createElement("textarea");
    aesthetic.rows = 2;
    aesthetic.value = item.aesthetic || "";
    aesthetic.placeholder = "解释：不要判断真伪/好坏/真实笔顺";
    aesthetic.addEventListener("input", () => {
      item.aesthetic = aesthetic.value.trim();
      syncManualAnnotationForm();
    });

    card.append(heading, label, formal, perception, aesthetic);
    els.manualAnnotationList.append(card);
  });
  syncManualAnnotationForm();
}

function startManualAnnotation(event) {
  if (!els.manualAnnotationStage || els.manualAnnotationEditor?.hidden || state.manualAnnotations.length >= 5) return;
  if (!els.manualAnnotationImage?.getAttribute("src")) return;
  event.preventDefault();
  const point = stagePercentPoint(event);
  state.manualAnnotationDraft = { start: point, end: point };
  els.manualAnnotationStage.setPointerCapture?.(event.pointerId);
  renderManualAnnotationEditor();
}

function moveManualAnnotation(event) {
  if (!state.manualAnnotationDraft) return;
  state.manualAnnotationDraft.end = stagePercentPoint(event);
  renderManualAnnotationEditor();
}

function finishManualAnnotation(event) {
  if (!state.manualAnnotationDraft) return;
  state.manualAnnotationDraft.end = stagePercentPoint(event);
  const box = normalizedBox(state.manualAnnotationDraft.start, state.manualAnnotationDraft.end);
  state.manualAnnotationDraft = null;
  if (box.width >= 1 && box.height >= 1) {
    state.manualAnnotations.push(defaultManualAnnotation(els.manualAnnotationType?.value || "brush_ink", box));
  }
  renderManualAnnotationEditor();
}

function clearManualAnnotations() {
  state.manualAnnotations = [];
  state.manualAnnotationDraft = null;
  syncManualAnnotationForm();
  renderManualAnnotationEditor();
}

async function generateAdminAppreciationDraft() {
  if (!els.uploadWorkForm || !els.adminAppreciationDraftResult) return;
  els.adminAppreciationDraftResult.hidden = false;
  if (!state.adminEditingWorkId) {
    els.adminAppreciationDraftResult.textContent = "新上传作品还没有作品 ID，不能生成 AI 全文赏析草稿。你可以先手写导览并框选上传；上传完成后再点“编辑”生成 AI 草稿。";
    return;
  }
  els.adminGenerateAppreciation.disabled = true;
  els.adminAppreciationDraftResult.textContent = "正在生成全文赏析草稿...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/works/${state.adminEditingWorkId}/appreciation-draft`, {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.uploadWorkForm.elements["manual_guide_text"].value = payload.guideText || "";
    const source = payload.provider === "local_rag" ? "本地模板" : `AI：${payload.provider}`;
    els.adminAppreciationDraftResult.textContent = `已生成全文赏析草稿来源：${source}。请修改确认后点击“保存修改”。`;
  } catch (error) {
    els.adminAppreciationDraftResult.textContent = `生成失败：${error.message}`;
  } finally {
    els.adminGenerateAppreciation.disabled = false;
  }
}

async function loadLlmStatus() {
  if (!els.llmStatus) return;
  try {
    const response = await fetch(`${API_BASE}/api/admin/llm-bindings`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const status = payload.status || {};
    els.llmStatus.textContent = status.configured
      ? `当前启用：${status.binding_name || status.provider} / ${status.model}。普通作品页会自动使用这个绑定。`
      : "尚未启用 AI 绑定。系统默认使用本地 RAG，不影响演示。";
    renderLlmBindings(payload.bindings || []);
  } catch (error) {
    els.llmStatus.textContent = `后端未启动或不可访问：${error.message}`;
    renderLlmBindings([]);
  }
}

async function saveLlmConfig(event) {
  event.preventDefault();
  if (!els.llmForm || !els.llmStatus) return;
  els.llmStatus.textContent = "正在保存 AI 配置...";
  const formData = new FormData(els.llmForm);
  const apiKey = String(formData.get("api_key") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const baseUrl = String(formData.get("base_url") || "").trim();
  if (/^https?:\/\//i.test(apiKey)) {
    els.llmStatus.textContent = "保存失败：你把接口地址填进 API key 了。API key 要填火山方舟控制台里的 ARK_API_KEY；https://... 要填到“接口地址”。";
    return;
  }
  if (/^https?:\/\//i.test(model)) {
    els.llmStatus.textContent = "保存失败：模型栏不能填网址。豆包模型应类似 doubao-seed-2-0-lite-260428。";
    return;
  }
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    els.llmStatus.textContent = "保存失败：接口地址必须以 http:// 或 https:// 开头。";
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/admin/llm-bindings`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    const status = payload.status || {};
    els.llmStatus.textContent = status.configured
      ? `已保存并启用：${status.binding_name || status.provider} / ${status.model}。`
      : "未填写 API key，仍使用本地 RAG。";
    renderLlmBindings(payload.bindings || []);
    els.llmForm.reset();
  } catch (error) {
    els.llmStatus.textContent = `保存失败：${error.message}`;
  }
}

function renderLlmBindings(bindings) {
  if (!els.llmBindingsList) return;
  els.llmBindingsList.replaceChildren();
  if (!bindings.length) {
    const empty = document.createElement("p");
    empty.className = "adminEmpty";
    empty.textContent = "还没有 AI 绑定。保存一个配置后会出现在这里。";
    els.llmBindingsList.append(empty);
    return;
  }
  bindings.forEach((binding) => {
    const item = document.createElement("div");
    item.className = "llmBindingItem";
    item.classList.toggle("active", Boolean(binding.active));

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${binding.name || "未命名绑定"}${binding.active ? " · 当前启用" : ""}`;
    const meta = document.createElement("p");
    meta.textContent = `${binding.provider} / ${binding.model} · ${binding.key_masked || "未保存 key"}`;
    const url = document.createElement("small");
    url.textContent = binding.base_url || "默认接口地址";
    info.append(title, meta, url);

    const actions = document.createElement("div");
    actions.className = "llmBindingActions";

    const activate = document.createElement("button");
    activate.type = "button";
    activate.className = "secondaryButton";
    activate.textContent = binding.active ? "已启用" : "启用";
    activate.disabled = binding.active;
    activate.addEventListener("click", () => activateLlmBinding(binding.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondaryButton dangerButton";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deleteLlmBinding(binding.id, binding.name || binding.provider));

    actions.append(activate, remove);
    item.append(info, actions);
    els.llmBindingsList.append(item);
  });
}

async function activateLlmBinding(bindingId) {
  if (!bindingId || !els.llmStatus) return;
  els.llmStatus.textContent = "正在启用 AI 绑定...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/llm-bindings/${encodeURIComponent(bindingId)}/activate`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    const status = payload.status || {};
    els.llmStatus.textContent = `已启用：${status.binding_name || status.provider} / ${status.model}`;
    renderLlmBindings(payload.bindings || []);
  } catch (error) {
    els.llmStatus.textContent = `启用失败：${error.message}`;
  }
}

async function deleteLlmBinding(bindingId, name) {
  if (!bindingId || !els.llmStatus) return;
  const ok = window.confirm(`确定删除 AI 绑定「${name}」吗？\n删除后不会影响本地 RAG。`);
  if (!ok) return;
  els.llmStatus.textContent = "正在删除 AI 绑定...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/llm-bindings/${encodeURIComponent(bindingId)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    const status = payload.status || {};
    els.llmStatus.textContent = status.configured
      ? `已删除。当前启用：${status.binding_name || status.provider} / ${status.model}`
      : "已删除。当前没有启用 AI，系统会回到本地 RAG。";
    renderLlmBindings(payload.bindings || []);
  } catch (error) {
    els.llmStatus.textContent = `删除失败：${error.message}`;
  }
}

async function testLlmConfig() {
  if (!els.llmStatus) return;
  els.llmStatus.textContent = "正在测试 AI 配置...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/test-llm`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.llmStatus.textContent = payload.ok
      ? `AI 测试成功：${payload.provider} 已返回结果。${payload.answer}`
      : `AI 测试未通过：${payload.answer}`;
  } catch (error) {
    els.llmStatus.textContent = `AI 测试失败：${error.message}`;
  }
}

async function uploadAdminWork(event) {
  event.preventDefault();
  if (!els.uploadWorkForm || !els.uploadResult) return;
  syncManualAnnotationForm();
  els.uploadResult.hidden = false;
  const isEditing = Boolean(state.adminEditingWorkId);
  els.uploadResult.textContent = isEditing
    ? "正在保存修改并更新知识库..."
    : "正在上传图片、运行 OpenCV，并写入知识库...";
  try {
    const url = isEditing
      ? `${API_BASE}/api/admin/works/${state.adminEditingWorkId}`
      : `${API_BASE}/api/admin/upload-work`;
    const response = await fetch(url, {
      method: "POST",
      body: new FormData(els.uploadWorkForm),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.uploadResult.textContent = isEditing
      ? `修改已保存：${state.adminEditingWorkId}\n返回作品库后可以看到最新修改。`
      : `上传完成：${payload.work_id}\n生成文件：${payload.generated.join("、")}\n返回作品库后可以看到新作品。`;
    resetAdminForm();
    await refreshAdminWorks();
  } catch (error) {
    els.uploadResult.textContent = isEditing
      ? `修改保存失败：${error.message}`
      : `上传失败：${error.message}\n请确认后端已启动：python -m uvicorn backend.app.main:app --reload --port 8000`;
  }
}

function editWorkInForm(work) {
  state.adminEditingWorkId = work.id;
  const form = els.uploadWorkForm;
  if (!form) return;
  if (els.adminQuestionDraftResult) {
    els.adminQuestionDraftResult.hidden = true;
    els.adminQuestionDraftResult.textContent = "";
  }
  
  form.elements["title"].value = work.title || "";
  form.elements["artist"].value = work.artist || "";
  form.elements["dynasty"].value = work.dynasty || "";
  form.elements["date"].value = work.date || "";
  form.elements["script_type"].value = work.script_type || "";
  form.elements["museum"].value = work.museum || "";
  form.elements["description"].value = work.description || "";
  form.elements["background"].value = work.background || "";
  form.elements["source_url"].value = work.source_url || "";
  form.elements["tags"].value = Array.isArray(work.tags) ? work.tags.join(", ") : "";
  form.elements["quick_questions"].value = Array.isArray(work.quick_questions) ? work.quick_questions.join(", ") : "";
  setManualEditorVisible(true, work.id);
  loadManualAnnotationDraft(work.id);

  const imageInput = form.elements["image"];
  if (imageInput) imageInput.required = false;

  const header = form.previousElementSibling;
  if (header && header.tagName === "H3") {
    header.textContent = `修改书法作品 (${work.id})`;
  }
  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.textContent = "保存修改";
  }

  let cancelBtn = form.querySelector("#cancelEditButton");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "cancelEditButton";
    cancelBtn.type = "button";
    cancelBtn.className = "secondaryButton";
    cancelBtn.textContent = "取消编辑";
    cancelBtn.style.marginLeft = "10px";
    cancelBtn.addEventListener("click", resetAdminForm);
    submitBtn.parentNode.appendChild(cancelBtn);
  }
  form.scrollIntoView({ behavior: "smooth" });
}

function resetAdminForm() {
  state.adminEditingWorkId = null;
  state.manualAnnotations = [];
  state.manualAnnotationDraft = null;
  revokeManualAnnotationObjectUrl();
  const form = els.uploadWorkForm;
  if (!form) return;
  form.reset();
  if (els.adminQuestionDraftResult) {
    els.adminQuestionDraftResult.hidden = true;
    els.adminQuestionDraftResult.textContent = "";
  }

  const imageInput = form.elements["image"];
  if (imageInput) imageInput.required = true;

  const header = form.previousElementSibling;
  if (header && header.tagName === "H3") {
    header.textContent = "上传书法作品";
  }
  const submitBtn = form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.textContent = "上传并处理";
  }
  const cancelBtn = form.querySelector("#cancelEditButton");
  if (cancelBtn) {
    cancelBtn.remove();
  }
  setManualEditorVisible(false);
  renderManualAnnotationEditor();
}

function handleAdminImageSelection(event) {
  const file = event.currentTarget?.files?.[0] || null;
  if (state.adminEditingWorkId) {
    if (file) showManualEditorForUploadFile(file);
    return;
  }
  showManualEditorForUploadFile(file);
}

async function askRagQuestion() {
  const question = els.ragQuestionInput?.value.trim();
  if (!question) return;
  els.ragAnswer.hidden = false;
  els.ragSources.hidden = true;
  const askMode = currentRagAskMode();
  els.ragAnswer.textContent = state.ragUseAi
    ? "正在检索本地知识库，并使用 AI 组织或补充..."
    : "正在检索本地知识库...";
  try {
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_id: activeWorkId || "work_003",
        question,
        use_llm: state.ragUseAi,
        ask_mode: askMode,
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`接口返回的不是 JSON。请确认后端已启动，并且问答接口地址是 ${API_BASE}/api/ask`);
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.ragAnswer.textContent = `回答模式：${formatRagMode(payload.mode || askMode, state.ragUseAi)}\n\n${payload.answer}`;
    renderRagSources(payload.sources || []);
  } catch (error) {
    els.ragAnswer.textContent = `问答服务不可用：${error.message}\n先启动后端：python -m uvicorn backend.app.main:app --reload --port 8000`;
  }
}

function currentRagAskMode() {
  return state.ragUseAi ? "ai_free" : "local";
}

function formatRagMode(mode, aiRequested = false) {
  if (mode?.startsWith?.("ai_free")) return "已启用 AI：RAG 检索 + AI 组织/补充";
  if (mode?.startsWith?.("llm_")) return "已启用 AI：基于本地 RAG 资料润色";
  if (mode === "ai_requested_unavailable") return "已请求 AI，但后端未配置或不可用，已退回本地 RAG";
  if (aiRequested) return "已请求 AI，但本次只返回本地 RAG";
  return "本地 RAG（未启用 AI）";
}

function setRagUseAi(enabled) {
  state.ragUseAi = Boolean(enabled);
  if (els.ragUseAiToggle) els.ragUseAiToggle.checked = state.ragUseAi;
  if (!els.ragModeNote) return;
  els.ragModeNote.textContent = state.ragUseAi
    ? "已启用 AI：先检索本地 RAG；有资料时合并组织回答，资料不足时允许 AI 补充，并会标注为非本地知识库来源。"
    : "未启用 AI：只检索本地 RAG 资料。资料里没有答案时，会明确提示未查询到，不会自动编造。";
}

function renderRagSources(sources) {
  els.ragSources.hidden = false;
  if (!sources.length) {
    els.ragSources.textContent = "没有匹配到明确来源。";
    return;
  }
  els.ragSources.replaceChildren();
  const title = document.createElement("p");
  title.className = "feedbackLabel";
  title.textContent = "参考来源";
  const list = document.createElement("ul");
  sources.forEach((source) => {
    const item = document.createElement("li");
    const sourceName = source.source || "项目知识库";
    if (source.url) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = sourceName;
      item.textContent = `${source.title} · `;
      item.append(link);
    } else {
      item.textContent = `${source.title} · ${sourceName}`;
    }
    list.append(item);
  });
  els.ragSources.append(title, list);
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

document.querySelectorAll(".modeButton[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
els.inkverseLiteButton?.addEventListener("click", openInkverseLite);
els.inkverseLiteClose?.addEventListener("click", closeInkverseLite);
els.inkverseLiteSteps?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  setInkverseLiteStep(event.target.dataset.inkverseStep);
});
els.inkverseReflectionTags?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  insertInkverseReflectionTag(event.target.dataset.reflectionTag);
});

els.spaceZoomIn?.addEventListener("click", (event) => {
  event.stopPropagation();
  adjustSpaceZoom(1);
});

els.spaceZoomOut?.addEventListener("click", (event) => {
  event.stopPropagation();
  adjustSpaceZoom(-1);
});

els.spacePanX?.addEventListener("input", (event) => {
  event.stopPropagation();
  setFullScrollPanFromSlider(event.currentTarget.value);
});

els.spaceRotateLeft?.addEventListener("click", (event) => {
  event.stopPropagation();
  setFullScrollView(-0.72, 0.08);
});

els.spaceRotateRight?.addEventListener("click", (event) => {
  event.stopPropagation();
  setFullScrollView(0.72, 0.08);
});

els.spaceViewReset?.addEventListener("click", (event) => {
  event.stopPropagation();
  setFullScrollView(0, 0);
});

els.storedWorks.addEventListener("click", () => {
  requestLibraryAccess();
});

els.backHomeFromLibrary.addEventListener("click", returnHome);

els.uploadEntry.addEventListener("click", () => {
  setScreen("upload");
  setAdminLoggedIn(localStorage.getItem("callilens-admin-logged-in") === "true");
  requestAnimationFrame(() => els.uploadPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
});

els.backHomeFromUpload.addEventListener("click", returnHome);

els.userAuthForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitUserAuth("login");
});
els.userRegister?.addEventListener("click", () => submitUserAuth("register"));
els.userLogout?.addEventListener("click", logoutUser);
els.userBadge?.addEventListener("click", toggleUserRecords);
els.userRecordsClose?.addEventListener("click", () => {
  state.userRecordsOpen = false;
  if (els.userRecordsPanel) els.userRecordsPanel.hidden = true;
});
els.userLogoutPanel?.addEventListener("click", logoutUser);

els.adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.adminLoginError.hidden = true;
  try {
    const formData = new FormData();
    const password = els.adminPassword.value.trim();
    if (!password) {
      els.adminLoginError.hidden = false;
      els.adminPassword.focus();
      return;
    }
    formData.set("password", password);
    const response = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("管理员口令不正确，或后端没有启动。");
    setAdminLoggedIn(true);
  } catch (error) {
    els.adminLoginError.textContent = error.message;
    els.adminLoginError.hidden = false;
  }
});

els.llmForm?.addEventListener("submit", saveLlmConfig);
els.llmTest?.addEventListener("click", testLlmConfig);
els.uploadWorkForm?.addEventListener("submit", uploadAdminWork);
els.uploadWorkForm?.elements?.["image"]?.addEventListener("change", handleAdminImageSelection);
els.adminGenerateQuestions?.addEventListener("click", generateAdminQuestionDraft);
els.adminGenerateAppreciation?.addEventListener("click", generateAdminAppreciationDraft);
els.manualAnnotationStage?.addEventListener("pointerdown", startManualAnnotation);
els.manualAnnotationStage?.addEventListener("pointermove", moveManualAnnotation);
els.manualAnnotationStage?.addEventListener("pointerup", finishManualAnnotation);
els.manualAnnotationStage?.addEventListener("pointercancel", () => {
  state.manualAnnotationDraft = null;
  renderManualAnnotationEditor();
});
els.manualAnnotationClear?.addEventListener("click", clearManualAnnotations);
els.adminRefreshWorks?.addEventListener("click", refreshAdminWorks);
els.adminRefreshRecords?.addEventListener("click", loadAdminRecords);
els.adminTabs?.forEach((button) => {
  button.addEventListener("click", () => setAdminTab(button.dataset.adminTab));
});
els.adminLogout?.addEventListener("click", () => {
  setAdminLoggedIn(false);
  if (els.adminPassword) els.adminPassword.value = "";
  requestAnimationFrame(() => els.adminLoginForm?.scrollIntoView({ behavior: "smooth", block: "center" }));
});

els.browseFromUpload.addEventListener("click", () => {
  requestLibraryAccess();
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
els.ragUseAiToggle?.addEventListener("change", () => setRagUseAi(els.ragUseAiToggle.checked));
setRagUseAi(state.ragUseAi);
els.ragAskButton?.addEventListener("click", askRagQuestion);
els.ragQuickQuestions?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLButtonElement)) return;
  els.ragQuestionInput.value = event.target.textContent.trim();
  askRagQuestion();
});
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
window.addEventListener("popstate", handleBrowserRouteChange);

boot();
