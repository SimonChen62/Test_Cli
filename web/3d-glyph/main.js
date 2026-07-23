import * as THREE from "../vendor/three.module.js";

const DATA_URL = "../../data/work_003/character_3d/character_3d_data.json";
const META_URL = "../../data/work_003/character_3d/character_3d_meta.json";

const canvas = document.querySelector("#scene");
const errorBox = document.querySelector("#error");
const glyphLabel = document.querySelector("#glyphLabel");
const statusText = document.querySelector("#statusText");
const strokeCountEl = document.querySelector("#strokeCount");
const pointCountEl = document.querySelector("#pointCount");
const timeValueEl = document.querySelector("#timeValue");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const resetCameraButton = document.querySelector("#resetCameraButton");

const state = {
  points: [],
  strokes: [],
  progress: 0,
  playing: true,
  lastFrame: 0,
  duration: 9.5,
  center: new THREE.Vector3(),
  scale: 0.105,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x11100d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
const defaultCamera = new THREE.Vector3(0, -5.8, 23);
camera.position.copy(defaultCamera);
camera.lookAt(0, 0, 0);

const root = new THREE.Group();
scene.add(root);

const paperGroup = new THREE.Group();
root.add(paperGroup);

const ghostGroup = new THREE.Group();
root.add(ghostGroup);

const inkGroup = new THREE.Group();
root.add(inkGroup);

const brushGroup = new THREE.Group();
root.add(brushGroup);

scene.add(new THREE.AmbientLight(0xfff0dc, 2.2));
const keyLight = new THREE.DirectionalLight(0xffdbb0, 2.2);
keyLight.position.set(6, -7, 10);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x88b5c7, 1.1);
rimLight.position.set(-8, 6, 7);
scene.add(rimLight);

const inkMaterial = new THREE.MeshStandardMaterial({
  color: 0x090705,
  roughness: 0.82,
  metalness: 0.02,
  emissive: 0x0f0905,
  emissiveIntensity: 0.32,
});

const ghostMaterial = new THREE.MeshBasicMaterial({
  color: 0x4d4032,
  transparent: true,
  opacity: 0.46,
  depthWrite: false,
});

const brushMaterial = new THREE.MeshStandardMaterial({
  color: 0xf5dfb5,
  emissive: 0x8d5f28,
  emissiveIntensity: 0.46,
  roughness: 0.46,
  metalness: 0.04,
});

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
  statusText.textContent = message;
}

function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(1, clientHeight);
  camera.updateProjectionMatrix();
}

function groupByStroke(points) {
  const groups = new Map();
  points.forEach((point) => {
    if (!groups.has(point.stroke_id)) groups.set(point.stroke_id, []);
    groups.get(point.stroke_id).push(point);
  });
  return [...groups.entries()]
    .map(([strokeId, strokePoints]) => ({
      strokeId,
      points: strokePoints.sort((a, b) => a.point_index - b.point_index),
    }))
    .sort((a, b) => {
      const at = a.points[0]?.t ?? 0;
      const bt = b.points[0]?.t ?? 0;
      return at - bt;
    });
}

function computeBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function toVector(point) {
  return new THREE.Vector3(
    (point.x - state.center.x) * state.scale,
    (state.center.y - point.y) * state.scale,
    point.z * state.scale * 1.8
  );
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.geometry?.dispose?.();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose?.());
    }
  }
}

function makePaper(bounds) {
  const width = (bounds.maxX - bounds.minX + 32) * state.scale;
  const height = (bounds.maxY - bounds.minY + 32) * state.scale;
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfff0d2,
      side: THREE.DoubleSide,
    })
  );
  paper.position.z = -1.8;
  paperGroup.add(paper);

  const ruleMaterial = new THREE.LineBasicMaterial({
    color: 0xb9a98a,
    transparent: true,
    opacity: 0.22,
  });
  for (let i = 0; i <= 5; i += 1) {
    const y = -height / 2 + (height / 5) * i;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2, y, -1.65),
        new THREE.Vector3(width / 2, y, -1.65),
      ]),
      ruleMaterial.clone()
    );
    paperGroup.add(line);
  }
}

function makeGhostStrokes() {
  state.strokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(stroke.points.map(toVector), false, "catmullrom", 0.45);
    const radius = Math.max(0.018, averageThickness(stroke.points) * state.scale * 0.08);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, radius, 8, false), ghostMaterial.clone());
    ghostGroup.add(mesh);
  });
}

function averageThickness(points) {
  return points.reduce((sum, point) => sum + point.thickness, 0) / Math.max(1, points.length);
}

function strokeVisiblePoints(stroke, progress) {
  return stroke.points.filter((point) => point.t <= progress);
}

function makeVisibleStroke(stroke, visiblePoints) {
  if (visiblePoints.length < 2) return;
  const vectors = visiblePoints.map(toVector);
  const curve = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.45);
  const radius = Math.max(0.025, averageThickness(visiblePoints) * state.scale * 0.105);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, vectors.length * 3), radius, 10, false), inkMaterial);
  inkGroup.add(mesh);

  visiblePoints.forEach((point, index) => {
    if (index % 2 !== 0) return;
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.026, point.thickness * state.scale * 0.085), 12, 8),
      inkMaterial
    );
    bead.position.copy(toVector(point));
    inkGroup.add(bead);
  });
}

function currentPoint(progress) {
  let candidate = state.points[0];
  for (const point of state.points) {
    if (point.t <= progress) candidate = point;
    else break;
  }
  return candidate;
}

function renderInk() {
  clearGroup(inkGroup);
  clearGroup(brushGroup);

  state.strokes.forEach((stroke) => {
    const visiblePoints = strokeVisiblePoints(stroke, state.progress);
    makeVisibleStroke(stroke, visiblePoints);
  });

  const point = currentPoint(state.progress);
  if (point) {
    const brush = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.14, point.thickness * state.scale * 0.16), 24, 16),
      brushMaterial
    );
    brush.position.copy(toVector(point));
    brush.position.z += 0.38;
    brushGroup.add(brush);
  }
}

function updateCamera() {
  const point = currentPoint(state.progress);
  if (!point) return;
  const target = toVector(point);
  const orbit = Math.sin(state.progress * Math.PI * 2) * 2.4;
  const desired = new THREE.Vector3(target.x * 0.22 + orbit, target.y * 0.16 - 7.6, 34 + Math.sin(state.progress * Math.PI) * 2.2);
  camera.position.lerp(desired, 0.035);
  camera.lookAt(target.x * 0.2, target.y * 0.18, -0.8);
}

function renderFrame(timestamp) {
  if (!state.lastFrame) state.lastFrame = timestamp;
  const delta = (timestamp - state.lastFrame) / 1000;
  state.lastFrame = timestamp;

  if (state.playing) {
    state.progress = Math.min(1, state.progress + delta / state.duration);
    if (state.progress >= 1) state.playing = false;
  }

  renderInk();
  updateCamera();
  timeValueEl.textContent = `${Math.round(state.progress * 100)}%`;
  renderer.render(scene, camera);
  requestAnimationFrame(renderFrame);
}

function resetCamera() {
  camera.position.copy(defaultCamera);
  camera.lookAt(0, 0, 0);
}

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`无法加载 ${DATA_URL}: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error("character_3d_data.json 为空或格式不正确。");
  }

  let meta = {};
  try {
    const metaResponse = await fetch(META_URL);
    if (metaResponse.ok) meta = await metaResponse.json();
  } catch {
    meta = {};
  }

  state.points = data.sort((a, b) => a.t - b.t);
  state.strokes = groupByStroke(state.points);
  const bounds = computeBounds(state.points);
  state.center.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0);
  const maxSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  state.scale = 17 / maxSpan;

  glyphLabel.textContent = meta.label ? `当前字形：${meta.label}` : "当前字形：估计轨迹";
  statusText.textContent = meta.note || "基于骨架和距离变换生成估计动态运笔。";
  strokeCountEl.textContent = String(state.strokes.length);
  pointCountEl.textContent = String(state.points.length);

  makePaper(bounds);
  makeGhostStrokes();
}

playButton.addEventListener("click", () => {
  state.playing = true;
});

pauseButton.addEventListener("click", () => {
  state.playing = false;
});

restartButton.addEventListener("click", () => {
  state.progress = 0;
  state.playing = true;
  resetCamera();
});

resetCameraButton.addEventListener("click", resetCamera);
window.addEventListener("resize", resize);

resize();
loadData()
  .then(() => {
    requestAnimationFrame(renderFrame);
  })
  .catch((error) => {
    console.error(error);
    showError(error.message);
  });
