import * as THREE from "../web/vendor/three.module.js";

const canvas = document.querySelector("#qiverseCanvas");
const launchPanel = document.querySelector("#launchPanel");
const startButton = document.querySelector("#startButton");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const xrButton = document.querySelector("#xrButton");
const sceneKicker = document.querySelector("#sceneKicker");
const sceneTitle = document.querySelector("#sceneTitle");
const sceneText = document.querySelector("#sceneText");
const backLink = document.querySelector(".backLink");
const launchTitle = document.querySelector("#launchPanel h1");
const launchCopy = document.querySelector(".launchCopy");
const chapterButtons = Array.from(document.querySelectorAll(".chapter"));

const sceneOrder = ["galaxy", "assemble", "enter", "ride", "qi", "void", "return"];
const journeyDurations = [0, 4200, 8200, 12400, 16600, 20800, 25000];
const SCROLL_WIDTH = 31.5;
const MAX_PARTICLES = 125000;
const routeParams = new URLSearchParams(window.location.search);
const requestedWorkId = routeParams.get("work") || "work_003";
const API_BASE =
  window.CALLILENS_API_BASE ||
  (["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port && window.location.port !== "8000"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : `${window.location.protocol}//${window.location.host}`);

const sceneCopy = {
  galaxy: {
    kicker: "Scene 0",
    title: "Ink Particles / 散墨",
    text: "先不显示纸面，只保留从作品墨迹中采样出来的细密墨粒，等待重新聚合。",
    camera: [0, 0.2, 38],
    target: [0, 0, 0],
  },
  assemble: {
    kicker: "Scene 1",
    title: "Dense Ink Scroll / 墨粒成卷",
    text: "墨粒从散布状态归位，沿整卷墨迹高度图组成每一个字。墨迹越重，粒子越密、越亮、越向前。",
    camera: [0, -0.12, 31],
    target: [0, 0, 0],
  },
  enter: {
    kicker: "Scene 2",
    title: "Enter the Ink / 入墨",
    text: "镜头靠近字群。这里看到的是墨迹深浅形成的粒子厚度，不声称恢复真实笔顺。",
    camera: [12.8, -0.55, 7.6],
    target: [10.6, -0.1, 0.3],
  },
  ride: {
    kicker: "Scene 3",
    title: "Travel the Scroll / 游卷",
    text: "镜头沿长卷横向移动，像在字阵内部穿行。它不是恢复真实笔顺，而是把阅读时的流动感做成空间运动。",
    camera: [8, -0.75, 6.2],
    target: [6.7, -0.05, 0.2],
  },
  qi: {
    kicker: "Scene 4",
    title: "Reading Wave / 追势",
    text: "发光阅读波沿整卷墨迹从右向左掠过，用整体节奏提示观看路径，不画假的单条气脉线。",
    camera: [1.4, -0.8, 9.6],
    target: [0.1, -0.04, 0.15],
  },
  void: {
    kicker: "Scene 5",
    title: "Between Characters / 入白",
    text: "入白不是画框，也不是假空洞。镜头穿过字与字、笔画与笔画之间的暗处，让空白作为通道出现。",
    camera: [-5.5, -0.35, 6.1],
    target: [-5.2, -0.15, 0.05],
  },
  return: {
    kicker: "Scene 6",
    title: "Return / 回看",
    text: "镜头拉远，粒子逐渐变密并淡入原作图像，最后回到作品本身。",
    camera: [0, 0.1, 27],
    target: [0, 0, 0],
  },
};

const state = {
  currentScene: "galaxy",
  running: false,
  paused: false,
  sceneStartedAt: performance.now(),
  autoTimers: [],
  data: null,
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
  readOrder: null,
  originalPlane: null,
  clock: new THREE.Clock(),
  cameraTarget: new THREE.Vector3(),
  pointer: { active: false, x: 0, y: 0, yaw: 0, pitch: 0 },
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

async function loadOptionalImage(src) {
  if (!src) return null;
  return loadImage(src).catch(() => null);
}

async function loadData() {
  let work = null;
  try {
    const response = await fetch(`${API_BASE}/api/works/${encodeURIComponent(requestedWorkId)}`, { cache: "no-store" });
    if (response.ok) work = await response.json();
  } catch {
    work = null;
  }

  if (!work) {
    const indexResponse = await fetch("../data/works.json", { cache: "no-store" });
    if (indexResponse.ok) {
      const index = await indexResponse.json();
      work = (index.works || []).find((item) => item.id === requestedWorkId) || null;
    }
  }

  if (!work && requestedWorkId === "work_003") {
    const response = await fetch("./calligraphy-work.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`无法加载 QiVerse 数据：${response.status}`);
    state.data = await response.json();
    return;
  }

  if (!work) throw new Error(`无法加载作品：${requestedWorkId}`);

  state.data = {
    id: `${requestedWorkId}_qiverse_character_constellation`,
    sourceWorkId: requestedWorkId,
    title: `${work.title || requestedWorkId} · QiVerse 墨粒长卷`,
    workTitle: work.title || requestedWorkId,
    artist: work.artist || "",
    heightImage: `data/${requestedWorkId}/height.png`,
    originalImage: `data/${requestedWorkId}/original.png`,
    fallbackImage: `data/${requestedWorkId}/ink_density.png`,
    description:
      work.description ||
      "QiVerse 会读取当前作品的 OpenCV 高度图，让墨粒按该作品的墨迹重新组成长卷；不恢复真实笔顺，也不自动评价书法水平。",
  };
}

function sampleScrollHeightMap(image, maxPoints = MAX_PARTICLES) {
  const sampleWidth = 3000;
  const sampleHeight = Math.max(160, Math.round(sampleWidth / (image.width / image.height)));
  const sampler = document.createElement("canvas");
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const context = sampler.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, sampleWidth, sampleHeight);
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const candidates = [];
  const stride = 1;

  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = (y * sampleWidth + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const alpha = pixels[index + 3] / 255;
      const brightness = ((r + g + b) / 765) * alpha;

      if (brightness < 0.05) continue;
      const keepChance = 0.22 + Math.pow(brightness, 0.72) * 0.62;
      if (random() <= keepChance) candidates.push({ x, y, density: brightness });
    }
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const selected = candidates.slice(0, maxPoints);
  const workHeight = SCROLL_WIDTH / (image.width / image.height);
  return selected.map((point, index) => {
    const nx = point.x / sampleWidth - 0.5;
    const ny = 0.5 - point.y / sampleHeight;
    const ridge = Math.pow(THREE.MathUtils.clamp(point.density, 0, 1), 1.35);
    const z = ridge * 0.72 + Math.sin(index * 0.97) * 0.018;
    return {
      target: new THREE.Vector3(nx * SCROLL_WIDTH, ny * workHeight, z),
      density: point.density,
    };
  });
}

function createOriginalPlane(image) {
  if (!image) return;
  const texture = new THREE.Texture(image);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy?.() || 1);

  const scrollHeight = SCROLL_WIDTH / (image.width / image.height);
  const geometry = new THREE.PlaneGeometry(SCROLL_WIDTH, scrollHeight, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });

  state.originalPlane = new THREE.Mesh(geometry, material);
  state.originalPlane.position.z = -0.08;
  state.world.add(state.originalPlane);
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
  const readOrder = new Float32Array(count);

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
    readOrder[index] = THREE.MathUtils.clamp((SCROLL_WIDTH * 0.5 - target.x) / SCROLL_WIDTH * 0.86 + (0.5 - target.y / 4) * 0.14, 0, 1);
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
    size: 0.024,
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
  state.readOrder = readOrder;
  state.particleGeometry = geometry;
  state.particleMaterial = material;
  state.particleSystem = new THREE.Points(geometry, material);
  state.world.add(state.particleSystem);
}

async function init() {
  await loadData();
  document.title = `${state.data.workTitle || state.data.title || "QiVerse"} - QiVerse`;
  if (launchTitle) launchTitle.textContent = state.data.workTitle || "墨粒长卷";
  if (launchCopy) {
    launchCopy.textContent = `${state.data.description || "系统读取当前作品的 OpenCV 高度图，让墨粒按这件作品的墨迹重新组成长卷。"} 当前作品：${state.data.sourceWorkId || requestedWorkId}`;
  }
  if (backLink) backLink.href = `../web/?view=demo&work=${encodeURIComponent(state.data.sourceWorkId || requestedWorkId)}`;

  let heightImage;
  try {
    heightImage = await loadImage(resolveAssetPath(state.data.heightImage));
  } catch (error) {
    if (!state.data.fallbackImage) throw error;
    heightImage = await loadImage(resolveAssetPath(state.data.fallbackImage));
  }
  const originalImage = await loadOptionalImage(resolveAssetPath(state.data.originalImage || `data/${requestedWorkId}/original.png`));

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

  createOriginalPlane(originalImage);
  createParticleField(sampleScrollHeightMap(heightImage));

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

function setScene(nextScene, immediate = false) {
  state.currentScene = nextScene;
  state.sceneStartedAt = performance.now();
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
}

function playJourney() {
  clearJourneyTimers();
  state.running = true;
  state.paused = false;
  pauseButton.textContent = "暂停";
  setScene("galaxy");

  sceneOrder.slice(1).forEach((scene, index) => {
    const timer = window.setTimeout(() => {
      if (!state.paused) setScene(scene);
    }, journeyDurations[index + 1]);
    state.autoTimers.push(timer);
  });
}

function bindEvents() {
  window.addEventListener("resize", resize);

  startButton.addEventListener("click", () => {
    launchPanel.classList.add("hidden");
    playJourney();
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
    launchPanel.classList.remove("hidden");
    setScene("galaxy", true);
  });

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

  canvas.addEventListener("pointerup", (event) => {
    state.pointer.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });

  setupXRButton();
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
    return { destination: state.voidTargets, amount, lift: 0.08, spread: 0.5, fade: 0.48 };
  }
  return { destination: state.targets, amount: 1, lift: 0, spread: 0.02, fade: 0.64 };
}

function getReadingProgress(elapsed) {
  if (state.currentScene === "ride") return (elapsed / 6200) % 1;
  if (state.currentScene === "qi") return (elapsed / 7600) % 1;
  return -1;
}

function updateParticleColors(seconds, elapsed) {
  const colors = state.colors;
  const base = state.baseColors;
  const waveX = SCROLL_WIDTH * 0.48 - ((seconds * 2.6) % SCROLL_WIDTH);
  const flowScene = state.currentScene === "qi";
  const readingScene = ["ride", "qi"].includes(state.currentScene);
  const readingProgress = getReadingProgress(elapsed);
  const voidScene = state.currentScene === "void";

  for (let i = 0; i < colors.length; i += 3) {
    const index = i / 3;
    const x = state.anchors[index];
    const spatialWave = flowScene ? Math.exp(-Math.pow(x - waveX, 2) / 4.8) * 0.32 : 0;
    const readingDelta = readingScene ? state.readOrder[index] - readingProgress : 4;
    const readingHead = Math.exp(-Math.pow(readingDelta, 2) / 0.0009);
    const readingAfterglow = readingDelta < 0 && readingDelta > -0.08 ? (1 + readingDelta / 0.08) * 0.45 : 0;
    const wave = spatialWave + readingHead * 1.15 + readingAfterglow;
    const dim = voidScene ? 0.46 : 1;
    const pulse = 1 + wave * 0.88 + Math.sin(seconds * 1.8 + index * 0.013) * 0.025;
    colors[i] = base[i] * pulse * dim + wave * 0.18;
    colors[i + 1] = base[i + 1] * pulse * dim + wave * 0.13;
    colors[i + 2] = base[i + 2] * pulse * dim + wave * 0.04;
  }

  state.particleGeometry.attributes.color.needsUpdate = true;
}

function updateOriginalPlane(elapsed) {
  if (!state.originalPlane) return;
  const targetOpacity = state.currentScene === "return"
    ? smoothstep(0.08, 0.88, elapsed / 3200) * 0.92
    : 0;
  state.originalPlane.material.opacity += (targetOpacity - state.originalPlane.material.opacity) * 0.06;
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
  updateParticleColors(seconds, elapsed);

  const targetSize =
    state.currentScene === "galaxy" ? 0.019 :
    state.currentScene === "assemble" ? 0.027 :
    state.currentScene === "enter" ? 0.026 :
    state.currentScene === "ride" ? 0.022 :
    state.currentScene === "void" ? 0.019 :
    state.currentScene === "return" ? 0.021 :
    0.024;
  state.particleMaterial.size += (targetSize - state.particleMaterial.size) * 0.045;
  state.particleMaterial.opacity += (mix.fade - state.particleMaterial.opacity) * 0.05;
  updateOriginalPlane(elapsed);
}

function updateCamera(elapsed) {
  const copy = sceneCopy[state.currentScene];
  const targetPosition = new THREE.Vector3(...copy.camera);
  const targetLook = new THREE.Vector3(...copy.target);

  if (state.currentScene === "ride") {
    const t = (elapsed / 5600) % 1;
    const x = THREE.MathUtils.lerp(13.2, -13.2, t);
    targetPosition.set(
      x,
      -0.8 + Math.sin(t * Math.PI * 2) * 0.28,
      5.8 + Math.sin(t * Math.PI) * 0.95,
    );
    targetLook.set(x - 1.2, -0.08, 0.3);
  }

  if (state.currentScene === "qi") {
    const t = (elapsed / 6200) % 1;
    const x = THREE.MathUtils.lerp(12.5, -12.5, t);
    targetPosition.set(x, -0.62 + Math.sin(t * Math.PI * 2) * 0.18, 6.2);
    targetLook.set(x - 1.8, -0.04, 0.34);
  }

  if (state.currentScene === "void") {
    const t = (elapsed / 5400) % 1;
    const x = THREE.MathUtils.lerp(5.8, -9.4, t);
    targetPosition.set(x, -0.28 + Math.sin(t * Math.PI * 2) * 0.18, 5.4);
    targetLook.set(x - 0.5, -0.06, 0);
  }

  if (state.currentScene === "galaxy") {
    targetPosition.x += Math.sin(elapsed * 0.00023) * 0.9;
    targetPosition.y += Math.cos(elapsed * 0.00017) * 0.36;
  }

  targetPosition.x += state.pointer.yaw * 4.2;
  targetPosition.y += state.pointer.pitch * 3.4;
  state.camera.position.lerp(targetPosition, 0.035);
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
  updateCamera(elapsed);

  state.world.rotation.z = Math.sin(seconds * 0.055) * 0.01;
  state.renderer.render(state.threeScene, state.camera);
}

init().catch((error) => {
  console.error(error);
  sceneTitle.textContent = "加载失败";
  sceneText.textContent = error.message;
});
