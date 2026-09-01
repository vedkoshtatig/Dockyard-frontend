import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createThreeScene({ canvas, cameraHeightElement }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9eb7c1);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(12, 8, 12);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.66;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const environment = new RoomEnvironment(renderer);
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(environment).texture;
  environment.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 1;
  controls.maxDistance = 500;
  controls.zoomSpeed = 0.45;
  controls.panSpeed = 0.35;
  controls.rotateSpeed = 0.35;
  // Right-drag is reserved for vertical stack browsing in cameraSystem.
  controls.mouseButtons.RIGHT = null;

  if (cameraHeightElement) {
    cameraHeightElement.disabled = false;
  }

  scene.fog = new THREE.FogExp2(0xaed3e2, 0.00056);

  const hemiLight = new THREE.HemisphereLight(0xe6f5ff, 0x23454b, 0.78);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffd39b, 2.35);
  sunLight.position.set(-85, 120, 70);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 360;
  sunLight.shadow.camera.left = -150;
  sunLight.shadow.camera.right = 150;
  sunLight.shadow.camera.top = 150;
  sunLight.shadow.camera.bottom = -150;
  sunLight.shadow.bias = -0.00035;
  sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x85d4f2, 0.5);
  fillLight.position.set(75, 45, -90);
  scene.add(fillLight);

  const horizonLight = new THREE.DirectionalLight(0xff8fae, 0.52);
  horizonLight.position.set(0, 18, -120);
  scene.add(horizonLight);

  return {
    camera,
    controls,
    renderer,
    scene,
    sunLight,
  };
}
