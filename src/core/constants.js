import * as THREE from 'three';

export const MOTION_PATH_NAMES = ['roadn', 'road'];
export const TRUCK_SPEED_UNITS_PER_SECOND = 4.5;
export const TRUCK_SPACING_UNITS = 16;
export const MAX_TRUCK_PATH_DISTANCE = 9;

export const WATER_EDGE_PADDING = 0.9;
export const WATER_SIZE_PADDING = 3000;
export const WATER_SIZE_MULTIPLIER = 6.5;
// Keep the playable water flat, then bend the distant surface below the
// horizon so the finite mesh cannot draw a hard line across the skybox.
export const WATER_HORIZON_CURVE_START = 520;
export const WATER_HORIZON_CURVE_RADIUS = 900;
export const WATER_HORIZON_BLEND_DISTANCE = 240;
export const SHIP_WAKE_PADDING = 10;
export const WATER_ANIMATION_SPEED = 1.65;
export const WATER_SHIMMER_SPEED = 0.55;
export const WATER_QUALITY = 'HIGH';
export const WATER_BOAT_WAKE_MAX_COUNT = 24;
export const SKYBOX_TEXTURE_SCROLL_SPEED = 0.002;

export const AMBIENT_BIRD_MODEL_URL = 'birds.glb';
export const AMBIENT_BIRD_FLOCK_COUNT = 11;
export const AMBIENT_BIRD_SINGLE_COUNT = 12;
export const AMBIENT_BIRD_FLOCK_SIZE_RANGE = [2, 4];
export const AMBIENT_BIRD_SMALL_FLOCK_SIZE_RANGE = [2, 3];
export const AMBIENT_BIRD_BIG_FLOCK_SIZE_RANGE = [4, 6];
export const AMBIENT_BIRD_FLOCK_SPREAD = 32;
export const AMBIENT_BIRD_AREA_RADIUS = 920;
export const AMBIENT_BIRD_MIN_RADIUS = 320;
export const AMBIENT_BIRD_HEIGHT_RANGE = [88, 180];
export const AMBIENT_BIRD_SIZE_RANGE = [0.85, 1.75];
export const AMBIENT_BIRD_ORBIT_SPEED_RANGE = [0.06, 0.14];
export const AMBIENT_BIRD_FORWARD_OFFSET = Math.PI;

export const AMBIENT_BOAT_MODEL_URL = 'newBoats.glb';
export const AMBIENT_BOAT_COUNT = 12;
export const AMBIENT_BOAT_LENGTH_RANGE = [18, 38];
export const AMBIENT_BOAT_SPEED_RANGE = [2.8, 5.8];
export const AMBIENT_BOAT_LANE_RADIUS_RANGE = [320, 760];
export const AMBIENT_BOAT_EDGE_PADDING = 80;
export const AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS = 180;
export const AMBIENT_BOAT_WATER_OFFSET = 0.18;
export const AMBIENT_BOAT_FORWARD_OFFSET = -Math.PI / 2;

export const SHIP_INTRO_START_AXIS = new THREE.Vector3(0, 0, -1);
export const SHIP_INTRO_START_DISTANCE = 102;
export const SHIP_WAKE_BASE_STRENGTH = 0.2;
export const SHIP_WAKE_SPEED_RESPONSE = 0.035;
export const SHIP_WAKE_INTRO_BOOST = 0.32;
export const SHIP_WAKE_MAX_STRENGTH = 0.95;
export const SHIP_WAKE_SMOOTHING = 5.5;
export const SHIP_MOTION = {
  speed: 0.58,
  heightOffset: 2.2,
  heave: 0.46,
  sway: 0.075,
  surge: 0,
  roll: 0.048,
  pitch: 0,
  yaw: 0,
};

export const HANGING_LOAD_MOTION = {
  speed: 0.82,
  sideToSideSwing: 0.18,
  frontBackSwing: 0.105,
  gustSwing: 0.035,
};
export const HANGING_LOAD_OBJECT_KEYS = new Set([
  'hangingcontainer',
  'hanging_container',
  'hangingstring1',
  'hanging_string_1',
  'hangingstring2',
  'hanging_string_2',
]);
export const HANGING_CONTAINER_OBJECT_KEYS = new Set([
  'hangingcontainer',
  'hanging_container',
]);

export const STACK_TARGET_OBJECT_KEYS = [
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
export const STACK_BLOCK_DEFINITIONS = [
  { label: 'Falling block 1', url: 'fallingBlock1.glb' },
  { label: 'Falling block 2', url: 'fallingBlock2.glb' },
  { label: 'Falling block 3', url: 'fallingBlock3.glb' },
  { label: 'Falling block 4', url: 'fallingBlock4.glb' },
  { label: 'Falling block 5', url: 'fallingBlock5.glb' },
];
export const STACK_BLOCK_SCALE = 1.725;
export const STACK_BLOCK_MATERIAL_COLOR_INTENSITY = 2;
export const STACK_RANDOM_X_RANGE = 2.8;
export const STACK_RANDOM_MAX_X_RANGE = 5.2;
export const STACK_RANDOM_MIN_X_OFFSET = 1.35;
export const STACK_RANDOM_MIN_PREVIOUS_X_DELTA = 1.05;
export const STACK_RANDOM_DEVIATION_RAMP_BLOCKS = 12;
export const STACK_RANDOM_EDGE_BIAS = 0.55;
export const STACK_RANDOM_Z_RANGE = 0;
export const STACK_RANDOM_Y_ROTATION_DEGREES = 24;
export const STACK_RANDOM_MIN_Y_ROTATION_DEGREES = 7;
export const TOTAL_STACK_BLOCKS = 24;
export const STACK_DROP_HEIGHT = 10;
export const STACK_DROP_SECONDS = 0.5;
export const HANGING_LOAD_CAMERA_FOLLOW_SPEED = 8;
export const HANGING_LOAD_RETRACT_SECONDS = 0.56;
export const HANGING_LOAD_DESCEND_SECONDS = 0.86;
export const INTRO_HANGING_LOAD_DESCEND_SECONDS = 1.15;
export const HANGING_LOAD_SETTLE_TIMEOUT_PADDING_SECONDS = 1.5;
export const HANGING_LOAD_OFFSCREEN_PROJECTED_Y = 1.18;
export const HANGING_LOAD_VISIBLE_TOP_PROJECTED_Y_PADDING = 0.02;
export const HANGING_LOAD_OFFSCREEN_MIN_LIFT = 9;
export const HANGING_LOAD_OFFSCREEN_MAX_LIFT = 72;
export const HANGING_LOAD_OFFSCREEN_BLOCK_LIFT = 2.4;
export const STACK_VERTICAL_OVERLAP = 0.12;
export const STACK_CONTACT_PROGRESS = 0.82;
export const STACK_SWING_DEGREES = 4.5;
export const STACK_IMPACT_COMPRESSION = 0.045;

export const LANDING_SHAKE_DURATION = 0.28;
export const LANDING_SHAKE_STRENGTH = 0.2;
export const LANDING_SCREEN_EFFECT_DURATION = 0.18;
export const LANDING_SCREEN_SHAKE_PIXELS = 9;
export const LANDING_SCREEN_BLUR_PIXELS = 2.2;
export const LANDING_SCREEN_SCALE = 1.008;
export const DUST_PARTICLE_COUNT = 104;
export const DUST_DURATION_RANGE = [0.7, 1.18];
export const DUST_GRAVITY = 1.85;
export const DUST_DRAG = 1.4;
export const DUST_EXPANSION = 2.35;
export const WATER_SPLASH_PARTICLE_COUNT = 58;
export const WATER_SPLASH_DURATION_RANGE = [0.52, 0.92];
export const WATER_SPLASH_GRAVITY = 9.6;
export const WATER_SPLASH_RING_DURATION = 1.05;
export const WATER_SPLASH_RING_EXPANSION = 5.8;
export const WATER_SPLASH_IMPACT_SPEED_RESPONSE = 0.075;

export const BAD_LANDING_TILT_DEGREES = 14;
export const COLLAPSE_GRAVITY = 18;
export const COLLAPSE_CAMERA_FOLLOW_SPEED = 5;
export const CAMERA_BASE_RETURN_SPEED = 2.8;
export const CAMERA_TOP_PADDING = 3;
export const CAMERA_TOP_CLEARANCE_BLOCKS = 1;
export const CAMERA_BASE_STACK_VIEW_Y = 0.4;
export const CAMERA_STACK_FOLLOW_SPEED = 5.5;
export const CAMERA_STACK_RISE_PER_BLOCK = 8;
export const CAMERA_STACK_FULL_RISE_BLOCKS = 10;
export const CAMERA_STACK_RISE_AFTER_FULL_BLOCKS_MULTIPLIER = 0.8;
export const CAMERA_STACK_MAX_RISE = 155;
export const CAMERA_STACK_TILT_DOWN_DEGREES_PER_BLOCK = 3.5;
export const CAMERA_STACK_MAX_TILT_DOWN_DEGREES = 39;
export const LOCK_CAMERA_TO_BLENDER_VIEW = true;
export const SLIDER_ORBIT_DEGREES_PER_HEIGHT_UNIT = 9;
export const INTRO_CAMERA_START_PROGRESS = 0.7;
export const INTRO_CAMERA_DURATION_SECONDS = 6;
export const DESTROY_BELOW_GROUND_DISTANCE = 5;

export const FALLBACK_STACK_ANCHOR = new THREE.Vector3(0, 0, 0);
export const WORLD_UP_AXIS = new THREE.Vector3(0, 1, 0);
export const SKYBOX_OBJECT_NAMES = new Set(['skybox', 'skybiox']);
export const BLENDER_CAMERA_VIEW = {
  position: new THREE.Vector3(-87.64164733886719, 9.622027397155762, 35.54764938354492),
  target: new THREE.Vector3(-9.503303527832031, 1.950033187866211, -26.38408660888672),
  up: new THREE.Vector3(0.060124725103378296, 0.997052788734436, -0.04765469580888748),
  fov: 46.397181333762305,
};

export const WATER_SETTINGS = {
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
    reflectionStrength: 0.68,
  },
};

export const initialGameState = {
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
