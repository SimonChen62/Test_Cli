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
const chapterButtons = Array.from(document.querySelectorAll(".chapter"));

const sceneOrder = ["galaxy", "assemble", "enter", "ride", "qi", "void", "return"];
const journeyDurations = [0, 3600, 7200, 10800, 14400, 18000, 21600];

const sceneCopy = {
  galaxy: {
    kicker: "Scene 0",
    title: "Silence / \u9759\u58a8",
    text: "\u6563\u843d\u7684\u661f\u5149\u8fd8\u6ca1\u6709\u6210\u4e3a\u6587\u5b57\u3002\u9760\u8fd1\u4e4b\u524d\uff0c\u58a8\u53ea\u662f\u8fdc\u5904\u7684\u5c18\u57c3\u3002",
    camera: [0, 0, 18],
    target: [0, 0, 0],
  },
  assemble: {
    kicker: "Scene 1",
    title: "Ink Constellation / \u6210\u5b57",
    text: "\u661f\u70b9\u5f00\u59cb\u5f52\u4f4d\uff0c\u70b9\u9635\u6162\u6162\u805a\u6210\u8d75\u5b5f\u982b\u300a\u5149\u798f\u91cd\u5efa\u5854\u8bb0\u300b\u7684\u58a8\u8ff9\u957f\u5377\u3002",
    camera: [0, -0.35, 12.6],
    target: [0, 0, 0],
  },
  enter: {
    kicker: "Scene 2",
    title: "Enter the Ink / \u5165\u58a8",
    text: "\u955c\u5934\u8d34\u8fd1\u58a8\u8ff9\u8fb9\u7f18\u3002\u91cd\u58a8\u50cf\u5c71\u810a\uff0c\u98de\u767d\u50cf\u7834\u788e\u7684\u661f\u5e26\u3002",
    camera: [-4.4, -0.9, 5.2],
    target: [-2.0, 0.05, 0.2],
  },
  ride: {
    kicker: "Scene 3",
    title: "Ride the Stroke / \u5fa1\u7b14\u800c\u884c",
    text: "\u6cbf\u58a8\u52bf\u7a7f\u884c\u3002\u8fd9\u91cc\u4e0d\u662f\u6062\u590d\u771f\u5b9e\u7b14\u987a\uff0c\u800c\u662f\u628a\u7ebf\u6761\u66fe\u7ecf\u662f\u52a8\u4f5c\u8fd9\u4ef6\u4e8b\u53d8\u5f97\u53ef\u611f\u3002",
    camera: [-1.4, -1.1, 3.1],
    target: [0.2, 0.12, 0.25],
  },
  qi: {
    kicker: "Scene 4",
    title: "Follow the Qi / \u8ffd\u52bf",
    text: "\u6de1\u91d1\u8272\u58a8\u7c92\u8de8\u8d8a\u65ad\u53e3\uff0c\u63d0\u793a\u5f62\u65ad\u52bf\u8fde\u3002\u5b83\u662f\u89e3\u91ca\u6027\u53ef\u89c6\u5316\uff0c\u4e0d\u662f\u7b97\u6cd5\u5224\u65ad\u6c14\u97f5\u3002",
    camera: [2.0, -1.0, 4.1],
    target: [2.9, 0.04, 0.2],
  },
  void: {
    kicker: "Scene 5",
    title: "Walk into the Void / \u5165\u767d",
    text: "\u58a8\u8ff9\u6e10\u9000\uff0c\u7a7a\u767d\u6d6e\u73b0\u3002\u5b57\u5185\u3001\u5b57\u95f4\u3001\u884c\u95f4\u6ca1\u6709\u88ab\u5199\u51fa\u7684\u5730\u65b9\uff0c\u4e5f\u5728\u7ec4\u7ec7\u547c\u5438\u3002",
    camera: [0, -1.25, 6.6],
    target: [0, 0, 0],
  },
  return: {
    kicker: "Scene 6",
    title: "Return / \u56de\u770b\u539f\u4f5c",
    text: "\u661f\u5c18\u9000\u573a\uff0c\u539f\u4f5c\u91cd\u65b0\u51fa\u73b0\u3002\u521a\u624d\u7684\u8fd0\u52a8\u3001\u65ad\u7eed\u4e0e\u7559\u767d\uff0c\u56de\u5230\u4e8c\u7ef4\u7eb8\u9762\u3002",
    camera: [0, 0, 10.8],
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
  darkness: null,
  paperPlane: null,
  qiGroup: null,
  voidGroup: null,
  backgroundStars: null,
  clock: new THREE.Clock(),
  cameraTarget: new THREE.Vector3(),
  pointer: { active: false, x: 0, y: 0, yaw: 0, pitch: 0 },
};

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeParticleTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 64;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.38, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.72, "rgba(255, 255, 255, 0.24)");
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
    image.onerror = () => reject(new Error(`\u65e0\u6cd5\u52a0\u8f7d\u56fe\u50cf\uff1a${src}`));
    image.src = src;
  });
}

async function loadData() {
  const response = await fetch("./calligraphy-work.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`\u65e0\u6cd5\u52a0\u8f7d QiVerse \u6570\u636e\uff1a${response.status}`);
  state.data = await response.json();
}

function sampleInkPixels(image, maxPoints = 14000) {
  const sampleWidth = 1200;
  const sampleHeight = Math.max(120, Math.round(sampleWidth / (image.width / image.height)));
  const sampler = document.createElement("canvas");
  sampler.width = sampleWidth;
  sampler.height = sampleHeight;
  const context = sampler.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#f4efe4";
  context.fillRect(0, 0, sampleWidth, sampleHeight);
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const candidates = [];
  const stride = 2;

  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = (y * sampleWidth + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const darkness = 1 - (r + g + b) / 765;

      if (darkness > 0.16 && Math.random() < Math.min(1, darkness * 1.42)) {
        candidates.push({ x, y, darkness });
      }
    }
  }

  candidates.sort((a, b) => b.darkness - a.darkness);
  const selected = candidates.slice(0, maxPoints);
  const workWidth = 16.8;
  const workHeight = workWidth / (image.width / image.height);

  return selected.map((point, index) => {
    const nx = point.x / sampleWidth - 0.5;
    const ny = 0.5 - point.y / sampleHeight;
    const height = Math.pow(THREE.MathUtils.clamp(point.darkness, 0, 1), 1.6) * 0.82;
    return {
      target: new THREE.Vector3(nx * workWidth, ny * workHeight, height + Math.sin(index * 1.31) * 0.012),
      darkness: point.darkness,
    };
  });
}

function createBackgroundStars() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const p = i * 3;
    positions[p] = randomRange(-18, 18);
    positions[p + 1] = randomRange(-8, 8);
    positions[p + 2] = randomRange(-16, -2);
    const warm = Math.random();
    colors[p] = 0.4 + warm * 0.55;
    colors[p + 1] = 0.38 + warm * 0.42;
    colors[p + 2] = 0.34 + warm * 0.34;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.022,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
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
  const colors = new Float32Array(count * 3);
  const darkness = new Float32Array(count);

  samples.forEach((sample, index) => {
    const i = index * 3;
    const arm = index % 5;
    const radius = 1.4 + Math.sqrt(index / count) * 10.4 + randomRange(-0.8, 0.8);
    const theta = index * 0.041 + arm * ((Math.PI * 2) / 5);
    const swirl = theta + radius * 0.18;

    galaxy[i] = Math.cos(swirl) * radius;
    galaxy[i + 1] = Math.sin(swirl) * radius * 0.52 + randomRange(-0.6, 0.6);
    galaxy[i + 2] = randomRange(-5.6, 5.6);
    scatter[i] = randomRange(-8.8, 8.8);
    scatter[i + 1] = randomRange(-3.3, 3.3);
    scatter[i + 2] = randomRange(-3.2, 4.8);

    targets[i] = sample.target.x;
    targets[i + 1] = sample.target.y;
    targets[i + 2] = sample.target.z;
    positions[i] = galaxy[i];
    positions[i + 1] = galaxy[i + 1];
    positions[i + 2] = galaxy[i + 2];

    darkness[index] = sample.darkness;
    colors[i] = 0.76 + sample.darkness * 0.22;
    colors[i + 1] = 0.58 + sample.darkness * 0.28;
    colors[i + 2] = 0.36 + sample.darkness * 0.2;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.026,
    map: makeParticleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    alphaTest: 0.01,
    blending: THREE.AdditiveBlending,
  });

  state.positions = positions;
  state.targets = targets;
  state.galaxy = galaxy;
  state.scatter = scatter;
  state.darkness = darkness;
  state.particleGeometry = geometry;
  state.particleMaterial = material;
  state.particleSystem = new THREE.Points(geometry, material);
  state.world.add(state.particleSystem);
}

function makePaperPlane(texture, image) {
  texture.colorSpace = THREE.SRGBColorSpace;
  const width = 16.95;
  const height = width / (image.width / image.height);
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  state.paperPlane = new THREE.Mesh(geometry, material);
  state.paperPlane.position.z = -0.08;
  state.world.add(state.paperPlane);
}

function workPoint(point, z = 0.58) {
  return new THREE.Vector3(point[0] * 7.4, point[1] * 3.0, z);
}

function makeQiCurve(points, color, opacity) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => workPoint(point, 0.78)));
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(140));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.userData.targetOpacity = opacity;
  return { line, curve };
}

function createInterpretiveLayers() {
  state.qiGroup = new THREE.Group();
  state.voidGroup = new THREE.Group();

  state.data.qiLinks.forEach((link) => {
    const { line, curve } = makeQiCurve(link.points, 0xd8b569, 0.52);
    state.qiGroup.add(line);

    for (let i = 0; i < 12; i += 1) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0xf3d889,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      dot.userData = { curve, phase: i / 12, targetOpacity: 0.78 };
      state.qiGroup.add(dot);
    }
  });

  state.data.voidRegions.forEach((region) => {
    const geometry = new THREE.BoxGeometry(region.size[0] * 7.4, region.size[1] * 3.0, 0.12 + region.depth);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf5ead7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(workPoint(region.center, 0.18 + region.depth));
    mesh.userData.targetOpacity = 0.26;
    state.voidGroup.add(mesh);
  });

  state.world.add(state.qiGroup, state.voidGroup);
}

async function init() {
  await loadData();
  const image = await loadImage(state.data.image);

  state.threeScene = new THREE.Scene();
  state.threeScene.background = new THREE.Color(0x070706);
  state.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 140);
  state.camera.position.set(...sceneCopy.galaxy.camera);
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  state.renderer.xr.enabled = true;

  const ambient = new THREE.AmbientLight(0xffffff, 0.42);
  const key = new THREE.DirectionalLight(0xf4dca6, 1.2);
  key.position.set(-3, -4, 6);
  state.threeScene.add(ambient, key);

  state.world = new THREE.Group();
  state.threeScene.add(state.world);

  const texture = await new THREE.TextureLoader().loadAsync(state.data.image);
  makePaperPlane(texture, image);
  createBackgroundStars();
  createParticleField(sampleInkPixels(image));
  createInterpretiveLayers();

  resize();
  bindEvents();
  setScene("galaxy", true);
  state.renderer.setAnimationLoop(animate);
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
  pauseButton.textContent = "\u6682\u505c";
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
    pauseButton.textContent = state.paused ? "\u7ee7\u7eed" : "\u6682\u505c";
  });

  resetButton.addEventListener("click", () => {
    clearJourneyTimers();
    state.running = false;
    state.paused = false;
    pauseButton.textContent = "\u6682\u505c";
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
    state.pointer.yaw += dx * 0.0015;
    state.pointer.pitch = THREE.MathUtils.clamp(state.pointer.pitch + dy * 0.0011, -0.26, 0.26);
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
  xrButton.textContent = supported ? "\u8fdb\u5165 XR" : "Desktop";
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
  if (scene === "galaxy") return { destination: state.galaxy, amount: 0, lift: 0, spread: 1, fade: 0.96 };
  if (scene === "assemble") {
    const amount = smoothstep(0.08, 0.95, elapsed / 3600);
    return { destination: state.targets, amount, lift: 0.05, spread: 1 - amount * 0.72, fade: 1 };
  }
  if (scene === "enter") {
    return { destination: state.targets, amount: 1, lift: smoothstep(0.05, 1, elapsed / 2600) * 0.92, spread: 0.16, fade: 0.96 };
  }
  if (scene === "ride") return { destination: state.targets, amount: 1, lift: 1.08, spread: 0.1, fade: 0.98 };
  if (scene === "qi") return { destination: state.targets, amount: 1, lift: 0.76, spread: 0.14, fade: 0.88 };
  if (scene === "void") {
    const amount = smoothstep(0.1, 1, elapsed / 3000);
    return { destination: state.scatter, amount, lift: 0.18, spread: 0.72, fade: 0.38 };
  }
  return { destination: state.targets, amount: 1, lift: 0, spread: 0.02, fade: 0.45 };
}

function updateParticles(elapsed, seconds) {
  const mix = particleMixForScene(state.currentScene, elapsed);
  const positions = state.positions;

  for (let i = 0; i < positions.length; i += 3) {
    const index = i / 3;
    const sourceX = state.galaxy[i] + Math.sin(seconds * 0.12 + index * 0.33) * 0.18;
    const sourceY = state.galaxy[i + 1] + Math.cos(seconds * 0.15 + index * 0.22) * 0.12;
    const sourceZ = state.galaxy[i + 2];
    const drift = Math.sin(seconds * 0.8 + index * 0.09) * mix.spread;
    const destinationX = mix.destination[i] + drift * 0.16;
    const destinationY = mix.destination[i + 1] + Math.cos(seconds * 0.62 + index * 0.05) * mix.spread * 0.08;
    const destinationZ = mix.destination[i + 2] + mix.lift * (0.26 + state.darkness[index] * 0.64);
    const targetX = THREE.MathUtils.lerp(sourceX, destinationX, mix.amount);
    const targetY = THREE.MathUtils.lerp(sourceY, destinationY, mix.amount);
    const targetZ = THREE.MathUtils.lerp(sourceZ, destinationZ, mix.amount);

    positions[i] += (targetX - positions[i]) * 0.055;
    positions[i + 1] += (targetY - positions[i + 1]) * 0.055;
    positions[i + 2] += (targetZ - positions[i + 2]) * 0.055;
  }

  state.particleGeometry.attributes.position.needsUpdate = true;
  const targetSize =
    state.currentScene === "galaxy" ? 0.022 :
    state.currentScene === "assemble" ? 0.035 :
    state.currentScene === "ride" ? 0.026 :
    state.currentScene === "return" ? 0.022 :
    0.031;
  state.particleMaterial.size += (targetSize - state.particleMaterial.size) * 0.04;
  state.particleMaterial.opacity += (mix.fade - state.particleMaterial.opacity) * 0.045;
}

function updateInterpretiveLayers(seconds) {
  const qiVisible = state.currentScene === "qi" ? 1 : 0;
  const voidVisible = state.currentScene === "void" ? 1 : 0;

  state.qiGroup.traverse((object) => {
    if (!object.material) return;
    const target = qiVisible * (object.userData.targetOpacity || 0.5);
    object.material.opacity += (target - object.material.opacity) * 0.08;
    if (object.userData.curve) {
      const t = (object.userData.phase + seconds * 0.095) % 1;
      object.position.copy(object.userData.curve.getPoint(t));
    }
  });

  state.voidGroup.traverse((object) => {
    if (!object.material) return;
    const target = voidVisible * (object.userData.targetOpacity || 0.22);
    object.material.opacity += (target - object.material.opacity) * 0.08;
  });
}

function updatePaper() {
  const target =
    state.currentScene === "return" ? 0.9 :
    state.currentScene === "assemble" ? 0.22 :
    state.currentScene === "void" ? 0.16 :
    0;
  state.paperPlane.material.opacity += (target - state.paperPlane.material.opacity) * 0.045;
}

function updateCamera(elapsed) {
  const copy = sceneCopy[state.currentScene];
  const targetPosition = new THREE.Vector3(...copy.camera);
  const targetLook = new THREE.Vector3(...copy.target);

  if (state.currentScene === "ride") {
    const t = (elapsed / 4300) % 1;
    targetPosition.set(
      THREE.MathUtils.lerp(-5.2, 4.8, t),
      -1.12 + Math.sin(t * Math.PI * 2) * 0.26,
      2.35 + Math.sin(t * Math.PI) * 1.1,
    );
    targetLook.set(THREE.MathUtils.lerp(-3.2, 3.7, t), 0.03, 0.36);
  }

  if (state.currentScene === "galaxy") {
    targetPosition.x += Math.sin(elapsed * 0.00025) * 0.7;
    targetPosition.y += Math.cos(elapsed * 0.00018) * 0.32;
  }

  targetPosition.x += state.pointer.yaw * 3.2;
  targetPosition.y += state.pointer.pitch * 3.2;
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
  updateInterpretiveLayers(seconds);
  updatePaper();
  updateCamera(elapsed);

  state.world.rotation.z = Math.sin(seconds * 0.07) * 0.014;
  if (state.backgroundStars) state.backgroundStars.rotation.z += 0.00008;
  state.renderer.render(state.threeScene, state.camera);
}

init().catch((error) => {
  console.error(error);
  sceneTitle.textContent = "\u52a0\u8f7d\u5931\u8d25";
  sceneText.textContent = error.message;
});
