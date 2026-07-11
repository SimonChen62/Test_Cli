import * as THREE from "../vendor/three.module.js";

const GLYPHS_URL = "../../data/work_003/glyphs/glyphs.json";
const GLYPH_BASE = "../../data/work_003/glyphs/";

const canvas = document.querySelector("#scene");
const errorBox = document.querySelector("#error");
const glyphButtons = document.querySelector("#glyphButtons");
const glyphLabel = document.querySelector("#glyphLabel");
const contourCount = document.querySelector("#contourCount");
const summary = document.querySelector("#summary");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x11100d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
camera.position.set(0, -3.4, 30);

const root = new THREE.Group();
scene.add(root);

const stage = new THREE.Group();
root.add(stage);

scene.add(new THREE.AmbientLight(0xfff2df, 1.25));
const key = new THREE.DirectionalLight(0xffd9a8, 3.1);
key.position.set(7, -9, 15);
scene.add(key);
const rim = new THREE.DirectionalLight(0x8fc0d1, 1.45);
rim.position.set(-7, 5, 10);
scene.add(rim);

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
let activeGlyph = null;
let activeRelief = null;
let activeBrush = null;
let dragging = false;
let lastPointer = { x: 0, y: 0 };

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function clearStage() {
  while (stage.children.length) {
    const child = stage.children.pop();
    child.traverse?.((object) => {
      object.geometry?.dispose?.();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((mat) => mat.dispose?.());
      }
    });
  }
}

function loadTexture(url, color = false) {
  if (!textureCache.has(url)) {
    textureCache.set(
      url,
      new Promise((resolve, reject) => {
        textureLoader.load(
          url,
          (texture) => {
            texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            resolve(texture);
          },
          undefined,
          reject
        );
      })
    );
  }
  return textureCache.get(url);
}

function textureSize(texture) {
  const image = texture.image || {};
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  };
}

function addPaper(width, height) {
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 1.8, height + 1.8, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xf2dfbb,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  paper.position.z = -0.42;
  stage.add(paper);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 1.8, height + 1.8)),
    new THREE.LineBasicMaterial({ color: 0x8d7652, transparent: true, opacity: 0.5 })
  );
  border.position.z = -0.39;
  stage.add(border);
}

function addDepthGuide(width, height) {
  const guide = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x8aa6aa, transparent: true, opacity: 0.18 });
  for (let i = 1; i < 5; i += 1) {
    const y = -height / 2 + (height * i) / 5;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, y, -0.22),
      new THREE.Vector3(width / 2, y, -0.22),
    ]);
    guide.add(new THREE.Line(geometry, material.clone()));
  }
  stage.add(guide);
}

function makeTraceBrush(glyph, width, height) {
  const points = (glyph.tracePath || []).map((point) => {
    const x = (point.x / 100 - 0.5) * width;
    const y = (0.5 - point.y / 100) * height;
    return new THREE.Vector3(x, y, 0.48);
  });
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.035, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xb74634, transparent: true, opacity: 0.38, depthWrite: false })
  );
  stage.add(line);
  const brush = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 12),
    new THREE.MeshStandardMaterial({
      color: 0xd6b16b,
      emissive: 0x8a3b24,
      emissiveIntensity: 0.45,
      roughness: 0.45,
    })
  );
  brush.userData = { curve, phase: 0 };
  stage.add(brush);
  return brush;
}

async function addGlyphRelief(glyph) {
  clearStage();
  activeGlyph = glyph;

  const [maskTexture, heightTexture] = await Promise.all([
    loadTexture(GLYPH_BASE + glyph.mask, true),
    loadTexture(GLYPH_BASE + glyph.height, false),
  ]);
  const size = textureSize(maskTexture);
  const aspect = size.width / Math.max(1, size.height);
  const height = 15.5;
  const width = Math.max(4, height * aspect);

  addPaper(width, height);
  addDepthGuide(width, height);

  const segmentsX = Math.min(260, Math.max(90, Math.round(size.width / 2)));
  const segmentsY = Math.min(320, Math.max(120, Math.round(size.height / 2)));
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const material = new THREE.MeshStandardMaterial({
    map: maskTexture,
    transparent: true,
    alphaTest: 0.05,
    color: 0x15100c,
    roughness: 0.84,
    metalness: 0.02,
    displacementMap: heightTexture,
    displacementScale: -1.15,
    displacementBias: 0.52,
    side: THREE.DoubleSide,
  });
  activeRelief = new THREE.Mesh(geometry, material);
  activeRelief.position.z = 0.18;
  stage.add(activeRelief);

  activeBrush = makeTraceBrush(glyph, width, height);

  stage.rotation.x = -0.22;
  stage.rotation.y = -0.28;
  stage.rotation.z = -0.035;
  stage.position.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}: ${response.status}`);
  return response.json();
}

async function selectGlyph(glyph) {
  glyphLabel.textContent = glyph.label;
  glyphButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === glyph.id);
  });
  contourCount.textContent = "生成中";
  await addGlyphRelief(glyph);
  contourCount.textContent = `${glyph.pixelBox?.width || "--"}x${glyph.pixelBox?.height || "--"}`;
  summary.textContent = `${glyph.description || "从人工框选 ROI 提取墨迹 mask 与厚度图，再转为 Three.js 静态浮雕。"} 当前展示静态 3D 字形，不声明真实笔顺。`;
}

function renderButtons(glyphs) {
  glyphButtons.replaceChildren();
  glyphs.forEach((glyph) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = glyph.id;
    button.textContent = glyph.label;
    button.addEventListener("click", () => selectGlyph(glyph).catch((error) => showError(error.message)));
    glyphButtons.append(button);
  });
}

function handlePointerDown(event) {
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  if (!dragging) return;
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  stage.rotation.y += dx * 0.006;
  stage.rotation.x += dy * 0.004;
  stage.rotation.x = Math.max(-0.72, Math.min(0.28, stage.rotation.x));
  lastPointer = { x: event.clientX, y: event.clientY };
}

function handlePointerUp(event) {
  dragging = false;
  canvas.releasePointerCapture?.(event.pointerId);
}

function animate(time = 0) {
  const seconds = time * 0.001;
  if (activeRelief) {
    activeRelief.material.displacementBias = 0.5 + Math.sin(seconds * 1.15) * 0.035;
  }
  if (activeBrush?.userData?.curve) {
    const phase = (seconds * 0.13) % 1;
    activeBrush.position.copy(activeBrush.userData.curve.getPointAt(phase));
    activeBrush.scale.setScalar(0.82 + Math.sin(seconds * 5.2) * 0.12);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function boot() {
  const manifest = await loadJson(GLYPHS_URL);
  const glyphs = manifest.glyphs || [];
  if (!glyphs.length) throw new Error("No glyphs found.");
  renderButtons(glyphs);
  await selectGlyph(glyphs.find((glyph) => glyph.id === "fu") || glyphs[0]);
  animate();
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
window.addEventListener("resize", resize);
resize();
boot().catch((error) => {
  console.error(error);
  showError(error.message);
});
