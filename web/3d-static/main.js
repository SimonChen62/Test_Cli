import * as THREE from "../vendor/three.module.js";

const FULL_SCROLL_URL = "../../data/work_003/full_scroll_3d_data.json";
const GLYPHS_URL = "../../data/work_003/glyphs/glyphs.json";
const FALLBACK_SCROLL_SIZE = { width: 18332, height: 2100 };
const PLANE_HEIGHT = 18;
const MAX_ATLAS_WIDTH = 8192;
const IMAGE_LOAD_BATCH_SIZE = 32;

const canvas = document.querySelector("#scene");
const errorBox = document.querySelector("#error");
const glyphButtons = document.querySelector("#glyphButtons");
const glyphLabel = document.querySelector("#glyphLabel");
const contourCount = document.querySelector("#contourCount");
const summary = document.querySelector("#summary");
const zoomInButton = document.querySelector("#zoomIn");
const zoomOutButton = document.querySelector("#zoomOut");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x11100d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1200);
const stage = new THREE.Group();
scene.add(stage);

scene.add(new THREE.HemisphereLight(0xfff2df, 0x1b211f, 0.58));
scene.add(new THREE.AmbientLight(0xfff2df, 0.28));

const key = new THREE.DirectionalLight(0xffdfad, 3.9);
key.position.set(-28, -20, 38);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 120;
key.shadow.camera.left = -90;
key.shadow.camera.right = 90;
key.shadow.camera.top = 36;
key.shadow.camera.bottom = -36;
key.shadow.bias = -0.00018;
key.shadow.normalBias = 0.04;
scene.add(key);

const rim = new THREE.DirectionalLight(0xb6c3ba, 0.38);
rim.position.set(35, 18, 28);
scene.add(rim);

const controls = createScrollControls(camera, canvas);
let scrollMesh = null;
let scrollMetrics = null;

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
  controls.update();
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}: ${response.status}`);
  return response.json();
}

function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:)?\/\//.test(path) || path.startsWith("../")) return path;
  return `../../${path.replace(/\\/g, "/").replace(/^\//, "")}`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Cannot load image: ${url}`));
    image.src = url;
  });
}

function getScrollSize(manifest, records) {
  const sourceMap = manifest?.sourceMap || {};
  const sourceSize = manifest?.sourceSize || {};
  const width =
    Number(sourceMap.sourceWidth) ||
    Number(sourceSize.width) ||
    Math.max(FALLBACK_SCROLL_SIZE.width, ...records.map((item) => item.scroll_x + item.width));
  const height =
    Number(sourceMap.sourceHeight) ||
    Number(sourceSize.height) ||
    Math.max(FALLBACK_SCROLL_SIZE.height, ...records.map((item) => item.scroll_y + item.height));
  return { width, height };
}

function makeTexture(canvasTextureSource, colorSpace) {
  const texture = new THREE.CanvasTexture(canvasTextureSource);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  return texture;
}

async function buildScrollAtlases(records, scrollSize) {
  const maxTextureSize = renderer.capabilities.maxTextureSize || 4096;
  const atlasWidth = Math.max(2048, Math.min(MAX_ATLAS_WIDTH, maxTextureSize));
  const atlasScale = atlasWidth / scrollSize.width;
  const atlasHeight = Math.max(256, Math.round(scrollSize.height * atlasScale));

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = atlasWidth;
  colorCanvas.height = atlasHeight;
  const colorContext = colorCanvas.getContext("2d", { willReadFrequently: false });
  colorContext.fillStyle = "#ead8b3";
  colorContext.fillRect(0, 0, atlasWidth, atlasHeight);
  colorContext.globalAlpha = 0.18;
  colorContext.fillStyle = "#f7edcf";
  for (let y = 0; y < atlasHeight; y += 7) {
    colorContext.fillRect(0, y, atlasWidth, 1);
  }
  colorContext.globalAlpha = 1;

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = atlasWidth;
  heightCanvas.height = atlasHeight;
  const heightContext = heightCanvas.getContext("2d", { willReadFrequently: false });
  heightContext.fillStyle = "#000";
  heightContext.fillRect(0, 0, atlasWidth, atlasHeight);

  for (let start = 0; start < records.length; start += IMAGE_LOAD_BATCH_SIZE) {
    const batch = records.slice(start, start + IMAGE_LOAD_BATCH_SIZE);
    await Promise.all(
      batch.map(async (record) => {
      const [maskImage, heightImage] = await Promise.all([
        loadImage(assetUrl(record.img_path)),
        loadImage(assetUrl(record.height_path || record.img_path)),
      ]);
      const x = Math.round(record.scroll_x * atlasScale);
      const y = Math.round(record.scroll_y * atlasScale);
      const width = Math.max(1, Math.round(record.width * atlasScale));
      const height = Math.max(1, Math.round(record.height * atlasScale));
      colorContext.drawImage(maskImage, x, y, width, height);
      const heightPatch = document.createElement("canvas");
      heightPatch.width = width;
      heightPatch.height = height;
      const patchContext = heightPatch.getContext("2d");
      patchContext.filter = "contrast(185%) brightness(118%)";
      patchContext.drawImage(heightImage, 0, 0, width, height);
      patchContext.filter = "none";
      patchContext.globalCompositeOperation = "destination-in";
      patchContext.drawImage(maskImage, 0, 0, width, height);
      patchContext.globalCompositeOperation = "source-over";
      heightContext.drawImage(heightPatch, x, y);
      })
    );
  }

  return {
    colorTexture: makeTexture(colorCanvas, THREE.SRGBColorSpace),
    heightTexture: makeTexture(heightCanvas, THREE.NoColorSpace),
    atlasSize: { width: atlasWidth, height: atlasHeight },
  };
}

function recordCenterToWorld(record, metrics) {
  const x = ((record.scroll_x + record.width / 2) / metrics.scrollWidth - 0.5) * metrics.planeWidth;
  const y = (0.5 - (record.scroll_y + record.height / 2) / metrics.scrollHeight) * metrics.planeHeight;
  return new THREE.Vector3(x, y, 0.42);
}

function clearStage() {
  while (stage.children.length) {
    const child = stage.children.pop();
    child.traverse?.((object) => {
      object.geometry?.dispose?.();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.map?.dispose?.();
          material.displacementMap?.dispose?.();
          material.bumpMap?.dispose?.();
          material.dispose?.();
        });
      }
    });
  }
}

function addScrollBase(records, manifest) {
  clearStage();
  const scrollSize = getScrollSize(manifest, records);
  const planeWidth = PLANE_HEIGHT * (scrollSize.width / scrollSize.height);
  const planeHeight = PLANE_HEIGHT;
  scrollMetrics = {
    scrollWidth: scrollSize.width,
    scrollHeight: scrollSize.height,
    planeWidth,
    planeHeight,
  };
  return { scrollSize, planeWidth, planeHeight };
}

function addFrame(width, height) {
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 1.4, height + 1.4, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xbda06a,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  back.position.z = -0.22;
  back.receiveShadow = true;
  stage.add(back);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 1.4, height + 1.4)),
    new THREE.LineBasicMaterial({ color: 0x6c5635, transparent: true, opacity: 0.55 })
  );
  border.position.z = -0.18;
  stage.add(border);
}

function addReferenceTicks(width, height) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x6c5635, transparent: true, opacity: 0.16 });
  for (let i = 1; i < 12; i += 1) {
    const x = -width / 2 + (width * i) / 12;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -height / 2, -0.12),
      new THREE.Vector3(x, height / 2, -0.12),
    ]);
    group.add(new THREE.Line(geometry, material.clone()));
  }
  stage.add(group);
}

async function buildFullScroll(records, manifest) {
  const { scrollSize, planeWidth, planeHeight } = addScrollBase(records, manifest);
  const { colorTexture, heightTexture, atlasSize } = await buildScrollAtlases(records, scrollSize);

  addFrame(planeWidth, planeHeight);

  const widthSegments = Math.min(2048, Math.max(512, Math.round(planeWidth * 13)));
  const heightSegments = 256;
  const scrollGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, widthSegments, heightSegments);
  const material = new THREE.MeshStandardMaterial({
    map: colorTexture,
    displacementMap: heightTexture,
    displacementScale: 0.72,
    displacementBias: 0,
    bumpMap: heightTexture,
    bumpScale: 0.18,
    roughness: 0.58,
    metalness: 0.01,
    color: 0xffffff,
    side: THREE.FrontSide,
  });

  scrollMesh = new THREE.Mesh(scrollGeometry, material);
  scrollMesh.castShadow = true;
  scrollMesh.receiveShadow = true;
  scrollMesh.position.z = 0;
  stage.add(scrollMesh);

  controls.setBounds(planeWidth, planeHeight);
  const firstRecord = records[0];
  const focus = firstRecord ? recordCenterToWorld(firstRecord, scrollMetrics) : new THREE.Vector3(0, 0, 0);
  controls.focus(focus, 24);

  glyphLabel.textContent = "全卷";
  contourCount.textContent = `${records.length}`;
  summary.textContent = `已读取 ${records.length} 个字形坐标，合成为 ${atlasSize.width}x${atlasSize.height} 的长卷墨迹/高度贴图；拖拽平移，滚轮缩放，右键拖拽调整视角。`;
}

function renderGlyphButtons(records) {
  glyphButtons.replaceChildren();
  const note = document.createElement("p");
  note.textContent = `已载入 ${records.length} 个候选墨迹块；使用画布右下角 + / - 放大或缩小查看。`;
  glyphButtons.append(note);
}

function createScrollControls(activeCamera, domElement) {
  const target = new THREE.Vector3();
  const state = {
    dragging: false,
    rotateMode: false,
    lastX: 0,
    lastY: 0,
    distance: 48,
    yaw: 0,
    pitch: 0.92,
    bounds: { width: 140, height: 18 },
  };

  function clampTarget() {
    const marginX = state.bounds.width * 0.04;
    const marginY = state.bounds.height * 0.16;
    target.x = Math.max(-state.bounds.width / 2 - marginX, Math.min(state.bounds.width / 2 + marginX, target.x));
    target.y = Math.max(-state.bounds.height / 2 - marginY, Math.min(state.bounds.height / 2 + marginY, target.y));
  }

  function update() {
    clampTarget();
    state.pitch = Math.max(0.32, Math.min(1.28, state.pitch));
    const horizontal = Math.cos(state.pitch) * state.distance;
    const z = Math.sin(state.pitch) * state.distance;
    activeCamera.position.set(
      target.x + Math.sin(state.yaw) * horizontal,
      target.y - Math.cos(state.yaw) * horizontal,
      target.z + z
    );
    activeCamera.lookAt(target);
  }

  function focus(point, distance = state.distance) {
    target.copy(point);
    state.distance = Math.max(5, Math.min(180, distance));
    update();
  }

  function setBounds(width, height) {
    state.bounds = { width, height };
    update();
  }

  function pointerDown(event) {
    state.dragging = true;
    state.rotateMode = event.button === 2 || event.altKey || event.ctrlKey;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    domElement.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    if (state.rotateMode) {
      state.yaw -= dx * 0.006;
      state.pitch += dy * 0.004;
    } else {
      const panScale = state.distance / Math.max(240, domElement.clientHeight) * 1.65;
      target.x -= dx * panScale;
      target.y += dy * panScale;
    }
    update();
  }

  function pointerUp(event) {
    state.dragging = false;
    domElement.releasePointerCapture?.(event.pointerId);
  }

  function wheel(event) {
    event.preventDefault();
    const zoom = Math.exp(event.deltaY * 0.001);
    state.distance = Math.max(5, Math.min(180, state.distance * zoom));
    update();
  }

  function zoomBy(factor) {
    state.distance = Math.max(5, Math.min(180, state.distance * factor));
    update();
  }

  domElement.addEventListener("pointerdown", pointerDown);
  domElement.addEventListener("pointermove", pointerMove);
  domElement.addEventListener("pointerup", pointerUp);
  domElement.addEventListener("pointercancel", pointerUp);
  domElement.addEventListener("wheel", wheel, { passive: false });
  domElement.addEventListener("contextmenu", (event) => event.preventDefault());

  return { focus, setBounds, update, zoomBy };
}

function animate() {
  if (scrollMesh) {
    scrollMesh.material.displacementScale = 0.7;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function boot() {
  const [records, manifest] = await Promise.all([loadJson(FULL_SCROLL_URL), loadJson(GLYPHS_URL)]);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("No full-scroll glyph records found. Run scripts/extract_glyphs.py first.");
  }
  renderGlyphButtons(records);
  await buildFullScroll(records, manifest);
  animate();
}

window.addEventListener("resize", resize);
zoomInButton?.addEventListener("click", () => controls.zoomBy(1 / 1.28));
zoomOutButton?.addEventListener("click", () => controls.zoomBy(1.28));
resize();
boot().catch((error) => {
  console.error(error);
  showError(error.message);
});
