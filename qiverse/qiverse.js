import * as THREE from "../web/vendor/three.module.js";

const canvas = document.querySelector("#qiverseCanvas");
const stepTitle = document.querySelector("#stepTitle");
const stepText = document.querySelector("#stepText");
const stageHint = document.querySelector("#stageHint");
const stepButtons = Array.from(document.querySelectorAll(".stepButton"));
const playButton = document.querySelector("#playButton");
const resetButton = document.querySelector("#resetButton");
const xrButton = document.querySelector("#xrButton");

const stepCopy = {
  original: {
    title: "Original · 静墨",
    text: "面前是一幅原作。先观察整体势态，再触发入墨体验。",
    hint: "Original：先看原作，不急着解释。",
  },
  enter: {
    title: "Enter the Ink · 入墨",
    text: "墨迹从纸面升起。重墨形成墨壁，飞白变成更薄、更碎的颗粒。",
    hint: "Enter the Ink：把可见墨迹转为空间厚度。",
  },
  ride: {
    title: "Ride the Stroke · 御笔而行",
    text: "镜头沿一条关键笔画运动，转折处放慢，粗重处空间更压近。",
    hint: "Ride the Stroke：一笔不是线，而是发生过的运动。",
  },
  qi: {
    title: "Follow the Qi · 追势",
    text: "淡金墨粒跨越断口，提示形断势连。它是解释性可视化，不是算法判断气韵。",
    hint: "Follow the Qi：断开的墨迹之间，观看仍可能感到势在继续。",
  },
  void: {
    title: "Walk into the Void · 入白",
    text: "留白从平面翻转成空间。字内是空腔，字间是通道，行间变成开放区域。",
    hint: "Walk into the Void：没有被写出的地方，也在组织呼吸。",
  },
  return: {
    title: "Return · 回到原作",
    text: "所有空间化效果退回纸面。体验结束后，再看原作中的运动、断续与留白。",
    hint: "Return：回到二维原作，重新看见气韵与呼吸。",
  },
};

const state = {
  step: "original",
  data: null,
  scene: null,
  camera: null,
  renderer: null,
  root: null,
  paper: null,
  imagePlane: null,
  inkGroup: null,
  qiGroup: null,
  voidGroup: null,
  particles: [],
  rideCurve: null,
  rideStart: 0,
  playTimer: 0,
  pointer: { active: false, x: 0, y: 0, rotX: -0.18, rotY: 0.18 },
};

function worldPoint(point, z = 0.02) {
  return new THREE.Vector3(point[0] * 7.2, point[1] * 4.2, z);
}

function makeRibbon(points, width, density) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => worldPoint(point, 0.18 + density * 0.16)));
  const samples = curve.getPoints(80);
  const vertices = [];
  const indices = [];
  const up = new THREE.Vector3(0, 0, 1);

  samples.forEach((point, index) => {
    const next = samples[Math.min(index + 1, samples.length - 1)];
    const prev = samples[Math.max(index - 1, 0)];
    const tangent = next.clone().sub(prev).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const tapered = width * 7.2 * (0.72 + Math.sin((index / (samples.length - 1)) * Math.PI) * 0.34);
    vertices.push(point.x + normal.x * tapered, point.y + normal.y * tapered, point.z);
    vertices.push(point.x - normal.x * tapered, point.y - normal.y * tapered, point.z);
    if (index < samples.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.08, 0.12, 0.06 + density * 0.04),
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.targetOpacity = 0.72 + density * 0.22;
  mesh.userData.baseZ = 0.18 + density * 0.16;
  return { mesh, curve };
}

function makeCurveLine(points, strength) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => worldPoint(point, 0.72)));
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
  const material = new THREE.LineBasicMaterial({
    color: 0xc4a35a,
    transparent: true,
    opacity: 0,
  });
  const line = new THREE.Line(geometry, material);
  line.userData.targetOpacity = 0.16 + strength * 0.42;

  const particles = new THREE.Group();
  for (let i = 0; i < 8; i += 1) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + strength * 0.015, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8bd72, transparent: true, opacity: 0 }),
    );
    dot.userData = { curve, phase: i / 8, speed: 0.055 + strength * 0.025, targetOpacity: 0.68 };
    particles.add(dot);
    state.particles.push(dot);
  }
  return { line, particles };
}

function makeVoidRegion(region) {
  const geometry = new THREE.BoxGeometry(region.size[0] * 7.2, region.size[1] * 4.2, region.depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5efe1,
    emissive: 0xd8cdb8,
    emissiveIntensity: 0.08,
    roughness: 0.92,
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(worldPoint(region.center, 0.12 + region.depth * 0.5));
  mesh.userData.targetOpacity = 0.42;
  return mesh;
}

async function loadData() {
  const response = await fetch("./calligraphy-work.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`无法加载 QiVerse 数据：${response.status}`);
  state.data = await response.json();
}

async function initScene() {
  await loadData();
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x15130f);
  state.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  state.camera.position.set(0, -6.8, 5.6);
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.xr.enabled = true;

  const hemi = new THREE.HemisphereLight(0xfff7e6, 0x242018, 1.8);
  state.scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.4);
  key.position.set(2.5, -4.5, 6);
  state.scene.add(key);

  state.root = new THREE.Group();
  state.root.rotation.x = state.pointer.rotX;
  state.root.rotation.y = state.pointer.rotY;
  state.scene.add(state.root);

  const texture = await new THREE.TextureLoader().loadAsync(state.data.image);
  texture.colorSpace = THREE.SRGBColorSpace;
  const imageRatio = texture.image.width / texture.image.height;
  const paperHeight = 4.2;
  const paperWidth = paperHeight * imageRatio;

  const paperGeometry = new THREE.PlaneGeometry(paperWidth, paperHeight, 64, 24);
  const paperMaterial = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.86 });
  state.paper = new THREE.Mesh(paperGeometry, paperMaterial);
  state.paper.position.z = -0.04;
  state.root.add(state.paper);

  state.imagePlane = new THREE.Mesh(
    paperGeometry,
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.98 }),
  );
  state.imagePlane.position.z = 0;
  state.root.add(state.imagePlane);

  state.inkGroup = new THREE.Group();
  state.qiGroup = new THREE.Group();
  state.voidGroup = new THREE.Group();
  state.root.add(state.voidGroup, state.inkGroup, state.qiGroup);

  state.data.strokes.forEach((stroke, index) => {
    const { mesh, curve } = makeRibbon(stroke.points, stroke.width, stroke.inkDensity);
    mesh.userData.strokeId = stroke.id;
    state.inkGroup.add(mesh);
    if (index === 0) state.rideCurve = curve;
  });

  state.data.qiLinks.forEach((link) => {
    const { line, particles } = makeCurveLine(link.points, link.strength);
    state.qiGroup.add(line, particles);
  });

  state.data.voidRegions.forEach((region) => {
    state.voidGroup.add(makeVoidRegion(region));
  });

  resize();
  bindControls();
  setStep("original");
  state.renderer.setAnimationLoop(animate);
}

function setOpacity(group, opacity, immediate = false) {
  group.traverse((object) => {
    if (!object.material) return;
    const target = opacity * (object.userData.targetOpacity || 1);
    if (immediate) object.material.opacity = target;
    object.userData.opacityTarget = target;
  });
}

function setStep(step) {
  state.step = step;
  const copy = stepCopy[step];
  stepTitle.textContent = copy.title;
  stepText.textContent = copy.text;
  stageHint.textContent = copy.hint;
  stepButtons.forEach((button) => button.classList.toggle("active", button.dataset.step === step));

  setOpacity(state.inkGroup, ["enter", "ride", "qi", "void"].includes(step) ? 1 : 0);
  setOpacity(state.qiGroup, step === "qi" ? 1 : 0);
  setOpacity(state.voidGroup, step === "void" ? 1 : 0);

  if (step === "ride") state.rideStart = performance.now();
  if (step === "return" || step === "original") resetCamera(step === "original");
}

function resetCamera(immediate = false) {
  state.camera.position.set(0, -6.8, 5.6);
  state.camera.lookAt(0, 0, 0);
  state.pointer.rotX = -0.18;
  state.pointer.rotY = 0.18;
  if (immediate) {
    state.root.rotation.x = state.pointer.rotX;
    state.root.rotation.y = state.pointer.rotY;
  }
}

function bindControls() {
  window.addEventListener("resize", resize);
  stepButtons.forEach((button) => button.addEventListener("click", () => setStep(button.dataset.step)));
  resetButton.addEventListener("click", () => resetCamera(true));
  playButton.addEventListener("click", playChain);

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
    state.pointer.rotY += dx * 0.006;
    state.pointer.rotX = THREE.MathUtils.clamp(state.pointer.rotX + dy * 0.004, -0.82, 0.58);
  });
  canvas.addEventListener("pointerup", (event) => {
    state.pointer.active = false;
    canvas.releasePointerCapture(event.pointerId);
  });

  setupXRButton();
}

async function setupXRButton() {
  if (!navigator.xr) {
    xrButton.textContent = "当前浏览器无 XR";
    xrButton.disabled = true;
    return;
  }
  const supported = await navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
  xrButton.textContent = supported ? "进入 XR" : "Desktop Mode";
  xrButton.disabled = !supported;
  xrButton.addEventListener("click", async () => {
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
    state.renderer.xr.setSession(session);
  });
}

function playChain() {
  const chain = ["original", "enter", "ride", "qi", "void", "return"];
  window.clearTimeout(state.playTimer);
  chain.forEach((step, index) => {
    state.playTimer = window.setTimeout(() => setStep(step), index * 2600);
  });
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  state.renderer.setSize(rect.width, rect.height, false);
  state.camera.aspect = rect.width / rect.height;
  state.camera.updateProjectionMatrix();
}

function animate(time) {
  const seconds = time * 0.001;
  state.root.rotation.x += (state.pointer.rotX - state.root.rotation.x) * 0.08;
  state.root.rotation.y += (state.pointer.rotY - state.root.rotation.y) * 0.08;

  [state.inkGroup, state.qiGroup, state.voidGroup].forEach((group) => {
    group.traverse((object) => {
      if (!object.material || object.userData.opacityTarget === undefined) return;
      object.material.opacity += (object.userData.opacityTarget - object.material.opacity) * 0.08;
    });
  });

  state.particles.forEach((dot) => {
    const t = (dot.userData.phase + seconds * dot.userData.speed) % 1;
    dot.position.copy(dot.userData.curve.getPoint(t));
    dot.material.opacity += ((dot.userData.opacityTarget || 0) - dot.material.opacity) * 0.08;
  });

  if (state.step === "ride" && state.rideCurve) {
    const t = ((performance.now() - state.rideStart) / 4800) % 1;
    const point = state.rideCurve.getPoint(t);
    const look = state.rideCurve.getPoint(Math.min(t + 0.025, 1));
    state.camera.position.lerp(new THREE.Vector3(point.x, point.y - 1.2, point.z + 0.62), 0.06);
    state.camera.lookAt(look);
  }

  state.renderer.render(state.scene, state.camera);
}

initScene().catch((error) => {
  console.error(error);
  stageHint.textContent = error.message;
});
