import * as THREE from "../web/vendor/three.module.js";

const canvas = document.querySelector("#qiverseCanvas");
const launchPanel = document.querySelector("#launchPanel");
const startButton = document.querySelector("#startButton");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const xrButton = document.querySelector("#xrButton");
const sceneKicker = document.querySelector("#sceneKicker");
const sceneTitle = document.querySelector("#sceneTitle");
const sceneText = document.querySelector("#sceneText");
const chapterButtons = Array.from(document.querySelectorAll(".chapter"));
const pathWidthSlider = document.querySelector("#pathWidthSlider");
const pathOpacitySlider = document.querySelector("#pathOpacitySlider");
const selectedStrokeName = document.querySelector("#selectedStrokeName");
const clearStrokeSelectionButton = document.querySelector("#clearStrokeSelectionButton");
const ridePrompt = document.querySelector("#ridePrompt");
const rideStartButton = document.querySelector("#rideStartButton");
const qiPrompt = document.querySelector("#qiPrompt");
const qiStartButton = document.querySelector("#qiStartButton");

const WORK_DATA_URL = "./calligraphy-work.json";
const QIVERSE_MODEL_FALLBACK_URL = "../data/work_003/qiverse-work.json";
const sceneOrder = ["galaxy", "assemble", "enter", "ride", "qi", "void", "return"];
const journeyDurations = [0, 4200, 8200, 12400, 39000, 55200, 59400];
const SCROLL_WIDTH = 31.5;
const MAX_PARTICLES = 280000;
const RIDE_DURATION_MS = 26000;
const RIDE_REPLAY_DURATION_MS = 5200;
const QI_DURATION_MS = 15000;
const RIDE_STROKE_ORDER = [
  "guang-left-dot",
  "guang-right-dot",
  "guang-center-vertical",
  "guang-cross",
  "guang-left-leg",
  "guang-right-leg-hook",
];
const QI_STROKE_ORDER = [
  "guang-center-vertical",
  "guang-left-dot",
  "guang-right-dot",
  "guang-cross",
  "guang-left-leg",
  "guang-right-leg-hook",
];
const ENTER_HOTSPOT_WORLD_X = 11.55;
const ENTER_HOTSPOT_WORLD_Y = 1.8;
const ENTER_DISPLAY_WORLD_X = 9.3;
const ENTER_DISPLAY_WORLD_Y = -0.15;
const ENTER_GLYPH_SCALE = 1.08;
const ENTER_GLYPH_ROTATION_Z = -0.02;
const FU_GLYPH_IMAGE = "../data/work_003/glyphs/fu_height.png";
const FU_HOTSPOT_WORLD_X = 11.55;
const FU_HOTSPOT_WORLD_Y = 0.62;
const FU_DISPLAY_WORLD_X = 8.15;
const FU_DISPLAY_WORLD_Y = -0.18;
const FU_GLYPH_SCALE = 0.92;
const FU_GLYPH_ROTATION_Z = -0.02;
const FU_GLYPH_MODEL = {
  id: "fu",
  glyph: "福",
  bounds: { x: 0, y: 0, width: 633, height: 555 },
  strokes: [
    { id: "fu-top-dot", label: "upper dot", points: [[0.50, 0.22], [0.58, 0.20], [0.66, 0.22]], widthScale: 0.62, inkDensityScale: 0.72, curvature: 0.28 },
    { id: "fu-left-sweep", label: "left radical sweep", points: [[0.45, 0.36], [0.37, 0.43], [0.28, 0.47], [0.23, 0.46]], widthScale: 0.76, inkDensityScale: 0.74, curvature: 0.4 },
    { id: "fu-left-vertical", label: "left radical vertical", points: [[0.50, 0.35], [0.50, 0.51], [0.47, 0.66], [0.46, 0.82]], widthScale: 0.88, inkDensityScale: 0.82, curvature: 0.32 },
    { id: "fu-left-short", label: "left radical short stroke", points: [[0.49, 0.58], [0.42, 0.66], [0.36, 0.72]], widthScale: 0.7, inkDensityScale: 0.68, curvature: 0.36 },
    { id: "fu-right-top", label: "right top stroke", points: [[0.66, 0.25], [0.78, 0.18], [0.91, 0.12]], widthScale: 0.92, inkDensityScale: 0.86, curvature: 0.3 },
    { id: "fu-right-mouth", label: "right middle enclosure", points: [[0.70, 0.35], [0.83, 0.30], [0.93, 0.38], [0.88, 0.51], [0.74, 0.50], [0.70, 0.35]], widthScale: 0.88, inkDensityScale: 0.84, curvature: 0.42 },
    { id: "fu-right-lower-left", label: "right lower left", points: [[0.67, 0.58], [0.69, 0.70], [0.77, 0.81]], widthScale: 0.82, inkDensityScale: 0.78, curvature: 0.34 },
    { id: "fu-right-lower-box", label: "right lower enclosure", points: [[0.78, 0.60], [0.94, 0.64], [0.95, 0.78], [0.83, 0.86], [0.72, 0.80]], widthScale: 0.92, inkDensityScale: 0.84, curvature: 0.46 },
  ],
};

const sceneCopy = {
  galaxy: {
    kicker: "Scene 0",
    title: "Stardust / 星尘",
    text: "先不出现纸面，也不贴原图。整卷墨迹被拆成散落星尘，等待重新成字。",
    camera: [0, 0.2, 19],
    target: [0, 0, 0],
  },
  assemble: {
    kicker: "Scene 1",
    title: "Character Constellation / 星字长卷",
    text: "星点从远处归位，沿整卷墨迹高度图组成每一个字。墨迹越重，星点越密、越亮、越向前。",
    camera: [0, -0.12, 13.5],
    target: [0, 0, 0],
  },
  enter: {
    kicker: "Scene 2",
    title: "Enter the Stroke / 进入笔画",
    text: "先在长卷中寻找右上角第一个「光」。点击它，蒙版会浮现，再进入真实图像里的第一处墨痕。",
    camera: [10.4, -0.42, 6.4],
    target: [9.3, -0.15, 0.7],
  },
  ride: {
    kicker: "Scene 3",
    title: "Ride the Stroke / 御笔而行",
    text: "镜头沿现有笔画骨架进入墨迹：加速、减速、转折和顿挫来自 stroke 数据的速度、浓淡与转折点。",
    camera: [9.4, -0.25, 4.2],
    target: [8.9, -0.1, 0.8],
  },
  qi: {
    kicker: "Scene 4",
    title: "Follow the Qi / 追随气脉",
    text: "墨迹已断，势未必断。画面保留轻微流动感，提示观看者在相邻笔画和字势之间寻找连接。",
    camera: [8.4, -0.35, 5.4],
    target: [7.7, -0.08, 0.7],
  },
  void: {
    kicker: "Scene 5",
    title: "Walk into the Void / 进入留白",
    text: "刚才你一直在看墨。现在看看没有被写出的地方：字内、字间、行间留白共同组织呼吸和节奏。",
    camera: [6.2, -0.18, 5.6],
    target: [5.7, -0.08, 0.2],
  },
  return: {
    kicker: "Scene 6",
    title: "Return / 回看原作",
    text: "所有解释性特效退后，重新面对原作。现在，你看到的还是刚才那幅字吗？",
    camera: [0, 0.1, 33],
    target: [0, 0, 0],
  },
};

const state = {
  currentScene: "galaxy",
  running: false,
  paused: false,
  sceneStartedAt: performance.now(),
  autoTimers: [],
  autoJourneyActive: false,
  data: null,
  enterGlyphPaths: null,
  renderer: null,
  threeScene: null,
  world: null,
  camera: null,
  particleSystem: null,
  particleGeometry: null,
  particleMaterial: null,
  positions: null,
  targets: null,
  galaxy: null,
  scatter: null,
  voidTargets: null,
  baseColors: null,
  colors: null,
  density: null,
  anchors: null,
  backgroundStars: null,
  enterGlyphGroup: null,
  enterGlyphPoints: null,
  enterMaskMesh: null,
  activeEnterGlyphId: "guang",
  fuGlyphGroup: null,
  fuGlyphPoints: null,
  fuMaskMesh: null,
  fuRibbonGroup: null,
  fuRibbonMeshes: [],
  fuRibbonMaterials: [],
  fuPathGroup: null,
  fuPathMeshes: [],
  fuPathMaterials: [],
  enterRevealStarted: false,
  enterRevealStartedAt: 0,
  enterRibbonGroup: null,
  enterRibbonMeshes: [],
  enterRibbonMaterials: [],
  enterPathGroup: null,
  enterPathMeshes: [],
  enterPathMaterials: [],
  enterPathWidth: 0.062,
  enterPathOpacity: 0.82,
  rideSegments: [],
  rideTotalLength: 0,
  rideDurationMs: RIDE_DURATION_MS,
  rideStarted: false,
  rideReplaySegment: null,
  rideReplayStartedAt: 0,
  qiFlowGroup: null,
  qiFlowLinks: [],
  qiStrokeCursor: null,
  qiMotionSegments: [],
  qiDurationMs: QI_DURATION_MS,
  qiStarted: false,
  qiStartedAt: 0,
  selectedStrokeMesh: null,
  raycaster: new THREE.Raycaster(),
  ndcPointer: new THREE.Vector2(),
  workHeight: 3.6,
  clock: new THREE.Clock(),
  cameraTarget: new THREE.Vector3(),
  zoom: 1,
  targetZoom: 1,
  pointer: { active: false, x: 0, y: 0, downX: 0, downY: 0, yaw: 0, pitch: 0 },
  session: {
    id: `qiverse-${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    sceneVisits: [],
    exportedAt: "",
    notes: "本 session 不记录个人敏感信息，只记录 QiVerse 体验章节访问。"
  },
};

function createSeededRandom(seed = 0x6d2b79f5) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createSeededRandom();

function randomRange(min, max) {
  return min + random() * (max - min);
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function resolveAssetPath(path) {
  if (!path) return "../data/work_003/height.png";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("../")) return path;
  return `../${path.replace(/\\/g, "/")}`;
}

function makeParticleTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 64;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.36, "rgba(255, 246, 214, 0.92)");
  gradient.addColorStop(0.7, "rgba(255, 215, 145, 0.25)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.needsUpdate = true;
  return texture;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载图像：${src}`));
    image.src = src;
  });
}

async function loadData() {
  const workResponse = await fetch(WORK_DATA_URL, { cache: "no-store" });
  if (!workResponse.ok) throw new Error(`无法加载 QiVerse 数据：${workResponse.status}`);
  state.data = await workResponse.json();
  const modelUrl = state.data.model ? resolveAssetPath(state.data.model) : QIVERSE_MODEL_FALLBACK_URL;
  const modelResponse = await fetch(`${modelUrl}?t=${Date.now()}`, { cache: "no-store" });
  if (!modelResponse.ok) throw new Error(`无法加载 QiVerse 数据模型：${modelResponse.status}`);
  state.enterGlyphPaths = normalizeQiVerseModel(await modelResponse.json());
}

function averageValue(value, fallback = 1) {
  if (Array.isArray(value)) {
    const numbers = value.filter((item) => Number.isFinite(item));
    if (!numbers.length) return fallback;
    return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
  }
  return Number.isFinite(value) ? value : fallback;
}

function normalizeQiVerseModel(model) {
  if (!model?.glyphs?.length) return model;
  const targetGlyphId = model.renderHints?.enterGlyphId;
  const glyph = model.glyphs.find((item) => item.id === targetGlyphId) || model.glyphs[0];
  state.enterPathWidth = Number(model.renderHints?.baseStrokeRadius) || state.enterPathWidth;
  state.enterPathOpacity = Number(model.renderHints?.baseStrokeOpacity) || state.enterPathOpacity;

  return {
    source: model.source,
    workId: model.work?.sourceWorkId || model.work?.id,
    glyph: glyph.character,
    image: glyph.image || model.work?.heightImage,
    bounds: glyph.bounds,
    coordinate: glyph.coordinate,
    strokes: glyph.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.path || stroke.points,
      widthScale: averageValue(stroke.width, 1),
      inkDensityScale: averageValue(stroke.inkDensity, 1),
      curvature: Number.isFinite(stroke.curvature) ? stroke.curvature : 0.35,
    })),
    qiLinks: model.qiLinks || [],
    voidRegions: model.voidRegions || [],
  };
}

function sampleScrollHeightMap(image, maxPoints = MAX_PARTICLES) {
  const sampleWidth = 4600;
  const sampleHeight = Math.max(160, Math.round(sampleWidth / (image.width / image.height)));
  const sampler = document.createElement("canvas");
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const context = sampler.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const candidates = [];

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const alpha = pixels[index + 3] / 255;
      const brightness = ((r + g + b) / 765) * alpha;
      if (brightness < 0.08) continue;
      const keepChance = 0.46 + Math.pow(brightness, 0.68) * 0.92;
      if (random() <= keepChance) candidates.push({ x, y, density: brightness });
    }
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const selected = candidates.slice(0, maxPoints);
  state.workHeight = SCROLL_WIDTH / (image.width / image.height);
  return selected.map((point, index) => {
    const nx = point.x / sampleWidth - 0.5;
    const ny = 0.5 - point.y / sampleHeight;
    const ridge = Math.pow(THREE.MathUtils.clamp(point.density, 0, 1), 1.35);
    const z = ridge * 0.72 + Math.sin(index * 0.97) * 0.018;
    return {
      target: new THREE.Vector3(nx * SCROLL_WIDTH, ny * state.workHeight, z),
      density: point.density,
    };
  });
}

function createBackgroundStars() {
  const count = 1100;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const p = i * 3;
    positions[p] = randomRange(-32, 32);
    positions[p + 1] = randomRange(-12, 12);
    positions[p + 2] = randomRange(-26, -4);
    const warm = random();
    colors[p] = 0.34 + warm * 0.42;
    colors[p + 1] = 0.32 + warm * 0.32;
    colors[p + 2] = 0.34 + warm * 0.28;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.028,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
  });

  state.backgroundStars = new THREE.Points(geometry, material);
  state.threeScene.add(state.backgroundStars);
}

function createParticleField(samples) {
  const count = samples.length;
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const galaxy = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const voidTargets = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColors = new Float32Array(count * 3);
  const density = new Float32Array(count);
  const anchors = new Float32Array(count);

  samples.forEach((sample, index) => {
    const i = index * 3;
    const target = sample.target;
    const arm = index % 6;
    const radius = 2.2 + Math.sqrt(index / count) * 16.8 + randomRange(-0.8, 1.4);
    const theta = index * 0.029 + arm * ((Math.PI * 2) / 6);
    const swirl = theta + radius * 0.22;
    const gapPush = Math.sign(target.y || 1) * (0.42 + random() * 0.66);

    galaxy[i] = Math.cos(swirl) * radius;
    galaxy[i + 1] = Math.sin(swirl) * radius * 0.46 + randomRange(-1.4, 1.4);
    galaxy[i + 2] = randomRange(-9.5, 7.5);
    scatter[i] = target.x + randomRange(-1.2, 1.2);
    scatter[i + 1] = target.y + randomRange(-1.0, 1.0);
    scatter[i + 2] = randomRange(-1.4, 2.4);
    voidTargets[i] = target.x + Math.sin(index * 0.11) * 0.22;
    voidTargets[i + 1] = target.y + gapPush;
    voidTargets[i + 2] = target.z * 0.42 + randomRange(-0.18, 0.42);

    targets[i] = target.x;
    targets[i + 1] = target.y;
    targets[i + 2] = target.z;
    positions[i] = galaxy[i];
    positions[i + 1] = galaxy[i + 1];
    positions[i + 2] = galaxy[i + 2];

    density[index] = sample.density;
    anchors[index] = target.x;
    const gold = sample.density;
    baseColors[i] = 0.62 + gold * 0.34;
    baseColors[i + 1] = 0.5 + gold * 0.32;
    baseColors[i + 2] = 0.34 + gold * 0.18;
    colors[i] = baseColors[i];
    colors[i + 1] = baseColors[i + 1];
    colors[i + 2] = baseColors[i + 2];
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.014,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
  });

  state.positions = positions;
  state.targets = targets;
  state.galaxy = galaxy;
  state.scatter = scatter;
  state.voidTargets = voidTargets;
  state.baseColors = baseColors;
  state.colors = colors;
  state.density = density;
  state.anchors = anchors;
  state.particleGeometry = geometry;
  state.particleMaterial = material;
  state.particleSystem = new THREE.Points(geometry, material);
  state.world.add(state.particleSystem);
}

function setGroupOpacity(group, opacity) {
  if (!group) return;
  group.traverse((object) => {
    if (!object.material) return;
    object.material.transparent = true;
    object.material.opacity = opacity;
  });
}

function detectTopRightGlyphBounds(image) {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = image.width;
  sampleCanvas.height = image.height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;

  const focusX0 = Math.floor(image.width * 0.885);
  const focusX1 = image.width;
  const focusY0 = 0;
  const focusY1 = Math.floor(image.height * 0.36);
  const rowCounts = [];
  const threshold = 42;

  for (let y = focusY0; y < focusY1; y += 1) {
    let count = 0;
    for (let x = focusX0; x < focusX1; x += 1) {
      const index = (y * image.width + x) * 4;
      const value = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      if (value > threshold) count += 1;
    }
    rowCounts.push(count);
  }

  const rowThreshold = Math.max(5, Math.round((focusX1 - focusX0) * 0.018));
  let top = focusY0;
  while (top < focusY1 && rowCounts[top - focusY0] <= rowThreshold) top += 1;

  let bottom = Math.min(focusY1, top + Math.round(image.height * 0.2));
  let emptyRun = 0;
  for (let y = top + 36; y < focusY1; y += 1) {
    if (rowCounts[y - focusY0] <= rowThreshold) emptyRun += 1;
    else emptyRun = 0;
    if (emptyRun >= 14) {
      bottom = y - emptyRun + 1;
      break;
    }
  }

  const colCounts = new Array(focusX1 - focusX0).fill(0);
  for (let y = top; y < bottom; y += 1) {
    for (let x = focusX0; x < focusX1; x += 1) {
      const index = (y * image.width + x) * 4;
      const value = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      if (value > threshold) colCounts[x - focusX0] += 1;
    }
  }

  const colThreshold = Math.max(3, Math.round((bottom - top) * 0.035));
  let left = focusX0;
  let right = focusX1 - 1;
  while (left < focusX1 && colCounts[left - focusX0] <= colThreshold) left += 1;
  while (right > focusX0 && colCounts[right - focusX0] <= colThreshold) right -= 1;

  if (left >= right || top >= bottom) {
    return {
      x: Math.floor(image.width * 0.91),
      y: 0,
      width: Math.floor(image.width * 0.085),
      height: Math.floor(image.height * 0.22),
    };
  }

  const padX = Math.round((right - left) * 0.26);
  const padY = Math.round((bottom - top) * 0.22);
  left = Math.max(0, left - padX);
  right = Math.min(image.width - 1, right + padX);
  top = Math.max(0, top - padY);
  bottom = Math.min(image.height - 1, bottom + padY);

  return {
    x: left,
    y: top,
    width: Math.max(24, right - left + 1),
    height: Math.max(24, bottom - top + 1),
  };
}

function buildEnterGlyphPreview(image) {
  const bounds = state.enterGlyphPaths?.bounds || detectTopRightGlyphBounds(image);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = image.width;
  sampleCanvas.height = image.height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const positions = [];
  const colors = [];
  const step = 1;
  const previewWidth = 4.6;
  const pixelSpacing = previewWidth / Math.max(1, bounds.width);

  for (let y = bounds.y; y < bounds.y + bounds.height; y += step) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += step) {
      const index = (y * image.width + x) * 4;
      const brightness = ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 765) * (pixels[index + 3] / 255);
      if (brightness < 0.055) continue;
      if (brightness < 0.18 && random() > 0.72) continue;
      const px = ((x - bounds.x) / bounds.width - 0.5) * previewWidth;
      const py = ((bounds.height * 0.5 - (y - bounds.y)) / bounds.width) * previewWidth;
      const ridge = Math.pow(THREE.MathUtils.clamp(brightness, 0, 1), 1.25);
      const repeat = brightness > 0.52 ? 3 : brightness > 0.24 ? 2 : 1;

      for (let copy = 0; copy < repeat; copy += 1) {
        const jitter = copy === 0 ? 0 : pixelSpacing * 0.42;
        positions.push(
          px + randomRange(-jitter, jitter),
          py + randomRange(-jitter, jitter),
          0.05 + ridge * 0.22 + copy * 0.004
        );
        colors.push(0.88 + ridge * 0.1, 0.68 + ridge * 0.18, 0.34 + ridge * 0.2);
      }
    }
  }

  state.enterGlyphGroup = new THREE.Group();
  state.enterGlyphGroup.name = "Top-right first glyph particle preview";
  state.enterGlyphGroup.position.set(ENTER_DISPLAY_WORLD_X, ENTER_DISPLAY_WORLD_Y, 1.46);
  state.enterGlyphGroup.rotation.z = ENTER_GLYPH_ROTATION_Z;
  state.enterGlyphGroup.scale.setScalar(ENTER_GLYPH_SCALE);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.058,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  state.enterGlyphGroup.add(new THREE.Points(geometry, pointMaterial));
  state.enterGlyphPoints = state.enterGlyphGroup.children.at(-1);

  const maskMaterial = new THREE.MeshBasicMaterial({
    color: 0xd2b26a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const maskHeight = previewWidth * (bounds.height / Math.max(1, bounds.width));
  state.enterMaskMesh = new THREE.Mesh(new THREE.PlaneGeometry(previewWidth * 1.08, maskHeight * 1.16), maskMaterial);
  state.enterMaskMesh.name = "Enter glyph reveal mask";
  state.enterMaskMesh.position.z = 0.36;
  state.enterMaskMesh.scale.setScalar(0.72);
  state.enterGlyphGroup.add(state.enterMaskMesh);

  state.world.add(state.enterGlyphGroup);
  setGroupOpacity(state.enterGlyphGroup, 0);
}

function buildFuGlyphPreview(image) {
  const bounds = FU_GLYPH_MODEL.bounds;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = image.width;
  sampleCanvas.height = image.height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const positions = [];
  const colors = [];
  const previewWidth = 4.6;
  const pixelSpacing = previewWidth / Math.max(1, bounds.width);

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 2) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 2) {
      const index = (y * image.width + x) * 4;
      const brightness = ((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 765) * (pixels[index + 3] / 255);
      if (brightness < 0.052) continue;
      if (brightness < 0.18 && random() > 0.62) continue;
      const px = ((x - bounds.x) / bounds.width - 0.5) * previewWidth;
      const py = ((bounds.height * 0.5 - (y - bounds.y)) / bounds.width) * previewWidth;
      const ridge = Math.pow(THREE.MathUtils.clamp(brightness, 0, 1), 1.18);
      const repeat = brightness > 0.52 ? 3 : brightness > 0.24 ? 2 : 1;

      for (let copy = 0; copy < repeat; copy += 1) {
        const jitter = copy === 0 ? 0 : pixelSpacing * 0.7;
        positions.push(
          px + randomRange(-jitter, jitter),
          py + randomRange(-jitter, jitter),
          0.05 + ridge * 0.24 + copy * 0.004
        );
        colors.push(0.88 + ridge * 0.1, 0.68 + ridge * 0.18, 0.34 + ridge * 0.2);
      }
    }
  }

  state.fuGlyphGroup = new THREE.Group();
  state.fuGlyphGroup.name = "Fu glyph particle preview";
  state.fuGlyphGroup.position.set(FU_DISPLAY_WORLD_X, FU_DISPLAY_WORLD_Y, 1.46);
  state.fuGlyphGroup.rotation.z = FU_GLYPH_ROTATION_Z;
  state.fuGlyphGroup.scale.setScalar(FU_GLYPH_SCALE);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.055,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  state.fuGlyphGroup.add(new THREE.Points(geometry, pointMaterial));
  state.fuGlyphPoints = state.fuGlyphGroup.children.at(-1);

  const maskHeight = previewWidth * (bounds.height / Math.max(1, bounds.width));
  const maskMaterial = new THREE.MeshBasicMaterial({
    color: 0xd2b26a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  state.fuMaskMesh = new THREE.Mesh(new THREE.PlaneGeometry(previewWidth * 1.08, maskHeight * 1.16), maskMaterial);
  state.fuMaskMesh.name = "Fu glyph reveal mask";
  state.fuMaskMesh.position.z = 0.36;
  state.fuMaskMesh.scale.setScalar(0.72);
  state.fuGlyphGroup.add(state.fuMaskMesh);

  state.world.add(state.fuGlyphGroup);
  setGroupOpacity(state.fuGlyphGroup, 0);
}

function glyphPointToLocal(point, bounds, previewWidth = 4.6) {
  const [x, y] = point;
  return new THREE.Vector3(
    (x - 0.5) * previewWidth,
    ((0.5 - y) * bounds.height / bounds.width) * previewWidth,
    0.44
  );
}

function sampleStrokeValue(value, t, fallback = 1) {
  if (Array.isArray(value) && value.length) {
    if (value.length === 1) return Number(value[0]) || fallback;
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * (value.length - 1);
    const index = Math.floor(scaled);
    const next = Math.min(value.length - 1, index + 1);
    const amount = scaled - index;
    return THREE.MathUtils.lerp(Number(value[index]) || fallback, Number(value[next]) || fallback, amount);
  }
  return Number.isFinite(value) ? value : fallback;
}

function createRibbonGeometry(curve, stroke, options = {}) {
  const segments = options.segments || 72;
  const baseHalfWidth = options.baseHalfWidth || 0.12;
  const lift = options.lift || 0;
  const vertices = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const widthValue = sampleStrokeValue(stroke.width, t, stroke.widthScale || 1);
    const densityValue = sampleStrokeValue(stroke.inkDensity, t, stroke.inkDensityScale || 1);
    const edgeWobble = Math.sin(t * Math.PI * 4 + (stroke.curvature || 0) * 3) * 0.012;
    const halfWidth = baseHalfWidth * widthValue;
    const z = 0.28 + lift + densityValue * 0.14;
    const left = point.clone().addScaledVector(normal, halfWidth + edgeWobble);
    const right = point.clone().addScaledVector(normal, -halfWidth + edgeWobble * 0.55);
    left.z = z;
    right.z = z - 0.018;
    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
    const warmth = THREE.MathUtils.clamp(densityValue, 0.25, 1.2);
    colors.push(0.54 + warmth * 0.16, 0.28 + warmth * 0.12, 0.18 + warmth * 0.08);
    colors.push(0.46 + warmth * 0.14, 0.22 + warmth * 0.1, 0.14 + warmth * 0.08);
    uvs.push(0, t, 1, t);
  }

  for (let index = 0; index < segments; index += 1) {
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function rebuildRideRouteMetadata() {
  let totalLength = 0;
  const orderedMeshes = [...state.enterPathMeshes].sort((left, right) => {
    const leftIndex = RIDE_STROKE_ORDER.indexOf(left.name);
    const rightIndex = RIDE_STROKE_ORDER.indexOf(right.name);
    const safeLeft = leftIndex === -1 ? RIDE_STROKE_ORDER.length : leftIndex;
    const safeRight = rightIndex === -1 ? RIDE_STROKE_ORDER.length : rightIndex;
    return safeLeft - safeRight;
  });

  state.rideSegments = orderedMeshes.map((mesh, index) => {
    const stroke = mesh.userData.ribbonMesh?.userData.stroke || {};
    const length = Math.max(0.001, mesh.userData.curve.getLength());
    const segment = {
      mesh,
      curve: mesh.userData.curve,
      stroke,
      index,
      startDistance: totalLength,
      length,
      moveMs: 0,
      pauseMs: 360,
      timeStart: 0,
      timeEnd: 0,
    };
    totalLength += length;
    return segment;
  });

  state.rideTotalLength = totalLength;
  const totalPauseMs = state.rideSegments.reduce((sum, segment) => sum + segment.pauseMs, 0);
  const travelMs = Math.max(6000, state.rideDurationMs - totalPauseMs);
  const speedWeights = state.rideSegments.map((segment) => {
    const speed = THREE.MathUtils.clamp(Number(segment.stroke.speedProxy) || 0.62, 0.32, 1.25);
    return segment.length / speed;
  });
  const weightTotal = speedWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;

  state.rideSegments.forEach((segment, index) => {
    segment.timeStart = cursor;
    segment.moveMs = Math.max(1450, (travelMs * speedWeights[index]) / weightTotal);
    cursor += segment.moveMs + segment.pauseMs;
    segment.timeEnd = cursor;
  });

  const scale = state.rideDurationMs / Math.max(1, cursor);
  cursor = 0;
  state.rideSegments.forEach((segment) => {
    segment.timeStart = cursor;
    segment.moveMs *= scale;
    segment.pauseMs *= scale;
    cursor += segment.moveMs + segment.pauseMs;
    segment.timeEnd = cursor;
  });
}

function buildEnterPathOverlay() {
  if (!state.enterGlyphPaths?.strokes?.length) return;
  const bounds = state.enterGlyphPaths.bounds;
  state.enterRibbonGroup = new THREE.Group();
  state.enterRibbonGroup.name = "3D ink ribbon strokes";
  state.enterRibbonGroup.position.set(ENTER_DISPLAY_WORLD_X, ENTER_DISPLAY_WORLD_Y, 1.43);
  state.enterRibbonGroup.rotation.z = ENTER_GLYPH_ROTATION_Z;
  state.enterRibbonGroup.scale.setScalar(ENTER_GLYPH_SCALE);

  state.enterPathGroup = new THREE.Group();
  state.enterPathGroup.name = "OpenCV-assisted Guang stroke paths";
  state.enterPathGroup.position.set(ENTER_DISPLAY_WORLD_X, ENTER_DISPLAY_WORLD_Y, 1.46);
  state.enterPathGroup.rotation.z = ENTER_GLYPH_ROTATION_Z;
  state.enterPathGroup.scale.setScalar(ENTER_GLYPH_SCALE);

  state.enterGlyphPaths.strokes.forEach((stroke, strokeIndex) => {
    const points = stroke.points.map((point) => glyphPointToLocal(point, bounds));
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", stroke.curvature);
    const ribbonMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    ribbonMaterial.userData.inkDensityScale = stroke.inkDensityScale;
    const ribbonMesh = new THREE.Mesh(createRibbonGeometry(curve, stroke), ribbonMaterial);
    ribbonMesh.name = `${stroke.id}-ribbon`;
    ribbonMesh.userData.strokeId = stroke.id;
    ribbonMesh.userData.curve = curve;
    ribbonMesh.userData.stroke = stroke;
    ribbonMesh.userData.strokeIndex = strokeIndex;
    ribbonMesh.userData.baseWidthScale = stroke.widthScale || 1;
    ribbonMesh.userData.widthMultiplier = 1;
    ribbonMesh.userData.inkMultiplier = 1;
    state.enterRibbonMaterials.push(ribbonMaterial);
    state.enterRibbonMeshes.push(ribbonMesh);
    state.enterRibbonGroup.add(ribbonMesh);

    const material = new THREE.MeshBasicMaterial({
      color: 0xc96b4d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const baseWidthScale = stroke.widthScale || 1;
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, state.enterPathWidth * baseWidthScale, 12, false),
      material
    );
    mesh.name = stroke.id;
    mesh.userData.curve = curve;
    mesh.userData.label = stroke.label || stroke.id;
    mesh.userData.baseWidthScale = baseWidthScale;
    mesh.userData.widthMultiplier = 1;
    mesh.userData.inkMultiplier = 1;
    mesh.userData.ribbonMesh = ribbonMesh;
    material.userData.inkDensityScale = stroke.inkDensityScale;
    material.userData.baseColor = 0xc96b4d;
    state.enterPathMaterials.push(material);
    state.enterPathMeshes.push(mesh);
    state.enterPathGroup.add(mesh);
  });

  state.world.add(state.enterRibbonGroup);
  state.world.add(state.enterPathGroup);
  rebuildRideRouteMetadata();
  buildQiFlowSystem();
  renderStrokeSelection();
}

function buildFuPathOverlay() {
  const bounds = FU_GLYPH_MODEL.bounds;
  state.fuRibbonGroup = new THREE.Group();
  state.fuRibbonGroup.name = "Fu 3D ink ribbon strokes";
  state.fuRibbonGroup.position.set(FU_DISPLAY_WORLD_X, FU_DISPLAY_WORLD_Y, 1.43);
  state.fuRibbonGroup.rotation.z = FU_GLYPH_ROTATION_Z;
  state.fuRibbonGroup.scale.setScalar(FU_GLYPH_SCALE);

  state.fuPathGroup = new THREE.Group();
  state.fuPathGroup.name = "OpenCV-assisted Fu stroke paths";
  state.fuPathGroup.position.set(FU_DISPLAY_WORLD_X, FU_DISPLAY_WORLD_Y, 1.46);
  state.fuPathGroup.rotation.z = FU_GLYPH_ROTATION_Z;
  state.fuPathGroup.scale.setScalar(FU_GLYPH_SCALE);

  FU_GLYPH_MODEL.strokes.forEach((stroke, strokeIndex) => {
    const points = stroke.points.map((point) => glyphPointToLocal(point, bounds));
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", stroke.curvature);
    const ribbonMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    ribbonMaterial.userData.inkDensityScale = stroke.inkDensityScale;
    const ribbonMesh = new THREE.Mesh(createRibbonGeometry(curve, stroke), ribbonMaterial);
    ribbonMesh.name = `${stroke.id}-ribbon`;
    ribbonMesh.userData.strokeId = stroke.id;
    ribbonMesh.userData.strokeIndex = strokeIndex;
    ribbonMesh.userData.inkMultiplier = 1;
    state.fuRibbonMaterials.push(ribbonMaterial);
    state.fuRibbonMeshes.push(ribbonMesh);
    state.fuRibbonGroup.add(ribbonMesh);

    const material = new THREE.MeshBasicMaterial({
      color: 0xc96b4d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    material.userData.inkDensityScale = stroke.inkDensityScale;
    material.userData.baseColor = 0xc96b4d;
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, state.enterPathWidth * (stroke.widthScale || 1), 12, false),
      material
    );
    mesh.name = stroke.id;
    mesh.userData.curve = curve;
    mesh.userData.label = stroke.label || stroke.id;
    mesh.userData.baseWidthScale = stroke.widthScale || 1;
    mesh.userData.inkMultiplier = 1;
    state.fuPathMaterials.push(material);
    state.fuPathMeshes.push(mesh);
    state.fuPathGroup.add(mesh);
  });

  state.world.add(state.fuRibbonGroup);
  state.world.add(state.fuPathGroup);
}

function buildQiFlowSystem() {
  if (!state.enterGlyphPaths?.qiLinks?.length) return;
  const bounds = state.enterGlyphPaths.bounds;
  state.qiFlowGroup = new THREE.Group();
  state.qiFlowGroup.name = "Qi flow links";
  state.qiFlowGroup.position.set(ENTER_DISPLAY_WORLD_X, ENTER_DISPLAY_WORLD_Y, 1.54);
  state.qiFlowGroup.rotation.z = ENTER_GLYPH_ROTATION_Z;
  state.qiFlowGroup.scale.setScalar(ENTER_GLYPH_SCALE);
  state.qiFlowLinks = [];

  state.enterGlyphPaths.qiLinks.forEach((link, linkIndex) => {
    const points = link.path.map((point) => glyphPointToLocal(point, bounds));
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.38);
    const samplePoints = curve.getPoints(56);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(samplePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xf0c875,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.name = `${link.id}-qi-line`;
    state.qiFlowGroup.add(line);

    const particleCount = 44;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffdc7a,
      size: 0.034,
      map: makeParticleTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = `${link.id}-qi-particles`;
    state.qiFlowGroup.add(particles);

    state.qiFlowLinks.push({
      link,
      linkIndex,
      curve,
      line,
      lineMaterial,
      particles,
      particleGeometry,
      particleMaterial,
      particleCount,
      durationMs: 2200 + (1 - (Number(link.rhythm) || 0.55)) * 1300,
      pauseMs: 320,
      timeStart: 0,
      timeEnd: 0,
    });
  });

  let cursor = 0;
  state.qiFlowLinks.forEach((item) => {
    item.timeStart = cursor;
    cursor += item.durationMs + item.pauseMs;
    item.timeEnd = cursor;
  });
  rebuildQiMotionTimeline();

  const cursorMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd874,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  state.qiStrokeCursor = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 8), cursorMaterial);
  state.qiStrokeCursor.name = "Qi stroke writing cursor";
  state.qiStrokeCursor.renderOrder = 6;
  state.qiFlowGroup.add(state.qiStrokeCursor);

  state.world.add(state.qiFlowGroup);
}

function rebuildQiMotionTimeline() {
  const strokeById = new Map(state.enterPathMeshes.map((mesh) => [mesh.name, mesh]));
  const linkByFromStrokeId = new Map(state.qiFlowLinks.map((item) => [item.link.fromStrokeId, item]));
  const segments = [];
  let cursor = 0;

  QI_STROKE_ORDER.forEach((strokeId, index) => {
    const mesh = strokeById.get(strokeId);
    if (!mesh) return;
    const strokeDuration = 1050 + Math.min(900, mesh.userData.curve.getLength() * 520);
    const strokeSegment = {
      type: "stroke",
      strokeId,
      mesh,
      curve: mesh.userData.curve,
      label: mesh.userData.label || strokeId,
      durationMs: strokeDuration,
      pauseMs: 180,
      timeStart: cursor,
      timeEnd: 0,
      motionIndex: segments.length,
    };
    cursor += strokeSegment.durationMs + strokeSegment.pauseMs;
    strokeSegment.timeEnd = cursor;
    segments.push(strokeSegment);

    if (index >= QI_STROKE_ORDER.length - 1) return;
    const link = linkByFromStrokeId.get(strokeId);
    if (!link) return;
    const linkSegment = {
      type: "link",
      qiLink: link,
      link: link.link,
      curve: link.curve,
      label: link.link.label || link.link.id,
      durationMs: link.durationMs,
      pauseMs: link.pauseMs,
      timeStart: cursor,
      timeEnd: 0,
      motionIndex: segments.length,
    };
    cursor += linkSegment.durationMs + linkSegment.pauseMs;
    linkSegment.timeEnd = cursor;
    link.motionIndex = linkSegment.motionIndex;
    segments.push(linkSegment);
  });

  state.qiMotionSegments = segments;
  state.qiDurationMs = Math.max(QI_DURATION_MS, cursor + 800);
}

function rebuildEnterPathThickness() {
  if (!state.enterPathGroup) return;
  const meshes = state.selectedStrokeMesh ? [state.selectedStrokeMesh] : state.enterPathGroup.children;
  meshes.forEach((mesh) => {
    const oldGeometry = mesh.geometry;
    const radius = state.enterPathWidth * (mesh.userData.baseWidthScale || 1) * (mesh.userData.widthMultiplier || 1);
    mesh.geometry = new THREE.TubeGeometry(mesh.userData.curve, 48, radius, 12, false);
    oldGeometry.dispose();
    const ribbonMesh = mesh.userData.ribbonMesh;
    if (ribbonMesh) {
      const oldRibbonGeometry = ribbonMesh.geometry;
      const stroke = {
        ...ribbonMesh.userData.stroke,
        widthScale: (ribbonMesh.userData.baseWidthScale || 1) * (mesh.userData.widthMultiplier || 1),
        width: Array.isArray(ribbonMesh.userData.stroke.width)
          ? ribbonMesh.userData.stroke.width.map((value) => value * (mesh.userData.widthMultiplier || 1))
          : (ribbonMesh.userData.stroke.width || 1) * (mesh.userData.widthMultiplier || 1),
      };
      ribbonMesh.geometry = createRibbonGeometry(ribbonMesh.userData.curve, stroke);
      oldRibbonGeometry.dispose();
      ribbonMesh.userData.widthMultiplier = mesh.userData.widthMultiplier || 1;
    }
  });
}

function renderStrokeSelection() {
  if (selectedStrokeName) {
    selectedStrokeName.textContent = state.selectedStrokeMesh?.userData.label || "全部笔画";
  }

  state.enterPathMeshes.forEach((mesh) => {
    const selected = mesh === state.selectedStrokeMesh;
    if (mesh.material?.color) mesh.material.color.setHex(selected ? 0xe4b86f : mesh.material.userData.baseColor || 0xc96b4d);
    mesh.renderOrder = selected ? 2 : 1;
    if (mesh.userData.ribbonMesh) mesh.userData.ribbonMesh.renderOrder = selected ? 1 : 0;
  });
}

function selectStroke(mesh) {
  state.selectedStrokeMesh = mesh || null;
  if (pathWidthSlider) pathWidthSlider.value = state.selectedStrokeMesh ? String(state.enterPathWidth * (state.selectedStrokeMesh.userData.widthMultiplier || 1)) : String(state.enterPathWidth);
  if (pathOpacitySlider) pathOpacitySlider.value = state.selectedStrokeMesh ? String(state.enterPathOpacity * (state.selectedStrokeMesh.userData.inkMultiplier || 1)) : String(state.enterPathOpacity);
  renderStrokeSelection();
}

function triggerEnterReveal() {
  if (state.currentScene !== "enter" || state.enterRevealStarted) return;
  state.enterRevealStarted = true;
  state.enterRevealStartedAt = performance.now();
  sceneText.textContent = "蒙版浮现：这一笔，曾经是一个动作。现在进入墨迹。";
  if (state.autoJourneyActive) {
    const timer = window.setTimeout(() => {
      if (!state.paused && state.currentScene === "enter" && state.enterRevealStarted) {
        setScene("ride");
      }
    }, 2400);
    state.autoTimers.push(timer);
  }
}

function isPointerNearEnterGlyph(event) {
  if (!state.camera) return true;
  const rect = canvas.getBoundingClientRect();
  const bounds = state.enterGlyphPaths?.bounds || { width: 82, height: 70 };
  const previewWidth = 4.6;
  const previewHeight = previewWidth * (bounds.height / Math.max(1, bounds.width));
  const hotspotOrigin = new THREE.Vector3(ENTER_HOTSPOT_WORLD_X, ENTER_HOTSPOT_WORLD_Y, 1.46);
  const corners = [
    new THREE.Vector3(-previewWidth * 0.5, -previewHeight * 0.5, 0.44),
    new THREE.Vector3(previewWidth * 0.5, -previewHeight * 0.5, 0.44),
    new THREE.Vector3(previewWidth * 0.5, previewHeight * 0.5, 0.44),
    new THREE.Vector3(-previewWidth * 0.5, previewHeight * 0.5, 0.44),
  ];

  const projected = corners.map((corner) => {
    const point = corner
      .clone()
      .multiplyScalar(ENTER_GLYPH_SCALE)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), ENTER_GLYPH_ROTATION_Z)
      .add(hotspotOrigin);
    point.project(state.camera);
    return {
      x: ((point.x + 1) / 2) * rect.width + rect.left,
      y: ((-point.y + 1) / 2) * rect.height + rect.top,
    };
  });

  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;

  // The original top-right "光" is small before the reveal animation.
  // Use a projected glyph box plus generous padding so zooming/resizing the page
  // does not make the entry target feel like a needle eye.
  const padding = Math.max(42, Math.min(rect.width, rect.height) * 0.055);
  const halfWidth = Math.max(width * 0.62 + padding, rect.width * 0.085);
  const halfHeight = Math.max(height * 0.66 + padding, rect.height * 0.105);

  return Math.abs(event.clientX - centerX) <= halfWidth
    && Math.abs(event.clientY - centerY) <= halfHeight;
}

function startRideReplay(mesh) {
  if (!mesh || state.currentScene !== "ride") return;
  const segment = state.rideSegments.find((item) => item.mesh === mesh);
  if (!segment) return;
  state.rideReplaySegment = segment;
  state.rideReplayStartedAt = performance.now();
  selectStroke(mesh);
}

function pickStrokeAt(event) {
  if (!state.enterPathGroup || !["enter", "ride"].includes(state.currentScene)) return;
  if (state.currentScene === "enter" && !state.enterRevealStarted) {
    if (isPointerNearEnterGlyph(event)) triggerEnterReveal();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  state.ndcPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.ndcPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  state.raycaster.setFromCamera(state.ndcPointer, state.camera);
  const hits = state.raycaster.intersectObjects(state.enterPathMeshes, false);
  const mesh = hits[0]?.object || null;
  selectStroke(mesh);
  if (state.currentScene === "ride" && state.rideStarted && mesh) startRideReplay(mesh);
}

function easeInOutCubic(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function strokeLocalToWorld(localPoint, zOffset = 0) {
  const group = state.enterPathGroup || state.enterRibbonGroup;
  if (!group) return localPoint.clone();
  group.updateWorldMatrix(true, false);
  const point = localPoint.clone();
  point.z += zOffset;
  return group.localToWorld(point);
}

function strokeLocalDirectionToWorld(localDirection) {
  const group = state.enterPathGroup || state.enterRibbonGroup;
  if (!group) return localDirection.clone().normalize();
  group.updateWorldMatrix(true, false);
  const quaternion = new THREE.Quaternion();
  group.getWorldQuaternion(quaternion);
  return localDirection.clone().applyQuaternion(quaternion).normalize();
}

function getFramedGlyphView(frameScale = 2) {
  const bounds = state.enterGlyphPaths?.bounds || { width: 82, height: 70 };
  const previewWidth = 4.6;
  const glyphHeight = previewWidth * (bounds.height / Math.max(1, bounds.width));
  const framedWidth = previewWidth * frameScale;
  const framedHeight = glyphHeight * frameScale;
  const verticalFov = THREE.MathUtils.degToRad(state.camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * state.camera.aspect);
  const distanceForHeight = framedHeight / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = framedWidth / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(distanceForHeight, distanceForWidth) * 1.02;
  const target = strokeLocalToWorld(new THREE.Vector3(0, 0, 0.56), 0);
  const position = target.clone().add(new THREE.Vector3(0, 0, distance));
  return { position, target };
}

function getFramedScrollHeightView(fillScale = 0.9) {
  const verticalFov = THREE.MathUtils.degToRad(state.camera.fov);
  const framedHeight = Math.max(1, state.workHeight) * fillScale;
  const distance = framedHeight / (2 * Math.tan(verticalFov / 2));
  const target = strokeLocalToWorld(new THREE.Vector3(0, 0, 0.56), 0);
  const position = target.clone().add(new THREE.Vector3(0, 0, distance));
  return { position, target };
}

function applyZoomToCameraPosition(position, target, minDistance = 0.72) {
  const direction = position.clone().sub(target);
  const distance = direction.length();
  if (distance < 0.0001) return position;
  return target.clone().add(direction.normalize().multiplyScalar(Math.max(minDistance, distance * state.zoom)));
}

function qiLocalToWorld(localPoint, zOffset = 0) {
  const group = state.qiFlowGroup || state.enterPathGroup || state.enterGlyphGroup;
  if (!group) return localPoint.clone();
  group.updateWorldMatrix(true, false);
  const point = localPoint.clone();
  point.z += zOffset;
  return group.localToWorld(point);
}

function normalizedBreakpoints(stroke, key) {
  const points = stroke?.points || stroke?.path || [];
  const maxIndex = Math.max(1, points.length - 1);
  return (stroke?.[key] || []).map((index) => THREE.MathUtils.clamp(Number(index) / maxIndex, 0, 1));
}

function nearestBreakpointSignal(localT, breakpoints, radius = 0.075) {
  return breakpoints.reduce((best, point) => {
    const distance = Math.abs(localT - point);
    if (distance > radius) return best;
    return Math.max(best, 1 - distance / radius);
  }, 0);
}

function sampleRideSegment(segment, localTime, totalTime, elapsed, replay = false) {
  if (!segment) return null;
  const isPause = localTime > segment.moveMs;
  const rawLocalT = isPause ? 1 : localTime / Math.max(1, segment.moveMs);
  const acceleratedT = easeInOutCubic(rawLocalT);
  const localT = THREE.MathUtils.clamp(acceleratedT, 0, 1);
  const point = segment.curve.getPointAt(localT);
  const tangent = segment.curve.getTangentAt(Math.min(0.995, Math.max(0.005, localT))).normalize();
  const lookAheadT = THREE.MathUtils.clamp(localT + 0.055, 0, 1);
  const lookAhead = segment.curve.getPointAt(lookAheadT);
  const stroke = segment.stroke || {};
  const density = sampleStrokeValue(stroke.inkDensity, localT, stroke.inkDensityScale || 1);
  const width = sampleStrokeValue(stroke.width, localT, stroke.widthScale || 1);
  const turnSignal = nearestBreakpointSignal(localT, normalizedBreakpoints(stroke, "turningPoints"));
  const pauseSignal = isPause ? 1 : nearestBreakpointSignal(localT, normalizedBreakpoints(stroke, "pausePoints"), 0.055);
  const sceneProgress = THREE.MathUtils.clamp(elapsed / Math.max(1, totalTime), 0, 1);
  const phase =
    pauseSignal > 0.62 ? "pause" :
    turnSignal > 0.5 ? "turn" :
    rawLocalT < 0.28 ? "speedUp" :
    rawLocalT > 0.72 ? "slowDown" :
    "ride";

  return {
    point,
    tangent,
    lookAhead,
    segment,
    localT,
    density,
    width,
    turnSignal,
    pauseSignal,
    sceneProgress,
    phase,
    complete: elapsed >= totalTime,
    replay,
  };
}

function getRideSample(elapsed) {
  if (!state.rideSegments.length || !state.rideStarted) return null;

  if (state.rideReplaySegment) {
    const replayElapsed = performance.now() - state.rideReplayStartedAt;
    const replaySegment = state.rideReplaySegment;
    const moveMs = Math.max(2600, RIDE_REPLAY_DURATION_MS - 700);
    const replayLikeSegment = {
      ...replaySegment,
      timeStart: 0,
      moveMs,
      pauseMs: RIDE_REPLAY_DURATION_MS - moveMs,
    };
    const localTime = THREE.MathUtils.clamp(replayElapsed, 0, RIDE_REPLAY_DURATION_MS);
    if (replayElapsed > RIDE_REPLAY_DURATION_MS + 650) {
      state.rideReplaySegment = null;
    }
    return sampleRideSegment(replayLikeSegment, localTime, RIDE_REPLAY_DURATION_MS, replayElapsed, true);
  }

  const rideTime = THREE.MathUtils.clamp(elapsed, 0, state.rideDurationMs);
  const segment = state.rideSegments.find((item) => rideTime <= item.timeEnd) || state.rideSegments.at(-1);
  const localTime = THREE.MathUtils.clamp(rideTime - segment.timeStart, 0, segment.moveMs + segment.pauseMs);
  return sampleRideSegment(segment, localTime, state.rideDurationMs, elapsed, false);
}

function updateRidePrompt(sample) {
  if (!ridePrompt) return;
  if (state.currentScene !== "ride") {
    ridePrompt.classList.add("hidden");
    rideStartButton?.classList.add("hidden");
    return;
  }

  if (!state.rideStarted) {
    ridePrompt.classList.remove("hidden");
    rideStartButton?.classList.remove("hidden");
    ridePrompt.innerHTML = `
      <strong>READY / 准备游卷</strong>
      <span>先观察这一字，再点击 RIDE 进入笔画。</span>
      <small>相机会沿现有骨架运动；不会自动描写，直到你主动开始。</small>
    `;
    return;
  }

  rideStartButton?.classList.add("hidden");
  if (!sample) {
    ridePrompt.classList.add("hidden");
    return;
  }

  const phaseCopy = {
    speedUp: ["SPEED UP / 提速", "沿墨势进入，镜头逐渐贴近笔画。"],
    slowDown: ["SLOW DOWN / 减速", "墨色变厚，速度放缓，观察边缘起伏。"],
    turn: ["TURNING / 转折", "路径切向改变，镜头跟随笔锋转向。"],
    pause: ["PAUSE / 顿挫", "笔画收束处短暂停留，感受顿挫。"],
    ride: ["RIDE / 御笔而行", "沿现有骨架穿行，不新增可见路径。"],
    replay: ["REPLAY / 单笔重看", "正在重复观看观众选中的这一笔。"],
    choose: ["CHOOSE A STROKE / 自选笔画", "完整游卷已结束。点击任一笔画，可以重复观看这一部分。"],
  };
  const promptKey = sample.replay ? "replay" : sample.complete ? "choose" : sample.phase;
  const [title, text] = phaseCopy[promptKey] || phaseCopy.ride;
  ridePrompt.classList.remove("hidden");
  ridePrompt.innerHTML = `
    <strong>${title}</strong>
    <span>${sample.segment.stroke.label || sample.segment.mesh.userData.label || "笔画"} · ${Math.round(sample.sceneProgress * 100)}%</span>
    <small>${text}</small>
  `;
}

async function init() {
  await loadData();
  const heightImage = await loadImage(resolveAssetPath(state.data.heightImage));

  state.threeScene = new THREE.Scene();
  state.threeScene.background = new THREE.Color(0x050506);
  state.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 180);
  state.camera.position.set(...sceneCopy.galaxy.camera);
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  state.renderer.xr.enabled = true;

  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  const key = new THREE.DirectionalLight(0xf3d38f, 0.92);
  key.position.set(-5, -5, 8);
  state.threeScene.add(ambient, key);

  state.world = new THREE.Group();
  state.threeScene.add(state.world);

  createBackgroundStars();
  createParticleField(sampleScrollHeightMap(heightImage));
  buildEnterGlyphPreview(heightImage);
  buildEnterPathOverlay();

  resize();
  bindEvents();
  setScene("galaxy", true);
  openSceneFromQuery();
  state.renderer.setAnimationLoop(animate);
}

function openSceneFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedScene = params.get("scene");
  if (!sceneOrder.includes(requestedScene)) return;
  launchPanel.classList.add("hidden");
  state.running = true;
  setScene(requestedScene, true);
  if (params.get("settled") === "1" && requestedScene !== "galaxy") {
    state.positions.set(state.targets);
    state.particleGeometry.attributes.position.needsUpdate = true;
    state.sceneStartedAt = performance.now() - 5000;
  }
}

function recordSceneVisit(scene) {
  const last = state.session.sceneVisits.at(-1);
  if (last?.scene === scene && !last.endedAt) return;
  if (last && !last.endedAt) {
    last.endedAt = new Date().toISOString();
    last.durationMs = Math.round(performance.now() - last.startedAtMs);
    delete last.startedAtMs;
  }
  state.session.sceneVisits.push({
    scene,
    startedAt: new Date().toISOString(),
    startedAtMs: performance.now(),
  });
}

function setScene(nextScene, immediate = false) {
  state.currentScene = nextScene;
  state.sceneStartedAt = performance.now();
  state.enterRevealStarted = false;
  state.enterRevealStartedAt = 0;
  state.rideStarted = false;
  state.rideReplaySegment = null;
  state.rideReplayStartedAt = 0;
  state.qiStarted = false;
  state.qiStartedAt = 0;
  if (nextScene !== "ride") {
    ridePrompt?.classList.add("hidden");
    rideStartButton?.classList.add("hidden");
  }
  if (nextScene !== "qi") {
    qiPrompt?.classList.add("hidden");
    qiStartButton?.classList.add("hidden");
  }
  recordSceneVisit(nextScene);
  const copy = sceneCopy[nextScene];
  sceneKicker.textContent = copy.kicker;
  sceneTitle.textContent = copy.title;
  sceneText.textContent = copy.text;

  chapterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.scene === nextScene);
  });

  if (immediate) {
    state.camera.position.set(...copy.camera);
    state.cameraTarget.set(...copy.target);
    state.camera.lookAt(state.cameraTarget);
  }
}

function clearJourneyTimers() {
  state.autoTimers.forEach((timer) => window.clearTimeout(timer));
  state.autoTimers = [];
  state.autoJourneyActive = false;
}

function playJourney() {
  clearJourneyTimers();
  state.running = true;
  state.paused = false;
  state.autoJourneyActive = true;
  pauseButton.textContent = "暂停";
  setScene("galaxy");

  ["assemble", "enter"].forEach((scene) => {
    const sceneIndex = sceneOrder.indexOf(scene);
    const timer = window.setTimeout(() => {
      if (!state.paused) setScene(scene);
    }, journeyDurations[sceneIndex]);
    state.autoTimers.push(timer);
  });
}

function exportSessionJson() {
  const last = state.session.sceneVisits.at(-1);
  if (last && !last.endedAt) {
    last.endedAt = new Date().toISOString();
    last.durationMs = Math.round(performance.now() - last.startedAtMs);
    delete last.startedAtMs;
  }
  const payload = {
    ...state.session,
    exportedAt: new Date().toISOString(),
    currentScene: state.currentScene,
    dataSummary: {
      workId: state.data.id || state.data.sourceWorkId || "work_003",
      heightImage: state.data.heightImage,
      model: state.data.model || "data/work_003/qiverse-work.json",
      enterGlyph: state.enterGlyphPaths?.glyph || "光",
      strokes: state.enterGlyphPaths?.strokes?.length || 0,
      qiLinks: state.enterGlyphPaths?.qiLinks?.length || 0,
      voidRegions: state.enterGlyphPaths?.voidRegions?.length || 0,
      particleBudget: MAX_PARTICLES,
      enterPreview: "top-right first glyph sampled from heightImage",
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${payload.id}.json`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
  recordSceneVisit(state.currentScene);
}

function bindEvents() {
  window.addEventListener("resize", resize);

  startButton.addEventListener("click", () => {
    launchPanel.classList.add("hidden");
    clearJourneyTimers();
    state.running = true;
    state.paused = false;
    pauseButton.textContent = "暂停";
    setScene("enter");
  });

  playButton.addEventListener("click", () => {
    launchPanel.classList.add("hidden");
    playJourney();
  });

  pauseButton.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? "继续" : "暂停";
  });

  resetButton.addEventListener("click", () => {
    clearJourneyTimers();
    state.running = false;
    state.paused = false;
    pauseButton.textContent = "暂停";
    state.pointer.yaw = 0;
    state.pointer.pitch = 0;
    state.zoom = 1;
    state.targetZoom = 1;
    state.session = {
      id: `qiverse-${Date.now().toString(36)}`,
      startedAt: new Date().toISOString(),
      sceneVisits: [],
      exportedAt: "",
      notes: "本 session 不记录个人敏感信息，只记录 QiVerse 体验章节访问。"
    };
    launchPanel.classList.remove("hidden");
    setScene("galaxy", true);
  });

  exportButton?.addEventListener("click", exportSessionJson);

  chapterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      clearJourneyTimers();
      launchPanel.classList.add("hidden");
      state.running = true;
      setScene(button.dataset.scene);
    });
  });

  canvas.addEventListener("pointerdown", (event) => {
    state.pointer.active = true;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.downX = event.clientX;
    state.pointer.downY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.pointer.active) return;
    const dx = event.clientX - state.pointer.x;
    const dy = event.clientY - state.pointer.y;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.yaw += dx * 0.0016;
    state.pointer.pitch = THREE.MathUtils.clamp(state.pointer.pitch + dy * 0.0012, -0.34, 0.34);
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    const factor = direction > 0 ? 1.11 : 0.9;
    state.targetZoom = THREE.MathUtils.clamp(state.targetZoom * factor, 0.28, 3.4);
  }, { passive: false });

  canvas.addEventListener("pointerup", (event) => {
    state.pointer.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const moved = Math.hypot(event.clientX - state.pointer.downX, event.clientY - state.pointer.downY);
    const clickTolerance = state.currentScene === "enter" && !state.enterRevealStarted ? 18 : 8;
    if (moved < clickTolerance) pickStrokeAt(event);
  });

  setupXRButton();

  if (pathWidthSlider) {
    state.enterPathWidth = Number(pathWidthSlider.value);
    pathWidthSlider.addEventListener("input", () => {
      const next = Number(pathWidthSlider.value);
      if (state.selectedStrokeMesh) {
        state.selectedStrokeMesh.userData.widthMultiplier = next / Math.max(0.001, state.enterPathWidth);
      } else {
        state.enterPathWidth = next;
      }
      rebuildEnterPathThickness();
    });
  }

  if (pathOpacitySlider) {
    state.enterPathOpacity = Number(pathOpacitySlider.value);
    pathOpacitySlider.addEventListener("input", () => {
      const next = Number(pathOpacitySlider.value);
      if (state.selectedStrokeMesh) {
        state.selectedStrokeMesh.userData.inkMultiplier = next / Math.max(0.001, state.enterPathOpacity);
        if (state.selectedStrokeMesh.userData.ribbonMesh) {
          state.selectedStrokeMesh.userData.ribbonMesh.userData.inkMultiplier = state.selectedStrokeMesh.userData.inkMultiplier;
        }
      } else {
        state.enterPathOpacity = next;
      }
    });
  }

  clearStrokeSelectionButton?.addEventListener("click", () => selectStroke(null));

  rideStartButton?.addEventListener("click", () => {
    if (state.currentScene !== "ride") return;
    state.rideStarted = true;
    state.rideReplaySegment = null;
    state.rideReplayStartedAt = 0;
    state.sceneStartedAt = performance.now();
    selectStroke(null);
    rideStartButton.classList.add("hidden");
  });

  qiStartButton?.addEventListener("click", () => {
    if (state.currentScene !== "qi") return;
    state.qiStarted = true;
    state.qiStartedAt = performance.now();
    state.sceneStartedAt = performance.now();
    qiStartButton.classList.add("hidden");
  });
}

async function setupXRButton() {
  if (!navigator.xr) {
    xrButton.textContent = "Desktop";
    xrButton.disabled = true;
    return;
  }

  const supported = await navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
  xrButton.textContent = supported ? "进入 XR" : "Desktop";
  xrButton.disabled = !supported;

  xrButton.addEventListener("click", async () => {
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    state.renderer.xr.setSession(session);
  });
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
}

function particleMixForScene(scene, elapsed) {
  if (scene === "galaxy") return { destination: state.galaxy, amount: 0, lift: 0, spread: 1.05, fade: 0.95 };
  if (scene === "assemble") {
    const amount = smoothstep(0.06, 0.92, elapsed / 4200);
    return { destination: state.targets, amount, lift: 0.02, spread: 1 - amount * 0.88, fade: 1 };
  }
  if (scene === "enter") {
    return { destination: state.targets, amount: 1, lift: smoothstep(0.08, 1, elapsed / 2800) * 0.74, spread: 0.12, fade: 0.98 };
  }
  if (scene === "ride") return { destination: state.targets, amount: 1, lift: 0.82, spread: 0.08, fade: 0.96 };
  if (scene === "qi") return { destination: state.targets, amount: 1, lift: 0.58, spread: 0.22, fade: 0.92 };
  if (scene === "void") {
    const amount = smoothstep(0.06, 1, elapsed / 3200);
    return { destination: state.targets, amount, lift: 0.12, spread: 0.09, fade: 0.56 };
  }
  return { destination: state.targets, amount: 1, lift: 0, spread: 0.03, fade: 0.78 };
}

function updateParticleColors(seconds) {
  const colors = state.colors;
  const base = state.baseColors;
  const waveX = SCROLL_WIDTH * 0.48 - ((seconds * 2.6) % SCROLL_WIDTH);
  const flowScene = state.currentScene === "qi";
  const voidScene = state.currentScene === "void";

  for (let i = 0; i < colors.length; i += 3) {
    const index = i / 3;
    const x = state.anchors[index];
    const wave = flowScene ? Math.exp(-Math.pow(x - waveX, 2) / 4.8) : 0;
    const dim = voidScene ? 0.46 : 1;
    const pulse = 1 + wave * 0.82 + Math.sin(seconds * 1.8 + index * 0.013) * 0.025;
    colors[i] = base[i] * pulse * dim + wave * 0.18;
    colors[i + 1] = base[i + 1] * pulse * dim + wave * 0.13;
    colors[i + 2] = base[i + 2] * pulse * dim + wave * 0.04;
  }

  state.particleGeometry.attributes.color.needsUpdate = true;
}

function updateParticles(elapsed, seconds) {
  const mix = particleMixForScene(state.currentScene, elapsed);
  const positions = state.positions;

  for (let i = 0; i < positions.length; i += 3) {
    const index = i / 3;
    const sourceX = state.galaxy[i] + Math.sin(seconds * 0.16 + index * 0.17) * 0.22;
    const sourceY = state.galaxy[i + 1] + Math.cos(seconds * 0.13 + index * 0.19) * 0.18;
    const sourceZ = state.galaxy[i + 2];
    const flowPush = state.currentScene === "qi" ? Math.sin(seconds * 1.25 + state.anchors[index] * 1.4) * 0.22 : 0;
    const drift = Math.sin(seconds * 0.72 + index * 0.051) * mix.spread;
    const destinationX = mix.destination[i] + drift * 0.11 + flowPush;
    const destinationY = mix.destination[i + 1] + Math.cos(seconds * 0.5 + index * 0.043) * mix.spread * 0.06;
    const destinationZ = mix.destination[i + 2] + mix.lift * (0.24 + state.density[index] * 0.74);
    const targetX = THREE.MathUtils.lerp(sourceX, destinationX, mix.amount);
    const targetY = THREE.MathUtils.lerp(sourceY, destinationY, mix.amount);
    const targetZ = THREE.MathUtils.lerp(sourceZ, destinationZ, mix.amount);

    positions[i] += (targetX - positions[i]) * 0.058;
    positions[i + 1] += (targetY - positions[i + 1]) * 0.058;
    positions[i + 2] += (targetZ - positions[i + 2]) * 0.058;
  }

  state.particleGeometry.attributes.position.needsUpdate = true;
  updateParticleColors(seconds);

  const targetSize =
    state.currentScene === "galaxy" ? 0.012 :
    state.currentScene === "assemble" ? 0.015 :
    state.currentScene === "ride" ? 0.013 :
    state.currentScene === "void" ? 0.011 :
    state.currentScene === "return" ? 0.013 :
    0.014;
  state.particleMaterial.size += (targetSize - state.particleMaterial.size) * 0.045;
  state.particleMaterial.opacity += (mix.fade - state.particleMaterial.opacity) * 0.05;
}

function getQiStrokeEmphasis(strokeId, sample) {
  if (state.currentScene !== "qi") return 0;
  if (!state.qiStarted || !sample) return 0.28;
  if (sample.complete) return 0.36;

  if (sample.segment.type === "stroke") {
    if (strokeId !== sample.segment.strokeId) return 0.12;
    const writingGlow = smoothstep(0.04, 0.38, sample.localT) * (1 - smoothstep(0.86, 1, sample.localT));
    return 0.78 + writingGlow * 1.05;
  }

  const fromStrokeId = sample.segment.link?.fromStrokeId;
  const toStrokeId = sample.segment.link?.toStrokeId;
  const arrive = smoothstep(0.38, 0.92, sample.localT);
  const leave = 1 - smoothstep(0.15, 0.72, sample.localT);

  if (strokeId === fromStrokeId) return 0.55 + leave * 0.88;
  if (strokeId === toStrokeId) return 0.48 + arrive * 0.95;
  return 0.1;
}

function getQiSample(elapsed) {
  if (!state.qiStarted || !state.qiMotionSegments.length) return null;
  const qiTime = THREE.MathUtils.clamp(elapsed, 0, state.qiDurationMs);
  const segment = state.qiMotionSegments.find((item) => qiTime <= item.timeEnd) || state.qiMotionSegments.at(-1);
  const localTime = THREE.MathUtils.clamp(qiTime - segment.timeStart, 0, segment.durationMs + segment.pauseMs);
  const isPause = localTime > segment.durationMs;
  const rawT = isPause ? 1 : localTime / Math.max(1, segment.durationMs);
  const localT = easeInOutCubic(rawT);
  const point = segment.curve.getPointAt(localT);
  const lookAhead = segment.curve.getPointAt(THREE.MathUtils.clamp(localT + 0.08, 0, 1));
  const tangent = segment.curve.getTangentAt(THREE.MathUtils.clamp(localT, 0.005, 0.995)).normalize();
  return {
    segment,
    motionIndex: segment.motionIndex,
    localT,
    point,
    lookAhead,
    tangent,
    isPause,
    complete: elapsed >= state.qiDurationMs,
    progress: qiTime / state.qiDurationMs,
  };
}

function updateQiPrompt(sample) {
  if (!qiPrompt) return;
  if (state.currentScene !== "qi") {
    qiPrompt.classList.add("hidden");
    qiStartButton?.classList.add("hidden");
    return;
  }

  qiPrompt.classList.remove("hidden");
  if (!state.qiStarted) {
    qiStartButton?.classList.remove("hidden");
    qiPrompt.innerHTML = `
      <strong>READY / 准备追气</strong>
      <span>墨迹已断，势未必断。</span>
      <small>点击 FOLLOW THE QI，让笔画和气脉按「中竖 → 左点 → 右点 → 横 → 撇 → 竖弯钩」一起推进。</small>
    `;
    return;
  }

  qiStartButton?.classList.add("hidden");
  if (!sample) {
    qiPrompt.classList.add("hidden");
    return;
  }

  const title = sample.complete
    ? "RETURN / 回看气势"
    : sample.isPause
      ? "PAUSE / 气息停驻"
      : sample.segment.type === "stroke"
        ? "STROKE / 笔画推进"
        : "FOLLOW THE QI / 气脉连接";
  const text = sample.complete
    ? "气脉连接完成。原来的笔画不受影响。"
    : sample.segment.type === "stroke"
      ? `正在推进：${sample.segment.label}`
      : sample.segment.link.label || "淡金粒子沿不可见气脉移动。";
  qiPrompt.innerHTML = `
    <strong>${title}</strong>
    <span>${text}</span>
    <small>${Math.round(sample.progress * 100)}% · 笔画先亮起推进，再由淡金气脉连接到下一笔。</small>
  `;
}

function updateQiFlow(elapsed, seconds) {
  if (!state.qiFlowGroup) return;
  const inQiScene = state.currentScene === "qi";
  const sample = getQiSample(elapsed);
  updateQiPrompt(sample);
  state.qiFlowGroup.visible = inQiScene;
  if (!inQiScene) return;

  state.qiFlowGroup.rotation.z = -0.02;
  state.qiFlowGroup.position.z = 1.6;

  if (state.qiStrokeCursor?.material) {
    const strokeActive = sample?.segment.type === "stroke";
    state.qiStrokeCursor.visible = Boolean(strokeActive);
    state.qiStrokeCursor.material.opacity = strokeActive ? 0.95 : 0;
    if (strokeActive) {
      state.qiStrokeCursor.position.copy(sample.point);
      state.qiStrokeCursor.position.z += 0.16 + Math.sin(seconds * 7) * 0.01;
      const pulse = 1 + Math.sin(seconds * 5) * 0.12;
      state.qiStrokeCursor.scale.setScalar(pulse);
    }
  }

  state.qiFlowLinks.forEach((item) => {
    const active = sample?.segment.type === "link" && sample.segment.qiLink === item;
    const alreadyPassed = state.qiStarted && sample && sample.motionIndex > (item.motionIndex ?? Number.POSITIVE_INFINITY);
    const baseOpacity = state.qiStarted ? (active ? 0.82 : alreadyPassed ? 0.46 : 0.26) : 0.36;
    const strength = THREE.MathUtils.clamp(Number(item.link.intensity) || 0.62, 0.28, 1);
    item.lineMaterial.opacity = baseOpacity * strength;
    item.particleMaterial.opacity = (active ? 0.92 : state.qiStarted ? 0.34 : 0.42) * strength;
    item.particleMaterial.size = active ? 0.044 : 0.03;

    const positions = item.particleGeometry.attributes.position.array;
    const flowBase = state.qiStarted
      ? active
        ? (sample.localT * 0.92)
        : alreadyPassed
          ? 0.98
          : 0
      : (seconds * 0.035 + item.linkIndex * 0.13) % 1;

    for (let i = 0; i < item.particleCount; i += 1) {
      const t = state.qiStarted && !active
        ? flowBase
        : (flowBase + i / item.particleCount * 0.58) % 1;
      const point = item.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
      const pulse = Math.sin(seconds * 2.2 + i * 0.9 + item.linkIndex) * 0.012;
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z + 0.06 + pulse;
    }
    item.particleGeometry.attributes.position.needsUpdate = true;
  });
}

function updateEnterGlyphPreview(elapsed, seconds) {
  const inEnterScene = state.currentScene === "enter";
  const inRideScene = state.currentScene === "ride";
  const inQiScene = state.currentScene === "qi";
  const qiSample = inQiScene ? getQiSample(elapsed) : null;
  const enterRevealElapsed = state.enterRevealStarted ? performance.now() - state.enterRevealStartedAt : -1;
  const enterRevealProgress = state.enterRevealStarted ? smoothstep(0.06, 0.86, enterRevealElapsed / 1700) : 0;
  const glyphOpacity = inEnterScene
    ? enterRevealProgress
    : inRideScene
      ? 0.96
      : inQiScene
        ? 0.92
      : 0;
  const ribbonSequenceTime = inEnterScene
    ? (state.enterRevealStarted ? enterRevealElapsed - 520 : -1)
    : (inRideScene || inQiScene) ? state.rideDurationMs : -1;
  if (state.enterGlyphPoints?.material) state.enterGlyphPoints.material.opacity = glyphOpacity;
  if (state.enterMaskMesh?.material) {
    const maskIntro = state.enterRevealStarted ? smoothstep(0, 0.24, enterRevealElapsed / 1700) : 0;
    const maskFade = state.enterRevealStarted ? 1 - smoothstep(0.28, 0.9, enterRevealElapsed / 1700) : 0;
    state.enterMaskMesh.visible = inEnterScene && state.enterRevealStarted && maskFade > 0.02;
    state.enterMaskMesh.material.opacity = maskIntro * maskFade * 0.46;
    const maskScale = 0.72 + smoothstep(0.02, 0.88, enterRevealElapsed / 1700) * 0.42;
    state.enterMaskMesh.scale.set(maskScale, maskScale, 1);
  }
  state.enterRibbonMaterials.forEach((material, index) => {
    const ribbon = state.enterRibbonMeshes[index];
    const centerMesh = state.enterPathMeshes.find((item) => item.userData.ribbonMesh === ribbon);
    const selectedBoost = centerMesh === state.selectedStrokeMesh ? 1.12 : 1;
    const startDelay = (ribbon?.userData.strokeIndex || 0) * 330;
    const localLift = state.currentScene === "enter" ? smoothstep(0, 1, (ribbonSequenceTime - startDelay) / 1050) : 0;
    if (ribbon) {
      ribbon.position.z = -0.34 + localLift * 0.82;
      ribbon.scale.z = 0.4 + localLift * 0.6;
    }
    const qiEmphasis = getQiStrokeEmphasis(ribbon?.userData.strokeId, qiSample);
    const sceneWeight = inRideScene ? 0.72 : inQiScene ? 0.52 : 0.64;
    material.opacity = THREE.MathUtils.clamp(
      glyphOpacity * localLift * sceneWeight * state.enterPathOpacity * (material.userData.inkDensityScale || 1) * (ribbon?.userData.inkMultiplier || 1) * selectedBoost * (1 + qiEmphasis * 0.85),
      0,
      1
    );
  });
  state.enterPathMaterials.forEach((material) => {
    const mesh = state.enterPathMeshes.find((item) => item.material === material);
    const selectedBoost = mesh === state.selectedStrokeMesh ? 1.12 : 1;
    const qiEmphasis = getQiStrokeEmphasis(mesh?.name, qiSample);
    const sceneWeight = inRideScene ? 0.72 : inQiScene ? 0.82 : 1;
    material.opacity = THREE.MathUtils.clamp(
      glyphOpacity * sceneWeight * state.enterPathOpacity * (material.userData.inkDensityScale || 1) * (mesh?.userData.inkMultiplier || 1) * selectedBoost * (1 + qiEmphasis * 0.72),
      0,
      1
    );
    if (material.color && inQiScene) {
      material.color.setHex(qiEmphasis > 0.5 ? 0xf0bf65 : 0xd18452);
    } else if (material.color) {
      material.color.setHex(mesh === state.selectedStrokeMesh ? 0xe4b86f : material.userData.baseColor || 0xc96b4d);
    }
  });

  if (state.enterGlyphGroup) {
    state.enterGlyphGroup.rotation.z = (inRideScene || inQiScene) ? -0.02 : -0.02 + Math.sin(seconds * 0.7) * 0.006;
    state.enterGlyphGroup.position.z = 1.46 + glyphOpacity * 0.42;
  }
  if (state.enterRibbonGroup) {
    state.enterRibbonGroup.rotation.z = (inRideScene || inQiScene) ? -0.02 : -0.02 + Math.sin(seconds * 0.7) * 0.006;
    state.enterRibbonGroup.position.z = inRideScene ? 1.14 : inQiScene ? 1.2 : 1.58;
  }
  if (state.enterPathGroup) {
    state.enterPathGroup.rotation.z = (inRideScene || inQiScene) ? -0.02 : -0.02 + Math.sin(seconds * 0.7) * 0.006;
    state.enterPathGroup.position.z = inRideScene ? 1.58 : inQiScene ? 1.58 : 1.52 + glyphOpacity * 0.42;
  }
}

function updateRideCamera(elapsed) {
  const sample = getRideSample(elapsed);
  updateRidePrompt(sample);
  if (!sample) return false;

  if (sample.complete && !sample.replay) {
    const framedView = getFramedScrollHeightView(0.92);
    const zoomedFramedPosition = applyZoomToCameraPosition(framedView.position, framedView.target, 0.55);
    state.camera.position.lerp(zoomedFramedPosition, 0.052);
    state.cameraTarget.lerp(framedView.target, 0.065);
    state.camera.lookAt(state.cameraTarget);
    return true;
  }

  const upperFlatStrokeIds = new Set(["guang-left-dot", "guang-right-dot", "guang-center-vertical"]);
  const upperFlatFollow = upperFlatStrokeIds.has(sample.segment.stroke.id);
  const stableStrokeIds = new Set(["guang-cross", "guang-left-leg", "guang-right-dot", "guang-left-dot", "guang-center-vertical"]);
  const stableFollow = stableStrokeIds.has(sample.segment.stroke.id);
  const pointWorld = strokeLocalToWorld(sample.point, 0.02);
  const lookWorld = strokeLocalToWorld(sample.lookAhead, 0.02);
  const tangentWorld = strokeLocalDirectionToWorld(sample.tangent);
  const sideWorld = new THREE.Vector3(-tangentWorld.y, tangentWorld.x, 0);
  if (sideWorld.lengthSq() < 0.0001) sideWorld.set(1, 0, 0);
  sideWorld.normalize();

  const turnLean = sample.turnSignal * (stableFollow ? 0.08 : 0.36);
  const pauseLift = sample.pauseSignal * (stableFollow ? 0.1 : 0.24);
  const densityLift = sample.density * (stableFollow ? 0.07 : 0.12);
  const widthOffset = THREE.MathUtils.clamp(sample.width, 0.55, 1.25) * (stableFollow ? 0.06 : 0.12);
  const targetPosition = pointWorld
    .clone()
    .addScaledVector(tangentWorld, upperFlatFollow ? -1.05 : stableFollow ? -1.62 : -1.34)
    .addScaledVector(sideWorld, (upperFlatFollow ? 0.16 : stableFollow ? 0.24 : 0.34) + widthOffset + turnLean)
    .add(new THREE.Vector3(
      0,
      0,
      (upperFlatFollow ? 1.35 : stableFollow ? 1.08 : 0.92)
        + (upperFlatFollow ? densityLift * 0.55 : densityLift)
        + (upperFlatFollow ? pauseLift * 0.45 : pauseLift)
    ));
  const targetLook = lookWorld
    .clone()
    .addScaledVector(tangentWorld, upperFlatFollow ? 0.5 : stableFollow ? 0.75 : 0.45)
    .add(new THREE.Vector3(0, 0, upperFlatFollow ? 0.02 : stableFollow ? 0.03 : 0.05));

  const zoomedPosition = applyZoomToCameraPosition(targetPosition, targetLook, 0.86);
  zoomedPosition.x += state.pointer.yaw * (stableFollow ? 0.72 : 1.2);
  zoomedPosition.y += state.pointer.pitch * (stableFollow ? 0.54 : 0.9);
  state.camera.position.lerp(zoomedPosition, upperFlatFollow ? 0.042 : stableFollow ? 0.046 : sample.pauseSignal > 0.6 ? 0.055 : 0.115);
  state.cameraTarget.lerp(targetLook, upperFlatFollow ? 0.065 : stableFollow ? 0.07 : 0.16);
  state.camera.lookAt(state.cameraTarget);
  return true;
}

function updateQiCamera(elapsed) {
  const sample = getQiSample(elapsed);
  if (!sample) return false;

  if (sample.complete) {
    const framedView = getFramedGlyphView();
    const zoomedFramedPosition = applyZoomToCameraPosition(framedView.position, framedView.target, 0.95);
    state.camera.position.lerp(zoomedFramedPosition, 0.05);
    state.cameraTarget.lerp(framedView.target, 0.06);
    state.camera.lookAt(state.cameraTarget);
    return true;
  }

  const pointWorld = qiLocalToWorld(sample.point, 0.12);
  const lookWorld = qiLocalToWorld(sample.lookAhead, 0.08);
  const tangentWorld = qiLocalToWorld(sample.point.clone().add(sample.tangent), 0.12).sub(pointWorld).normalize();
  const sideWorld = new THREE.Vector3(-tangentWorld.y, tangentWorld.x, 0);
  if (sideWorld.lengthSq() < 0.0001) sideWorld.set(1, 0, 0);
  sideWorld.normalize();

  const targetLook = lookWorld.clone().add(new THREE.Vector3(0, 0, 0.04));
  const targetPosition = pointWorld
    .clone()
    .addScaledVector(tangentWorld, -1.55)
    .addScaledVector(sideWorld, 0.48)
    .add(new THREE.Vector3(0, 0, 1.38));
  const zoomedPosition = applyZoomToCameraPosition(targetPosition, targetLook, 1.15);
  zoomedPosition.x += state.pointer.yaw * 0.62;
  zoomedPosition.y += state.pointer.pitch * 0.48;

  state.camera.position.lerp(zoomedPosition, sample.isPause ? 0.045 : 0.075);
  state.cameraTarget.lerp(targetLook, 0.09);
  state.camera.lookAt(state.cameraTarget);
  return true;
}

function updateCamera(elapsed) {
  state.zoom += (state.targetZoom - state.zoom) * 0.12;
  if (state.currentScene === "ride") {
    if (updateRideCamera(elapsed)) return;
  } else if (state.currentScene === "qi") {
    if (updateQiCamera(elapsed)) return;
  } else {
    updateRidePrompt(null);
  }
  const copy = sceneCopy[state.currentScene];
  const targetPosition = new THREE.Vector3(...copy.camera);
  const targetLook = new THREE.Vector3(...copy.target);

  if (state.currentScene === "galaxy") {
    targetPosition.x += Math.sin(elapsed * 0.00023) * 0.9;
    targetPosition.y += Math.cos(elapsed * 0.00017) * 0.36;
  }

  targetPosition.x += state.pointer.yaw * 4.2;
  targetPosition.y += state.pointer.pitch * 3.4;
  const zoomedPosition = applyZoomToCameraPosition(targetPosition, targetLook, 0.8);
  state.camera.position.lerp(zoomedPosition, 0.035);
  state.cameraTarget.lerp(targetLook, 0.045);
  state.camera.lookAt(state.cameraTarget);
}

function animate() {
  state.clock.getDelta();

  if (state.paused) {
    state.renderer.render(state.threeScene, state.camera);
    return;
  }

  const now = performance.now();
  const elapsed = now - state.sceneStartedAt;
  const seconds = now * 0.001;

  updateParticles(elapsed, seconds);
  updateEnterGlyphPreview(elapsed, seconds);
  updateQiFlow(elapsed, seconds);
  updateCamera(elapsed);

  state.world.rotation.z = Math.sin(seconds * 0.055) * 0.01;
  if (state.backgroundStars) state.backgroundStars.rotation.z += 0.00006;
  state.renderer.render(state.threeScene, state.camera);
}

init().catch((error) => {
  console.error(error);
  sceneTitle.textContent = "加载失败";
  sceneText.textContent = error.message;
});
