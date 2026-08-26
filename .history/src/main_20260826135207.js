import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './styles.css';

const canvas = document.querySelector('#scene');
const loaderEl = document.querySelector('#loader');
const resetButton = document.querySelector('#reset-view');
const fullscreenButton = document.querySelector('#fullscreen');
const statusElement = document.querySelector('#status');
const fpsElement = document.querySelector('#fps');
const stackButton = document.querySelector('#primary-action');
const cashOutButton = document.querySelector('#cash-out');
const resetRoundButton = document.querySelector('#reset-round');
const cameraHeightElement = document.querySelector('#camera-height');
const amountElement = document.querySelector('#bet-amount');
const difficultyElement = document.querySelector('#difficulty');
const clientSeedElement = document.querySelector('#client-seed');
const balanceElement = document.querySelector('#balance');
const roundDetailsElement = document.querySelector('#round-details');
const dataModeElement = document.querySelector('#data-mode');

const MOTION_PATH_NAMES = ['roadn', 'road'];
const TRUCK_SPEED_UNITS_PER_SECOND = 4.5;
const TRUCK_SPACING_UNITS = 16;
const MAX_TRUCK_PATH_DISTANCE = 9;
const WATER_EDGE_PADDING = 0.9;
const WATER_SIZE_PADDING = 900;
const WATER_SIZE_MULTIPLIER = 4.8;
const SHIP_WAKE_PADDING = 10;
const WATER_ANIMATION_SPEED = 1.65;
const WATER_SHIMMER_SPEED = 0.55;
const WATER_QUALITY = 'HIGH';
const SKYBOX_TEXTURE_SCROLL_SPEED = 0.002;
const SHIP_INTRO_START_DISTANCE = 82;
const SHIP_MOTION = {
  speed: 0.58,
  heightOffset: 2.2,
  heave: 0.46,
  sway: 0.075,
  surge: 0,
  roll: 0.048,
  pitch: 0,
  yaw: 0,
};
const HANGING_LOAD_MOTION = {
  speed: 0.82,
  sideToSideSwing: 0.18,
  frontBackSwing: 0.105,
  gustSwing: 0.035,
};
const HANGING_LOAD_OBJECT_KEYS = new Set([
  'hangingcontainer',
  'hanging_container',
  'hangingstring1',
  'hanging_string_1',
  'hangingstring2',
  'hanging_string_2',
]);
const HANGING_CONTAINER_OBJECT_KEYS = new Set([
  'hangingcontainer',
  'hanging_container',
]);
const STACK_TARGET_OBJECT_KEYS = [
  'base-container',
  'base_container',
  'basecontainer',
  'ship-base',
  'ship_base',
  'shipbase',
  'hangingcontainer001',
  'hanging_container_001',
  'hangingcontainer.001',
  'hanging_container001',
  'hanging_container',
  'hangingcontainer',
];
const STACK_BLOCK_DEFINITIONS = [
  { label: 'Falling block 1', url: 'fallingBlock1.glb' },
  { label: 'Falling block 2', url: 'fallingBlock2.glb' },
  { label: 'Falling block 3', url: 'fallingBlock3.glb' },
  { label: 'Falling block 4', url: 'fallingBlock4.glb' },
  { label: 'Falling block 5', url: 'fallingBlock5.glb' },
];
const STACK_BLOCK_SCALE = 1.725;
const STACK_RANDOM_X_RANGE = 1.4;
const STACK_RANDOM_Z_RANGE = 1.4;
const STACK_RANDOM_Y_ROTATION_DEGREES = 12;
const TOTAL_STACK_BLOCKS = 24;
const STACK_DROP_HEIGHT = 10;
const STACK_DROP_SECONDS = 0.5;
const HANGING_LOAD_CAMERA_FOLLOW_SPEED = 8;
const HANGING_LOAD_RETRACT_SECONDS = 0.56;
const HANGING_LOAD_DESCEND_SECONDS = 0.86;
const HANGING_LOAD_OFFSCREEN_PROJECTED_Y = 1.18;
const HANGING_LOAD_OFFSCREEN_MIN_LIFT = 9;
const HANGING_LOAD_OFFSCREEN_MAX_LIFT = 72;
const HANGING_LOAD_OFFSCREEN_BLOCK_LIFT = 2.4;
const STACK_VERTICAL_OVERLAP = 0.12;
const STACK_CONTACT_PROGRESS = 0.82;
const STACK_SWING_DEGREES = 4.5;
const STACK_IMPACT_COMPRESSION = 0.045;
const LANDING_SHAKE_DURATION = 0.28;
const LANDING_SHAKE_STRENGTH = 0.2;
const LANDING_SCREEN_EFFECT_DURATION = 0.34;
const LANDING_SCREEN_SHAKE_PIXELS = 9;
const LANDING_SCREEN_BLUR_PIXELS = 3.5;
const LANDING_SCREEN_SCALE = 1.008;
const DUST_PARTICLE_COUNT = 104;
const DUST_DURATION_RANGE = [0.7, 1.18];
const DUST_GRAVITY = 1.85;
const DUST_DRAG = 1.4;
const DUST_EXPANSION = 2.35;
const BAD_LANDING_TILT_DEGREES = 14;
const COLLAPSE_GRAVITY = 18;
const COLLAPSE_CAMERA_FOLLOW_SPEED = 5;
const CAMERA_BASE_RETURN_SPEED = 2.8;
const CAMERA_TOP_PADDING = 3;
const CAMERA_TOP_CLEARANCE_BLOCKS = 1;
const CAMERA_BASE_STACK_VIEW_Y = 0.4;
const LOCK_CAMERA_TO_BLENDER_VIEW = true;
const SLIDER_ORBIT_DEGREES_PER_HEIGHT_UNIT = 9;
const INTRO_CAMERA_START_PROGRESS = 0.7;
const INTRO_CAMERA_DURATION_SECONDS = 3.6;
const DESTROY_BELOW_GROUND_DISTANCE = 5;
const FALLBACK_STACK_ANCHOR = new THREE.Vector3(0, 0, 0);
const WORLD_UP_AXIS = new THREE.Vector3(0, 1, 0);
const SKYBOX_OBJECT_NAMES = new Set(['skybox', 'skybiox']);
const BLENDER_CAMERA_VIEW = {
  position: new THREE.Vector3(-87.64164733886719, 9.622027397155762, 35.54764938354492),
  target: new THREE.Vector3(-9.503303527832031, 1.950033187866211, -26.38408660888672),
  up: new THREE.Vector3(0.060124725103378296, 0.997052788734436, -0.04765469580888748),
  fov: 46.397181333762305,
};
const WATER_SETTINGS = {
  LOW: {
    segments: 160,
    normalIntensity: 0.72,
    foamIntensity: 0.36,
    reflectionStrength: 0.5,
  },
  MEDIUM: {
    segments: 240,
    normalIntensity: 0.95,
    foamIntensity: 0.55,
    reflectionStrength: 0.68,
  },
  HIGH: {
    segments: 520,
    normalIntensity: 0.45,
    foamIntensity: 0.74,
    reflectionStrength: 0.46,
  },
};
const MOCK_SETTINGS = {
  defaultDifficulty: 'easy',
  difficulties: {
    easy: { maxFloor: 24 },
    medium: { maxFloor: 22 },
    hard: { maxFloor: 20 },
    hardcore: { maxFloor: 15 },
  },
  maxBet: 100,
  maxProfit: 1000,
  minBet: 0.1,
};
const initialGameState = {
  balance: null,
  betAmount: 0,
  betId: null,
  clientSeed: '',
  completedFloorCount: 0,
  crashFloor: null,
  currency: 'SC',
  difficulty: 'easy',
  error: null,
  maxFloor: 24,
  nonce: null,
  payoutMultiplier: 1,
  serverSeedHash: null,
  status: 'idle',
  winningAmount: 0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eb7c1);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(12, 8, 12);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.72;

const environment = new RoomEnvironment(renderer);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(environment).texture;
environment.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = !LOCK_CAMERA_TO_BLENDER_VIEW;
controls.enableDamping = !LOCK_CAMERA_TO_BLENDER_VIEW;
controls.dampingFactor = 0.08;
controls.enablePan = !LOCK_CAMERA_TO_BLENDER_VIEW;
controls.enableRotate = !LOCK_CAMERA_TO_BLENDER_VIEW;
controls.enableZoom = !LOCK_CAMERA_TO_BLENDER_VIEW;
controls.screenSpacePanning = true;
controls.minDistance = 1;
controls.maxDistance = 500;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.7;

if (cameraHeightElement) {
  cameraHeightElement.disabled = LOCK_CAMERA_TO_BLENDER_VIEW;
}

const hemiLight = new THREE.HemisphereLight(0xf1f7ff, 0x46545b, 0.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.15);
sunLight.position.set(12, 18, 8);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xcde7ff, 0.3);
fillLight.position.set(-10, 8, -12);
scene.add(fillLight);

const textureByMaterial = {
  'Material.051': 'zone.jpg',
  'Material.008': 'hangar_Base_Color.jpg',
  container1: 'container_Base_Color.jpg',
  container2: 'container2_Base_Color.jpg',
  container3: 'container3_Base_Color.jpg',
  container4: 'container4_Base_Color.jpg',
  container5: 'container5_Base_Color.jpg',
  'Material.017': 'truck_Base_Color.jpg',
  Material: 'ship-room_Base_Color.jpg',
  'Material.009': 'shipbody_Base_Color.jpg',
  'Material.041': 'block_Base_Color.jpg',
  'Material.007': 'factory_Base_Color.jpg'
};

const loadingManager = new THREE.LoadingManager();
loadingManager.onStart = (url) => {
  setLoaderMessage(`Loading ${url.split('/').pop()}`);
};
loadingManager.onProgress = (url, loaded, total) => {
  setLoaderMessage(`Loading assets ${loaded}/${total}`);
};
loadingManager.onError = (url) => {
  setLoaderMessage(`Failed to load ${url}`, true);
};

let modelRoot = null;
let defaultCamera = null;
let defaultTarget = null;
let truckFollowers = [];
let water = null;
let floatingShip = null;
let shipWake = null;
let hangingLoad = null;
let importedSkybox = null;
let stackParts = [];
let activeDrop = null;
let mountedStackPart = null;
let blockHandoffInProgress = false;
let collapsingBlocks = [];
let dustParticles = [];
let stackAnchor = {
  center: FALLBACK_STACK_ANCHOR.clone(),
  halfWidthX: STACK_RANDOM_X_RANGE,
  halfWidthZ: STACK_RANDOM_Z_RANGE,
  topY: 0,
};
let stackIndex = 0;
let currentStackTopY = 0;
let cameraTargetMinY = 0;
let baseStackTopProjectedY = null;
let introCameraAnimation = null;
let collapseCameraStartTargetY = 0;
let landingShakeRemaining = 0;
let landingScreenEffectRemaining = 0;
let returningCameraToBase = false;
let resetInProgress = false;
let collapseSettled = null;
let settings = null;
let mockBalance = 1000;
let mockBetCounter = 41;
let mockHistory = [];
let mockActiveRound = null;
let gameState = { ...initialGameState };
let unfinishedGatePending = true;
let frameCount = 0;
let fpsTimer = 0;
const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const dustTexture = createDustTexture();
const shipBounds = new THREE.Box3();
const shipBoundsSize = new THREE.Vector3();
const shipBoundsCenter = new THREE.Vector3();
const shipWobbleQuaternion = new THREE.Quaternion();
const hangingLoadQuaternion = new THREE.Quaternion();
const hangingLoadBounds = new THREE.Box3();
const hangingLoadPivot = new THREE.Vector3();
const skyboxBounds = new THREE.Box3();
const skyboxSize = new THREE.Vector3();

function applyManualTextures(root) {
  const textureCache = new Map();

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (isNamedSkyboxObject(object)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;

      const textureFile = textureByMaterial[material.name];
      if (!textureFile) continue;

      if (!textureCache.has(textureFile)) {
        const texture = textureLoader.load(`/models/dockyard/textures/${textureFile}`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        textureCache.set(textureFile, texture);
      }

      material.map = textureCache.get(textureFile);
      material.color.set(0xffffff);
      material.metalness = 0;
      material.roughness = 0.82;
      material.needsUpdate = true;
    }
  });
}

function isNamedSkyboxObject(object) {
  return SKYBOX_OBJECT_NAMES.has(normalizeObjectKey(object.name));
}

function setupImportedSkybox(root) {
  const skyboxes = [];

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (isNamedSkyboxObject(object)) {
      skyboxes.push(object);
    }
  });

  if (skyboxes.length === 0) return;

  importedSkybox = skyboxes[0];
  scene.attach(importedSkybox);

  importedSkybox.name = 'skybox';
  importedSkybox.frustumCulled = false;
  importedSkybox.renderOrder = -1000;
  importedSkybox.position.set(0, 0, 0);

  const materials = Array.isArray(importedSkybox.material)
    ? importedSkybox.material
    : [importedSkybox.material];
  const skyboxMaterials = materials.map((material) => {
    const map = material?.map ? material.map.clone() : null;
    configureSkyboxTexture(map);

    return new THREE.MeshBasicMaterial({
      map,
      color: map ? 0xffffff : 0x9eb7c1,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
  });
  importedSkybox.material = Array.isArray(importedSkybox.material)
    ? skyboxMaterials
    : skyboxMaterials[0];

  if (import.meta.env.DEV) {
    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getSkyboxSnapshot: () => {
        const activeMaterials = Array.isArray(importedSkybox.material)
          ? importedSkybox.material
          : [importedSkybox.material];
        return {
          name: importedSkybox.name,
          visible: importedSkybox.visible,
          position: importedSkybox.position.toArray(),
          scale: importedSkybox.scale.toArray(),
          materialMaps: activeMaterials.map((material) => material?.map?.image?.currentSrc
            ?? material?.map?.image?.src
            ?? material?.map?.name
            ?? null),
        };
      },
    };
  }

  for (let index = 1; index < skyboxes.length; index += 1) {
    skyboxes[index].visible = false;
  }
}

function updateImportedSkybox(elapsedSeconds = 0) {
  if (!importedSkybox) return;

  importedSkybox.position.copy(camera.position);
  updateSkyboxTextureScroll(elapsedSeconds);
  skyboxBounds.setFromObject(importedSkybox);
  skyboxBounds.getSize(skyboxSize);

  const currentDiameter = Math.max(skyboxSize.x, skyboxSize.y, skyboxSize.z);
  const targetDiameter = controls.maxDistance * 2.6;
  if (currentDiameter > 0 && currentDiameter < targetDiameter) {
    const scaleBoost = targetDiameter / currentDiameter;
    importedSkybox.scale.multiplyScalar(scaleBoost);
  }
}

function configureSkyboxTexture(texture) {
  if (!texture) {
    return;
  }

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
}

function updateSkyboxTextureScroll(elapsedSeconds) {
  const materials = Array.isArray(importedSkybox.material)
    ? importedSkybox.material
    : [importedSkybox.material];
  const offset = THREE.MathUtils.euclideanModulo(
    -elapsedSeconds * SKYBOX_TEXTURE_SCROLL_SPEED,
    1,
  );

  for (const material of materials) {
    if (material?.map) {
      material.map.offset.x = offset;
    }
  }
}

function hideImportedSkyDomes(root) {
  root.traverse((object) => {
    if (!object.isMesh || isNamedSkyboxObject(object)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const usesSkyTexture = materials.some((material) => {
      const mapName = material?.map?.name ?? '';
      const imageName = material?.map?.image?.name ?? '';
      const imageSrc = material?.map?.image?.currentSrc ?? material?.map?.image?.src ?? '';
      const textureLabel = `${mapName} ${imageName} ${imageSrc}`.toLowerCase();
      return textureLabel.includes('sky') || textureLabel.includes('cloudy');
    });

    if (usesSkyTexture) {
      object.visible = false;
      object.scale.setScalar(0);
    }
  });
}

function setLoaderMessage(message, isError = false) {
  loaderEl.textContent = message;
  loaderEl.classList.toggle('error', isError);
}

function hideLoader() {
  loaderEl.classList.add('hidden');
  loaderEl.setAttribute('aria-hidden', 'true');
}

function getAssetUrl(url) {
  return `${url}?v=${Date.now()}`;
}

function createDustTexture() {
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 64;
  dustCanvas.height = 64;

  const context = dustCanvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(226, 213, 184, 0.72)');
    gradient.addColorStop(0.45, 'rgba(199, 178, 137, 0.34)');
    gradient.addColorStop(1, 'rgba(199, 178, 137, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, dustCanvas.width, dustCanvas.height);
  }

  const texture = new THREE.CanvasTexture(dustCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function clampCurrency(value) {
  return Number(value.toFixed(2));
}

function chooseCrashFloor(maxFloor) {
  return maxFloor;
}

function multiplierForFloor(floor, maxFloor) {
  const progress = floor / maxFloor;
  return Number((1 + progress * progress * 23.25).toFixed(6));
}

async function mockLaunch() {
  await delay(180);
  return {
    currency: 'SC',
    gameKey: 'mega-block',
    token: 'mock-mega-block-token',
  };
}

async function mockGetSettings() {
  await delay(120);
  return MOCK_SETTINGS;
}

async function mockGetUnfinishedBet() {
  await delay(120);
  return {
    hasUnfinishedBet: Boolean(mockActiveRound),
    unfinishedBet: mockActiveRound ? withoutOpenCrashFloor(mockActiveRound) : null,
  };
}

async function mockPlaceBet(request) {
  await delay(220);

  if (mockActiveRound) {
    throw new Error('OpenBetExistsErrorType');
  }

  const maxFloor = MOCK_SETTINGS.difficulties[request.difficulty].maxFloor;
  const betAmount = clampCurrency(request.amount);

  if (betAmount < MOCK_SETTINGS.minBet || betAmount > MOCK_SETTINGS.maxBet) {
    throw new Error('BetAmountOutOfRangeErrorType');
  }

  if (betAmount > mockBalance) {
    throw new Error('InsufficientBalanceErrorType');
  }

  mockBalance = clampCurrency(mockBalance - betAmount);
  mockBetCounter += 1;

  const id = String(mockBetCounter);
  const nonce = mockBetCounter - 39;
  const crashFloor = chooseCrashFloor(maxFloor);

  mockActiveRound = {
    betAmount,
    clientSeed: request.clientSeed,
    crashFloor,
    currency: gameState.currency,
    currentFloorCount: 0,
    gameDifficulty: request.difficulty,
    id,
    maxFloor,
    nonce,
    payoutMultiplier: 1,
    result: null,
    roundId: globalThis.crypto?.randomUUID?.() ?? `mock-round-${id}`,
    serverSeedHash: `mock-server-seed-hash-${nonce}`,
    winningAmount: 0,
  };

  return {
    betAmount,
    betId: id,
    clientSeed: request.clientSeed,
    currency: gameState.currency,
    currentFloorCount: 0,
    difficulty: request.difficulty,
    maxFloor,
    nonce,
    serverSeedHash: mockActiveRound.serverSeedHash,
  };
}

async function mockDropBlock(betId) {
  await delay(260);
  const round = getMockActiveRound(betId);
  const attemptedFloor = round.currentFloorCount + 1;

  if (attemptedFloor === round.crashFloor) {
    round.result = 'lost';
    round.winningAmount = 0;
    round.payoutMultiplier = 0;
    completeMockRound(round);

    return {
      attemptedFloor,
      betId,
      clientSeed: round.clientSeed,
      completedFloorCount: round.currentFloorCount,
      crashFloor: round.crashFloor,
      maxFloor: round.maxFloor,
      nonce: round.nonce,
      payoutMultiplier: 0,
      result: 'lost',
      serverSeedHash: round.serverSeedHash,
      winningAmount: 0,
    };
  }

  round.currentFloorCount = attemptedFloor;
  round.payoutMultiplier = multiplierForFloor(round.currentFloorCount, round.maxFloor);

  if (round.currentFloorCount >= round.maxFloor) {
    const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
    round.result = 'won';
    round.winningAmount = winningAmount;
    mockBalance = clampCurrency(mockBalance + winningAmount);
    completeMockRound(round);

    return {
      balance: mockBalance,
      betId,
      clientSeed: round.clientSeed,
      completedFloorCount: round.currentFloorCount,
      crashFloor: round.maxFloor + 1,
      maxFloor: round.maxFloor,
      nonce: round.nonce,
      payoutMultiplier: Number(round.payoutMultiplier),
      result: 'won',
      serverSeedHash: round.serverSeedHash,
      winningAmount,
    };
  }

  return {
    betId,
    completedFloorCount: round.currentFloorCount,
    maxFloor: round.maxFloor,
    payoutMultiplier: Number(round.payoutMultiplier),
    result: null,
  };
}

async function mockCashOut(betId) {
  await delay(240);
  const round = getMockActiveRound(betId);

  if (round.currentFloorCount === 0) {
    throw new Error('MegaBlockNoFloorsCompletedErrorType');
  }

  const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
  round.result = 'won';
  round.winningAmount = winningAmount;
  mockBalance = clampCurrency(mockBalance + winningAmount);
  completeMockRound(round);

  return {
    balance: mockBalance,
    betAmount: round.betAmount,
    betId,
    clientSeed: round.clientSeed,
    completedFloorCount: round.currentFloorCount,
    crashFloor: round.crashFloor,
    currency: round.currency,
    maxFloor: round.maxFloor,
    nonce: round.nonce,
    payoutMultiplier: Number(round.payoutMultiplier),
    result: 'won',
    serverSeedHash: round.serverSeedHash,
    winningAmount,
  };
}

function getMockActiveRound(betId) {
  if (!mockActiveRound || mockActiveRound.id !== betId) {
    throw new Error('NoOpenBetErrorType');
  }

  return mockActiveRound;
}

function completeMockRound(round) {
  mockHistory.unshift({ ...round });
  mockActiveRound = null;
}

function withoutOpenCrashFloor(round) {
  const { crashFloor: _crashFloor, ...safeRound } = round;
  return {
    ...safeRound,
    crashFloor: null,
  };
}

async function initializeGameSession() {
  setDataMode();

  try {
    const launch = await mockLaunch();
    gameState.currency = launch.currency;
    settings = await mockGetSettings();
    applySettings(settings);

    const hasUnfinishedBet = await syncUnfinishedBet({
      resetStackWhenNone: true,
      preserveResolvedWhenNone: false,
    });

    if (!hasUnfinishedBet) {
      setGameStatus(stackParts.length ? 'Ready to place bet' : 'Loading stack blocks');
    }
  } catch (error) {
    gameState.status = 'error';
    gameState.error = getDisplayError(error);
    setGameStatus(gameState.error);
  } finally {
    updateControls();
  }
}

function setDataMode() {
  if (dataModeElement) {
    dataModeElement.textContent = 'Mock data';
  }
}

function applySettings(nextSettings) {
  gameState.difficulty = nextSettings.defaultDifficulty;
  gameState.maxFloor = nextSettings.difficulties[nextSettings.defaultDifficulty].maxFloor;

  if (amountElement) {
    amountElement.min = String(nextSettings.minBet);
    amountElement.max = String(nextSettings.maxBet);
    amountElement.value = String(Math.max(nextSettings.minBet, Number(amountElement.value) || 1));
  }

  if (difficultyElement) {
    difficultyElement.value = nextSettings.defaultDifficulty;
  }
}

function restoreUnfinishedBet(response) {
  const unfinishedBet = response.unfinishedBet;

  if (!response.hasUnfinishedBet || !unfinishedBet) {
    restoreCompletedStack(0);
    return;
  }

  gameState = {
    ...gameState,
    betAmount: Number(unfinishedBet.betAmount),
    betId: unfinishedBet.id,
    clientSeed: unfinishedBet.clientSeed,
    completedFloorCount: unfinishedBet.currentFloorCount,
    crashFloor: null,
    currency: unfinishedBet.currency,
    difficulty: unfinishedBet.gameDifficulty,
    error: null,
    maxFloor: unfinishedBet.maxFloor,
    nonce: unfinishedBet.nonce,
    payoutMultiplier: Number(unfinishedBet.payoutMultiplier),
    serverSeedHash: unfinishedBet.serverSeedHash,
    status: 'active',
    winningAmount: Number(unfinishedBet.winningAmount),
  };

  if (amountElement) {
    amountElement.value = String(Number(unfinishedBet.betAmount));
  }

  if (difficultyElement) {
    difficultyElement.value = unfinishedBet.gameDifficulty;
  }

  if (clientSeedElement) {
    clientSeedElement.value = unfinishedBet.clientSeed;
  }

  restoreCompletedStack(unfinishedBet.currentFloorCount);
  setGameStatus(`Restored round ${unfinishedBet.id}`);
}

async function syncUnfinishedBet(options) {
  unfinishedGatePending = true;
  updateControls();

  try {
    const unfinishedBet = await mockGetUnfinishedBet();

    if (unfinishedBet.hasUnfinishedBet) {
      restoreUnfinishedBet(unfinishedBet);
      unfinishedGatePending = false;
      return true;
    }

    if (options.resetStackWhenNone) {
      restoreCompletedStack(0);
    }

    gameState = {
      ...gameState,
      betId: null,
      completedFloorCount: options.preserveResolvedWhenNone ? gameState.completedFloorCount : 0,
      crashFloor: options.preserveResolvedWhenNone ? gameState.crashFloor : null,
      error: options.preserveResolvedWhenNone ? gameState.error : null,
      payoutMultiplier: options.preserveResolvedWhenNone ? gameState.payoutMultiplier : 1,
      status: options.preserveResolvedWhenNone ? gameState.status : 'idle',
      winningAmount: options.preserveResolvedWhenNone ? gameState.winningAmount : 0,
    };
    unfinishedGatePending = false;
    return false;
  } catch (error) {
    gameState.error = getDisplayError(error);
    setGameStatus(gameState.error);
    return true;
  } finally {
    updateControls();
  }
}

function handlePrimaryAction() {
  if (gameState.betId) {
    void dropBlock();
    return;
  }

  void placeBet();
}

async function placeBet() {
  if (!settings || unfinishedGatePending || gameState.status === 'placing' || gameState.betId || !stackParts.length) {
    return;
  }

  const amountInput = amountElement?.value.trim() ?? '';
  const amount = Number(amountInput);
  const difficulty = getSelectedDifficulty();
  const clientSeed = clientSeedElement?.value.trim() ?? '';

  if (!Number.isFinite(amount) || amount <= 0) {
    highlightAmountInput();
    showError('Enter a valid bet amount.');
    return;
  }

  if (!hasAtMostTwoDecimalPlaces(amountInput)) {
    highlightAmountInput();
    showError('Bet amount can use at most two decimal places.');
    return;
  }

  if (amount < settings.minBet || amount > settings.maxBet) {
    highlightAmountInput();
    showError(
      `Bet amount must be ${formatAmount(settings.minBet, gameState.currency)}-${formatAmount(
        settings.maxBet,
        gameState.currency,
      )}.`,
    );
    return;
  }

  if (clientSeed.length < 1 || clientSeed.length > 32) {
    showError('Client seed must be 1-32 characters.');
    return;
  }

  gameState = {
    ...gameState,
    betAmount: amount,
    clientSeed,
    crashFloor: null,
    difficulty,
    error: null,
    maxFloor: settings.difficulties[difficulty].maxFloor,
    status: 'placing',
    winningAmount: 0,
  };
  updateControls();
  setGameStatus('Placing bet');

  try {
    const bet = await mockPlaceBet({ amount, clientSeed, difficulty });
    applyPlacedBet(bet);
    restoreCompletedStack(0);
    setGameStatus(`Bet ${bet.betId} placed`);
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    updateControls();
  }
}

async function dropBlock() {
  if (unfinishedGatePending || !gameState.betId || gameState.status !== 'active' || activeDrop) {
    return;
  }

  gameState.status = 'dropping';
  gameState.error = null;
  updateControls();
  setGameStatus('Block in motion');

  try {
    const response = await mockDropBlock(gameState.betId);
    const shouldCollapse = response.result === 'lost';

    await animateNextBlock(shouldCollapse);
    applyDropResponse(response);
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    updateControls();
  }
}

async function cashOut() {
  if (
    unfinishedGatePending ||
    !gameState.betId ||
    gameState.status !== 'active' ||
    gameState.completedFloorCount === 0
  ) {
    return;
  }

  gameState.status = 'cashingOut';
  gameState.error = null;
  updateControls();
  setGameStatus('Cashing out');

  try {
    const response = await mockCashOut(gameState.betId);
    gameState = {
      ...gameState,
      balance: response.balance ?? gameState.balance,
      betId: null,
      completedFloorCount: response.completedFloorCount,
      crashFloor: response.crashFloor,
      maxFloor: response.maxFloor,
      payoutMultiplier: Number(response.payoutMultiplier),
      status: 'won',
      winningAmount: Number(response.winningAmount),
    };
    resetStackPool();
    mountNextStackPart();
    returningCameraToBase = true;
    setGameStatus(`Cashed out ${formatAmount(response.winningAmount, response.currency)}`);
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    updateControls();
  }
}

function resetRound() {
  collapsingBlocks.length = 0;
  resetInProgress = true;
  returningCameraToBase = true;
  restoreCompletedStack(gameState.betId ? gameState.completedFloorCount : 0);

  if (!gameState.betId && (gameState.status === 'won' || gameState.status === 'lost')) {
    gameState = {
      ...gameState,
      completedFloorCount: 0,
      crashFloor: null,
      error: null,
      payoutMultiplier: 1,
      status: 'idle',
      winningAmount: 0,
    };
  }

  updateControls();
  setGameStatus('Resetting round');
}

function applyPlacedBet(bet) {
  gameState = {
    ...gameState,
    balance: mockBalance,
    betAmount: Number(bet.betAmount),
    betId: bet.betId,
    clientSeed: bet.clientSeed,
    completedFloorCount: bet.currentFloorCount,
    crashFloor: null,
    currency: bet.currency,
    difficulty: bet.difficulty,
    error: null,
    maxFloor: bet.maxFloor,
    nonce: bet.nonce,
    payoutMultiplier: 1,
    serverSeedHash: bet.serverSeedHash,
    status: 'active',
    winningAmount: 0,
  };
}

function applyDropResponse(response) {
  if (response.result === 'lost') {
    gameState = {
      ...gameState,
      betId: null,
      completedFloorCount: response.completedFloorCount,
      crashFloor: response.crashFloor ?? response.attemptedFloor ?? null,
      maxFloor: response.maxFloor,
      payoutMultiplier: Number(response.payoutMultiplier),
      status: 'lost',
      winningAmount: Number(response.winningAmount ?? 0),
    };
    setGameStatus(`Crashed on floor ${response.attemptedFloor ?? response.crashFloor ?? '?'}`);
    return;
  }

  if (response.result === 'won') {
    gameState = {
      ...gameState,
      balance: response.balance ?? gameState.balance,
      betId: null,
      completedFloorCount: response.completedFloorCount,
      crashFloor: response.crashFloor ?? null,
      maxFloor: response.maxFloor,
      payoutMultiplier: Number(response.payoutMultiplier),
      status: 'won',
      winningAmount: Number(response.winningAmount ?? 0),
    };
    setGameStatus(`Auto won ${formatAmount(gameState.winningAmount, gameState.currency)}`);
    return;
  }

  gameState = {
    ...gameState,
    completedFloorCount: response.completedFloorCount,
    maxFloor: response.maxFloor,
    payoutMultiplier: Number(response.payoutMultiplier),
    status: 'active',
  };
  setGameStatus(`Floor ${response.completedFloorCount} safe`);
}

function updateControls() {
  const hasActiveBet = Boolean(gameState.betId);
  const isResolvedRound = !hasActiveBet && (gameState.status === 'won' || gameState.status === 'lost');
  const isBusy =
    gameState.status === 'placing' ||
    gameState.status === 'dropping' ||
    gameState.status === 'cashingOut' ||
    unfinishedGatePending ||
    Boolean(activeDrop) ||
    collapsingBlocks.length > 0;
  const canPlace = Boolean(settings) && stackParts.length > 0 && !hasActiveBet && !isBusy && gameState.status !== 'error';
  const canDrop =
    hasActiveBet &&
    gameState.status === 'active' &&
    !isBusy &&
    stackIndex < gameState.maxFloor &&
    stackIndex < stackParts.length;
  const canCashOut =
    hasActiveBet &&
    gameState.status === 'active' &&
    gameState.completedFloorCount > 0 &&
    !isBusy;

  if (stackButton) {
    stackButton.disabled = hasActiveBet ? !canDrop : !canPlace;
    const isDropAction = hasActiveBet && (gameState.status === 'active' || gameState.status === 'dropping');
    stackButton.textContent = isDropAction ? 'Go' : 'Play';
  }

  if (cashOutButton) {
    cashOutButton.disabled = !canCashOut;
    const cashOutAmount = gameState.betAmount * gameState.payoutMultiplier;

    if (gameState.status === 'cashingOut') {
      cashOutButton.textContent = 'Cashing Out';
    } else if (hasActiveBet && gameState.completedFloorCount) {
      const amount = document.createElement('span');
      amount.className = 'cashout-button__amount';
      amount.textContent = formatPanelAmount(cashOutAmount, gameState.currency);
      const multiplier = document.createElement('span');
      multiplier.className = 'cashout-button__multiplier';
      multiplier.textContent = `(${gameState.payoutMultiplier.toFixed(3)}x)`;
      cashOutButton.replaceChildren(document.createTextNode('Cash Out'), amount, multiplier);
    } else {
      cashOutButton.textContent = 'Cash Out';
    }
  }

  if (resetRoundButton) {
    resetRoundButton.disabled = resetInProgress && !isResolvedRound;
  }

  if (amountElement) {
    amountElement.disabled = hasActiveBet || isBusy;
  }

  if (difficultyElement) {
    difficultyElement.disabled = hasActiveBet || isBusy;
  }

  if (clientSeedElement) {
    clientSeedElement.disabled = hasActiveBet || isBusy;
  }

  if (cameraHeightElement) {
    cameraHeightElement.disabled = LOCK_CAMERA_TO_BLENDER_VIEW;
  }

  if (balanceElement) {
    balanceElement.textContent =
      gameState.balance === null
        ? `${gameState.currency} --`
        : formatPanelAmount(gameState.balance, gameState.currency);
  }

  if (roundDetailsElement) {
    roundDetailsElement.textContent = getRoundDetailsText();
  }
}

function getRoundDetailsText() {
  if (gameState.error) {
    return gameState.error;
  }

  if (!gameState.betId && gameState.status !== 'won' && gameState.status !== 'lost') {
    return `Limits ${settings?.minBet ?? 0.1}-${settings?.maxBet ?? 100} ${gameState.currency}`;
  }

  const floorText = `${gameState.completedFloorCount}/${gameState.maxFloor} blocks`;

  if (gameState.status === 'lost') {
    return `${floorText} | Lost on block ${gameState.crashFloor ?? '?'} | ${gameState.currency}`;
  }

  if (gameState.status === 'won') {
    return `${floorText} | Won ${formatAmount(gameState.winningAmount, gameState.currency)}`;
  }

  return `${floorText} | ${gameState.payoutMultiplier.toFixed(3)}x | Bet ${formatAmount(
    gameState.betAmount,
    gameState.currency,
  )}`;
}

function getSelectedDifficulty() {
  const value = difficultyElement?.value;

  if (value === 'medium' || value === 'hard' || value === 'hardcore') {
    return value;
  }

  return 'easy';
}

function handleDifficultyChange() {
  if (!settings || gameState.betId) {
    return;
  }

  const difficulty = getSelectedDifficulty();
  gameState = {
    ...gameState,
    difficulty,
    maxFloor: settings.difficulties[difficulty].maxFloor,
  };
  updateControls();
}

function handleAmountInput() {
  amountElement?.classList.remove('field__input--error');
  updateControls();
}

function highlightAmountInput() {
  amountElement?.classList.add('field__input--error');
}

function showError(message) {
  gameState = {
    ...gameState,
    error: message,
    status: gameState.betId ? 'active' : 'idle',
  };
  setGameStatus(message);
  updateControls();
}

function setGameStatus(status) {
  if (statusElement) {
    statusElement.textContent = status;
  }
}

function formatAmount(value, currency) {
  return `${Number(value).toFixed(2)} ${currency}`;
}

function formatPanelAmount(value, currency) {
  return `${currency} ${Number(value).toFixed(2)}`;
}

function hasAtMostTwoDecimalPlaces(value) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

function getDisplayError(error) {
  return error instanceof Error ? error.message : 'MegaBlock request failed.';
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  object.position.sub(center);

  const framedBox = new THREE.Box3().setFromObject(object);
  const framedSize = framedBox.getSize(new THREE.Vector3());
  const framedMaxDim = Math.max(framedSize.x, framedSize.y, framedSize.z, maxDim);

  camera.fov = BLENDER_CAMERA_VIEW.fov;
  camera.up.copy(BLENDER_CAMERA_VIEW.up).normalize();
  camera.position.copy(BLENDER_CAMERA_VIEW.position).sub(center);
  controls.target.copy(BLENDER_CAMERA_VIEW.target).sub(center);

  const cameraDistance = camera.position.distanceTo(controls.target);
  camera.near = Math.max(cameraDistance / 1000, 0.01);
  camera.far = Math.max(cameraDistance + framedMaxDim * 6, 1000);
  camera.updateProjectionMatrix();

  controls.maxDistance = Math.max(cameraDistance * 4, framedMaxDim * 2);
  controls.minDistance = Math.max(cameraDistance / 100, 0.2);
  controls.update();

  defaultCamera = camera.position.clone();
  defaultTarget = controls.target.clone();
  cameraTargetMinY = controls.target.y;

  if (import.meta.env.DEV) {
    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getCameraSnapshot: () => ({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        up: camera.up.toArray(),
        fov: camera.fov,
      }),
    };
  }
}

function resetView() {
  if (!defaultCamera || !defaultTarget) return;
  introCameraAnimation = null;
  returningCameraToBase = false;
  camera.position.copy(defaultCamera);
  controls.target.copy(defaultTarget);
  controls.update();
  updateCameraSlider();
}

function resize() {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function materialNameForIndex(material, index) {
  if (Array.isArray(material)) {
    return material[index]?.name ?? '';
  }

  return material?.name ?? '';
}

function getMaterialBounds(root, materialNames) {
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const rootLocalVertex = new THREE.Vector3();

  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;

    const position = object.geometry.attributes.position;
    const groups = object.geometry.groups.length
      ? object.geometry.groups
      : [{ start: 0, count: position.count, materialIndex: 0 }];

    object.updateWorldMatrix(true, false);
    groups.forEach((group) => {
      const materialName = materialNameForIndex(object.material, group.materialIndex);
      if (!materialNames.has(materialName)) return;

      const start = group.start;
      const end = Math.min(group.start + group.count, position.count);
      for (let index = start; index < end; index += 1) {
        vertex.fromBufferAttribute(position, index);
        object.localToWorld(vertex);
        rootLocalVertex.copy(vertex);
        root.worldToLocal(rootLocalVertex);
        bounds.expandByPoint(rootLocalVertex);
      }
    });
  });

  return bounds.isEmpty() ? null : bounds;
}

function createWaterMaterial(dockBounds) {
  const centerX = (dockBounds.min.x + dockBounds.max.x) * 0.5;
  const centerZ = (dockBounds.min.z + dockBounds.max.z) * 0.5;
  const halfSizeX = (dockBounds.max.x - dockBounds.min.x) * 0.5 + WATER_EDGE_PADDING;
  const halfSizeZ = (dockBounds.max.z - dockBounds.min.z) * 0.5 + WATER_EDGE_PADDING;
  const quality = WATER_SETTINGS[WATER_QUALITY] ?? WATER_SETTINGS.HIGH;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      shimmerTime: { value: 0 },
      dockCenter: { value: new THREE.Vector2(centerX, centerZ) },
      dockHalfSize: { value: new THREE.Vector2(halfSizeX, halfSizeZ) },
      shipCenter: { value: new THREE.Vector2(9999, 9999) },
      shipHalfSize: { value: new THREE.Vector2(1, 1) },
      shipWakeStrength: { value: 0 },
      sunDirection: { value: sunLight.position.clone().normalize() },
      normalIntensity: { value: quality.normalIntensity },
      foamIntensity: { value: quality.foamIntensity },
      reflectionStrength: { value: quality.reflectionStrength },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      varying float vCrest;

      uniform float time;
      uniform vec2 dockCenter;
      uniform vec2 dockHalfSize;
      uniform vec2 shipCenter;
      uniform vec2 shipHalfSize;
      uniform float shipWakeStrength;

      float waveLayer(vec2 point, vec2 direction, float frequency, float speed, float amplitude, float steepness) {
        float phase = dot(point, normalize(direction)) * frequency + time * speed;
        float rounded = sin(phase);
        float crest = pow(max(0.0, rounded), 2.0) * steepness;
        return (rounded + crest * 0.28) * amplitude;
      }

      float oceanHeight(vec2 point) {
        point += vec2(
          sin(point.y * 0.025 + time * 0.19) * 2.4,
          sin(point.x * 0.021 - time * 0.17) * 2.1
        );
        float height = 0.0;
        height += waveLayer(point, vec2(0.78, 0.32), 0.026, 0.78, 0.95, 0.78);
        height += waveLayer(point, vec2(-0.31, 0.95), 0.041, -0.64, 0.66, 0.66);
        height += waveLayer(point, vec2(0.22, 0.72), 0.068, 1.05, 0.4, 0.58);
        height += waveLayer(point, vec2(-0.92, 0.39), 0.118, 1.42, 0.24, 0.42);
        height += sin(point.x * 0.11 + sin(point.y * 0.05 + time * 0.36) * 2.1 - time * 1.45) * 0.18;
        return height;
      }

      float hash1(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      float centerPulseRing(vec2 point, float cycleLength, float seed, float reach, float width, float amplitude) {
        float distanceToCenter = length(point - dockCenter);
        float cyclePosition = time / cycleLength + seed;
        float cycleIndex = floor(cyclePosition);
        float phase = fract(cyclePosition);
        float randomGate = step(0.36, hash1(cycleIndex + seed * 41.0));
        float birthFade = smoothstep(0.04, 0.18, phase);
        float deathFade = 1.0 - smoothstep(0.72, 1.0, phase);
        float reachJitter = mix(0.82, 1.14, hash1(cycleIndex + seed * 19.0));
        float radius = phase * reach * reachJitter;
        float bandDistance = abs(distanceToCenter - radius);
        float leadingBand = exp(-(bandDistance * bandDistance) / (width * width));
        float trailingBand = exp(-pow(max(distanceToCenter - radius + width * 2.4, 0.0), 2.0) / (width * width * 5.2));
        float waveShape = sin((distanceToCenter - radius) * 0.72) * 0.42 + 0.58;
        return (leadingBand * waveShape + trailingBand * 0.32) * birthFade * deathFade * randomGate * amplitude;
      }

      float centerRippleHeight(vec2 point) {
        return centerPulseRing(point, 9.6, 0.17, 116.0, 5.8, 0.92)
          + centerPulseRing(point, 14.2, 2.83, 132.0, 7.4, 0.62)
          + centerPulseRing(point, 21.0, 5.41, 145.0, 9.0, 0.42);
      }

      void main() {
        vUv = uv;
        vec3 transformed = position;
        vec2 waterPoint = (modelMatrix * vec4(position, 1.0)).xz;
        vec2 shipScale = max(shipHalfSize, vec2(1.0));
        float shipDistance = length((waterPoint - shipCenter) / shipScale);
        float shipWake = shipWakeStrength * (1.0 - smoothstep(0.72, 3.8, shipDistance));
        float wakeRipple = sin(shipDistance * 18.0 - time * 4.1) * shipWake * 0.08;
        vWave = oceanHeight(waterPoint) + centerRippleHeight(waterPoint) * 0.78 + wakeRipple;
        vCrest = smoothstep(0.08, 0.52, vWave);
        transformed.z += vWave * 0.08;

        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      varying float vCrest;

      uniform float time;
      uniform float shimmerTime;
      uniform vec2 dockCenter;
      uniform vec2 dockHalfSize;
      uniform vec2 shipCenter;
      uniform vec2 shipHalfSize;
      uniform float shipWakeStrength;
      uniform vec3 sunDirection;
      uniform float normalIntensity;
      uniform float foamIntensity;
      uniform float reflectionStrength;

      float rectDistance(vec2 point, vec2 center, vec2 halfSize) {
        vec2 q = abs(point - center) - halfSize;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      }

      float hash(vec2 point) {
        vec3 p = fract(vec3(point.xyx) * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        vec2 curve = local * local * (3.0 - 2.0 * local);

        float a = hash(cell);
        float b = hash(cell + vec2(1.0, 0.0));
        float c = hash(cell + vec2(0.0, 1.0));
        float d = hash(cell + vec2(1.0, 1.0));

        return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
      }

      float waveLayer(vec2 point, vec2 direction, float frequency, float speed, float amplitude, float steepness) {
        float phase = dot(point, normalize(direction)) * frequency + time * speed;
        float rounded = sin(phase);
        float crest = pow(max(0.0, rounded), 2.0) * steepness;
        return (rounded + crest * 0.28) * amplitude;
      }

      float oceanHeight(vec2 point) {
        point += vec2(
          sin(point.y * 0.025 + time * 0.19) * 2.4,
          sin(point.x * 0.021 - time * 0.17) * 2.1
        );
        float height = 0.0;
        height += waveLayer(point, vec2(0.78, 0.32), 0.026, 0.78, 0.95, 0.78);
        height += waveLayer(point, vec2(-0.31, 0.95), 0.041, -0.64, 0.66, 0.66);
        height += waveLayer(point, vec2(0.22, 0.72), 0.068, 1.05, 0.4, 0.58);
        height += waveLayer(point, vec2(-0.92, 0.39), 0.118, 1.42, 0.24, 0.42);
        height += sin(point.x * 0.11 + sin(point.y * 0.05 + time * 0.36) * 2.1 - time * 1.45) * 0.18;
        return height;
      }

      vec3 oceanNormal(vec2 point) {
        float sampleStep = 0.55;
        float left = oceanHeight(point - vec2(sampleStep, 0.0));
        float right = oceanHeight(point + vec2(sampleStep, 0.0));
        float back = oceanHeight(point - vec2(0.0, sampleStep));
        float front = oceanHeight(point + vec2(0.0, sampleStep));
        vec3 normal = normalize(vec3(left - right, sampleStep * 2.0, back - front));

        float rippleA = sin(point.x * 0.22 + point.y * 0.05 + time * 0.92);
        float rippleB = sin(point.x * -0.08 + point.y * 0.24 - time * 0.78);
        float rippleNoise = noise(point * 0.14 + vec2(time * -0.08, time * 0.06)) - 0.5;
        normal.xz += vec2(rippleA * 0.07 + rippleNoise * 0.08, rippleB * 0.07 - rippleNoise * 0.07) * normalIntensity;

        return normalize(normal);
      }

      float hash1(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      float centerPulseMask(vec2 point, float cycleLength, float seed, float reach, float width, float strength) {
        float distanceToCenter = length(point - dockCenter);
        float cyclePosition = time / cycleLength + seed;
        float cycleIndex = floor(cyclePosition);
        float phase = fract(cyclePosition);
        float randomGate = step(0.36, hash1(cycleIndex + seed * 41.0));
        float birthFade = smoothstep(0.04, 0.18, phase);
        float deathFade = 1.0 - smoothstep(0.72, 1.0, phase);
        float reachJitter = mix(0.82, 1.14, hash1(cycleIndex + seed * 19.0));
        float radius = phase * reach * reachJitter;
        float bandDistance = abs(distanceToCenter - radius);
        float ring = 1.0 - smoothstep(width * 0.32, width, bandDistance);
        float breakup = noise(point * 0.31 + vec2(shimmerTime * -0.07, shimmerTime * 0.05));
        return ring * smoothstep(0.36, 0.88, breakup + ring * 0.52) * birthFade * deathFade * randomGate * strength;
      }

      float centerRippleFoam(vec2 point) {
        return centerPulseMask(point, 9.6, 0.17, 116.0, 6.2, 0.9)
          + centerPulseMask(point, 14.2, 2.83, 132.0, 8.0, 0.54)
          + centerPulseMask(point, 21.0, 5.41, 145.0, 9.8, 0.34);
      }

      void main() {
        vec2 waterPoint = vWorldPosition.xz;
        float signedWallDistance = rectDistance(waterPoint, dockCenter, dockHalfSize);
        float outsideDock = smoothstep(-0.04, 0.36, signedWallDistance);
        float wallBand = 1.0 - smoothstep(0.03, 1.35, signedWallDistance);
        float foamBreakup = noise(waterPoint * 0.52 + vec2(shimmerTime * 0.18, -shimmerTime * 0.12)) * 0.62
          + noise(waterPoint * 1.05 + vec2(shimmerTime * -0.28, shimmerTime * 0.16)) * 0.38;
        float wallFoam = outsideDock * wallBand * smoothstep(0.34, 0.78, foamBreakup + vCrest * 0.58) * foamIntensity;
        float surfaceNoise = noise(waterPoint * 0.024 + vec2(shimmerTime * 0.018, shimmerTime * -0.014));
        float smallNoise = noise(waterPoint * 0.055 + vec2(shimmerTime * -0.06, shimmerTime * 0.045)) * 0.72
          + noise(waterPoint * 0.11 + vec2(shimmerTime * 0.08, shimmerTime * -0.052)) * 0.28;
        float fineRipples = sin(waterPoint.x * 0.08 + waterPoint.y * 0.055 + shimmerTime * 0.92)
          * sin(waterPoint.x * -0.06 + waterPoint.y * 0.095 - shimmerTime * 0.84);
        vec2 shipScale = max(shipHalfSize, vec2(1.0));
        vec2 shipVector = waterPoint - shipCenter;
        float shipDistance = length(shipVector / shipScale);
        float shipContact = shipWakeStrength * (1.0 - smoothstep(0.62, 1.42, shipDistance)) * 0.18;
        float shipWakeBand = shipWakeStrength * (1.0 - smoothstep(0.72, 7.6, shipDistance)) * 0.16;
        float shipRipple = (sin(shipDistance * 19.0 - time * 3.95) * 0.5 + 0.5)
          * shipWakeBand
          * (0.45 + noise(waterPoint * 0.74 + vec2(shimmerTime * -0.22, shimmerTime * 0.17)) * 0.55);
        vec3 normal = oceanNormal(waterPoint);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sun = normalize(sunDirection);
        float ndv = clamp(dot(normal, viewDirection), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 3.0);
        float horizonReflection = smoothstep(0.0, 0.58, fresnel);
        float broadShade = surfaceNoise * 2.0 - 1.0;

        vec3 deep = vec3(0.012, 0.12, 0.25);
        vec3 mid = vec3(0.028, 0.29, 0.48);
        vec3 teal = vec3(0.055, 0.48, 0.62);
        vec3 shallow = vec3(0.26, 0.7, 0.76);
        float depthTint = clamp(0.45 + broadShade * 0.24 + smallNoise * 0.2 + vWave * 0.08, 0.0, 1.0);
        float mottling = noise(waterPoint * 0.045 + vec2(shimmerTime * 0.025, shimmerTime * -0.02)) * 2.0 - 1.0;
        vec3 color = mix(deep, mid, depthTint);
        color = mix(color, teal, clamp(0.26 + smallNoise * 0.24 + fineRipples * 0.08, 0.0, 0.54));
        color = mix(color, shallow, clamp(vCrest * 0.22 + max(vWave, 0.0) * 0.12, 0.0, 0.42));
        color *= 1.04 + mottling * 0.055;

        vec3 reflectedSun = reflect(-sun, normal);
        float sharpSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 96.0);
        float broadSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 18.0);
        float streakMask = smoothstep(0.48, 0.92, noise(waterPoint * vec2(0.08, 0.22) + vec2(shimmerTime * -0.08, shimmerTime * 0.18)));
        float crestMask = smoothstep(0.12, 0.62, vWave + smallNoise * 0.38);
        float crestFoam = vCrest
          * smoothstep(0.5, 0.88, noise(waterPoint * 0.16 + vec2(shimmerTime * -0.12, shimmerTime * 0.09)))
          * foamIntensity;
        float centerFoam = centerRippleFoam(waterPoint) * foamIntensity;
        float glint = (sharpSpec * 0.55 + broadSpec * 0.18) * streakMask * (0.28 + crestMask * 0.5) * reflectionStrength;
        vec3 skyReflection = mix(vec3(0.34, 0.58, 0.78), vec3(0.72, 0.9, 1.0), horizonReflection);

        color = mix(color, skyReflection, clamp((fresnel * 0.42 + crestMask * 0.08) * reflectionStrength, 0.0, 0.46));
        color += vec3(0.78, 0.9, 0.88) * glint;
        color += vec3(0.08, 0.18, 0.18) * shipRipple * 0.08;
        color = mix(color, vec3(0.72, 0.86, 0.84), clamp(wallFoam * 0.08 + crestFoam * 0.08 + centerFoam * 0.34 + shipContact * 0.06 + shipRipple * 0.04, 0.0, 0.34));

        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeFade = smoothstep(0.0, 0.055, edgeDistance);
        if (edgeFade < 0.02) {
          discard;
        }

        float alpha = mix(0.94, 1.0, clamp(fresnel + wallFoam + shipContact * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha * edgeFade);
      }
    `,
  });
}

function setupWater(root) {
  const sceneBounds = new THREE.Box3().setFromObject(root);
  const dockBounds = getMaterialBounds(root, new Set(['Material.051'])) ?? sceneBounds;
  const sceneSize = sceneBounds.getSize(new THREE.Vector3());
  const dockSize = dockBounds.getSize(new THREE.Vector3());
  const dockCenter = dockBounds.getCenter(new THREE.Vector3());
  const waterSize = Math.max(sceneSize.x, sceneSize.z, dockSize.x, dockSize.z) * WATER_SIZE_MULTIPLIER
    + WATER_SIZE_PADDING;
  const waterLevel = dockBounds.min.y + Math.max(1.1, dockSize.y * 0.12);
  const quality = WATER_SETTINGS[WATER_QUALITY] ?? WATER_SETTINGS.HIGH;

  const geometry = new THREE.PlaneGeometry(waterSize, waterSize, quality.segments, quality.segments);
  const material = createWaterMaterial(dockBounds);
  water = new THREE.Mesh(geometry, material);
  water.name = 'surrounding_water';
  water.rotation.x = -Math.PI / 2;
  water.position.set(dockCenter.x, waterLevel, dockCenter.z);
  water.renderOrder = -1;
  scene.add(water);
}

function updateWater(elapsedSeconds) {
  if (!water) return;
  water.material.uniforms.time.value = elapsedSeconds * WATER_ANIMATION_SPEED;
  water.material.uniforms.shimmerTime.value = elapsedSeconds * WATER_SHIMMER_SPEED;
}

function createShipWakeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform float time;

      float hash(vec2 point) {
        vec3 p = fract(vec3(point.xyx) * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        vec2 curve = local * local * (3.0 - 2.0 * local);

        float a = hash(cell);
        float b = hash(cell + vec2(1.0, 0.0));
        float c = hash(cell + vec2(0.0, 1.0));
        float d = hash(cell + vec2(1.0, 1.0));

        return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
      }

      void main() {
        vec2 point = (vUv - 0.5) * 2.0;
        float ellipse = length(point / vec2(0.92, 0.34));
        float contactFoam = smoothstep(0.42, 0.82, ellipse) * (1.0 - smoothstep(0.82, 1.38, ellipse));
        float rippleRings = (sin(ellipse * 27.0 - time * 3.25) * 0.5 + 0.5)
          * smoothstep(0.52, 0.78, ellipse)
          * (1.0 - smoothstep(0.78, 2.45, ellipse));
        float broken = noise(point * 8.0 + vec2(time * 0.3, -time * 0.18));
        float edgeFade = 1.0 - smoothstep(1.55, 2.55, ellipse);
        float alpha = (contactFoam * 0.62 + rippleRings * 0.4) * edgeFade * (0.48 + broken * 0.52);

        if (alpha < 0.01) {
          discard;
        }

        gl_FragColor = vec4(0.78, 0.95, 0.92, alpha);
      }
    `,
  });
}

function isChildOf(object, possibleParent) {
  let current = object.parent;
  while (current) {
    if (current === possibleParent) return true;
    current = current.parent;
  }
  return false;
}

function materialLooksLikeShipPart(material) {
  const name = material?.name?.toLowerCase() ?? '';
  return name.startsWith('acmat_') && !name.startsWith('acmat_53.');
}

function meshLooksLikeShipPart(object) {
  return object.isMesh && materialsForObject(object).some(materialLooksLikeShipPart);
}

function attachStaticShipMeshesToController(root, controller) {
  const shipMeshes = [];

  root.traverse((object) => {
    if (object === controller || isChildOf(object, controller)) return;
    if (materialsForObject(object).some((material) => material?.name?.toLowerCase().startsWith('acmat_53.'))) {
      object.visible = false;
      return;
    }
    if (meshLooksLikeShipPart(object)) {
      shipMeshes.push(object);
    }
  });

  if (shipMeshes.length === 0) {
    console.warn('No static ship meshes found to attach to ship-controller.');
    return;
  }

  controller.updateWorldMatrix(true, true);
  for (const mesh of shipMeshes) {
    controller.attach(mesh);
  }
}

function findFloatingShipRoot(root) {
  let shipController = null;
  let namedShipObject = null;
  let vesselMesh = null;
  let sketchfabVessel = null;

  root.traverse((object) => {
    const name = baseObjectName(object.name);
    const rawName = object.name.toLowerCase();
    const normalizedName = normalizeObjectKey(object.name);
    const usesVesselMaterial = materialsForObject(object).some((material) =>
      material?.name?.toLowerCase().startsWith('acmat_')
    );

    if (normalizedName === 'ship_controller' || normalizedName.startsWith('ship_controller_')) {
      shipController = object;
      return;
    }

    if (normalizedName === 'ship_object' || normalizedName.startsWith('ship_object_')) {
      namedShipObject = object;
      return;
    }

    if (name.includes('multi-purpose') || name.includes('vessel') || usesVesselMaterial) {
      vesselMesh = object;
    }

    if (rawName === 'sketchfab_model.001' || rawName === 'sketchfab_model_1') {
      sketchfabVessel = object;
    }
  });

  if (shipController) return shipController;
  if (namedShipObject) return namedShipObject;
  if (sketchfabVessel) return sketchfabVessel;
  if (!vesselMesh) return null;

  let object = vesselMesh;
  while (object.parent && object.parent !== root) {
    object = object.parent;
  }

  if (object === root || baseObjectName(object.name).includes('dockyard_static_scene')) {
    return null;
  }

  return object;
}

function setupFloatingShip(root) {
  const shipRoot = findFloatingShipRoot(root);
  if (!shipRoot) {
    console.warn('No floating ship group found.');
    return;
  }

  attachStaticShipMeshesToController(root, shipRoot);
  shipRoot.updateWorldMatrix(true, true);
  shipBounds.setFromObject(shipRoot);
  shipBounds.getSize(shipBoundsSize);

  floatingShip = {
    object: shipRoot,
    basePosition: shipRoot.position.clone(),
    baseQuaternion: shipRoot.quaternion.clone(),
    phase: Math.random() * Math.PI * 2,
  };

  if (import.meta.env.DEV) {
    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getFloatingShipSnapshot: () => ({
        name: floatingShip.object.name,
        position: floatingShip.object.position.toArray(),
        quaternion: floatingShip.object.quaternion.toArray(),
        children: floatingShip.object.children.map((child) => child.name),
        childCount: floatingShip.object.children.length,
      }),
      getObjectSnapshot: (name) => {
        let match = null;
        modelRoot?.traverse((object) => {
          if (object.name === name) {
            match = object;
          }
        });
        if (!match) return null;
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        match.getWorldPosition(worldPosition);
        match.getWorldQuaternion(worldQuaternion);
        return {
          name: match.name,
          parent: match.parent?.name ?? null,
          localPosition: match.position.toArray(),
          worldPosition: worldPosition.toArray(),
          localQuaternion: match.quaternion.toArray(),
          worldQuaternion: worldQuaternion.toArray(),
        };
      },
      listSceneObjects: () => {
        const objects = [];
        modelRoot?.traverse((object) => {
          const materials = materialsForObject(object).map((material) => material?.name).filter(Boolean);
          const childNames = object.children.map((child) => child.name);
          objects.push({
            name: object.name,
            type: object.type,
            isMesh: object.isMesh,
            hasGeometry: Boolean(object.geometry),
            materialNames: materials,
            childNames,
          });
        });
        return objects;
      },
    };
  }

  updateShipWaterInteraction();
}

function updateShipWaterInteraction() {
  if (!water || !floatingShip) return;

  shipBounds.setFromObject(floatingShip.object);
  shipBounds.getSize(shipBoundsSize);
  shipBounds.getCenter(shipBoundsCenter);

  water.material.uniforms.shipCenter.value.set(shipBoundsCenter.x, shipBoundsCenter.z);
  water.material.uniforms.shipHalfSize.value.set(
    Math.max(shipBoundsSize.x * 0.5 + SHIP_WAKE_PADDING * 1.6, 1),
    Math.max(shipBoundsSize.z * 0.5 + SHIP_WAKE_PADDING * 1.6, 1),
  );
  water.material.uniforms.shipWakeStrength.value = 0.18;

  if (shipWake) {
    const wakeLength = THREE.MathUtils.clamp(
      Math.max(shipBoundsSize.x, shipBoundsSize.z) + SHIP_WAKE_PADDING * 8,
      54,
      128,
    );
    const wakeWidth = THREE.MathUtils.clamp(
      Math.min(shipBoundsSize.x, shipBoundsSize.z) + SHIP_WAKE_PADDING * 6,
      34,
      76,
    );
    const shipRunsAlongX = shipBoundsSize.x >= shipBoundsSize.z;

    shipWake.position.set(shipBoundsCenter.x, water.position.y + 0.04, shipBoundsCenter.z);
    shipWake.scale.set(
      shipRunsAlongX ? wakeLength : wakeWidth,
      shipRunsAlongX ? wakeWidth : wakeLength,
      1,
    );
  }
}

function getShipIntroStartOffset() {
  if (!floatingShip) {
    return null;
  }

  const { object, basePosition } = floatingShip;
  const parent = object.parent;
  const finalWorldPosition = parent
    ? parent.localToWorld(basePosition.clone())
    : basePosition.clone();
  const behindDirection = finalWorldPosition.clone().sub(camera.position);

  behindDirection.y = 0;
  if (behindDirection.lengthSq() < 0.0001) {
    behindDirection.set(0, 0, -1);
  }
  behindDirection.normalize().multiplyScalar(SHIP_INTRO_START_DISTANCE);

  const startWorldPosition = finalWorldPosition.clone().add(behindDirection);
  const startLocalPosition = parent
    ? parent.worldToLocal(startWorldPosition)
    : startWorldPosition;

  return startLocalPosition.sub(basePosition);
}

function getShipIntroOffset() {
  const startOffset = introCameraAnimation?.shipStartOffset;
  if (!startOffset) {
    return null;
  }

  const progress = THREE.MathUtils.clamp(
    introCameraAnimation.elapsed / introCameraAnimation.duration,
    0,
    1,
  );
  const easedProgress = easeInOutSmoother(progress);
  return startOffset.clone().multiplyScalar(1 - easedProgress);
}

function updateFloatingShip(elapsedSeconds) {
  if (!floatingShip) return;

  const { object, basePosition, baseQuaternion, phase } = floatingShip;
  const introOffset = getShipIntroOffset();
  const seaTime = elapsedSeconds * WATER_ANIMATION_SPEED * SHIP_MOTION.speed;
  const heave = Math.sin(seaTime * 0.78 + phase) * SHIP_MOTION.heave
    + Math.sin(seaTime * 1.31 + phase * 0.65) * (SHIP_MOTION.heave * 0.28);
  const sway = Math.sin(seaTime * 0.52 + phase + 1.8) * SHIP_MOTION.sway;
  const surge = Math.sin(seaTime * 0.44 + phase * 1.25) * SHIP_MOTION.surge;
  const roll = Math.sin(seaTime * 0.72 + phase * 0.4) * SHIP_MOTION.roll
    + Math.sin(seaTime * 1.18 + phase) * (SHIP_MOTION.roll * 0.34);
  const pitch = Math.sin(seaTime * 0.63 + phase + 1.2) * SHIP_MOTION.pitch
    + Math.sin(seaTime * 1.08 + phase * 0.5) * (SHIP_MOTION.pitch * 0.3);
  const yawDrift = Math.sin(seaTime * 0.32 + phase) * SHIP_MOTION.yaw;

  object.position.copy(basePosition);
  if (introOffset) {
    object.position.add(introOffset);
  }
  object.position.x += sway;
  object.position.y += SHIP_MOTION.heightOffset + heave;
  object.position.z += surge;
  shipWobbleQuaternion.setFromEuler(new THREE.Euler(pitch, yawDrift, roll, 'XYZ'));
  object.quaternion.copy(baseQuaternion).multiply(shipWobbleQuaternion);

  updateShipWaterInteraction();
  if (shipWake) {
    shipWake.material.uniforms.time.value = seaTime;
  }
}

function setupHangingLoad(root) {
  const parts = [];
  const targetObject = findStackTargetObject(root);

  root.traverse((object) => {
    if (isHangingLoadPart(object)) {
      parts.push(object);
    }
  });

  if (parts.length === 0) {
    console.warn('No hanging load objects found for swing animation.');
    return;
  }

  root.updateWorldMatrix(true, true);
  hangingLoadBounds.makeEmpty();
  for (const part of parts) {
    part.updateWorldMatrix(true, true);
    hangingLoadBounds.union(new THREE.Box3().setFromObject(part));
  }

  hangingLoadBounds.getCenter(hangingLoadPivot);
  hangingLoadPivot.y = hangingLoadBounds.max.y;

  const pivot = new THREE.Group();
  pivot.name = 'hanging_load_swing_pivot';
  root.add(pivot);
  pivot.position.copy(root.worldToLocal(hangingLoadPivot.clone()));
  pivot.updateWorldMatrix(true, false);

  for (const part of parts) {
    pivot.attach(part);
  }

  pivot.updateWorldMatrix(true, true);
  const pivotWorldPosition = new THREE.Vector3();
  const loadCenter = new THREE.Vector3();
  const loadBounds = new THREE.Box3().setFromObject(pivot);
  pivot.getWorldPosition(pivotWorldPosition);
  loadBounds.getCenter(loadCenter);
  const mountLocalPosition = loadBounds.isEmpty()
    ? new THREE.Vector3()
    : pivot.worldToLocal(new THREE.Vector3(loadCenter.x, loadBounds.min.y, loadCenter.z));
  const carrierContainers = parts.filter(isHangingContainerPart);

  hangingLoad = {
    basePosition: pivot.position.clone(),
    carrierContainers,
    carrierContainerNames: carrierContainers.map((part) => part.name),
    initialBasePosition: pivot.position.clone(),
    mountLocalPosition,
    pivot,
    baseQuaternion: pivot.quaternion.clone(),
    loadBottomOffset: loadBounds.isEmpty() ? 0 : loadBounds.min.y - pivotWorldPosition.y,
    loadCenterOffset: loadBounds.isEmpty()
      ? new THREE.Vector3()
      : loadCenter.sub(pivotWorldPosition),
    phase: Math.random() * Math.PI * 2,
    targetName: targetObject?.name ?? null,
  };

  setHangingCarrierVisible(false);

  if (import.meta.env.DEV) {
    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getHangingLoadSnapshot: () => ({
        partNames: parts.map((part) => part.name),
        hiddenCarrierNames: hangingLoad.carrierContainerNames,
        stackTargetName: targetObject?.name ?? null,
        basePosition: hangingLoad.basePosition.toArray(),
        mountLocalPosition: mountLocalPosition.toArray(),
        pivotPosition: pivot.position.toArray(),
        pivotQuaternion: pivot.quaternion.toArray(),
      }),
    };
  }
}

function setHangingCarrierVisible(isVisible) {
  if (!hangingLoad) {
    return;
  }

  for (const container of hangingLoad.carrierContainers) {
    container.visible = isVisible;
  }
}

function updateHangingCarrierVisibility() {
  setHangingCarrierVisible(false);
}

function updateHangingLoad(elapsedSeconds, deltaSeconds) {
  if (!hangingLoad) return;

  const { pivot, baseQuaternion, phase } = hangingLoad;
  updateHangingLoadPosition(deltaSeconds);

  const loadTime = elapsedSeconds * HANGING_LOAD_MOTION.speed;
  const sideToSideSwing = Math.sin(loadTime + phase) * HANGING_LOAD_MOTION.sideToSideSwing
    + Math.sin(loadTime * 1.63 + phase * 0.42) * HANGING_LOAD_MOTION.gustSwing;
  const frontBackSwing = Math.sin(loadTime * 0.74 + phase + 1.35) * HANGING_LOAD_MOTION.frontBackSwing
    + Math.sin(loadTime * 1.27 + phase * 0.61) * HANGING_LOAD_MOTION.gustSwing * 0.55;

  hangingLoadQuaternion.setFromEuler(new THREE.Euler(frontBackSwing, 0, sideToSideSwing, 'XYZ'));
  pivot.quaternion.copy(baseQuaternion).multiply(hangingLoadQuaternion);
}

function updateHangingLoadPosition(deltaSeconds) {
  if (!hangingLoad) {
    return;
  }

  const frameDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
  const readyPosition = getHangingLoadBasePosition();
  hangingLoad.basePosition.copy(getHangingLoadHoistPosition(readyPosition, frameDelta));

  if (hangingLoad.hoistCycle) {
    hangingLoad.pivot.position.copy(hangingLoad.basePosition);
    return;
  }

  const smoothing = 1 - Math.exp(-frameDelta * HANGING_LOAD_CAMERA_FOLLOW_SPEED);
  hangingLoad.pivot.position.lerp(hangingLoad.basePosition, smoothing);
}

function getHangingLoadBasePosition() {
  const position = hangingLoad.initialBasePosition.clone();
  position.y += getHangingLoadStackLift(position);
  return position;
}

function getHangingLoadStackLift(basePosition) {
  const nextPart = stackParts[stackIndex];
  if (!nextPart || !stackAnchor.group) {
    return 0;
  }

  const carrierPoint = getHangingLoadCarrierPoint(basePosition);
  if (!carrierPoint) {
    return 0;
  }

  const desiredBottomPoint = getStackWorldPoint(0, nextPart.finalY + STACK_DROP_HEIGHT, 0);
  return Math.max(0, desiredBottomPoint.y - carrierPoint.bottomY);
}

function getHangingLoadHoistPosition(readyPosition, deltaSeconds) {
  const cycle = hangingLoad?.hoistCycle;
  if (!cycle) {
    return readyPosition;
  }

  if (cycle.phase === 'held') {
    const offscreenPosition = getHangingLoadOffscreenPosition(readyPosition);
    if (offscreenPosition.y > cycle.targetPosition.y) {
      cycle.targetPosition.copy(offscreenPosition);
    }
    return cycle.targetPosition;
  }

  cycle.elapsed += deltaSeconds;
  const progress = THREE.MathUtils.clamp(cycle.elapsed / cycle.duration, 0, 1);
  const easedProgress = easeInOutSmoother(progress);
  const position = cycle.startPosition.clone().lerp(cycle.targetPosition, easedProgress);

  if (progress < 1) {
    return position;
  }

  if (cycle.phase === 'retracting') {
    cycle.phase = 'held';
    cycle.elapsed = 0;
    cycle.startPosition.copy(cycle.targetPosition);

    const onHeld = cycle.onHeld;
    cycle.onHeld = null;
    if (onHeld) {
      onHeld();
      return getHangingLoadHoistPosition(readyPosition, 0);
    }

    return cycle.targetPosition;
  }

  const onComplete = cycle.onComplete;
  hangingLoad.hoistCycle = null;
  onComplete?.();
  return position;
}

function getHangingLoadOffscreenPosition(readyPosition) {
  const position = readyPosition.clone();
  const minimumLift = Math.max(HANGING_LOAD_OFFSCREEN_MIN_LIFT, getStackBlockHeight() * HANGING_LOAD_OFFSCREEN_BLOCK_LIFT);
  let lift = minimumLift;

  while (lift <= HANGING_LOAD_OFFSCREEN_MAX_LIFT) {
    const candidate = position.clone();
    candidate.y += lift;

    if (isHangingLoadAboveVisibleFrame(candidate)) {
      return candidate;
    }

    lift *= 1.35;
  }

  position.y += HANGING_LOAD_OFFSCREEN_MAX_LIFT;
  return position;
}

function isHangingLoadAboveVisibleFrame(pivotPosition) {
  const bottomPoint = getHangingLoadBottomWorldPoint(pivotPosition);
  if (!bottomPoint) {
    return false;
  }

  const projectedY = getProjectedY(bottomPoint);
  return Number.isFinite(projectedY) && projectedY >= HANGING_LOAD_OFFSCREEN_PROJECTED_Y;
}

function getHangingLoadBottomWorldPoint(pivotPosition) {
  const carrierPoint = getHangingLoadCarrierPoint(pivotPosition);
  if (!carrierPoint) {
    return null;
  }

  return new THREE.Vector3(carrierPoint.center.x, carrierPoint.bottomY, carrierPoint.center.z);
}

function isHangingLoadHoisting() {
  return Boolean(hangingLoad?.hoistCycle);
}

function easeInOutSmoother(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function startHangingLoadRetract() {
  if (!hangingLoad) {
    return;
  }

  const readyPosition = getHangingLoadBasePosition();
  const startPosition = hangingLoad.pivot.position.clone();
  const targetPosition = getHangingLoadOffscreenPosition(readyPosition);

  if (targetPosition.y <= startPosition.y) {
    targetPosition.y = startPosition.y + Math.max(HANGING_LOAD_OFFSCREEN_MIN_LIFT, getStackBlockHeight());
  }

  hangingLoad.hoistCycle = {
    duration: HANGING_LOAD_RETRACT_SECONDS,
    elapsed: 0,
    onHeld: null,
    phase: 'retracting',
    startPosition,
    targetPosition,
  };
  updateHangingCarrierVisibility();
}

function settleHangingLoadAfterDrop() {
  const hasNextPart = stackIndex < stackParts.length && stackIndex < gameState.maxFloor;
  if (!hasNextPart) {
    return waitForHangingLoadRetracted();
  }

  return lowerHangingLoadWithNextBlock();
}

function waitForHangingLoadRetracted() {
  if (!hangingLoad?.hoistCycle || hangingLoad.hoistCycle.phase !== 'retracting') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    runWhenHangingLoadHeld(resolve);
  });
}

function lowerHangingLoadWithNextBlock() {
  if (!hangingLoad) {
    mountNextStackPart();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    runWhenHangingLoadHeld(() => {
      const targetPosition = getHangingLoadBasePosition();
      const startPosition = hangingLoad.hoistCycle?.targetPosition.clone()
        ?? getHangingLoadOffscreenPosition(targetPosition);

      hangingLoad.pivot.position.copy(startPosition);
      mountNextStackPart({ snapHangingLoadToBase: false });
      hangingLoad.hoistCycle = {
        duration: HANGING_LOAD_DESCEND_SECONDS,
        elapsed: 0,
        onComplete: resolve,
        phase: 'descending',
        startPosition,
        targetPosition,
      };
      updateHangingCarrierVisibility();
      setGameStatus('Next block incoming');
    });
  });
}

function runWhenHangingLoadHeld(callback) {
  const cycle = hangingLoad?.hoistCycle;
  if (!cycle || cycle.phase !== 'retracting') {
    callback();
    return;
  }

  const previousOnHeld = cycle.onHeld;
  cycle.onHeld = () => {
    previousOnHeld?.();
    callback();
  };
}

function getHangingLoadCarrierPoint(pivotPosition = hangingLoad?.pivot.position) {
  if (!hangingLoad || !pivotPosition) {
    return null;
  }

  const pivotWorldPosition = hangingLoad.pivot.parent
    ? hangingLoad.pivot.parent.localToWorld(pivotPosition.clone())
    : pivotPosition.clone();

  return {
    bottomY: pivotWorldPosition.y + hangingLoad.loadBottomOffset,
    center: pivotWorldPosition.clone().add(hangingLoad.loadCenterOffset),
  };
}

function baseObjectName(name) {
  return name.replace(/\.\d+$/, '').toLowerCase();
}

function normalizeObjectKey(name) {
  return baseObjectName(name).replace(/[\s.-]+/g, '_');
}

function getObjectLookupKeys(name) {
  const rawName = name.trim().toLowerCase();

  return new Set([
    rawName,
    rawName.replace(/[\s-]+/g, '_'),
    rawName.replace(/[\s.-]+/g, '_'),
    rawName.replace(/[\s._-]+/g, ''),
    normalizeObjectKey(name),
  ]);
}

function objectHasLookupKey(object, targetKey) {
  return getObjectLookupKeys(object.name).has(targetKey);
}

function isHangingLoadPart(object) {
  const objectKeys = getObjectLookupKeys(object.name);
  const isPlacementTarget =
    objectKeys.has('hangingcontainer001') ||
    objectKeys.has('hanging_container_001') ||
    objectKeys.has('hangingcontainer.001') ||
    objectKeys.has('hanging_container001');

  if (isPlacementTarget) {
    return false;
  }

  return [...HANGING_LOAD_OBJECT_KEYS].some((key) => objectKeys.has(key));
}

function isHangingContainerPart(object) {
  const objectKeys = getObjectLookupKeys(object.name);
  return [...HANGING_CONTAINER_OBJECT_KEYS].some((key) => objectKeys.has(key));
}

function findStackTargetObject(root) {
  let bestTarget = null;
  let bestPriority = Number.POSITIVE_INFINITY;

  root.traverse((object) => {
    for (let index = 0; index < STACK_TARGET_OBJECT_KEYS.length; index += 1) {
      if (index >= bestPriority) {
        break;
      }

      if (objectHasLookupKey(object, STACK_TARGET_OBJECT_KEYS[index])) {
        bestTarget = object;
        bestPriority = index;
        break;
      }
    }
  });

  return bestTarget;
}

function materialsForObject(object) {
  if (!object.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
}

async function setupFallingBlockStack(loader) {
  stackParts = [];
  stackIndex = 0;
  activeDrop = null;

  const loadedTemplates = await Promise.all(
    STACK_BLOCK_DEFINITIONS.map(async (definition) => {
      const gltf = await loader.loadAsync(getAssetUrl(definition.url));
      return {
        definition,
        object: createFallingBlockTemplate(gltf.scene, definition),
      };
    }),
  );
  const templates = loadedTemplates.filter((template) => Boolean(template.object));

  if (!templates.length) {
    throw new Error('No usable falling block meshes were found.');
  }

  let nextTopY = stackAnchor.topY;

  for (let index = 0; index < TOTAL_STACK_BLOCKS; index += 1) {
    const template = templates[index % templates.length];
    const object = template.object.clone(true);
    const label = `Block ${index + 1} (${template.definition.label})`;

    object.name = label;
    prepareFallingBlockObject(object);
    getStackParent().add(object);
    object.visible = false;

    const finalY = placePartOnStack(object, nextTopY - STACK_VERTICAL_OVERLAP);
    const finalBox = getObjectParentSpaceBox(object);
    nextTopY = finalBox.max.y;

    stackParts.push({
      baseRotationX: object.rotation.x,
      baseRotationY: object.rotation.y,
      baseRotationZ: object.rotation.z,
      baseScale: object.scale.clone(),
      baseX: object.position.x,
      baseZ: object.position.z,
      finalY,
      label,
      object,
      topY: finalBox.max.y,
    });
  }

  resetStackPool();
  if (gameState.completedFloorCount > 0) {
    restoreCompletedStack(gameState.completedFloorCount);
  } else {
    mountNextStackPart();
  }
  installStackDebugHelpers();
}

function createFallingBlockTemplate(source, definition) {
  const group = new THREE.Group();
  group.name = `${definition.label} template`;
  source.updateWorldMatrix(true, true);

  source.traverse((object) => {
    if (!isFallingBlockMesh(object)) {
      return;
    }

    const mesh = object.clone(true);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.applyMatrix4(object.matrixWorld);
    group.add(mesh);
  });

  if (!group.children.length) {
    console.warn(`${definition.label} did not contain a container mesh.`);
    return null;
  }

  normalizeObjectToBottomCenter(group);
  group.scale.setScalar(STACK_BLOCK_SCALE);
  prepareFallingBlockObject(group);

  return group;
}

function isFallingBlockMesh(object) {
  if (!object.isMesh || !object.geometry) {
    return false;
  }

  const key = normalizeObjectKey(object.name);
  if (SKYBOX_OBJECT_NAMES.has(key) || key.includes('sky') || key.includes('ground')) {
    return false;
  }

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  if (Math.max(size.x, size.y, size.z) > 40) {
    return false;
  }

  return materialsForObject(object).some((material) => {
    const materialName = material?.name?.toLowerCase() ?? '';
    return materialName.startsWith('container');
  });
}

function normalizeObjectToBottomCenter(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const bottomCenter = new THREE.Vector3(
    (box.min.x + box.max.x) * 0.5,
    box.min.y,
    (box.min.z + box.max.z) * 0.5,
  );

  for (const child of object.children) {
    child.position.sub(bottomCenter);
  }

  object.updateMatrixWorld(true);
}

function prepareFallingBlockObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
  });
}

function measureDockyardStackAnchor(root) {
  root.updateWorldMatrix(true, true);

  const targetObject = findStackTargetObject(root);
  if (targetObject) {
    const targetBox = getObjectWorldBox(targetObject);

    if (!targetBox.isEmpty()) {
      return createStackAnchorFromTargetObject(root, targetObject, targetBox);
    }
  }

  const box = new THREE.Box3();
  let hasContainerStack = false;

  root.traverse((object) => {
    if (!isDockyardStackAnchorMesh(object)) {
      return;
    }

    const objectBox = new THREE.Box3().setFromObject(object);
    if (objectBox.isEmpty()) {
      return;
    }

    box.union(objectBox);
    hasContainerStack = true;
  });

  if (!hasContainerStack) {
    console.warn('No dockyard container stack found. Using the measured scene bounds.');
    box.setFromObject(root);
  }

  return createStackAnchorFromBox(box, null);
}

function getObjectWorldBox(object) {
  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    return box;
  }

  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);
  box.set(worldPosition, worldPosition);
  return box;
}

function createStackAnchorFromTargetObject(root, targetObject, targetBox) {
  const anchorParent = targetObject ?? root ?? scene;
  const topFaceWorldCenter = getObjectTopFaceWorldCenter(targetObject, targetBox);
  const anchorParentPosition = anchorParent.worldToLocal(topFaceWorldCenter.clone());
  const anchorGroup = new THREE.Group();

  anchorGroup.name = `stack_follow_anchor_${normalizeObjectKey(targetObject.name)}`;
  anchorGroup.position.copy(anchorParentPosition);
  anchorParent.add(anchorGroup);
  cancelInheritedWorldScale(anchorGroup, anchorParent);
  anchorGroup.updateWorldMatrix(true, true);
  const topFaceExtents = getObjectTopFaceExtentsInAnchorSpace(targetObject, anchorGroup, targetBox);

  return {
    center: new THREE.Vector3(0, 0, 0),
    group: anchorGroup,
    halfWidthX: topFaceExtents.x,
    halfWidthZ: topFaceExtents.z,
    targetName: targetObject.name,
    topY: 0,
  };
}

function cancelInheritedWorldScale(object, parent) {
  const parentScale = new THREE.Vector3();
  parent.getWorldScale(parentScale);
  object.scale.set(
    parentScale.x ? 1 / parentScale.x : 1,
    parentScale.y ? 1 / parentScale.y : 1,
    parentScale.z ? 1 / parentScale.z : 1,
  );
}

function getObjectTopFaceWorldCenter(object, fallbackBox) {
  if (object.isMesh && object.geometry) {
    object.geometry.computeBoundingBox();
    const localBox = object.geometry.boundingBox;

    if (localBox) {
      return new THREE.Vector3(
        (localBox.min.x + localBox.max.x) * 0.5,
        localBox.max.y,
        (localBox.min.z + localBox.max.z) * 0.5,
      ).applyMatrix4(object.matrixWorld);
    }
  }

  const fallbackCenter = fallbackBox.getCenter(new THREE.Vector3());
  return new THREE.Vector3(fallbackCenter.x, fallbackBox.max.y, fallbackCenter.z);
}

function getObjectTopFaceExtentsInAnchorSpace(object, anchorGroup, fallbackBox) {
  if (object.isMesh && object.geometry) {
    object.geometry.computeBoundingBox();
    const localBox = object.geometry.boundingBox;

    if (localBox) {
      const anchorPoints = [
        new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.min.z),
        new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.min.z),
        new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.max.z),
        new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.max.z),
      ].map((point) => anchorGroup.worldToLocal(point.applyMatrix4(object.matrixWorld)));

      const extents = anchorPoints.reduce(
        (extents, point) => ({
          x: Math.max(extents.x, Math.abs(point.x)),
          z: Math.max(extents.z, Math.abs(point.z)),
        }),
        { x: 0, z: 0 },
      );

      return {
        x: Math.max(extents.x, 0.1),
        z: Math.max(extents.z, 0.1),
      };
    }
  }

  const fallbackSize = fallbackBox.getSize(new THREE.Vector3());
  return {
    x: Math.max(fallbackSize.x * 0.5, STACK_RANDOM_X_RANGE),
    z: Math.max(fallbackSize.z * 0.5, STACK_RANDOM_Z_RANGE),
  };
}

function createStackAnchorFromBox(box, targetName) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const anchorGroup = new THREE.Group();

  anchorGroup.name = targetName
    ? `stack_follow_anchor_${normalizeObjectKey(targetName)}`
    : 'stack_follow_anchor_fallback';
  anchorGroup.position.set(center.x, box.max.y, center.z);
  scene.add(anchorGroup);
  anchorGroup.updateWorldMatrix(true, true);

  return {
    center: new THREE.Vector3(0, 0, 0),
    group: anchorGroup,
    halfWidthX: size.x / 2,
    halfWidthZ: size.z / 2,
    targetName,
    topY: 0,
  };
}

function isDockyardStackAnchorMesh(object) {
  if (!object.isMesh || !object.visible) {
    return false;
  }

  const name = baseObjectName(object.name);
  if (!name.startsWith('dockyard_static_scene') || name.includes('truck') || name.includes('hanging')) {
    return false;
  }

  return materialsForObject(object).some((material) => {
    const materialName = material?.name?.toLowerCase() ?? '';
    return /^container[1-5]$/.test(materialName);
  });
}

function placePartOnStack(object, targetBottomY) {
  return placeObjectParentBottomCenter(object, stackAnchor.center.x, stackAnchor.center.z, targetBottomY);
}

function getStackParent() {
  return stackAnchor.group ?? scene;
}

function attachPartToStack(part) {
  const parent = getStackParent();

  if (part.object.parent === parent) {
    return;
  }

  if (part.object.parent) {
    parent.attach(part.object);
  } else {
    parent.add(part.object);
  }
}

function getObjectParentSpaceBox(object) {
  object.updateWorldMatrix(true, true);

  const parentMatrixInverse = object.parent
    ? new THREE.Matrix4().copy(object.parent.matrixWorld).invert()
    : new THREE.Matrix4();
  const box = new THREE.Box3();

  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) {
      return;
    }

    child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) {
      return;
    }

    const childBox = child.geometry.boundingBox.clone();
    childBox.applyMatrix4(child.matrixWorld);
    childBox.applyMatrix4(parentMatrixInverse);
    box.union(childBox);
  });

  if (box.isEmpty()) {
    box.set(object.position, object.position);
  }

  return box;
}

function placeObjectParentBottomCenter(object, targetX, targetZ, targetBottomY) {
  const box = getObjectParentSpaceBox(object);
  const center = box.getCenter(new THREE.Vector3());

  object.position.x += targetX - center.x;
  object.position.z += targetZ - center.z;
  object.position.y += targetBottomY - box.min.y;
  object.updateMatrixWorld(true);

  return object.position.y;
}

function placeObjectWorldBottomCenter(object, targetX, targetZ, targetBottomY) {
  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const currentWorldPosition = new THREE.Vector3();
  const targetWorldPosition = new THREE.Vector3();

  object.getWorldPosition(currentWorldPosition);
  targetWorldPosition.copy(currentWorldPosition);
  targetWorldPosition.x += targetX - center.x;
  targetWorldPosition.z += targetZ - center.z;
  targetWorldPosition.y += targetBottomY - box.min.y;

  object.position.copy(
    object.parent ? object.parent.worldToLocal(targetWorldPosition) : targetWorldPosition,
  );
  object.updateMatrixWorld(true);

  return object.position.y;
}

function getStackWorldPoint(localX, localY, localZ) {
  const point = new THREE.Vector3(localX, localY, localZ);
  return stackAnchor.group ? stackAnchor.group.localToWorld(point) : point;
}

function getObjectBottomCenter(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  return new THREE.Vector3(center.x, box.min.y, center.z);
}

function restoreCompletedStack(completedBlockCount) {
  resetStackPool();
  const visibleCount = THREE.MathUtils.clamp(
    completedBlockCount,
    0,
    Math.min(gameState.maxFloor, stackParts.length),
  );

  for (let index = 0; index < visibleCount; index += 1) {
    const part = stackParts[index];
    attachPartToStack(part);
    part.object.visible = true;
    part.object.rotation.set(part.baseRotationX, part.baseRotationY, part.baseRotationZ);
    part.object.scale.copy(part.baseScale);
    placePartOnStack(part.object, part.finalY);
    currentStackTopY = Math.max(currentStackTopY, part.topY);
  }

  stackIndex = visibleCount;
  mountNextStackPart();
  updateControls();
}

function resetStackPool() {
  mountedStackPart = null;

  for (const part of stackParts) {
    attachPartToStack(part);

    part.object.visible = false;
    part.object.rotation.set(part.baseRotationX, part.baseRotationY, part.baseRotationZ);
    part.object.scale.copy(part.baseScale);
    placePartOnStack(part.object, part.finalY);
    part.object.updateMatrixWorld(true);
  }

  stackIndex = 0;
  activeDrop = null;
  blockHandoffInProgress = false;
  currentStackTopY = stackAnchor.topY;
  if (hangingLoad) {
    hangingLoad.hoistCycle = null;
    hangingLoad.pivot.position.copy(getHangingLoadBasePosition());
    hangingLoad.pivot.quaternion.copy(hangingLoad.baseQuaternion);
  }
  updateHangingCarrierVisibility();
  clearLandingImpact();
  clearDustParticles();
}

function mountNextStackPart({ snapHangingLoadToBase = true } = {}) {
  if (
    !hangingLoad ||
    activeDrop ||
    collapsingBlocks.length > 0 ||
    stackIndex >= stackParts.length ||
    stackIndex >= gameState.maxFloor
  ) {
    mountedStackPart = null;
    updateHangingCarrierVisibility();
    return null;
  }

  const part = stackParts[stackIndex];
  if (mountedStackPart && mountedStackPart !== part && mountedStackPart.object.parent === hangingLoad.pivot) {
    mountedStackPart.object.visible = false;
    attachPartToStack(mountedStackPart);
  }

  hangingLoad.basePosition.copy(getHangingLoadBasePosition());
  if (snapHangingLoadToBase) {
    hangingLoad.pivot.position.copy(hangingLoad.basePosition);
  }

  if (part.object.parent !== hangingLoad.pivot) {
    hangingLoad.pivot.attach(part.object);
  }

  part.object.visible = true;
  part.object.position.copy(hangingLoad.mountLocalPosition);
  part.object.rotation.set(part.baseRotationX, part.baseRotationY, part.baseRotationZ);
  part.object.scale.copy(part.baseScale);
  part.object.updateMatrixWorld(true);
  mountedStackPart = part;
  updateHangingCarrierVisibility();

  return part;
}

function detachMountedStackPart(part) {
  if (mountedStackPart === part) {
    mountedStackPart = null;
    updateHangingCarrierVisibility();
  }

  if (part.object.parent !== scene) {
    scene.attach(part.object);
  }

  part.object.updateMatrixWorld(true);
  return getObjectBottomCenter(part.object);
}

function animateNextBlock(shouldCollapse) {
  if (activeDrop || stackIndex >= stackParts.length || stackIndex >= gameState.maxFloor) {
    return Promise.resolve();
  }

  const part = stackParts[stackIndex];
  const xRange = Math.min(STACK_RANDOM_X_RANGE, stackAnchor.halfWidthX);
  const zRange = Math.min(STACK_RANDOM_Z_RANGE, stackAnchor.halfWidthZ);
  const finalX = part.baseX + THREE.MathUtils.randFloatSpread(xRange * 2);
  const finalZ = part.baseZ + THREE.MathUtils.randFloatSpread(zRange * 2);

  return new Promise((resolve) => {
    blockHandoffInProgress = true;
    updateHangingCarrierVisibility();
    const mountedPart = mountedStackPart === part ? mountedStackPart : mountNextStackPart();
    let startBottomCenter = null;

    if (mountedPart) {
      startBottomCenter = detachMountedStackPart(mountedPart);
    } else {
      const fallbackStartPoint = getStackWorldPoint(finalX, part.finalY + STACK_DROP_HEIGHT, finalZ);
      part.object.visible = true;
      placeObjectWorldBottomCenter(part.object, fallbackStartPoint.x, fallbackStartPoint.z, fallbackStartPoint.y);
      startBottomCenter = getObjectBottomCenter(part.object);
    }

    const startRotationX = part.object.rotation.x;
    const startRotationY = part.object.rotation.y;
    const startRotationZ = part.object.rotation.z;
    const finalRotationY =
      part.baseRotationY +
      THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(STACK_RANDOM_Y_ROTATION_DEGREES * 2));
    currentStackTopY = Math.max(currentStackTopY, part.topY);
    activeDrop = {
      baseRotationX: part.baseRotationX,
      baseRotationZ: part.baseRotationZ,
      baseScale: part.object.scale.clone(),
      elapsed: 0,
      finalRotationY,
      finalX,
      finalZ,
      hasImpacted: false,
      onSettled: resolve,
      part,
      phase: 'falling',
      shouldCollapse,
      startBottomY: startBottomCenter.y,
      startRotationX,
      startRotationY,
      startRotationZ,
      startX: startBottomCenter.x,
      startZ: startBottomCenter.z,
      swingDirection: Math.random() < 0.5 ? -1 : 1,
      swingPhase: Math.random() * Math.PI * 2,
    };
    blockHandoffInProgress = false;
    stackIndex += 1;
    startHangingLoadRetract();
    updateHangingCarrierVisibility();
    updateControls();
    setGameStatus('Block in motion');
  });
}

function updateStackAnimation(delta) {
  if (!activeDrop) {
    return;
  }

  const drop = activeDrop;
  drop.elapsed += delta;

  const progress = Math.min(drop.elapsed / STACK_DROP_SECONDS, 1);
  const fallProgress = Math.min(progress / STACK_CONTACT_PROGRESS, 1);
  const gravityProgress = fallProgress * fallProgress;
  const finalPoint = getStackWorldPoint(drop.finalX, drop.part.finalY, drop.finalZ);
  const fallX = THREE.MathUtils.lerp(drop.startX, finalPoint.x, fallProgress);
  const fallZ = THREE.MathUtils.lerp(drop.startZ, finalPoint.z, fallProgress);
  const fallBottomY = THREE.MathUtils.lerp(drop.startBottomY, finalPoint.y, gravityProgress);
  const swing =
    THREE.MathUtils.degToRad(STACK_SWING_DEGREES) *
    Math.sin(drop.swingPhase + fallProgress * Math.PI * 2.2) *
    Math.pow(1 - fallProgress, 0.7);
  drop.part.object.rotation.x = THREE.MathUtils.lerp(drop.startRotationX, drop.baseRotationX, fallProgress) + swing;
  drop.part.object.rotation.y = THREE.MathUtils.lerp(drop.startRotationY, drop.finalRotationY, fallProgress);
  drop.part.object.rotation.z =
    THREE.MathUtils.lerp(drop.startRotationZ, drop.baseRotationZ, fallProgress) +
    swing * 0.55 * drop.swingDirection;
  placeObjectWorldBottomCenter(drop.part.object, fallX, fallZ, fallBottomY);

  if (progress >= STACK_CONTACT_PROGRESS) {
    if (!drop.hasImpacted) {
      drop.hasImpacted = true;
      triggerLandingImpact(drop.part, drop.shouldCollapse);
    }

    const impactProgress = (progress - STACK_CONTACT_PROGRESS) / (1 - STACK_CONTACT_PROGRESS);
    const compression = Math.sin(impactProgress * Math.PI) * STACK_IMPACT_COMPRESSION;
    drop.part.object.scale.set(
      drop.baseScale.x * (1 + compression * 0.45),
      drop.baseScale.y * (1 - compression),
      drop.baseScale.z * (1 + compression * 0.45),
    );
  }

  if (progress >= 1) {
    drop.part.object.rotation.x = drop.baseRotationX;
    drop.part.object.rotation.y = drop.finalRotationY;
    drop.part.object.rotation.z = drop.baseRotationZ;
    drop.part.object.scale.copy(drop.baseScale);
    const settledPoint = getStackWorldPoint(drop.finalX, drop.part.finalY, drop.finalZ);
    placeObjectWorldBottomCenter(drop.part.object, settledPoint.x, settledPoint.z, settledPoint.y);
    activeDrop = null;

    if (drop.shouldCollapse) {
      drop.part.object.rotation.z += THREE.MathUtils.degToRad(
        BAD_LANDING_TILT_DEGREES * (Math.random() < 0.5 ? -1 : 1),
      );
      collapseSettled = drop.onSettled;
      startTowerCollapse();
      return;
    }

    attachPartToStack(drop.part);
    drop.part.object.position.set(drop.finalX, drop.part.finalY, drop.finalZ);
    drop.part.object.rotation.set(drop.baseRotationX, drop.finalRotationY, drop.baseRotationZ);
    drop.part.object.scale.copy(drop.baseScale);
    drop.part.object.updateMatrixWorld(true);

    void settleHangingLoadAfterDrop().then(() => {
      drop.onSettled();
      updateControls();
      setGameStatus(
        stackIndex >= stackParts.length || stackIndex >= gameState.maxFloor
          ? 'Blocks stacked'
          : 'Ready for next block',
      );
    });
  }
}

function startTowerCollapse() {
  collapsingBlocks.length = 0;
  collapseCameraStartTargetY = controls.target.y;

  for (const [index, part] of stackParts.slice(0, stackIndex).entries()) {
    if (!part.object.visible) {
      continue;
    }

    collapsingBlocks.push({
      angularVelocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(2.4),
        THREE.MathUtils.randFloatSpread(1.4),
        THREE.MathUtils.randFloatSpread(2.4),
      ),
      delay: (stackIndex - index - 1) * 0.025 + Math.random() * 0.08,
      object: part.object,
      startY: part.object.position.y,
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(3.5),
        Math.random() * 1.5,
        THREE.MathUtils.randFloatSpread(3.5),
      ),
    });
  }

  if (stackButton) {
    stackButton.disabled = true;
  }
  setGameStatus(`Block ${stackIndex} landed badly`);
}

function updateTowerCollapse(delta) {
  if (!collapsingBlocks.length) {
    return;
  }

  let visibleBlocks = 0;
  let totalFallDistance = 0;

  for (const block of collapsingBlocks) {
    if (!block.object.visible) {
      continue;
    }

    visibleBlocks += 1;
    block.delay -= delta;

    if (block.delay > 0) {
      totalFallDistance += Math.max(block.startY - block.object.position.y, 0);
      continue;
    }

    block.velocity.y -= COLLAPSE_GRAVITY * delta;
    block.object.position.addScaledVector(block.velocity, delta);
    block.object.rotation.x += block.angularVelocity.x * delta;
    block.object.rotation.y += block.angularVelocity.y * delta;
    block.object.rotation.z += block.angularVelocity.z * delta;
    totalFallDistance += Math.max(block.startY - block.object.position.y, 0);

    if (block.object.position.y < stackAnchor.topY - DESTROY_BELOW_GROUND_DISTANCE) {
      block.object.visible = false;
      block.object.removeFromParent();
    }
  }

  if (visibleBlocks > 0) {
    const averageFallDistance = totalFallDistance / visibleBlocks;
    const desiredCameraY = Math.max(cameraTargetMinY, collapseCameraStartTargetY - averageFallDistance);
    const smoothing = 1 - Math.exp(-delta * COLLAPSE_CAMERA_FOLLOW_SPEED);
    shiftCameraVertically((desiredCameraY - controls.target.y) * smoothing);
  }

  if (visibleBlocks === 0) {
    collapsingBlocks.length = 0;
    returningCameraToBase = true;
    resetStackPool();
    setGameStatus('Tower collapsed');
    if (stackButton) {
      stackButton.disabled = true;
      stackButton.textContent = 'Resetting';
    }
    collapseSettled?.();
    collapseSettled = null;
  }
}

function triggerLandingImpact(part, isHeavyImpact) {
  landingShakeRemaining = LANDING_SHAKE_DURATION;
  landingScreenEffectRemaining = LANDING_SCREEN_EFFECT_DURATION;
  document.body.classList.add('screen-impact-active');
  spawnLandingDust(part, isHeavyImpact);
}

function spawnLandingDust(part, isHeavyImpact) {
  const box = new THREE.Box3().setFromObject(part.object);
  const center = box.getCenter(new THREE.Vector3());
  const width = Math.max(box.max.x - box.min.x, stackAnchor.halfWidthX * 0.24, 1);
  const depth = Math.max(box.max.z - box.min.z, stackAnchor.halfWidthZ * 0.24, 1);
  const count = Math.round(DUST_PARTICLE_COUNT * (isHeavyImpact ? 1.6 : 1));

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const angleJitter = THREE.MathUtils.randFloatSpread(0.75);
    const travelAngle = angle + angleJitter;
    const edgeSpread = THREE.MathUtils.randFloat(0.2, 0.92);
    const opacity = THREE.MathUtils.randFloat(0.38, isHeavyImpact ? 0.82 : 0.7);
    const initialScale = THREE.MathUtils.randFloat(0.2, isHeavyImpact ? 0.58 : 0.5);
    const fallsDownward = Math.random() < 0.36;
    const material = new THREE.SpriteMaterial({
      color: 0xd8c39c,
      depthWrite: false,
      map: dustTexture,
      opacity,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);

    sprite.position.set(
      center.x + Math.cos(angle) * width * edgeSpread,
      box.min.y + THREE.MathUtils.randFloat(0.02, isHeavyImpact ? 0.62 : 0.46),
      center.z + Math.sin(angle) * depth * edgeSpread,
    );
    sprite.scale.setScalar(initialScale);
    scene.add(sprite);

    dustParticles.push({
      age: 0,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: THREE.MathUtils.randFloat(4, 8),
      driftStrength: THREE.MathUtils.randFloat(0.025, isHeavyImpact ? 0.075 : 0.06),
      initialOpacity: opacity,
      initialScale,
      lifetime: THREE.MathUtils.randFloat(DUST_DURATION_RANGE[0], DUST_DURATION_RANGE[1]),
      sprite,
      spin: THREE.MathUtils.randFloatSpread(2.8),
      velocity: new THREE.Vector3(
        Math.cos(travelAngle) * THREE.MathUtils.randFloat(0.75, isHeavyImpact ? 2.25 : 1.75),
        fallsDownward
          ? THREE.MathUtils.randFloat(-0.65, -0.15)
          : THREE.MathUtils.randFloat(0.35, isHeavyImpact ? 1.65 : 1.25),
        Math.sin(travelAngle) * THREE.MathUtils.randFloat(0.75, isHeavyImpact ? 2.25 : 1.75),
      ),
    });
  }
}

function updateDustParticles(delta) {
  for (let index = dustParticles.length - 1; index >= 0; index -= 1) {
    const particle = dustParticles[index];
    particle.age += delta;

    if (particle.age >= particle.lifetime) {
      removeDustParticle(index);
      continue;
    }

    const progress = particle.age / particle.lifetime;
    const material = particle.sprite.material;
    particle.velocity.y -= DUST_GRAVITY * delta;
    particle.velocity.multiplyScalar(Math.max(1 - DUST_DRAG * delta, 0.2));
    particle.sprite.position.addScaledVector(particle.velocity, delta);
    particle.sprite.position.x +=
      Math.sin(particle.driftPhase + particle.age * particle.driftSpeed) *
      particle.driftStrength *
      (1 - progress);
    particle.sprite.position.z +=
      Math.cos(particle.driftPhase + particle.age * particle.driftSpeed * 0.82) *
      particle.driftStrength *
      (1 - progress);
    particle.sprite.scale.setScalar(particle.initialScale * (1 + progress * DUST_EXPANSION));
    material.opacity = particle.initialOpacity * Math.pow(1 - progress, 1.35);
    material.rotation += particle.spin * delta;
  }
}

function clearDustParticles() {
  for (let index = dustParticles.length - 1; index >= 0; index -= 1) {
    removeDustParticle(index);
  }
}

function removeDustParticle(index) {
  const [particle] = dustParticles.splice(index, 1);
  particle.sprite.removeFromParent();
  particle.sprite.material.dispose();
}

function updateLandingScreenEffect(delta) {
  if (landingScreenEffectRemaining <= 0) {
    if (document.body.classList.contains('screen-impact-active')) {
      clearLandingImpact();
    }
    return;
  }

  landingScreenEffectRemaining = Math.max(landingScreenEffectRemaining - delta, 0);
  const progress = landingScreenEffectRemaining / LANDING_SCREEN_EFFECT_DURATION;
  const easedProgress = progress * progress;
  const shakePixels = LANDING_SCREEN_SHAKE_PIXELS * easedProgress;
  const blurPixels = LANDING_SCREEN_BLUR_PIXELS * Math.min(progress * 1.2, 1);

  document.body.style.setProperty(
    '--impact-shake-x',
    `${THREE.MathUtils.randFloatSpread(shakePixels * 2).toFixed(2)}px`,
  );
  document.body.style.setProperty(
    '--impact-shake-y',
    `${THREE.MathUtils.randFloatSpread(shakePixels).toFixed(2)}px`,
  );
  document.body.style.setProperty('--impact-blur', `${blurPixels.toFixed(2)}px`);
  document.body.style.setProperty(
    '--impact-scale',
    String(1 + (LANDING_SCREEN_SCALE - 1) * easedProgress),
  );
}

function clearLandingImpact() {
  landingShakeRemaining = 0;
  landingScreenEffectRemaining = 0;
  document.body.classList.remove('screen-impact-active');
  document.body.style.setProperty('--impact-shake-x', '0px');
  document.body.style.setProperty('--impact-shake-y', '0px');
  document.body.style.setProperty('--impact-blur', '0px');
  document.body.style.setProperty('--impact-scale', '1');
}

function getLandingShakeOffset(delta) {
  if (landingShakeRemaining <= 0) {
    return new THREE.Vector3();
  }

  landingShakeRemaining = Math.max(landingShakeRemaining - delta, 0);
  const strength = LANDING_SHAKE_STRENGTH * (landingShakeRemaining / LANDING_SHAKE_DURATION);

  return new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(strength * 2),
    THREE.MathUtils.randFloatSpread(strength),
    THREE.MathUtils.randFloatSpread(strength * 0.7),
  );
}

function frameBaseStackAtViewPosition() {
  if (LOCK_CAMERA_TO_BLENDER_VIEW) {
    const firstTopY = stackParts[0]?.topY ?? stackAnchor.topY;
    baseStackTopProjectedY = getProjectedY(getStackTopPoint(firstTopY));
    defaultCamera = camera.position.clone();
    defaultTarget = controls.target.clone();
    return;
  }

  const focusPoint = getBaseStackFocusPoint();
  const desiredProjectedY = 1 - CAMERA_BASE_STACK_VIEW_Y * 2;
  const shiftAmount = getVerticalCameraShiftForProjectedY(focusPoint, desiredProjectedY);

  if (Math.abs(shiftAmount) >= 0.001) {
    shiftCameraVertically(shiftAmount);
    cameraTargetMinY = controls.target.y;
    controls.update();
  }

  const firstTopY = stackParts[0]?.topY ?? stackAnchor.topY;
  baseStackTopProjectedY = getProjectedY(getStackTopPoint(firstTopY));
  defaultCamera = camera.position.clone();
  defaultTarget = controls.target.clone();
}

function getBaseStackFocusPoint() {
  return getStackWorldPoint(
    stackAnchor.center.x,
    stackAnchor.topY + getStackBlockHeight() * 0.5,
    stackAnchor.center.z,
  );
}

function getVerticalCameraShiftForProjectedY(point, desiredProjectedY) {
  const projectWithShift = (shiftY) => {
    camera.position.y += shiftY;
    camera.updateMatrixWorld(true);
    const projectedY = point.clone().project(camera).y;
    camera.position.y -= shiftY;
    camera.updateMatrixWorld(true);
    return projectedY;
  };

  let lowerShift = -40;
  let upperShift = 40;
  let lowerDelta = projectWithShift(lowerShift) - desiredProjectedY;
  let upperDelta = projectWithShift(upperShift) - desiredProjectedY;

  for (let expand = 0; lowerDelta * upperDelta > 0 && expand < 4; expand += 1) {
    lowerShift *= 1.5;
    upperShift *= 1.5;
    lowerDelta = projectWithShift(lowerShift) - desiredProjectedY;
    upperDelta = projectWithShift(upperShift) - desiredProjectedY;
  }

  if (lowerDelta * upperDelta > 0) {
    return 0;
  }

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middleShift = (lowerShift + upperShift) / 2;
    const middleDelta = projectWithShift(middleShift) - desiredProjectedY;

    if (lowerDelta * middleDelta <= 0) {
      upperShift = middleShift;
      upperDelta = middleDelta;
    } else {
      lowerShift = middleShift;
      lowerDelta = middleDelta;
    }
  }

  return (lowerShift + upperShift) / 2;
}

function getStackTopPoint(topY) {
  return getStackWorldPoint(stackAnchor.center.x, topY, stackAnchor.center.z);
}

function getCameraClearanceTopY(topY) {
  return topY + getStackBlockHeight() * CAMERA_TOP_CLEARANCE_BLOCKS;
}

function getStackBlockHeight() {
  const firstPart = stackParts[0];
  const secondPart = stackParts[1];

  if (firstPart && secondPart) {
    const measuredStep = secondPart.topY - firstPart.topY;

    if (measuredStep > 0) {
      return measuredStep;
    }
  }

  if (firstPart) {
    firstPart.object.updateMatrixWorld(true);
    const firstPartBox = new THREE.Box3().setFromObject(firstPart.object);

    if (!firstPartBox.isEmpty()) {
      return firstPartBox.max.y - firstPartBox.min.y;
    }
  }

  return CAMERA_TOP_PADDING;
}

function getProjectedY(point) {
  camera.updateMatrixWorld(true);
  return point.clone().project(camera).y;
}

function getCameraMaxTargetY(stackTopY = currentStackTopY) {
  return Math.max(cameraTargetMinY, getCameraClearanceTopY(stackTopY) + CAMERA_TOP_PADDING);
}

function getIntroCameraStackTopY() {
  const introBlockCount = Math.min(gameState.maxFloor || stackParts.length, stackParts.length);

  if (introBlockCount > 0) {
    return stackParts[introBlockCount - 1].topY;
  }

  return currentStackTopY;
}

function getSliderCameraState(targetY, baseCamera = defaultCamera, baseTarget = defaultTarget) {
  if (!baseCamera || !baseTarget) {
    return null;
  }

  const verticalMovement = targetY - baseTarget.y;
  const target = baseTarget.clone();
  const cameraOffset = baseCamera.clone().sub(baseTarget);

  target.y = targetY;
  cameraOffset.applyAxisAngle(
    WORLD_UP_AXIS,
    THREE.MathUtils.degToRad(-verticalMovement * SLIDER_ORBIT_DEGREES_PER_HEIGHT_UNIT),
  );

  return {
    position: target.clone().add(cameraOffset),
    target,
  };
}

function applyCameraState(cameraState) {
  if (!cameraState) {
    return;
  }

  camera.position.copy(cameraState.position);
  controls.target.copy(cameraState.target);
}

function startIntroCameraAnimation() {
  if (!defaultCamera || !defaultTarget) {
    return;
  }

  const topTargetY = getCameraMaxTargetY(getIntroCameraStackTopY());
  const startProgress = THREE.MathUtils.clamp(INTRO_CAMERA_START_PROGRESS, 0, 0.98);
  const startTargetY = THREE.MathUtils.lerp(
    topTargetY,
    defaultTarget.y,
    easeInOutSmoother(startProgress),
  );

  if (topTargetY <= defaultTarget.y + 0.01) {
    return;
  }

  introCameraAnimation = {
    baseCamera: defaultCamera.clone(),
    baseTarget: defaultTarget.clone(),
    duration: INTRO_CAMERA_DURATION_SECONDS,
    elapsed: 0,
    shipStartOffset: getShipIntroStartOffset(),
    startTargetY,
    topTargetY,
  };

  applyCameraState(getSliderCameraState(
    introCameraAnimation.startTargetY,
    introCameraAnimation.baseCamera,
    introCameraAnimation.baseTarget,
  ));
  controls.update();
  updateCameraSlider();
  updateFloatingShip(clock.elapsedTime);
}

function finishIntroCameraAnimation() {
  if (!introCameraAnimation) {
    return;
  }

  applyCameraState({
    position: introCameraAnimation.baseCamera,
    target: introCameraAnimation.baseTarget,
  });
  introCameraAnimation = null;
  controls.update();
  updateCameraSlider();
}

function updateIntroCamera(delta) {
  if (!introCameraAnimation) {
    return false;
  }

  introCameraAnimation.elapsed += delta;
  const progress = THREE.MathUtils.clamp(
    introCameraAnimation.elapsed / introCameraAnimation.duration,
    0,
    1,
  );
  const easedProgress = easeInOutSmoother(progress);
  const targetY = THREE.MathUtils.lerp(
    introCameraAnimation.startTargetY,
    introCameraAnimation.baseTarget.y,
    easedProgress,
  );

  applyCameraState(getSliderCameraState(
    targetY,
    introCameraAnimation.baseCamera,
    introCameraAnimation.baseTarget,
  ));

  if (progress >= 1) {
    finishIntroCameraAnimation();
  }

  return true;
}

function updateCameraHeight(delta) {
  const clearanceTopY = getCameraClearanceTopY(currentStackTopY);
  const maxTargetY = getCameraMaxTargetY(currentStackTopY);

  const clampedTargetY = THREE.MathUtils.clamp(controls.target.y, cameraTargetMinY, maxTargetY);
  shiftCameraVertically(clampedTargetY - controls.target.y);

  const stackTop = getStackTopPoint(clearanceTopY);

  if (activeDrop && baseStackTopProjectedY !== null) {
    const desiredShift = getVerticalCameraShiftForProjectedY(stackTop, baseStackTopProjectedY);
    const desiredTargetY = THREE.MathUtils.clamp(
      controls.target.y + desiredShift,
      cameraTargetMinY,
      maxTargetY,
    );
    const smoothShift = (desiredTargetY - controls.target.y) * Math.min(delta * 6, 1);
    shiftCameraVertically(smoothShift);
  }
}

function shiftCameraVertically(amount) {
  if (amount === 0) {
    return;
  }

  camera.position.y += amount;
  controls.target.y += amount;
}

function updateCameraBaseReturn(delta) {
  if (!returningCameraToBase) {
    return;
  }

  const remainingDistance = cameraTargetMinY - controls.target.y;

  if (Math.abs(remainingDistance) < 0.01) {
    shiftCameraVertically(remainingDistance);
    returningCameraToBase = false;

    if (resetInProgress) {
      resetInProgress = false;
      updateControls();
      setGameStatus(gameState.betId ? 'Ready for next block' : 'Ready to place bet');
      if (resetRoundButton) {
        resetRoundButton.disabled = false;
      }
    } else {
      updateControls();
    }
    return;
  }

  const smoothing = 1 - Math.exp(-delta * CAMERA_BASE_RETURN_SPEED);
  shiftCameraVertically(remainingDistance * smoothing);
}

function moveCameraFromSlider() {
  if (!cameraHeightElement || LOCK_CAMERA_TO_BLENDER_VIEW) {
    return;
  }

  introCameraAnimation = null;
  const maxTargetY = getCameraMaxTargetY(currentStackTopY);
  const sliderMin = Number(cameraHeightElement.min);
  const sliderMax = Number(cameraHeightElement.max);
  const ratio = (Number(cameraHeightElement.value) - sliderMin) / (sliderMax - sliderMin);
  const desiredTargetY = THREE.MathUtils.lerp(cameraTargetMinY, maxTargetY, ratio);
  const verticalMovement = desiredTargetY - controls.target.y;

  shiftCameraVertically(verticalMovement);
  const cameraOffset = camera.position.clone().sub(controls.target);
  cameraOffset.applyAxisAngle(
    WORLD_UP_AXIS,
    THREE.MathUtils.degToRad(-verticalMovement * SLIDER_ORBIT_DEGREES_PER_HEIGHT_UNIT),
  );
  camera.position.copy(controls.target).add(cameraOffset);
  controls.update();
}

function updateCameraSlider() {
  if (!cameraHeightElement) {
    return;
  }

  const maxTargetY = introCameraAnimation?.topTargetY ?? getCameraMaxTargetY(currentStackTopY);
  const heightRange = maxTargetY - cameraTargetMinY;
  const ratio = heightRange
    ? THREE.MathUtils.clamp((controls.target.y - cameraTargetMinY) / heightRange, 0, 1)
    : 0;
  const sliderMin = Number(cameraHeightElement.min);
  const sliderMax = Number(cameraHeightElement.max);
  cameraHeightElement.value = String(Math.round(THREE.MathUtils.lerp(sliderMin, sliderMax, ratio)));
}

function updateFps(delta) {
  frameCount += 1;
  fpsTimer += delta;

  if (fpsTimer >= 0.5 && fpsElement) {
    fpsElement.textContent = `${Math.round(frameCount / fpsTimer)} fps`;
    frameCount = 0;
    fpsTimer = 0;
  }
}

function installStackDebugHelpers() {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__dockyardDebug = {
    ...(window.__dockyardDebug ?? {}),
    getStackSnapshot: () => ({
      activeDrop: Boolean(activeDrop),
      anchorCenter: getStackWorldPoint(stackAnchor.center.x, stackAnchor.topY, stackAnchor.center.z).toArray(),
      anchorParentName: stackAnchor.group?.parent?.name ?? null,
      anchorTargetName: stackAnchor.targetName,
      blockScale: STACK_BLOCK_SCALE,
      completedBlockCount: gameState.completedFloorCount,
      dropPhase: activeDrop?.phase ?? null,
      hangingLoadPosition: hangingLoad?.pivot.position.toArray() ?? null,
      mountedBlock: mountedStackPart?.label ?? null,
      stackIndex,
      stackParts: stackParts.map((part) => {
        const worldPosition = new THREE.Vector3();
        part.object.getWorldPosition(worldPosition);

        return {
          label: part.label,
          parentName: part.object.parent?.name ?? null,
          position: part.object.position.toArray(),
          scale: part.object.scale.toArray(),
          topY: part.topY,
          visible: part.object.visible,
          worldPosition: worldPosition.toArray(),
        };
      }),
      status: gameState.status,
    }),
  };
}

function materialUsesTruckTexture(material) {
  if (!material) return false;

  const mapName = material.map?.name ?? '';
  const imageName = material.map?.image?.name ?? material.map?.image?.src ?? '';
  return (
    material.name.toLowerCase().includes('truck') ||
    mapName.toLowerCase().includes('truck') ||
    imageName.toLowerCase().includes('truck')
  );
}

function isTruckObject(object) {
  if (!object.isMesh) return false;

  const name = baseObjectName(object.name);
  return (
    name.startsWith('truck') ||
    name.startsWith('vehicle') ||
    materialsForObject(object).some(materialUsesTruckTexture)
  );
}

function findMotionPath(root) {
  const paths = new Map();

  root.traverse((object) => {
    const name = baseObjectName(object.name);
    if (!MOTION_PATH_NAMES.includes(name) || !object.geometry?.attributes?.position) return;
    paths.set(name, object);
  });

  return MOTION_PATH_NAMES.map((name) => paths.get(name)).find(Boolean) ?? null;
}

function collectPathPoints(root, pathObject) {
  const pathPointData = pathObject.userData?.dockyard_path_points;
  if (pathPointData) {
    try {
      const pathPoints = typeof pathPointData === 'string' ? JSON.parse(pathPointData) : pathPointData;
      if (Array.isArray(pathPoints)) {
        return pathPoints
          .filter((point) => Array.isArray(point) && point.length >= 3)
          .map((point) => new THREE.Vector3(point[0], point[1], point[2]));
      }
    } catch (error) {
      console.warn('Failed to parse roadn path points.', error);
    }
  }

  const position = pathObject.geometry?.attributes?.position;
  if (!position) return [];

  root.updateWorldMatrix(true, true);
  pathObject.updateWorldMatrix(true, false);

  const points = [];
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    localPoint.fromBufferAttribute(position, index);
    worldPoint.copy(localPoint);
    pathObject.localToWorld(worldPoint);

    const rootPoint = root.worldToLocal(worldPoint.clone());
    const previous = points[points.length - 1];
    if (!previous || previous.distanceToSquared(rootPoint) > 0.0001) {
      points.push(rootPoint);
    }
  }

  return points;
}

function collectTruckObjects(root) {
  const trucks = [];

  root.traverse((object) => {
    if (isTruckObject(object)) {
      trucks.push(object);
    }
  });

  return trucks;
}

function findClosestCurveOffset(curve, point) {
  let closestOffset = 0;
  let closestDistance = Infinity;
  const sampleCount = 720;

  for (let index = 0; index <= sampleCount; index += 1) {
    const offset = index / sampleCount;
    const curvePoint = curve.getPointAt(offset);
    const distance = curvePoint.distanceToSquared(point);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestOffset = offset;
    }
  }

  return {
    distance: Math.sqrt(closestDistance),
    offset: closestOffset,
  };
}

function rootLocalPositionForObject(root, object) {
  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);
  return root.worldToLocal(worldPosition);
}

function setObjectRootLocalPosition(root, object, rootPosition) {
  const worldPosition = root.localToWorld(rootPosition.clone());
  object.position.copy(object.parent ? object.parent.worldToLocal(worldPosition) : worldPosition);
}

function setupTruckFollowers(root) {
  truckFollowers = [];

  const pathObject = findMotionPath(root);
  if (!pathObject) {
    console.warn('No roadn path found for truck animation.');
    return;
  }

  const points = collectPathPoints(root, pathObject);
  if (points.length < 2) {
    console.warn('The roadn path does not have enough points for truck animation.');
    return;
  }

  pathObject.visible = false;

  const isClosedPath = points[0].distanceTo(points[points.length - 1]) < 2.5;
  const curve = new THREE.CatmullRomCurve3(points, isClosedPath, 'catmullrom', 0.2);
  const pathLength = curve.getLength();
  if (pathLength <= 0) {
    console.warn('The roadn path length is zero.');
    return;
  }

  const trucks = collectTruckObjects(root);

  trucks.forEach((truck, index) => {
    const truckRootPosition = rootLocalPositionForObject(root, truck);
    const nearestPath = findClosestCurveOffset(curve, truckRootPosition);
    if (nearestPath.distance > MAX_TRUCK_PATH_DISTANCE) {
      return;
    }

    const startOffset = Number.isFinite(nearestPath.offset)
      ? nearestPath.offset
      : index / Math.max(trucks.length, 1);
    const pathPoint = curve.getPointAt(startOffset);
    const tangent = curve.getTangentAt(startOffset).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    truckFollowers.push({
      truck,
      curve,
      pathLength,
      startOffset,
      yOffset: truckRootPosition.y - pathPoint.y,
      yawOffset: truck.rotation.y - heading,
      isClosedPath,
    });
  });

  spaceTruckFollowers(pathLength, isClosedPath);
}

function spaceTruckFollowers(pathLength, isClosedPath) {
  if (truckFollowers.length < 2 || pathLength <= 0) return;

  const minimumOffsetGap = Math.min(
    TRUCK_SPACING_UNITS / pathLength,
    0.85 / truckFollowers.length,
  );
  truckFollowers.sort((a, b) => a.startOffset - b.startOffset);

  for (let index = 1; index < truckFollowers.length; index += 1) {
    const previous = truckFollowers[index - 1];
    const current = truckFollowers[index];
    const offsetGap = current.startOffset - previous.startOffset;

    if (offsetGap < minimumOffsetGap) {
      current.startOffset = previous.startOffset + minimumOffsetGap;
    }
  }

  const lastFollower = truckFollowers[truckFollowers.length - 1];
  if (isClosedPath) {
    truckFollowers.forEach((follower) => {
      follower.startOffset = THREE.MathUtils.euclideanModulo(follower.startOffset, 1);
    });
    return;
  }

  if (lastFollower.startOffset > 0.98) {
    const firstOffset = Math.max(0.02, 0.98 - minimumOffsetGap * (truckFollowers.length - 1));
    truckFollowers.forEach((follower, index) => {
      follower.startOffset = firstOffset + minimumOffsetGap * index;
    });
  }
}

function updateTruckFollowers(elapsedSeconds) {
  for (const follower of truckFollowers) {
    const distanceOffset = (elapsedSeconds * TRUCK_SPEED_UNITS_PER_SECOND) / follower.pathLength;
    let pathOffset = follower.startOffset + distanceOffset;

    if (follower.isClosedPath) {
      pathOffset %= 1;
    } else {
      pathOffset %= 2;
      pathOffset = pathOffset <= 1 ? pathOffset : 2 - pathOffset;
    }

    const point = follower.curve.getPointAt(pathOffset);
    point.y += follower.yOffset;
    setObjectRootLocalPosition(modelRoot, follower.truck, point);

    const tangent = follower.curve.getTangentAt(pathOffset).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);
    follower.truck.rotation.y = heading + follower.yawOffset;
  }
}

function animate() {
  const deltaSeconds = clock.getDelta();
  const elapsedSeconds = clock.elapsedTime;
  const isIntroCameraActive = updateIntroCamera(deltaSeconds);
  updateTruckFollowers(elapsedSeconds);
  updateFloatingShip(elapsedSeconds);
  updateHangingLoad(elapsedSeconds, deltaSeconds);
  updateWater(elapsedSeconds);
  updateStackAnimation(deltaSeconds);
  updateTowerCollapse(deltaSeconds);
  if (!isIntroCameraActive) {
    updateCameraBaseReturn(deltaSeconds);
    updateCameraHeight(deltaSeconds);
  }
  controls.update();
  updateImportedSkybox(elapsedSeconds);
  updateDustParticles(deltaSeconds);
  updateCameraSlider();
  updateFps(deltaSeconds);
  updateLandingScreenEffect(deltaSeconds);
  const shakeOffset = getLandingShakeOffset(deltaSeconds);
  camera.position.add(shakeOffset);
  renderer.render(scene, camera);
  camera.position.sub(shakeOffset);
  requestAnimationFrame(animate);
}

const modelLoader = new GLTFLoader(loadingManager);
modelLoader.setPath('/models/');

modelLoader.load(
  `dockyard.glb?v=${Date.now()}`,
  async (gltf) => {
    setLoaderMessage('Preparing scene');
    modelRoot = gltf.scene;
    applyManualTextures(modelRoot);
    hideImportedSkyDomes(modelRoot);
    scene.add(modelRoot);
    setupImportedSkybox(modelRoot);
    frameObject(modelRoot);
    updateImportedSkybox();
    setupWater(modelRoot);
    setupFloatingShip(modelRoot);
    setupHangingLoad(modelRoot);
    stackAnchor = measureDockyardStackAnchor(modelRoot);
    currentStackTopY = stackAnchor.topY;
    setGameStatus('Loading stack blocks');

    try {
      await setupFallingBlockStack(modelLoader);
      frameBaseStackAtViewPosition();
      startIntroCameraAnimation();
      setGameStatus(gameState.betId ? 'Ready for next block' : 'Ready to place bet');
    } catch (error) {
      console.warn('Falling blocks failed to load.', error);
      setGameStatus('Dockyard loaded without stack blocks');
      startIntroCameraAnimation();
    }

    updateControls();
    hideLoader();
  },
  (event) => {
    if (!event.total) return;
    const progress = Math.round((event.loaded / event.total) * 100);
    setLoaderMessage(`Loading dockyard file ${progress}%`);
  },
  (error) => {
    console.error(error);
    setLoaderMessage('Dockyard model failed to load', true);
  }
);

resetButton?.addEventListener('click', resetView);
stackButton?.addEventListener('click', handlePrimaryAction);
cashOutButton?.addEventListener('click', cashOut);
resetRoundButton?.addEventListener('click', resetRound);
cameraHeightElement?.addEventListener('input', moveCameraFromSlider);
amountElement?.addEventListener('input', handleAmountInput);
difficultyElement?.addEventListener('change', handleDifficultyChange);
clientSeedElement?.addEventListener('input', updateControls);

fullscreenButton?.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

window.addEventListener('resize', resize);
void initializeGameSession();
updateControls();
animate();
