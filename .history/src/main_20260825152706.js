import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './styles.css';

const canvas = document.querySelector('#scene');
const loaderEl = document.querySelector('#loader');
const resetButton = document.querySelector('#reset-view');
const fullscreenButton = document.querySelector('#fullscreen');

const MOTION_PATH_NAMES = ['roadn', 'road'];
const TRUCK_SPEED_UNITS_PER_SECOND = 4.5;
const TRUCK_SPACING_UNITS = 16;
const MAX_TRUCK_PATH_DISTANCE = 9;
const WATER_EDGE_PADDING = 0.9;
const WATER_SIZE_PADDING = 240;
const SHIP_WAKE_PADDING = 10;
const WATER_ANIMATION_SPEED = 1.65;
const WATER_SHIMMER_SPEED = 0.55;
const WATER_QUALITY = 'HIGH';
const SHIP_MOTION = {
  speed: 0.58,
  heightOffset: 3,
  heave: 0.46,
  sway: 0.075,
  surge: 0,
  roll: 0.048,
  pitch: 0,
  yaw: 0,
};
const HANGING_LOAD_MOTION = {
  speed: 0.72,
  swing: 0.13,
  secondarySwing: 0.035,
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
    segments: 300,
    normalIntensity: 1.05,
    foamIntensity: 0.82,
    reflectionStrength: 0.28,
  },
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
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = 1;
controls.maxDistance = 500;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.7;

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
const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const shipBounds = new THREE.Box3();
const shipBoundsSize = new THREE.Vector3();
const shipBoundsCenter = new THREE.Vector3();
const shipWobbleQuaternion = new THREE.Quaternion();
const hangingLoadQuaternion = new THREE.Quaternion();

function applyManualTextures(root) {
  const textureCache = new Map();

  root.traverse((object) => {
    if (!object.isMesh) return;

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

function hideImportedSkyDomes(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;

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

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  object.position.sub(center);

  const framedBox = new THREE.Box3().setFromObject(object);
  const framedSize = framedBox.getSize(new THREE.Vector3());
  const framedMaxDim = Math.max(framedSize.x, framedSize.y, framedSize.z);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distanceForHeight = framedMaxDim / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = framedMaxDim / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(distanceForHeight, distanceForWidth) * 1.45;
  const direction = new THREE.Vector3(0.9, 0.55, 0.9).normalize();

  controls.target.set(0, framedSize.y * 0.08, 0);
  camera.position.copy(direction.multiplyScalar(distance));
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 8, 1000);
  camera.updateProjectionMatrix();

  controls.maxDistance = distance * 4;
  controls.minDistance = Math.max(distance / 80, 0.2);
  controls.update();

  defaultCamera = camera.position.clone();
  defaultTarget = controls.target.clone();
}

function resetView() {
  if (!defaultCamera || !defaultTarget) return;
  camera.position.copy(defaultCamera);
  controls.target.copy(defaultTarget);
  controls.update();
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
        transformed.z += vWave;

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

        float rippleA = sin(point.x * 0.72 + point.y * 0.17 + time * 1.45);
        float rippleB = sin(point.x * -0.38 + point.y * 0.83 - time * 1.78);
        float rippleNoise = noise(point * 0.42 + vec2(time * -0.12, time * 0.08)) - 0.5;
        normal.xz += vec2(rippleA * 0.18 + rippleNoise * 0.36, rippleB * 0.18 - rippleNoise * 0.32) * normalIntensity;

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
        float surfaceNoise = noise(waterPoint * 0.036 + vec2(shimmerTime * 0.02, shimmerTime * -0.018));
        float smallNoise = noise(waterPoint * 0.24 + vec2(shimmerTime * -0.12, shimmerTime * 0.09)) * 0.65
          + noise(waterPoint * 0.48 + vec2(shimmerTime * 0.16, shimmerTime * -0.11)) * 0.35;
        float fineRipples = sin(waterPoint.x * 0.26 + waterPoint.y * 0.18 + shimmerTime * 1.28)
          * sin(waterPoint.x * -0.21 + waterPoint.y * 0.34 - shimmerTime * 1.12);
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

        vec3 deep = vec3(0.006, 0.075, 0.14);
        vec3 mid = vec3(0.018, 0.19, 0.31);
        vec3 teal = vec3(0.025, 0.36, 0.42);
        vec3 shallow = vec3(0.13, 0.58, 0.58);
        float depthTint = clamp(0.45 + broadShade * 0.24 + smallNoise * 0.2 + vWave * 0.08, 0.0, 1.0);
        float mottling = noise(waterPoint * 0.12 + vec2(shimmerTime * 0.04, shimmerTime * -0.03)) * 2.0 - 1.0;
        vec3 color = mix(deep, mid, depthTint);
        color = mix(color, teal, clamp(0.18 + smallNoise * 0.28 + fineRipples * 0.08, 0.0, 0.46));
        color = mix(color, shallow, clamp(vCrest * 0.18 + max(vWave, 0.0) * 0.1, 0.0, 0.34));
        color *= 0.94 + mottling * 0.08;

        vec3 reflectedSun = reflect(-sun, normal);
        float sharpSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 96.0);
        float broadSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 18.0);
        float streakMask = smoothstep(0.48, 0.92, noise(waterPoint * vec2(0.08, 0.22) + vec2(shimmerTime * -0.08, shimmerTime * 0.18)));
        float crestMask = smoothstep(0.12, 0.62, vWave + smallNoise * 0.38);
        float crestFoam = vCrest
          * smoothstep(0.5, 0.88, noise(waterPoint * 0.55 + vec2(shimmerTime * -0.28, shimmerTime * 0.2)))
          * foamIntensity;
        float centerFoam = centerRippleFoam(waterPoint) * foamIntensity;
        float glint = (sharpSpec * 0.55 + broadSpec * 0.18) * streakMask * (0.28 + crestMask * 0.5) * reflectionStrength;
        vec3 skyReflection = mix(vec3(0.29, 0.48, 0.64), vec3(0.66, 0.82, 0.92), horizonReflection);

        color = mix(color, skyReflection, clamp(fresnel * 0.32 * reflectionStrength, 0.0, 0.34));
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
  const waterSize = Math.max(sceneSize.x, sceneSize.z, dockSize.x, dockSize.z) + WATER_SIZE_PADDING;
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

function updateFloatingShip(elapsedSeconds) {
  if (!floatingShip) return;

  const { object, basePosition, baseQuaternion, phase } = floatingShip;
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

function baseObjectName(name) {
  return name.replace(/\.\d+$/, '').toLowerCase();
}

function normalizeObjectKey(name) {
  return baseObjectName(name).replace(/[\s.-]+/g, '_');
}

function materialsForObject(object) {
  if (!object.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
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
  const elapsedSeconds = clock.getElapsedTime();
  updateTruckFollowers(elapsedSeconds);
  updateFloatingShip(elapsedSeconds);
  updateWater(elapsedSeconds);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

const modelLoader = new GLTFLoader(loadingManager);
modelLoader.setPath('/models/');

modelLoader.load(
  `dockyard.glb?v=${Date.now()}`,
  (gltf) => {
    setLoaderMessage('Preparing scene');
    modelRoot = gltf.scene;
    applyManualTextures(modelRoot);
    hideImportedSkyDomes(modelRoot);
    scene.add(modelRoot);
    frameObject(modelRoot);
    setupWater(modelRoot);
    setupFloatingShip(modelRoot);
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

resetButton.addEventListener('click', resetView);

fullscreenButton.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
});

window.addEventListener('resize', resize);
animate();
