import * as THREE from "./vendor/three.module.js";

const API_BASE = window.CALLILENS_API_BASE || "http://localhost:8000";
const STATIC_DATA_BASE = "../data";
const DEFAULT_WORK_ID = "work_003";

const state = {
  view: "gallery",
  mode: "image",
  workId: DEFAULT_WORK_ID,
  work: null,
  three: {
    ready: false,
    renderer: null,
    scene: null,
    camera: null,
    root: null,
    scrollGroup: null,
    zoom: 1,
    panX: 0,
    rotX: 0,
    rotY: 0,
    pointer: null,
    assetKey: "",
  },
};

const els = {
  navButtons: document.querySelectorAll(".navButton"),
  panels: document.querySelectorAll("[data-panel]"),
  workMeta: document.querySelector("#workMeta"),
  workTitle: document.querySelector("#workTitle"),
  workImage: document.querySelector("#workImage"),
  threeCanvas: document.querySelector("#threeCanvas"),
  stageStatus: document.querySelector("#stageStatus"),
  imageModeButton: document.querySelector("#imageModeButton"),
  threeModeButton: document.querySelector("#threeModeButton"),
  threeControls: document.querySelector("#threeControls"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  panSlider: document.querySelector("#panSlider"),
  frontButton: document.querySelector("#frontButton"),
  sideButton: document.querySelector("#sideButton"),
  resetButton: document.querySelector("#resetButton"),
  workDescription: document.querySelector("#workDescription"),
  factArtist: document.querySelector("#factArtist"),
  factDate: document.querySelector("#factDate"),
  factScript: document.querySelector("#factScript"),
  factMuseum: document.querySelector("#factMuseum"),
  sourceLink: document.querySelector("#sourceLink"),
  questionGrid: document.querySelector("#questionGrid"),
  questionInput: document.querySelector("#questionInput"),
  useLlmInput: document.querySelector("#useLlmInput"),
  askButton: document.querySelector("#askButton"),
  answerBox: document.querySelector("#answerBox"),
  sourceBox: document.querySelector("#sourceBox"),
  llmForm: document.querySelector("#llmForm"),
  llmStatus: document.querySelector("#llmStatus"),
  uploadForm: document.querySelector("#uploadForm"),
  uploadResult: document.querySelector("#uploadResult"),
};

function dataUrl(workId, file) {
  return `${STATIC_DATA_BASE}/${workId}/${file}`;
}

function normalizeAssetPath(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("data/")) return `../${path}`;
  return dataUrl(state.workId, path);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function loadWork() {
  try {
    state.work = await fetchJson(`${API_BASE}/api/works/${state.workId}`);
  } catch {
    state.work = await fetchJson(dataUrl(state.workId, "work-info.json"));
  }
  renderWork();
}

function renderWork() {
  const work = state.work;
  els.workTitle.textContent = work.title || "赵孟頫《光福重建塔记》";
  els.workMeta.textContent = [work.dynasty, work.script_type, work.museum].filter(Boolean).join(" · ");
  els.workDescription.textContent = work.description || "本系统展示书法作品原图、悬浮 3D 墨迹和本地 RAG 导览问答。";
  els.factArtist.textContent = work.artist || "赵孟頫";
  els.factDate.textContent = work.date || "至治元年（1321）";
  els.factScript.textContent = work.script_type || "行书";
  els.factMuseum.textContent = work.museum || "上海博物馆";
  if (work.source_url) els.sourceLink.href = work.source_url;
  els.workImage.src = dataUrl(work.id || state.workId, work.images?.original || "original.png");
}

function setView(view) {
  state.view = view;
  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== view;
  });
}

function setMode(mode) {
  state.mode = mode;
  els.imageModeButton.classList.toggle("active", mode === "image");
  els.threeModeButton.classList.toggle("active", mode === "three");
  els.workImage.hidden = mode !== "image";
  els.threeCanvas.hidden = mode !== "three";
  els.threeControls.hidden = mode !== "three";
  if (mode === "three") initThree();
}

function showStatus(message, persist = false) {
  els.stageStatus.textContent = message;
  els.stageStatus.hidden = false;
  if (!persist) {
    window.setTimeout(() => {
      els.stageStatus.hidden = true;
    }, 2800);
  }
}

function initThree() {
  if (!state.three.ready) {
    const renderer = new THREE.WebGLRenderer({
      canvas: els.threeCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
    camera.position.set(0, 0, 28);

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xffffff, 1.75);
    const key = new THREE.DirectionalLight(0xfff6e2, 1.35);
    key.position.set(0, -5, 9);
    const side = new THREE.DirectionalLight(0xd7e7ff, 0.72);
    side.position.set(-5, 4, 6);
    scene.add(ambient, key, side);

    state.three = { ...state.three, ready: true, renderer, scene, camera, root };
    bindThreePointer();
    animate();
  }
  resizeThree();
  buildFloatingScroll();
}

function resizeThree() {
  if (!state.three.ready) return;
  const rect = els.threeCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  state.three.renderer.setSize(width, height, false);
  state.three.camera.aspect = width / height;
  state.three.camera.updateProjectionMatrix();
}

async function buildFloatingScroll() {
  const work = state.work;
  const key = `${work?.id}:${work?.floating3d?.records || "full_scroll_3d_data.json"}`;
  if (state.three.assetKey === key) return;
  state.three.assetKey = key;
  showStatus("正在合成悬浮 3D 墨迹层...", true);

  try {
    const records = await fetchJson(dataUrl(work.id || state.workId, work.floating3d?.records || "full_scroll_3d_data.json"));
    const group = await createFloatingScroll(records);
    if (state.three.scrollGroup) state.three.root.remove(state.three.scrollGroup);
    state.three.scrollGroup = group;
    state.three.root.add(group);
    applyView();
    showStatus(`已载入 ${records.length} 个墨迹候选，拖拽可旋转，滑条可水平移动。`);
  } catch (error) {
    console.error(error);
    showStatus("悬浮 3D 数据加载失败，请确认 full_scroll_3d_data.json 和 glyph 图片存在。", true);
  }
}

async function createFloatingScroll(records) {
  const scrollWidth = Math.max(...records.map((item) => item.scroll_x + item.width), 18332);
  const scrollHeight = Math.max(...records.map((item) => item.scroll_y + item.height), 2100);
  const canvasWidth = 4096;
  const canvasHeight = Math.max(256, Math.round(canvasWidth * scrollHeight / scrollWidth));
  const inkCanvas = document.createElement("canvas");
  const alphaCanvas = document.createElement("canvas");
  const heightCanvas = document.createElement("canvas");
  inkCanvas.width = alphaCanvas.width = heightCanvas.width = canvasWidth;
  inkCanvas.height = alphaCanvas.height = heightCanvas.height = canvasHeight;
  const inkCtx = inkCanvas.getContext("2d");
  const alphaCtx = alphaCanvas.getContext("2d");
  const heightCtx = heightCanvas.getContext("2d");

  inkCtx.fillStyle = "#211d19";
  alphaCtx.fillStyle = "#000";
  heightCtx.fillStyle = "#000";
  alphaCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  heightCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  const batchSize = 48;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    await Promise.all(batch.map((record) => drawGlyph(record, scrollWidth, scrollHeight, canvasWidth, canvasHeight, inkCtx, alphaCtx, heightCtx)));
  }

  const group = new THREE.Group();
  const planeHeight = 4.9;
  const planeWidth = planeHeight * (scrollWidth / scrollHeight);

  const paperTexture = new THREE.TextureLoader().load(dataUrl(state.workId, "original.png"));
  paperTexture.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1),
    new THREE.MeshStandardMaterial({
      map: paperTexture,
      color: 0xf3e7d4,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      opacity: 0.88,
    }),
  );
  paper.position.z = -0.08;

  const inkTexture = new THREE.CanvasTexture(inkCanvas);
  const alphaTexture = new THREE.CanvasTexture(alphaCanvas);
  const heightTexture = new THREE.CanvasTexture(heightCanvas);
  inkTexture.colorSpace = THREE.SRGBColorSpace;

  const ink = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight, 2048, 256),
    new THREE.MeshStandardMaterial({
      map: inkTexture,
      alphaMap: alphaTexture,
      displacementMap: heightTexture,
      displacementScale: 0.48,
      displacementBias: 0.1,
      bumpMap: heightTexture,
      bumpScale: 0.05,
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.FrontSide,
    }),
  );
  ink.position.z = 0.12;
  ink.userData.kind = "floatingInk";

  group.add(paper, ink);
  group.userData = { planeWidth, planeHeight };
  return group;
}

async function drawGlyph(record, scrollWidth, scrollHeight, canvasWidth, canvasHeight, inkCtx, alphaCtx, heightCtx) {
  const mask = await loadImage(normalizeAssetPath(record.img_path));
  const height = await loadImage(normalizeAssetPath(record.height_path || record.img_path));
  const x = (record.scroll_x / scrollWidth) * canvasWidth;
  const y = (record.scroll_y / scrollHeight) * canvasHeight;
  const w = Math.max(1, (record.width / scrollWidth) * canvasWidth);
  const h = Math.max(1, (record.height / scrollHeight) * canvasHeight);

  inkCtx.save();
  inkCtx.globalAlpha = 0.96;
  inkCtx.drawImage(mask, x, y, w, h);
  inkCtx.globalCompositeOperation = "source-atop";
  inkCtx.fillStyle = "#211d19";
  inkCtx.fillRect(x, y, w, h);
  inkCtx.restore();

  alphaCtx.drawImage(height, x, y, w, h);
  heightCtx.drawImage(height, x, y, w, h);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载图片：${src}`));
    image.src = src;
  });
}

function animate() {
  requestAnimationFrame(animate);
  if (!state.three.ready) return;
  state.three.root.rotation.x += (state.three.rotX - state.three.root.rotation.x) * 0.15;
  state.three.root.rotation.y += (state.three.rotY - state.three.root.rotation.y) * 0.15;
  applyView();
  state.three.renderer.render(state.three.scene, state.three.camera);
}

function applyView() {
  if (!state.three.ready || !state.three.scrollGroup) return;
  const zoom = Math.min(4.2, Math.max(0.55, state.three.zoom));
  const plane = state.three.scrollGroup.userData;
  const visibleWidth = 2 * Math.tan((state.three.camera.fov * Math.PI) / 360) * state.three.camera.position.z * state.three.camera.aspect;
  const limitX = Math.max(0, (plane.planeWidth - visibleWidth / zoom) / 2);
  state.three.scrollGroup.scale.setScalar(zoom);
  state.three.scrollGroup.position.x = state.three.panX * limitX;
}

function bindThreePointer() {
  els.threeCanvas.addEventListener("pointerdown", (event) => {
    els.threeCanvas.setPointerCapture(event.pointerId);
    state.three.pointer = {
      x: event.clientX,
      y: event.clientY,
      rotX: state.three.rotX,
      rotY: state.three.rotY,
    };
  });
  els.threeCanvas.addEventListener("pointermove", (event) => {
    if (!state.three.pointer) return;
    const dx = event.clientX - state.three.pointer.x;
    const dy = event.clientY - state.three.pointer.y;
    state.three.rotY = Math.max(-1.1, Math.min(1.1, state.three.pointer.rotY + dx * 0.006));
    state.three.rotX = Math.max(-0.62, Math.min(0.62, state.three.pointer.rotX + dy * 0.0045));
  });
  els.threeCanvas.addEventListener("pointerup", () => {
    state.three.pointer = null;
  });
  els.threeCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 1 : -1);
  });
}

function adjustZoom(direction) {
  state.three.zoom *= direction > 0 ? 1.25 : 0.8;
  state.three.zoom = Math.max(0.55, Math.min(4.2, state.three.zoom));
}

async function askQuestion() {
  const question = els.questionInput.value.trim();
  if (!question) return;
  els.answerBox.hidden = false;
  els.answerBox.textContent = "正在检索本地知识库...";
  els.sourceBox.hidden = true;
  try {
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_id: state.workId, question, use_llm: els.useLlmInput.checked }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderAnswer(payload);
  } catch (error) {
    els.answerBox.textContent = `后端问答服务不可用：${error.message}\n请先启动 uvicorn backend.app.main:app --reload --port 8000。`;
  }
}

async function loadLlmStatus() {
  try {
    const status = await fetchJson(`${API_BASE}/api/admin/llm-config`);
    els.llmStatus.textContent = status.configured
      ? `已配置：${status.provider} / ${status.model}，问答区可开启 AI 润色。`
      : "尚未配置 API key。系统会默认使用本地 RAG，不影响演示。";
  } catch {
    els.llmStatus.textContent = "后端未启动，暂时无法读取 AI 配置。";
  }
}

async function saveLlmConfig(event) {
  event.preventDefault();
  const formData = new FormData(els.llmForm);
  els.llmStatus.textContent = "正在保存 AI 配置...";
  try {
    const response = await fetch(`${API_BASE}/api/admin/llm-config`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.llmStatus.textContent = payload.configured
      ? `已配置：${payload.provider} / ${payload.model}。API key 已保存到本机 .env.local。`
      : "未填写 API key，仍使用本地 RAG。";
    els.llmForm.reset();
  } catch (error) {
    els.llmStatus.textContent = `保存失败：${error.message}`;
  }
}

function renderAnswer(payload) {
  els.answerBox.textContent = payload.answer;
  els.sourceBox.hidden = false;
  if (!payload.sources?.length) {
    els.sourceBox.textContent = "没有匹配到来源。";
    return;
  }
  els.sourceBox.innerHTML = `<strong>参考来源</strong><ul>${payload.sources
    .map((source) => {
      const title = escapeHtml(source.title || "未命名资料");
      const label = escapeHtml(source.source || "项目知识库");
      const url = source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${label}</a>` : label;
      return `<li>${title} · ${url}</li>`;
    })
    .join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function uploadWork(event) {
  event.preventDefault();
  els.uploadResult.hidden = false;
  els.uploadResult.textContent = "正在上传并处理图片...";
  const formData = new FormData(els.uploadForm);
  try {
    const response = await fetch(`${API_BASE}/api/admin/upload-work`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `HTTP ${response.status}`);
    els.uploadResult.textContent = `上传完成：${payload.work_id}\n生成文件：${payload.generated.join("、")}`;
  } catch (error) {
    els.uploadResult.textContent = `上传失败：${error.message}\n请确认后端已启动，并且图片格式可被 OpenCV 读取。`;
  }
}

els.navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
els.imageModeButton.addEventListener("click", () => setMode("image"));
els.threeModeButton.addEventListener("click", () => setMode("three"));
els.zoomInButton.addEventListener("click", () => adjustZoom(1));
els.zoomOutButton.addEventListener("click", () => adjustZoom(-1));
els.panSlider.addEventListener("input", (event) => {
  state.three.panX = Number(event.currentTarget.value) / 100;
});
els.frontButton.addEventListener("click", () => {
  state.three.rotX = 0;
  state.three.rotY = 0;
});
els.sideButton.addEventListener("click", () => {
  state.three.rotX = 0.08;
  state.three.rotY = 0.9;
});
els.resetButton.addEventListener("click", () => {
  state.three.zoom = 1;
  state.three.panX = 0;
  state.three.rotX = 0;
  state.three.rotY = 0;
  els.panSlider.value = 0;
});
els.askButton.addEventListener("click", askQuestion);
els.llmForm.addEventListener("submit", saveLlmConfig);
els.questionGrid.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) {
    els.questionInput.value = event.target.textContent.trim();
    askQuestion();
  }
});
els.uploadForm.addEventListener("submit", uploadWork);
window.addEventListener("resize", resizeThree);

loadWork();
loadLlmStatus();
