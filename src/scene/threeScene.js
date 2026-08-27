import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOCK_CAMERA_TO_BLENDER_VIEW } from '../core/constants.js';

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

  return {
    camera,
    controls,
    renderer,
    scene,
    sunLight,
  };
}
