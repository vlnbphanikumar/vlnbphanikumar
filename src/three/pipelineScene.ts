import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Deal, DealStage } from '../types/crm';
import { DEAL_STAGES } from '../utils/formatters';

export type CameraPreset = 'overview' | 'commit' | 'won' | 'aerial';

export interface SpatialSceneCallbacks {
  onSelectDeal: (dealId: string | null) => void;
  onHoverDeal: (dealId: string | null) => void;
}

export interface SpatialSceneController {
  updateDeals: (deals: Deal[], quarterlyQuota: number) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setExplodeFactor: (value: number) => void;
  setAutoRotate: (enabled: boolean) => void;
  focusDeal: (dealId: string) => void;
  resize: () => void;
  dispose: () => void;
}

interface TowerEntry {
  deal: Deal;
  group: THREE.Group;
  proxyMesh: THREE.Mesh;
  crownGroup: THREE.Group;
  flangeMesh: THREE.Mesh;
  coreCrystal: THREE.Mesh;
  capGroup: THREE.Group;
  spineMat: THREE.MeshStandardMaterial;
  baseCrownY: number;
  baseFlangeY: number;
  baseCapY: number;
  worldCenter: THREE.Vector3;
  phase: number;
}

// Pre-allocated scratch math helpers (zero per-frame GC)
const _mouse = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();

const STAGE_HEX: Record<DealStage, number> = {
  Qualification: 0x908fa0,
  Discovery: 0x4d8eff,
  Proposal: 0x8083ff,
  Negotiation: 0x6366f1,
  'Closed Won': 0x10b981,
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, 'rgba(2, 6, 18, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 18, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createArchitecturalFloorTexture(maxAniso: number): {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const size = 1024;
  const cColor = document.createElement('canvas');
  cColor.width = size;
  cColor.height = size;
  const ctx = cColor.getContext('2d')!;

  ctx.fillStyle = '#0b1326';
  ctx.fillRect(0, 0, size, size);

  // Subtle concentric telemetry calibration rings & architectural grid
  ctx.strokeStyle = 'rgba(128, 131, 255, 0.14)';
  ctx.lineWidth = 1.5;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Finer sub-grid
  ctx.strokeStyle = 'rgba(70, 69, 84, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 32; i < size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Coordinate ticks at intersections
  ctx.fillStyle = 'rgba(192, 193, 255, 0.28)';
  for (let x = 0; x <= size; x += step * 2) {
    for (let y = 0; y <= size; y += step * 2) {
      ctx.fillRect(x - 3, y - 0.75, 6, 1.5);
      ctx.fillRect(x - 0.75, y - 3, 1.5, 6);
    }
  }

  const albedo = new THREE.CanvasTexture(cColor);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(6, 6);
  albedo.anisotropy = maxAniso;

  // Linear procedural micro-grain roughness map
  const cRough = document.createElement('canvas');
  cRough.width = 512;
  cRough.height = 512;
  const rCtx = cRough.getContext('2d')!;
  rCtx.fillStyle = '#9a9a9a';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 125 + Math.floor(Math.random() * 55);
    rCtx.fillStyle = `rgb(${v},${v},${v})`;
    rCtx.fillRect(x, y, 2, 2);
  }
  const roughness = new THREE.CanvasTexture(cRough);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(6, 6);
  roughness.anisotropy = maxAniso;

  return { albedo, roughness };
}

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createSpatialPipelineScene(
  container: HTMLElement,
  initialDeals: Deal[],
  initialQuota: number,
  callbacks: SpatialSceneCallbacks
): SpatialSceneController {
  const isSoftwareGl = detectSoftwareWebGL();
  const width = Math.max(300, container.clientWidth);
  const height = Math.max(300, container.clientHeight);

  // Scene with horizon-matched fog
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1326);
  scene.fog = new THREE.FogExp2(0x0b1326, 0.022);

  // Camera
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 160);
  camera.position.set(13.5, 10.2, 16.5);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Studio environment reflections on every device
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmremGenerator.dispose();

  // Balanced 3-point warm/cool studio lighting rig
  const hemiLight = new THREE.HemisphereLight(0xadc6ff, 0x0b1326, 0.85);
  hemiLight.position.set(0, 28, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.15);
  keyLight.position.set(14, 22, 12);
  keyLight.castShadow = !isSoftwareGl;
  if (keyLight.castShadow) {
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 55;
    const d = 16;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x8083ff, 1.05);
  rimLight.position.set(-15, 12, -14);
  scene.add(rimLight);

  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    const softboxA = new THREE.RectAreaLight(0xc0c1ff, 2.2, 8, 3);
    softboxA.position.set(-9, 9, 8);
    softboxA.lookAt(0, 2, 0);
    scene.add(softboxA);

    const softboxB = new THREE.RectAreaLight(0x4edea3, 1.8, 7, 2.5);
    softboxB.position.set(10, 7, -8);
    softboxB.lookAt(0, 2, 0);
    scene.add(softboxB);
  }

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = 0.22;
  controls.minDistance = 6.5;
  controls.maxDistance = 36;
  controls.target.set(0, 2.0, 0);
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.45;

  // Shared procedural textures & materials
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const floorTextures = createArchitecturalFloorTexture(maxAniso);
  const contactShadowTex = createContactShadowTexture();

  const floorGeo = new THREE.CircleGeometry(48, 72);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTextures.albedo,
    roughnessMap: floorTextures.roughness,
    roughness: 0.78,
    metalness: 0.22,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Subtle architectural stage ring beneath the central amphitheater
  const stageDeckGeo = new THREE.CylinderGeometry(11.4, 11.9, 0.18, 64);
  const stageDeckMat = new THREE.MeshStandardMaterial({
    color: 0x131b2e,
    roughness: 0.68,
    metalness: 0.35,
  });
  const stageDeck = new THREE.Mesh(stageDeckGeo, stageDeckMat);
  stageDeck.position.y = 0.09;
  stageDeck.receiveShadow = true;
  scene.add(stageDeck);

  // Brushed bevel rim around the amphitheater deck
  const deckRimGeo = new THREE.TorusGeometry(11.45, 0.06, 12, 80);
  deckRimGeo.rotateX(Math.PI / 2);
  const brushedMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa4c2,
    metalness: 0.92,
    roughness: 0.22,
    anisotropy: 0.75,
    clearcoat: 0.3,
  });
  const deckRim = new THREE.Mesh(deckRimGeo, brushedMetalMat);
  deckRim.position.y = 0.18;
  scene.add(deckRim);

  // Shared materials with clear roughness/metalness contrast between adjacent parts
  const mattePlinthMat = new THREE.MeshStandardMaterial({
    color: 0x171f33,
    roughness: 0.76,
    metalness: 0.22,
  });
  const satinBodyMat = new THREE.MeshStandardMaterial({
    color: 0x222a3d,
    roughness: 0.42,
    metalness: 0.68,
  });
  const titaniumTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xb6c0df,
    roughness: 0.18,
    metalness: 0.94,
    anisotropy: 0.7,
  });
  const opticalGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8e2ff,
    metalness: 0.05,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.86,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 0.95,
    ior: 1.52,
    thickness: 0.8,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Instanced perimeter architectural light bollards (40 instances)
  const bollardCount = 40;
  const bollardGeo = new THREE.CylinderGeometry(0.055, 0.075, 0.65, 10);
  bollardGeo.translate(0, 0.325, 0);
  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.8,
  });
  const bollardInstanced = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
  for (let i = 0; i < bollardCount; i++) {
    const angle = (i / bollardCount) * Math.PI * 2;
    const r = 11.75;
    const scaleJitter = 0.88 + ((i * 37) % 25) * 0.01;
    _dummy.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
    _dummy.rotation.set(0, -angle, 0);
    _dummy.scale.set(1, scaleJitter, 1);
    _dummy.updateMatrix();
    bollardInstanced.setMatrixAt(i, _dummy.matrix);

    const tint = i % 5 === 0 ? 0x4edea3 : i % 2 === 0 ? 0x8083ff : 0x464554;
    _tempColor.setHex(tint);
    bollardInstanced.setColorAt(i, _tempColor);
  }
  bollardInstanced.instanceMatrix.needsUpdate = true;
  if (bollardInstanced.instanceColor) bollardInstanced.instanceColor.needsUpdate = true;
  bollardInstanced.computeBoundingSphere();
  scene.add(bollardInstanced);

  // Subtle floating telemetry particles (140 instanced motes)
  const moteCount = 140;
  const moteGeo = new THREE.OctahedronGeometry(0.038, 0);
  const moteMat = new THREE.MeshBasicMaterial({
    color: 0xc0c1ff,
    transparent: true,
    opacity: 0.42,
  });
  const moteInstanced = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
  moteInstanced.frustumCulled = false;
  const moteSeeds = new Float32Array(moteCount * 4);
  for (let i = 0; i < moteCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.5 + Math.random() * 14.5;
    const y = 0.7 + Math.random() * 8.5;
    const speed = 0.15 + Math.random() * 0.35;
    moteSeeds[i * 4] = angle;
    moteSeeds[i * 4 + 1] = radius;
    moteSeeds[i * 4 + 2] = y;
    moteSeeds[i * 4 + 3] = speed;
  }
  scene.add(moteInstanced);

  // Shared base geometries for composite Deal Towers
  const plinthShape = createHexShape(0.68);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  plinthGeo.rotateX(-Math.PI / 2);
  plinthGeo.translate(0, 0.04, 0);

  const collarPoints = [
    new THREE.Vector2(0.56, 0),
    new THREE.Vector2(0.58, 0.06),
    new THREE.Vector2(0.49, 0.14),
    new THREE.Vector2(0.46, 0.18),
  ];
  const collarGeo = new THREE.LatheGeometry(collarPoints, 24);

  const shaftShape = createHexShape(0.42);
  const unitShaftGeo = new THREE.ExtrudeGeometry(shaftShape, {
    depth: 1.0,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  unitShaftGeo.rotateX(-Math.PI / 2);

  const flangePoints = [
    new THREE.Vector2(0.44, 0),
    new THREE.Vector2(0.54, 0.04),
    new THREE.Vector2(0.54, 0.1),
    new THREE.Vector2(0.43, 0.14),
  ];
  const flangeGeo = new THREE.LatheGeometry(flangePoints, 24);

  const crownGlassGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.68, 24, 1, false);
  const coreCrystalGeo = new THREE.OctahedronGeometry(0.19, 0);
  const capPoints = [
    new THREE.Vector2(0.4, 0),
    new THREE.Vector2(0.43, 0.05),
    new THREE.Vector2(0.28, 0.14),
    new THREE.Vector2(0.06, 0.18),
    new THREE.Vector2(0.02, 0.42),
    new THREE.Vector2(0.0, 0.44),
  ];
  const capGeo = new THREE.LatheGeometry(capPoints, 24);
  const shadowPlaneGeo = new THREE.PlaneGeometry(1.9, 1.9);
  shadowPlaneGeo.rotateX(-Math.PI / 2);

  // Central Executive Quota Core (7-part composite kinetic sculpture)
  const quotaCoreGroup = new THREE.Group();
  quotaCoreGroup.position.set(0, 0.18, 0);
  scene.add(quotaCoreGroup);

  const corePedestalPoints = [
    new THREE.Vector2(1.95, 0),
    new THREE.Vector2(1.85, 0.22),
    new THREE.Vector2(1.45, 0.34),
    new THREE.Vector2(1.32, 0.56),
    new THREE.Vector2(0.95, 0.66),
    new THREE.Vector2(0.0, 0.66),
  ];
  const corePedestalGeo = new THREE.LatheGeometry(corePedestalPoints, 36);
  const corePedestalMesh = new THREE.Mesh(corePedestalGeo, mattePlinthMat);
  corePedestalMesh.castShadow = true;
  corePedestalMesh.receiveShadow = true;
  quotaCoreGroup.add(corePedestalMesh);

  const coreShadow = new THREE.Mesh(shadowPlaneGeo, contactShadowMat);
  coreShadow.scale.set(2.5, 1, 2.5);
  coreShadow.position.y = 0.02;
  quotaCoreGroup.add(coreShadow);

  const coreCollarGeo = new THREE.TorusGeometry(1.42, 0.055, 14, 48);
  coreCollarGeo.rotateX(Math.PI / 2);
  const coreCollarMesh = new THREE.Mesh(coreCollarGeo, titaniumTrimMat);
  coreCollarMesh.position.y = 0.36;
  quotaCoreGroup.add(coreCollarMesh);

  // Orbital calibration arcs built with TubeGeometry
  const orbitalGroup = new THREE.Group();
  orbitalGroup.position.y = 1.95;
  quotaCoreGroup.add(orbitalGroup);

  const arcCurveA = new THREE.CatmullRomCurve3(
    Array.from({ length: 18 }, (_, i) => {
      const t = (i / 17) * Math.PI * 1.45;
      return new THREE.Vector3(Math.cos(t) * 1.25, Math.sin(t) * 0.45, Math.sin(t) * 1.25);
    })
  );
  const arcGeoA = new THREE.TubeGeometry(arcCurveA, 40, 0.032, 10, false);
  const arcMatIndigo = new THREE.MeshStandardMaterial({
    color: 0x8083ff,
    emissive: 0x6366f1,
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.85,
  });
  orbitalGroup.add(new THREE.Mesh(arcGeoA, arcMatIndigo));

  const arcCurveB = new THREE.CatmullRomCurve3(
    Array.from({ length: 18 }, (_, i) => {
      const t = (i / 17) * Math.PI * 1.35 + Math.PI * 0.7;
      return new THREE.Vector3(Math.cos(t) * 1.05, -Math.sin(t) * 0.52, Math.sin(t) * 1.05);
    })
  );
  const arcGeoB = new THREE.TubeGeometry(arcCurveB, 40, 0.028, 10, false);
  const arcMatEmerald = new THREE.MeshStandardMaterial({
    color: 0x4edea3,
    emissive: 0x10b981,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.82,
  });
  orbitalGroup.add(new THREE.Mesh(arcGeoB, arcMatEmerald));

  // Central crystalline telemetry prism
  const centralCrystalGeo = new THREE.OctahedronGeometry(0.58, 0);
  const centralCrystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0c1ff,
    emissive: 0x494bd6,
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.3,
    clearcoat: 1.0,
  });
  const centralCrystal = new THREE.Mesh(centralCrystalGeo, centralCrystalMat);
  centralCrystal.position.y = 1.95;
  centralCrystal.castShadow = true;
  quotaCoreGroup.add(centralCrystal);

  // Dynamic quota attainment ring mesh (rebuilt when quota/closed changes)
  let quotaArcMesh: THREE.Mesh | null = null;

  // Dynamic Deal Towers container
  const towersRoot = new THREE.Group();
  scene.add(towersRoot);

  // Stage arcs / sector markers on the deck
  const sectorLinesGroup = new THREE.Group();
  sectorLinesGroup.position.y = 0.2;
  scene.add(sectorLinesGroup);

  DEAL_STAGES.forEach((stage, idx) => {
    const startAngle = -Math.PI * 0.85 + idx * (Math.PI * 0.36);
    const arcPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 16; s++) {
      const a = startAngle + (s / 16) * (Math.PI * 0.3);
      arcPts.push(new THREE.Vector3(Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const lineMat = new THREE.LineBasicMaterial({
      color: STAGE_HEX[stage],
      transparent: true,
      opacity: 0.55,
    });
    sectorLinesGroup.add(new THREE.Line(lineGeo, lineMat));
  });

  // Dynamic state
  const towerEntries: TowerEntry[] = [];
  const disposablePerRebuild: Array<{ dispose: () => void }> = [];
  let hoveredDealId: string | null = null;
  let selectedDealId: string | null = null;
  let targetExplode = 0;
  let currentExplode = 0;
  let cameraTransitionActive = false;

  const raycaster = new THREE.Raycaster();
  raycaster.layers.set(1);

  function clearTowers() {
    while (towersRoot.children.length > 0) {
      towersRoot.remove(towersRoot.children[0]);
    }
    towerEntries.length = 0;
    disposablePerRebuild.forEach((item) => item.dispose());
    disposablePerRebuild.length = 0;
  }

  function rebuildQuotaArc(deals: Deal[], quota: number) {
    if (quotaArcMesh) {
      quotaCoreGroup.remove(quotaArcMesh);
      quotaArcMesh.geometry.dispose();
      quotaArcMesh = null;
    }
    const closedWon = deals
      .filter((d) => d.stage === 'Closed Won')
      .reduce((s, d) => s + d.value, 0);
    const ratio = Math.max(0.06, Math.min(1, closedWon / Math.max(1, quota)));
    const arcGeo = new THREE.TorusGeometry(1.66, 0.08, 14, 60, Math.PI * 2 * ratio);
    arcGeo.rotateX(Math.PI / 2);
    quotaArcMesh = new THREE.Mesh(arcGeo, arcMatEmerald);
    quotaArcMesh.position.y = 0.24;
    quotaCoreGroup.add(quotaArcMesh);
  }

  function buildTowers(deals: Deal[], quarterlyQuota: number) {
    clearTowers();
    rebuildQuotaArc(deals, quarterlyQuota);

    const maxArr = Math.max(500_000, ...deals.map((d) => d.value));

    DEAL_STAGES.forEach((stage, stageIdx) => {
      const stageDeals = deals
        .filter((d) => d.stage === stage)
        .sort((a, b) => b.value - a.value);

      const sectorCenterAngle = -Math.PI * 0.7 + stageIdx * (Math.PI * 0.36);

      stageDeals.forEach((deal, localIdx) => {
        const ring = localIdx < 3 ? 0 : 1;
        const posInRing = ring === 0 ? localIdx : localIdx - 3;
        const countInRing =
          ring === 0 ? Math.min(3, stageDeals.length) : Math.max(1, stageDeals.length - 3);
        const radius = ring === 0 ? 5.6 : 8.5;
        const angleSpread = ring === 0 ? 0.28 : 0.31;
        const angleOffset =
          countInRing === 1
            ? 0
            : (posInRing / (countInRing - 1) - 0.5) * angleSpread;
        const theta = sectorCenterAngle + angleOffset;

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const baseY = 0.18;

        const group = new THREE.Group();
        group.position.set(x, baseY, z);
        group.rotation.y = -theta + Math.PI / 2;

        // Soft contact shadow directly on stage deck
        const shadowMesh = new THREE.Mesh(shadowPlaneGeo, contactShadowMat);
        shadowMesh.position.y = 0.02;
        group.add(shadowMesh);

        // Part 1: Chamfered Hexagonal Plinth
        const plinth = new THREE.Mesh(plinthGeo, mattePlinthMat);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        // Part 2: Brushed Titanium Lower Collar
        const collar = new THREE.Mesh(collarGeo, titaniumTrimMat);
        collar.position.y = 0.28;
        collar.castShadow = true;
        group.add(collar);

        // Part 3: Main Fluted Revenue Shaft (scaled to ARR)
        const shaftHeight = 1.0 + (deal.value / maxArr) * 4.2;
        const shaft = new THREE.Mesh(unitShaftGeo, satinBodyMat);
        shaft.position.y = 0.44;
        shaft.scale.set(1, shaftHeight, 1);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        group.add(shaft);

        // Part 4: Luminous Vertical Status Spine
        const accentHex =
          deal.health === 'At Risk' ? 0xff7a70 : STAGE_HEX[deal.stage];
        const spineMat = new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 0.72,
          roughness: 0.25,
          metalness: 0.3,
        });
        disposablePerRebuild.push(spineMat);

        const spineGeo = new THREE.BoxGeometry(0.1, shaftHeight * 0.88, 0.12);
        disposablePerRebuild.push(spineGeo);
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.position.set(0, 0.46 + shaftHeight * 0.48, 0.38);
        group.add(spine);

        // Part 5: Mid-tier Structural Flange Ring
        const baseFlangeY = 0.44 + shaftHeight;
        const flange = new THREE.Mesh(flangeGeo, titaniumTrimMat);
        flange.position.y = baseFlangeY;
        flange.castShadow = true;
        group.add(flange);

        // Part 6 & 7: Optical Glass Crown Chamber + Inner Probability Crystal
        const baseCrownY = baseFlangeY + 0.14;
        const crownGroup = new THREE.Group();
        crownGroup.position.y = baseCrownY;

        const glassChamber = new THREE.Mesh(crownGlassGeo, opticalGlassMat);
        glassChamber.position.y = 0.34;
        glassChamber.renderOrder = 2;
        crownGroup.add(glassChamber);

        const coreCrystal = new THREE.Mesh(coreCrystalGeo, spineMat);
        const probScale = 0.55 + (deal.probability / 100) * 0.65;
        coreCrystal.scale.setScalar(probScale);
        coreCrystal.position.y = 0.34;
        crownGroup.add(coreCrystal);
        group.add(crownGroup);

        // Part 8: Top Machined Bezel Cap & Signal Spire
        const baseCapY = baseCrownY + 0.68;
        const capGroup = new THREE.Group();
        capGroup.position.y = baseCapY;
        const capMesh = new THREE.Mesh(capGeo, titaniumTrimMat);
        capMesh.castShadow = true;
        capGroup.add(capMesh);
        group.add(capGroup);

        // Invisible simplified raycast proxy cylinder on Layer 1
        const totalHeight = baseCapY + 0.55;
        const proxyGeo = new THREE.CylinderGeometry(0.65, 0.7, totalHeight, 10);
        disposablePerRebuild.push(proxyGeo);
        const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
        disposablePerRebuild.push(proxyMat);
        const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
        proxyMesh.position.y = totalHeight / 2;
        proxyMesh.layers.set(1);
        proxyMesh.userData.dealId = deal.id;
        group.add(proxyMesh);

        towersRoot.add(group);

        towerEntries.push({
          deal,
          group,
          proxyMesh,
          crownGroup,
          flangeMesh: flange,
          coreCrystal,
          capGroup,
          spineMat,
          baseCrownY,
          baseFlangeY,
          baseCapY,
          worldCenter: new THREE.Vector3(x, baseY + totalHeight * 0.55, z),
          phase: stageIdx * 0.9 + localIdx * 0.65,
        });
      });
    });
  }

  buildTowers(initialDeals, initialQuota);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Cancel scripted camera glide as soon as user interacts
  controls.addEventListener('start', () => {
    cameraTransitionActive = false;
  });

  // Pointer raycasting (throttled move, instant click)
  let lastMoveTime = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;

  const updatePointerNdc = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - lastMoveTime < 45) return;
    lastMoveTime = now;
    updatePointerNdc(e);
    raycaster.setFromCamera(_mouse, camera);
    const proxies = towerEntries.map((t) => t.proxyMesh);
    const hits = raycaster.intersectObjects(proxies, false);
    const hitId = hits.length > 0 ? (hits[0].object.userData.dealId as string) : null;
    if (hitId !== hoveredDealId) {
      hoveredDealId = hitId;
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      callbacks.onHoverDeal(hitId);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
  };

  const onPointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    if (dist > 6) return; // Ignore orbit drags
    updatePointerNdc(e);
    raycaster.setFromCamera(_mouse, camera);
    const proxies = towerEntries.map((t) => t.proxyMesh);
    const hits = raycaster.intersectObjects(proxies, false);
    const hitId = hits.length > 0 ? (hits[0].object.userData.dealId as string) : null;
    selectedDealId = hitId;
    callbacks.onSelectDeal(hitId);
    if (hitId) {
      focusDealById(hitId);
    }
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  function focusDealById(dealId: string) {
    const entry = towerEntries.find((t) => t.deal.id === dealId);
    if (!entry) return;
    selectedDealId = dealId;
    const dir = entry.worldCenter.clone().setY(0).normalize();
    _targetLookAt.copy(entry.worldCenter);
    _targetCamPos.set(
      entry.worldCenter.x + dir.x * 5.2 + 2.2,
      Math.max(4.6, entry.worldCenter.y + 2.4),
      entry.worldCenter.z + dir.z * 5.2 + 2.2
    );
    cameraTransitionActive = true;
  }

  function applyCameraPreset(preset: CameraPreset) {
    if (preset === 'overview') {
      _targetCamPos.set(13.5, 10.2, 16.5);
      _targetLookAt.set(0, 2.0, 0);
    } else if (preset === 'commit') {
      _targetCamPos.set(11.8, 6.4, 8.6);
      _targetLookAt.set(4.5, 2.4, 2.6);
    } else if (preset === 'won') {
      _targetCamPos.set(2.4, 6.8, 13.8);
      _targetLookAt.set(0.8, 2.6, 5.2);
    } else if (preset === 'aerial') {
      _targetCamPos.set(0.1, 23.5, 9.5);
      _targetLookAt.set(0, 0.8, 0);
    }
    cameraTransitionActive = true;
  }

  // Animation loop with proper Software-WebGL fenceSync pacing
  let frameId = 0;
  let disposed = false;
  const clock = new THREE.Clock();

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (disposed) return;

    const delta = Math.min(0.05, clock.getDelta());
    const elapsed = clock.getElapsedTime();

    // Smoothly damp exploded view separation
    currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 7, delta);

    // Smooth camera preset glide
    if (cameraTransitionActive) {
      const k = 1 - Math.exp(-5.5 * delta);
      camera.position.lerp(_targetCamPos, k);
      controls.target.lerp(_targetLookAt, k);
      if (
        camera.position.distanceToSquared(_targetCamPos) < 0.01 &&
        controls.target.distanceToSquared(_targetLookAt) < 0.01
      ) {
        cameraTransitionActive = false;
      }
    }

    // Animate central kinetic core
    orbitalGroup.rotation.y = elapsed * 0.32;
    orbitalGroup.rotation.x = Math.sin(elapsed * 0.45) * 0.14;
    centralCrystal.rotation.y = -elapsed * 0.55;
    centralCrystal.position.y = 1.95 + Math.sin(elapsed * 1.4) * 0.1;

    // Animate composite deal towers & exploded tiers
    for (let i = 0; i < towerEntries.length; i++) {
      const entry = towerEntries[i];
      const isHighlighted =
        entry.deal.id === hoveredDealId || entry.deal.id === selectedDealId;

      entry.flangeMesh.position.y = entry.baseFlangeY + currentExplode * 0.35;
      entry.crownGroup.position.y = entry.baseCrownY + currentExplode * 0.85;
      entry.capGroup.position.y = entry.baseCapY + currentExplode * 1.45;

      entry.coreCrystal.rotation.y = elapsed * 0.9 + entry.phase;
      entry.coreCrystal.position.y = 0.34 + Math.sin(elapsed * 1.8 + entry.phase) * 0.05;

      const targetEmissive = isHighlighted ? 1.55 : 0.68;
      entry.spineMat.emissiveIntensity = THREE.MathUtils.damp(
        entry.spineMat.emissiveIntensity,
        targetEmissive,
        9,
        delta
      );

      const targetScale = isHighlighted ? 1.07 : 1.0;
      const nextS = THREE.MathUtils.damp(entry.group.scale.x, targetScale, 10, delta);
      entry.group.scale.set(nextS, 1, nextS);
    }

    // Subtle floating telemetry motes
    for (let i = 0; i < moteCount; i++) {
      const baseAngle = moteSeeds[i * 4];
      const r = moteSeeds[i * 4 + 1];
      const baseY = moteSeeds[i * 4 + 2];
      const speed = moteSeeds[i * 4 + 3];
      const a = baseAngle + elapsed * 0.05 * speed;
      _dummy.position.set(
        Math.cos(a) * r,
        baseY + Math.sin(elapsed * speed + baseAngle) * 0.35,
        Math.sin(a) * r
      );
      _dummy.rotation.set(elapsed * 0.5, a, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      moteInstanced.setMatrixAt(i, _dummy.matrix);
    }
    moteInstanced.instanceMatrix.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  tick();

  const handleResize = () => {
    if (disposed) return;
    const w = Math.max(300, container.clientWidth);
    const h = Math.max(300, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  window.addEventListener('resize', handleResize);

  return {
    updateDeals: (nextDeals: Deal[], nextQuota: number) => {
      buildTowers(nextDeals, nextQuota);
    },
    setCameraPreset: (preset: CameraPreset) => {
      applyCameraPreset(preset);
    },
    setExplodeFactor: (val: number) => {
      targetExplode = THREE.MathUtils.clamp(val, 0, 1);
    },
    setAutoRotate: (enabled: boolean) => {
      controls.autoRotate = isSoftwareGl ? false : enabled;
    },
    focusDeal: (dealId: string) => {
      focusDealById(dealId);
    },
    resize: handleResize,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      clearTowers();

      // Dispose shared geometries, materials, and textures
      [
        floorGeo,
        stageDeckGeo,
        deckRimGeo,
        bollardGeo,
        moteGeo,
        plinthGeo,
        collarGeo,
        unitShaftGeo,
        flangeGeo,
        crownGlassGeo,
        coreCrystalGeo,
        capGeo,
        shadowPlaneGeo,
        corePedestalGeo,
        coreCollarGeo,
        arcGeoA,
        arcGeoB,
        centralCrystalGeo,
      ].forEach((g) => g.dispose());

      if (quotaArcMesh) quotaArcMesh.geometry.dispose();

      [
        floorMat,
        stageDeckMat,
        brushedMetalMat,
        mattePlinthMat,
        satinBodyMat,
        titaniumTrimMat,
        opticalGlassMat,
        contactShadowMat,
        bollardMat,
        moteMat,
        arcMatIndigo,
        arcMatEmerald,
        centralCrystalMat,
      ].forEach((m) => m.dispose());

      floorTextures.albedo.dispose();
      floorTextures.roughness.dispose();
      contactShadowTex.dispose();
      envTexture.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
