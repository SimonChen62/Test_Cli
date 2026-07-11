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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
camera.position.set(0, -3.4, 30);

const root = new THREE.Group();
scene.add(root);

const stage = new THREE.Group();
root.add(stage);

scene.add(new THREE.HemisphereLight(0xfff2df, 0x1b211f, 0.56));
scene.add(new THREE.AmbientLight(0xfff2df, 0.34));
const key = new THREE.DirectionalLight(0xffdfad, 4.2);
key.position.set(-6.5, -9, 16);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 48;
key.shadow.camera.left = -14;
key.shadow.camera.right = 14;
key.shadow.camera.top = 14;
key.shadow.camera.bottom = -14;
key.shadow.bias = -0.00022;
key.shadow.normalBias = 0.035;
scene.add(key);
const rim = new THREE.DirectionalLight(0xb6c3ba, 0.32);
rim.position.set(7, 5, 9);
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
            texture.minFilter = THREE.LinearFilter;
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

function makeSmoothedTexture(sourceTexture, blurPx, color = false) {
  const image = sourceTexture.image;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const smoothCanvas = document.createElement("canvas");
  smoothCanvas.width = width;
  smoothCanvas.height = height;
  const context = smoothCanvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `blur(${blurPx}px)`;
  context.drawImage(image, 0, 0, width, height);

  const texture = new THREE.CanvasTexture(smoothCanvas);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  const imageData = context.getImageData(0, 0, width, height);
  return { texture, imageData, width, height };
}

function sampleImageData(imageData, imageWidth, imageHeight, u, v, channel = 0) {
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(u * (imageWidth - 1))));
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(v * (imageHeight - 1))));
  const index = (y * imageWidth + x) * 4;
  return imageData.data[index + channel] / 255;
}

function applyHeightToGeometry(geometry, maskField, heightField, displacementScale, displacementBias) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let index = 0; index < position.count; index += 1) {
    const u = uv.getX(index);
    const v = uv.getY(index);
    const alphaValue = sampleImageData(maskField.imageData, maskField.width, maskField.height, u, v, 3);
    void heightField;
    const heightValue = Math.pow(alphaValue, 1.12);
    position.setZ(index, displacementBias + heightValue * displacementScale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
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
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  paper.position.z = -0.18;
  paper.receiveShadow = true;
  stage.add(paper);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 1.8, height + 1.8)),
    new THREE.LineBasicMaterial({ color: 0x8d7652, transparent: true, opacity: 0.5 })
  );
  border.position.z = -0.15;
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
    return new THREE.Vector3(x, y, 2.15);
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
  brush.castShadow = true;
  brush.userData = { curve, phase: 0 };
  stage.add(brush);
  return brush;
}

async function addGlyphRelief(glyph) {
  clearStage();
  activeGlyph = glyph;

  const [rawMaskTexture, rawHeightTexture] = await Promise.all([
    loadTexture(GLYPH_BASE + glyph.mask, true),
    loadTexture(GLYPH_BASE + glyph.height, false),
  ]);
  const maskField = makeSmoothedTexture(rawMaskTexture, 1.25, true);
  const heightField = makeSmoothedTexture(rawHeightTexture, 3.2, false);
  const maskTexture = maskField.texture;
  const heightTexture = heightField.texture;
  const size = textureSize(maskTexture);
  const aspect = size.width / Math.max(1, size.height);
  const height = 15.5;
  const width = Math.max(4, height * aspect);

  addPaper(width, height);
  addDepthGuide(width, height);

  const displacementScale = 0.32;
  const displacementBias = 0.0;
  const geometry = new THREE.PlaneGeometry(width, height, 512, 512);
  applyHeightToGeometry(geometry, maskField, heightField, displacementScale, displacementBias);
  const material = new THREE.MeshStandardMaterial({
    map: maskTexture,
    transparent: true,
    alphaTest: 0.025,
    color: 0x1a1a14,
    roughness: 0.5,
    metalness: 0.02,
    bumpMap: maskTexture,
    bumpScale: 0.14,
    displacementMap: maskTexture,
    displacementScale: 0,
    displacementBias: 0,
    side: THREE.FrontSide,
  });
  activeRelief = new THREE.Mesh(geometry, material);
  activeRelief.position.z = 0.02;
  activeRelief.userData = { baseScale: 1 };
  activeRelief.castShadow = true;
  activeRelief.receiveShadow = true;
  stage.add(activeRelief);

  activeBrush = null;

  stage.rotation.x = -0.1;
  stage.rotation.y = -0.16;
  stage.rotation.z = -0.025;
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
    activeRelief.scale.z = 1 + Math.sin(seconds * 1.15) * 0.035;
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
