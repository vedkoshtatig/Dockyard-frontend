import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  AMBIENT_BIRD_AREA_RADIUS,
  AMBIENT_BIRD_BIG_FLOCK_SIZE_RANGE,
  AMBIENT_BIRD_FLOCK_COUNT,
  AMBIENT_BIRD_FLOCK_SIZE_RANGE,
  AMBIENT_BIRD_FLOCK_SPREAD,
  AMBIENT_BIRD_FORWARD_OFFSET,
  AMBIENT_BIRD_HEIGHT_RANGE,
  AMBIENT_BIRD_MIN_RADIUS,
  AMBIENT_BIRD_MODEL_URL,
  AMBIENT_BIRD_ORBIT_SPEED_RANGE,
  AMBIENT_BIRD_SMALL_FLOCK_SIZE_RANGE,
  AMBIENT_BIRD_SINGLE_COUNT,
  AMBIENT_BIRD_SIZE_RANGE,
  AMBIENT_BOAT_COUNT,
  AMBIENT_BOAT_DOCKYARD_COUNT,
  AMBIENT_BOAT_EDGE_PADDING,
  AMBIENT_BOAT_FORWARD_OFFSET,
  AMBIENT_BOAT_HORIZON_LIFT,
  AMBIENT_BOAT_HORIZON_LIFT_END,
  AMBIENT_BOAT_HORIZON_LIFT_START,
  AMBIENT_BOAT_LANE_RADIUS_RANGE,
  AMBIENT_BOAT_LENGTH_RANGE,
  AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS,
  AMBIENT_BOAT_MODEL_URL,
  AMBIENT_BOAT_SPEED_RANGE,
  AMBIENT_BOAT_WATER_OFFSET,
  WATER_BOAT_WAKE_MAX_COUNT,
  WATER_HORIZON_CURVE_START,
} from '../core/constants.js';

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();
const tempPosition = new THREE.Vector3();
const tempNextPosition = new THREE.Vector3();
const tempPlanarDirection = new THREE.Vector2();

const BOAT_MAIN_AREA_FOCUS_CHANCE = 0.82;
const BOAT_OUTER_OCEAN_RADIUS_MULTIPLIER = 1.85;
const BOAT_FOCUS_RADIUS_MULTIPLIER = 1.15;
const BOAT_DOCKYARD_ROUTE_RADIUS_PADDING = 280;
const BOAT_ROUTE_MIN_TURN = 0.28;
const BOAT_ROUTE_MAX_TURN = 0.92;
const BOAT_MIN_ROUTE_DISTANCE = 80;
const BOAT_MIN_SEPARATION = 34;
const BOAT_DOCK_CLEARANCE_SCALE = 0.42;
const BOAT_TURN_SPEED_RANGE = [0.42, 0.82];
const BOAT_TEMPLATE_NAME_PATTERN = /boat|ship|vessel|yacht|sail[_\s-]?boat|jet[_\s-]?ski/i;
const TEMPLATE_CONTAINER_NAME_PATTERN = /sketchfab|rootnode|pack|collection/i;
const BIRD_ANIMATION_SPEED_RANGE = [1.35, 2.15];
const BIRD_DOCK_CLEARANCE_SCALE = 1.02;
const BIRD_BIG_FLOCK_INTERVAL = 3;
const BIRD_SMALL_FLOCK_INTERVAL = 2;
const BIRD_MIN_FLOCK_SEPARATION = 5.5;
const DARK_AMBIENT_BOAT_MATERIAL_NAMES = new Set([
  'Low_Poly_Boat_02SG',
  'Low_Poly_Boat_05SG',
]);

function randomRange([min, max]) {
  return THREE.MathUtils.randFloat(min, max);
}

function randomIntegerRange([min, max]) {
  return THREE.MathUtils.randInt(min, max);
}

function randomFromArray(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function countRenderableMeshes(object) {
  let count = 0;

  object.traverse((child) => {
    if (child.isMesh || child.isSkinnedMesh) {
      count += 1;
    }
  });

  return count;
}

function objectMaterialNames(object) {
  if (!object.material) return [];
  return Array.isArray(object.material)
    ? object.material.map((material) => material?.name ?? '')
    : [object.material.name ?? ''];
}

function getObjectMaterials(object) {
  if (!object.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
}

function getObjectSearchText(object, includeDescendants = false) {
  const parts = [
    object.name ?? '',
    ...objectMaterialNames(object),
  ];

  if (includeDescendants) {
    object.traverse((child) => {
      if (child === object) return;
      parts.push(child.name ?? '', ...objectMaterialNames(child));
    });
  }

  return parts.join(' ');
}

function isTemplateContainerGroup(object) {
  if (object.isMesh || object.isSkinnedMesh) return false;
  return TEMPLATE_CONTAINER_NAME_PATTERN.test(object.name ?? '');
}

function isBoatTemplateCandidate(object, includeDescendants = false) {
  return BOAT_TEMPLATE_NAME_PATTERN.test(getObjectSearchText(object, includeDescendants));
}

function isIndividualBoatMesh(object) {
  if (!object.isMesh && !object.isSkinnedMesh) return false;

  return isBoatTemplateCandidate(object);
}

function hasDescendantGroupTemplate(object, matcher) {
  let found = false;

  object.traverse((child) => {
    if (found || child === object || child.isMesh || child.isSkinnedMesh) return;
    if (countRenderableMeshes(child) <= 0 || isTemplateContainerGroup(child)) return;

    if (matcher(child, true)) {
      found = true;
    }
  });

  return found;
}

function countDirectMatchingMeshes(object, matcher) {
  return object.children.reduce((count, child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return count;
    return matcher(child) ? count + 1 : count;
  }, 0);
}

function findLeafGroupTemplates(sceneRoot, matcher) {
  const templates = [];

  sceneRoot.traverse((object) => {
    if (object === sceneRoot || object.isMesh || object.isSkinnedMesh) return;
    if (countRenderableMeshes(object) <= 0 || isTemplateContainerGroup(object)) return;
    if (!matcher(object, true)) return;
    if (hasDescendantGroupTemplate(object, matcher)) return;
    if (countDirectMatchingMeshes(object, matcher) > 1) return;

    templates.push(object);
  });

  return templates;
}

function findLeafMeshTemplates(sceneRoot, matcher) {
  const templates = [];

  sceneRoot.traverse((object) => {
    if ((!object.isMesh && !object.isSkinnedMesh) || countRenderableMeshes(object) <= 0) return;
    if (matcher(object)) {
      templates.push(object);
    }
  });

  return templates;
}

function brightenDarkBoatMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;

    for (const material of getObjectMaterials(child)) {
      if (!material || !DARK_AMBIENT_BOAT_MATERIAL_NAMES.has(material.name)) continue;

      if (material.color?.isColor) {
        material.color.multiplyScalar(1.85);
      }
      if (material.emissive?.isColor) {
        material.emissive.setRGB(0.18, 0.2, 0.2);
        material.emissiveIntensity = 0.42;
      }
      if ('roughness' in material) {
        material.roughness = Math.min(material.roughness ?? 1, 0.62);
      }
      material.needsUpdate = true;
    }
  });
}

function cloneMaterialForAmbient(material, options, materialCache) {
  if (!material) return material;
  if (materialCache.has(material)) return materialCache.get(material);

  const clone = material.clone();
  if ('metalness' in clone && Number.isFinite(options.metalness)) {
    clone.metalness = options.metalness;
  }
  if ('roughness' in clone && Number.isFinite(options.roughness)) {
    clone.roughness = options.roughness;
  }
  if ('envMapIntensity' in clone && Number.isFinite(options.envMapIntensity)) {
    clone.envMapIntensity = options.envMapIntensity;
  }
  if (options.side) {
    clone.side = options.side;
  }
  clone.needsUpdate = true;

  materialCache.set(material, clone);
  return clone;
}

function prepareAmbientObject(object, options = {}) {
  const materialCache = new Map();

  object.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;

    child.castShadow = Boolean(options.castShadow);
    child.receiveShadow = Boolean(options.receiveShadow);
    child.frustumCulled = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) =>
        cloneMaterialForAmbient(material, options, materialCache)
      );
    } else if (child.material) {
      child.material = cloneMaterialForAmbient(child.material, options, materialCache);
    }
  });
}

function cloneObjectWithWorldTransform(object, cloneFn = (source) => source.clone(true)) {
  object.updateWorldMatrix(true, true);
  const clone = cloneFn(object);

  clone.position.set(0, 0, 0);
  clone.quaternion.identity();
  clone.scale.set(1, 1, 1);
  clone.updateMatrix();
  clone.applyMatrix4(object.matrixWorld);

  return clone;
}

function centerObjectContent(object) {
  object.updateWorldMatrix(true, true);
  tempBox.setFromObject(object);
  if (tempBox.isEmpty()) return;

  tempBox.getCenter(tempCenter);
  object.position.sub(tempCenter);
}

function centerObjectOnWaterline(object) {
  object.updateWorldMatrix(true, true);
  tempBox.setFromObject(object);
  if (tempBox.isEmpty()) return;

  tempBox.getCenter(tempCenter);
  object.position.x -= tempCenter.x;
  object.position.y -= tempBox.min.y;
  object.position.z -= tempCenter.z;
}

function scaleObjectToDimension(object, targetDimension, usePlanarLength = false) {
  object.updateWorldMatrix(true, true);
  tempBox.setFromObject(object);
  if (tempBox.isEmpty()) return;

  tempBox.getSize(tempSize);
  const sourceDimension = usePlanarLength
    ? Math.max(tempSize.x, tempSize.z)
    : Math.max(tempSize.x, tempSize.y, tempSize.z);

  if (sourceDimension <= 0.0001) return;
  object.scale.multiplyScalar(targetDimension / sourceDimension);
}

function getTrackNodeName(track) {
  try {
    return THREE.PropertyBinding.parseTrackName(track.name).nodeName;
  } catch {
    return track.name.split('.')[0];
  }
}

function createFilteredClipForRoot(clip, root) {
  const nodeNames = new Set();
  root.traverse((object) => {
    if (object.name) {
      nodeNames.add(object.name);
    }
  });

  const tracks = clip.tracks.filter((track) => nodeNames.has(getTrackNodeName(track)));
  if (tracks.length === 0) return null;

  return new THREE.AnimationClip(`${clip.name}-${root.uuid}`, clip.duration, tracks);
}

function setOrbitPosition(target, center, radiusX, radiusZ, angle, y) {
  target.set(
    center.x + Math.cos(angle) * radiusX,
    y,
    center.z + Math.sin(angle) * radiusZ,
  );
}

function orientAlongPlanarMotion(object, from, to, forwardOffset = 0) {
  const deltaX = to.x - from.x;
  const deltaZ = to.z - from.z;

  if (Math.abs(deltaX) + Math.abs(deltaZ) < 0.0001) {
    return;
  }

  object.rotation.y = Math.atan2(deltaX, deltaZ) + forwardOffset;
}

function planarHeadingToPoint(from, to) {
  return Math.atan2(to.x - from.x, to.y - from.y);
}

function moveDirectionFromHeading(target, heading) {
  target.set(Math.sin(heading), Math.cos(heading));
}

function rotateHeadingToward(current, target, maxStep) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

function randomRadiusBetween(min, max, bias = 1) {
  const t = Math.pow(Math.random(), bias);
  return THREE.MathUtils.lerp(min, max, t);
}

function pointDistanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clearGroup(group) {
  while (group.children.length) {
    group.remove(group.children[0]);
  }
}

function getTemplateDisplayName(template) {
  return template.name || template.type || 'unnamed_template';
}

export function createAmbientLifeSystem({
  scene,
  getModelRoot = () => null,
  getWater = () => null,
} = {}) {
  const root = new THREE.Group();
  root.name = 'ambient_life';
  scene.add(root);

  const birdsRoot = new THREE.Group();
  birdsRoot.name = 'ambient_birds';
  root.add(birdsRoot);

  const boatsRoot = new THREE.Group();
  boatsRoot.name = 'ambient_boats';
  root.add(boatsRoot);

  const flocks = [];
  const boats = [];
  const mixers = [];
  let loadPromise = null;
  let boatTemplateNames = [];

  function getWaterInfo() {
    const water = getWater();
    const bounds = water?.userData?.bounds;
    const center = bounds?.center?.isVector3
      ? bounds.center.clone()
      : water?.position?.clone?.() ?? getModelCenter();
    const halfSize = Number.isFinite(bounds?.halfSize)
      ? bounds.halfSize
      : AMBIENT_BOAT_LANE_RADIUS_RANGE[1] + AMBIENT_BOAT_EDGE_PADDING;
    const level = Number.isFinite(water?.userData?.level)
      ? water.userData.level
      : water?.position?.y ?? 0;

    return { center, halfSize, level };
  }

  function getDistantBoatLift(position, waterInfo) {
    const distanceFromWaterCenter = Math.hypot(
      position.x - waterInfo.center.x,
      position.y - waterInfo.center.z,
    );
    const horizonBlend = THREE.MathUtils.smoothstep(
      distanceFromWaterCenter,
      AMBIENT_BOAT_HORIZON_LIFT_START,
      AMBIENT_BOAT_HORIZON_LIFT_END,
    );

    return horizonBlend * AMBIENT_BOAT_HORIZON_LIFT;
  }

  function getModelCenter() {
    const modelRoot = getModelRoot();
    if (!modelRoot) return new THREE.Vector3();

    tempBox.setFromObject(modelRoot);
    if (tempBox.isEmpty()) return new THREE.Vector3();

    return tempBox.getCenter(new THREE.Vector3());
  }

  function getModelClearanceRadius() {
    const modelRoot = getModelRoot();
    if (!modelRoot) return AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS;

    tempBox.setFromObject(modelRoot);
    if (tempBox.isEmpty()) return AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS;

    tempBox.getSize(tempSize);
    return Math.max(tempSize.x, tempSize.z) * 0.5 + AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS;
  }

  function getBirdMinimumOrbitRadius() {
    return Math.max(
      AMBIENT_BIRD_MIN_RADIUS,
      getModelClearanceRadius() * BIRD_DOCK_CLEARANCE_SCALE,
    );
  }

  function getBirdOrbitRadius() {
    const minRadius = getBirdMinimumOrbitRadius();
    const maxRadius = Math.max(minRadius + 80, AMBIENT_BIRD_AREA_RADIUS);

    return THREE.MathUtils.randFloat(minRadius, maxRadius);
  }

  function getBirdFlockSize(index) {
    if (index % BIRD_BIG_FLOCK_INTERVAL === 0) {
      return randomIntegerRange(AMBIENT_BIRD_BIG_FLOCK_SIZE_RANGE);
    }

    if (index % BIRD_SMALL_FLOCK_INTERVAL === 0) {
      return randomIntegerRange(AMBIENT_BIRD_SMALL_FLOCK_SIZE_RANGE);
    }

    return randomIntegerRange(AMBIENT_BIRD_FLOCK_SIZE_RANGE);
  }

  function getBoatRouteBounds(waterInfo = getWaterInfo()) {
    const modelCenter = getModelCenter();
    const meshWaterRadius = Math.max(
      AMBIENT_BOAT_LANE_RADIUS_RANGE[1],
      waterInfo.halfSize - AMBIENT_BOAT_EDGE_PADDING,
    );
    const waterRadius = Math.min(meshWaterRadius, WATER_HORIZON_CURVE_START - 90);
    const minRadius = Math.min(
      waterRadius - BOAT_MIN_ROUTE_DISTANCE,
      Math.max(AMBIENT_BOAT_LANE_RADIUS_RANGE[0], getModelClearanceRadius() * BOAT_DOCK_CLEARANCE_SCALE),
    );
    const focusRadius = Math.min(
      waterRadius,
      Math.max(minRadius + 360, AMBIENT_BOAT_LANE_RADIUS_RANGE[1] * BOAT_FOCUS_RADIUS_MULTIPLIER),
    );
    const maxRadius = Math.min(
      waterRadius,
      Math.max(focusRadius + 280, AMBIENT_BOAT_LANE_RADIUS_RANGE[1] * BOAT_OUTER_OCEAN_RADIUS_MULTIPLIER),
    );

    return {
      center: new THREE.Vector2(modelCenter.x, modelCenter.z),
      minRadius: Math.max(minRadius, 1),
      focusRadius,
      maxRadius,
    };
  }

  function getDockyardBoatRouteBounds(waterInfo = getWaterInfo()) {
    const routeBounds = getBoatRouteBounds(waterInfo);
    const maxRadius = Math.min(
      routeBounds.maxRadius,
      Math.max(
        routeBounds.minRadius + BOAT_DOCKYARD_ROUTE_RADIUS_PADDING,
        routeBounds.focusRadius * 0.62,
      ),
    );

    return {
      center: routeBounds.center,
      minRadius: routeBounds.minRadius,
      focusRadius: Math.min(maxRadius, Math.max(routeBounds.minRadius + 120, maxRadius * 0.82)),
      maxRadius,
    };
  }

  function getBoatRouteBoundsForBoat(boat, waterInfo = getWaterInfo()) {
    return boat?.staysNearDockyard
      ? getDockyardBoatRouteBounds(waterInfo)
      : getBoatRouteBounds(waterInfo);
  }

  function getDockyardBoatCount() {
    return Math.min(AMBIENT_BOAT_DOCKYARD_COUNT, AMBIENT_BOAT_COUNT);
  }

  function getBoatSpawnAngle(index, staysNearDockyard) {
    if (staysNearDockyard) {
      const dockyardBoatCount = Math.max(getDockyardBoatCount(), 1);
      return (index / dockyardBoatCount) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.36);
    }

    const oceanBoatCount = Math.max(AMBIENT_BOAT_COUNT - getDockyardBoatCount(), 1);
    const oceanIndex = Math.max(index - getDockyardBoatCount(), 0);
    return (oceanIndex / oceanBoatCount) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.64);
  }

  function isBoatPointSeparated(point, minDistance, excludedBoat = null) {
    const minDistanceSquared = minDistance * minDistance;

    return boats.every((boat) => {
      if (boat === excludedBoat) return true;
      if (boat.position && pointDistanceSquared(point, boat.position) < minDistanceSquared) return false;
      if (boat.target && pointDistanceSquared(point, boat.target) < minDistanceSquared) return false;
      return true;
    });
  }

  function sampleBoatOceanPoint(routeBounds, {
    angle = Math.random() * Math.PI * 2,
    angleJitter = Math.PI * 2,
    excludedBoat = null,
    minSeparation = BOAT_MIN_SEPARATION,
    preferFocus = Math.random() < BOAT_MAIN_AREA_FOCUS_CHANCE,
  } = {}) {
    let fallback = null;

    for (let attempt = 0; attempt < 36; attempt += 1) {
      const useFocus = attempt < 22 ? preferFocus : Math.random() < BOAT_MAIN_AREA_FOCUS_CHANCE;
      const radiusMax = useFocus ? routeBounds.focusRadius : routeBounds.maxRadius;
      const radiusMin = Math.min(routeBounds.minRadius, radiusMax - 1);
      const routeAngle = angle + THREE.MathUtils.randFloatSpread(angleJitter);
      const radius = randomRadiusBetween(radiusMin, radiusMax, useFocus ? 2.2 : 0.82);
      const point = new THREE.Vector2(
        routeBounds.center.x + Math.cos(routeAngle) * radius,
        routeBounds.center.y + Math.sin(routeAngle) * radius,
      );

      fallback = point;
      if (isBoatPointSeparated(point, minSeparation, excludedBoat)) {
        return point;
      }
    }

    return fallback ?? routeBounds.center.clone();
  }

  function chooseNextBoatTarget(boat) {
    const routeBounds = getBoatRouteBoundsForBoat(boat);
    const currentAngle = Math.atan2(
      boat.position.y - routeBounds.center.y,
      boat.position.x - routeBounds.center.x,
    );
    const turnDirection = Math.random() < 0.5 ? -1 : 1;
    let target = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const turn = THREE.MathUtils.randFloat(BOAT_ROUTE_MIN_TURN, BOAT_ROUTE_MAX_TURN) * turnDirection;
      target = sampleBoatOceanPoint(routeBounds, {
        angle: currentAngle + turn,
        angleJitter: 0.28 + attempt * 0.1,
        excludedBoat: boat,
        minSeparation: BOAT_MIN_SEPARATION,
        preferFocus: boat.staysNearDockyard || Math.random() < BOAT_MAIN_AREA_FOCUS_CHANCE,
      });

      if (target.distanceTo(boat.position) >= BOAT_MIN_ROUTE_DISTANCE) break;
    }

    boat.target.copy(target);
  }

  function findBirdTemplates(sceneRoot) {
    const armatures = [];

    sceneRoot.traverse((object) => {
      if (/^Armature(?:\.|$)/i.test(object.name) && countRenderableMeshes(object) > 0) {
        armatures.push(object);
      }
    });

    if (armatures.length) return armatures;

    const renderableChildren = sceneRoot.children.filter((child) => countRenderableMeshes(child) > 0);
    return renderableChildren.length ? renderableChildren : [sceneRoot];
  }

  function startBirdAnimation(bird, animations) {
    if (!animations.length) return;

    const mixer = new THREE.AnimationMixer(bird);
    let hasAction = false;

    for (const clip of animations) {
      const filteredClip = createFilteredClipForRoot(clip, bird);
      if (!filteredClip) continue;

      const action = mixer.clipAction(filteredClip);
      action.timeScale = randomRange(BIRD_ANIMATION_SPEED_RANGE);
      action.play();
      action.time = Math.random() * filteredClip.duration;
      hasAction = true;
    }

    if (hasAction) {
      mixers.push(mixer);
    }
  }

  function createBirdInstance(template, animations, isFlockBird) {
    const bird = cloneObjectWithWorldTransform(template, SkeletonUtils.clone);
    bird.name = isFlockBird ? 'ambient_flock_bird' : 'ambient_single_bird';

    prepareAmbientObject(bird, {
      castShadow: false,
      envMapIntensity: 0.12,
      metalness: 0,
      receiveShadow: false,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    centerObjectContent(bird);
    scaleObjectToDimension(bird, randomRange(AMBIENT_BIRD_SIZE_RANGE));
    startBirdAnimation(bird, animations);

    return bird;
  }

  function createBirdFlock(template, animations, flockSize, index) {
    const flock = new THREE.Group();
    flock.name = flockSize > 1 ? `ambient_bird_flock_${index + 1}` : `ambient_bird_single_${index + 1}`;

    const spread = flockSize > 1 ? AMBIENT_BIRD_FLOCK_SPREAD : 0;
    const birdEntries = [];
    const occupiedPositions = [];

    for (let birdIndex = 0; birdIndex < flockSize; birdIndex += 1) {
      const bird = createBirdInstance(template, animations, flockSize > 1);
      const candidatePosition = new THREE.Vector3();

      for (let attempt = 0; attempt < 20; attempt += 1) {
        candidatePosition.set(
          THREE.MathUtils.randFloatSpread(spread),
          THREE.MathUtils.randFloatSpread(spread * 0.28),
          THREE.MathUtils.randFloatSpread(spread * 0.72),
        );

        if (occupiedPositions.every((position) => position.distanceTo(candidatePosition) >= BIRD_MIN_FLOCK_SEPARATION)) {
          break;
        }
      }

      bird.position.copy(candidatePosition);
      occupiedPositions.push(candidatePosition.clone());
      bird.userData.basePosition = bird.position.clone();
      bird.userData.flightPhase = Math.random() * Math.PI * 2;
      bird.userData.flightSpeed = THREE.MathUtils.randFloat(1.2, 2.2);
      birdEntries.push(bird);
      flock.add(bird);
    }

    const waterInfo = getWaterInfo();
    const orbitCenter = getModelCenter();
    const minOrbitRadius = getBirdMinimumOrbitRadius();
    const orbitRadius = getBirdOrbitRadius();
    const radiusX = Math.max(minOrbitRadius, orbitRadius * THREE.MathUtils.randFloat(0.76, 1.16));
    const radiusZ = Math.max(minOrbitRadius, orbitRadius * THREE.MathUtils.randFloat(0.72, 1.12));
    const angle = Math.random() * Math.PI * 2;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const flight = {
      angle,
      angularSpeed: randomRange(AMBIENT_BIRD_ORBIT_SPEED_RANGE) * direction,
      birds: birdEntries,
      bobAmount: THREE.MathUtils.randFloat(0.7, 1.8),
      bobSpeed: THREE.MathUtils.randFloat(0.35, 0.82),
      center: orbitCenter,
      group: flock,
      height: waterInfo.level + randomRange(AMBIENT_BIRD_HEIGHT_RANGE),
      phase: Math.random() * Math.PI * 2,
      radiusX,
      radiusZ,
    };

    updateBirdFlock(flight, 0, 0);
    birdsRoot.add(flock);
    flocks.push(flight);
  }

  function setupBirds(gltf) {
    clearGroup(birdsRoot);
    flocks.length = 0;
    mixers.length = 0;

    const templates = findBirdTemplates(gltf.scene);
    if (!templates.length) {
      console.warn('No bird templates found in ambient bird model.');
      return;
    }

    let flockIndex = 0;
    for (let index = 0; index < AMBIENT_BIRD_FLOCK_COUNT; index += 1) {
      createBirdFlock(
        randomFromArray(templates),
        gltf.animations ?? [],
        getBirdFlockSize(index),
        flockIndex,
      );
      flockIndex += 1;
    }

    for (let index = 0; index < AMBIENT_BIRD_SINGLE_COUNT; index += 1) {
      createBirdFlock(randomFromArray(templates), gltf.animations ?? [], 1, flockIndex);
      flockIndex += 1;
    }
  }

  function findBoatTemplates(sceneRoot) {
    const groupTemplates = findLeafGroupTemplates(sceneRoot, isBoatTemplateCandidate);
    if (groupTemplates.length) return groupTemplates;

    const meshTemplates = findLeafMeshTemplates(sceneRoot, isIndividualBoatMesh);
    if (meshTemplates.length) return meshTemplates;

    const templates = [];
    sceneRoot.traverse((object) => {
      if ((object.isMesh || object.isSkinnedMesh) && countRenderableMeshes(object) > 0) {
        templates.push(object);
      }
    });

    return templates.length ? templates : [sceneRoot];
  }

  function createBoatInstance(template, index, targetLength) {
    const boat = cloneObjectWithWorldTransform(template);
    boat.name = `ambient_boat_model_${index + 1}`;

    prepareAmbientObject(boat, {
      castShadow: false,
      envMapIntensity: 0.22,
      metalness: 0,
      receiveShadow: false,
      roughness: 0.78,
    });
    centerObjectOnWaterline(boat);
    scaleObjectToDimension(boat, targetLength, true);
    brightenDarkBoatMaterials(boat);

    return boat;
  }

  function createBoatVoyage(template, index) {
    const waterInfo = getWaterInfo();
    const staysNearDockyard = index < getDockyardBoatCount();
    const routeBounds = staysNearDockyard
      ? getDockyardBoatRouteBounds(waterInfo)
      : getBoatRouteBounds(waterInfo);
    const initialAngle = getBoatSpawnAngle(index, staysNearDockyard);
    const startPosition = sampleBoatOceanPoint(routeBounds, {
      angle: initialAngle,
      angleJitter: 0.42,
      minSeparation: BOAT_MIN_SEPARATION,
      preferFocus: staysNearDockyard || index % 5 !== 0,
    });
    const length = randomRange(AMBIENT_BOAT_LENGTH_RANGE);
    const speed = randomRange(AMBIENT_BOAT_SPEED_RANGE);
    const boat = {
      group: new THREE.Group(),
      heading: 0,
      heaveAmount: THREE.MathUtils.randFloat(0.08, 0.24),
      heaveSpeed: THREE.MathUtils.randFloat(0.72, 1.15),
      moveDirection: new THREE.Vector2(0, 1),
      phase: Math.random() * Math.PI * 2,
      position: startPosition,
      pitchAmount: THREE.MathUtils.randFloat(0.008, 0.026),
      pitchSpeed: THREE.MathUtils.randFloat(0.5, 0.9),
      rollAmount: THREE.MathUtils.randFloat(0.018, 0.048),
      rollSpeed: THREE.MathUtils.randFloat(0.62, 1.05),
      speed,
      staysNearDockyard,
      target: startPosition.clone(),
      turnSpeed: randomRange(BOAT_TURN_SPEED_RANGE),
      wakeDirection: new THREE.Vector2(0, 1),
      wakeLength: THREE.MathUtils.clamp(length * 4.8, 48, 108),
      wakePosition: new THREE.Vector2(),
      wakeStrength: THREE.MathUtils.clamp(speed / AMBIENT_BOAT_SPEED_RANGE[1], 0.52, 0.95),
      wakeWidth: THREE.MathUtils.clamp(length * 0.16, 1.8, 4.8),
    };

    boat.group.name = `ambient_boat_${index + 1}`;
    boat.group.add(createBoatInstance(template, index, length));
    chooseNextBoatTarget(boat);
    boat.heading = planarHeadingToPoint(boat.position, boat.target);
    moveDirectionFromHeading(boat.moveDirection, boat.heading);
    updateBoat(boat, 0, 0);
    boatsRoot.add(boat.group);
    boats.push(boat);
  }

  function constrainDockyardBoatToRouteBounds(boat, routeBounds) {
    if (!boat.staysNearDockyard) return;

    tempPlanarDirection.copy(boat.position).sub(routeBounds.center);
    const distance = tempPlanarDirection.length();
    let constrained = false;

    if (distance > routeBounds.maxRadius) {
      tempPlanarDirection.multiplyScalar(routeBounds.maxRadius / distance);
      constrained = true;
    } else if (distance > 0.0001 && distance < routeBounds.minRadius) {
      tempPlanarDirection.multiplyScalar(routeBounds.minRadius / distance);
      constrained = true;
    }

    if (!constrained) return;

    boat.position.copy(routeBounds.center).add(tempPlanarDirection);
    chooseNextBoatTarget(boat);
    boat.heading = planarHeadingToPoint(boat.position, boat.target);
    moveDirectionFromHeading(boat.moveDirection, boat.heading);
  }

  function updateBoatWakeUniforms() {
    const water = getWater();
    const uniforms = water?.material?.uniforms;
    const wakeDataA = uniforms?.boatWakeDataA?.value;
    const wakeDataB = uniforms?.boatWakeDataB?.value;

    if (!uniforms?.boatWakeCount || !Array.isArray(wakeDataA) || !Array.isArray(wakeDataB)) {
      return;
    }

    const wakeCount = Math.min(boats.length, wakeDataA.length, wakeDataB.length, WATER_BOAT_WAKE_MAX_COUNT);
    uniforms.boatWakeCount.value = wakeCount;

    for (let index = 0; index < wakeCount; index += 1) {
      const boat = boats[index];
      wakeDataA[index].set(
        boat.wakePosition.x,
        boat.wakePosition.y,
        boat.wakeLength,
        boat.wakeStrength,
      );
      wakeDataB[index].set(
        boat.wakeDirection.x,
        boat.wakeDirection.y,
        boat.wakeWidth,
        boat.speed,
      );
    }

    for (let index = wakeCount; index < wakeDataA.length && index < wakeDataB.length; index += 1) {
      wakeDataA[index].set(9999, 9999, 0, 0);
      wakeDataB[index].set(0, 1, 0, 0);
    }
  }

  function setupBoats(gltf) {
    clearGroup(boatsRoot);
    boats.length = 0;
    boatTemplateNames = [];
    updateBoatWakeUniforms();

    const templates = findBoatTemplates(gltf.scene);
    if (!templates.length) {
      console.warn('No boat templates found in ambient boat model.');
      return;
    }
    boatTemplateNames = templates.map(getTemplateDisplayName);

    for (let index = 0; index < AMBIENT_BOAT_COUNT; index += 1) {
      createBoatVoyage(templates[index % templates.length], index);
    }
    updateBoatWakeUniforms();
  }

  function updateBirdFlock(flock, elapsedSeconds, deltaSeconds) {
    flock.angle += flock.angularSpeed * deltaSeconds;
    const y = flock.height + Math.sin(elapsedSeconds * flock.bobSpeed + flock.phase) * flock.bobAmount;

    setOrbitPosition(tempPosition, flock.center, flock.radiusX, flock.radiusZ, flock.angle, y);
    setOrbitPosition(
      tempNextPosition,
      flock.center,
      flock.radiusX,
      flock.radiusZ,
      flock.angle + Math.sign(flock.angularSpeed || 1) * 0.01,
      y,
    );

    flock.group.position.copy(tempPosition);
    orientAlongPlanarMotion(flock.group, tempPosition, tempNextPosition, AMBIENT_BIRD_FORWARD_OFFSET);

    for (const bird of flock.birds) {
      const basePosition = bird.userData.basePosition;
      if (!basePosition) continue;

      const phase = bird.userData.flightPhase;
      const speed = bird.userData.flightSpeed;
      bird.position.y = basePosition.y + Math.sin(elapsedSeconds * speed + phase) * 0.28;
    }
  }

  function updateBoat(boat, elapsedSeconds, deltaSeconds) {
    const waterInfo = getWaterInfo();
    const routeBounds = getBoatRouteBoundsForBoat(boat, waterInfo);
    tempPlanarDirection.copy(boat.target).sub(boat.position);
    let targetDistance = tempPlanarDirection.length();

    if (targetDistance < Math.max(8, boat.speed * deltaSeconds * 2)) {
      chooseNextBoatTarget(boat);
      tempPlanarDirection.copy(boat.target).sub(boat.position);
      targetDistance = tempPlanarDirection.length();
    }

    if (targetDistance > 0.0001) {
      const desiredHeading = planarHeadingToPoint(boat.position, boat.target);
      boat.heading = rotateHeadingToward(boat.heading, desiredHeading, boat.turnSpeed * deltaSeconds);
    }

    moveDirectionFromHeading(boat.moveDirection, boat.heading);
    const moveDistance = Math.min(targetDistance, boat.speed * deltaSeconds);
    boat.position.addScaledVector(boat.moveDirection, moveDistance);
    constrainDockyardBoatToRouteBounds(boat, routeBounds);

    const waterY = waterInfo.level
      + AMBIENT_BOAT_WATER_OFFSET
      + getDistantBoatLift(boat.position, waterInfo);
    const heave = Math.sin(elapsedSeconds * boat.heaveSpeed + boat.phase) * boat.heaveAmount;
    tempPosition.set(boat.position.x, waterY + heave, boat.position.y);
    tempNextPosition.set(
      boat.position.x + boat.moveDirection.x,
      waterY + heave,
      boat.position.y + boat.moveDirection.y,
    );

    boat.group.position.copy(tempPosition);
    boat.wakeDirection.copy(boat.moveDirection);
    boat.wakePosition.set(tempPosition.x, tempPosition.z);

    orientAlongPlanarMotion(boat.group, tempPosition, tempNextPosition, AMBIENT_BOAT_FORWARD_OFFSET);
    boat.group.rotation.x = Math.sin(elapsedSeconds * boat.pitchSpeed + boat.phase) * boat.pitchAmount;
    boat.group.rotation.z = Math.sin(elapsedSeconds * boat.rollSpeed + boat.phase) * boat.rollAmount;
  }

  function getBoatDistanceStats() {
    const center = getModelCenter();
    const distances = boats.map((boat) => Math.hypot(
      boat.group.position.x - center.x,
      boat.group.position.z - center.z,
    ));

    if (!distances.length) {
      return null;
    }

    const total = distances.reduce((sum, distance) => sum + distance, 0);

    return {
      average: total / distances.length,
      max: Math.max(...distances),
      min: Math.min(...distances),
    };
  }

  function getDockyardBoatStats() {
    const routeBounds = getDockyardBoatRouteBounds();
    const center = getModelCenter();
    const distances = boats.map((boat) => ({
      distance: Math.hypot(
        boat.group.position.x - center.x,
        boat.group.position.z - center.z,
      ),
      staysNearDockyard: boat.staysNearDockyard,
    }));
    const nearbyCount = distances.filter((entry) => entry.distance <= routeBounds.maxRadius).length;
    const managedNearbyCount = distances.filter((entry) =>
      entry.staysNearDockyard && entry.distance <= routeBounds.maxRadius
    ).length;

    return {
      managedNearbyCount,
      maxRadius: routeBounds.maxRadius,
      nearbyCount,
      required: getDockyardBoatCount(),
    };
  }

  function getBirdDistanceStats() {
    const center = getModelCenter();
    const distances = flocks.map((flock) => Math.hypot(
      flock.group.position.x - center.x,
      flock.group.position.z - center.z,
    ));

    if (!distances.length) {
      return null;
    }

    const total = distances.reduce((sum, distance) => sum + distance, 0);

    return {
      average: total / distances.length,
      max: Math.max(...distances),
      min: Math.min(...distances),
    };
  }

  function getBirdHeightStats() {
    const heights = flocks.map((flock) => flock.group.position.y);

    if (!heights.length) {
      return null;
    }

    const total = heights.reduce((sum, height) => sum + height, 0);

    return {
      average: total / heights.length,
      max: Math.max(...heights),
      min: Math.min(...heights),
    };
  }

  function getBoatHeadingAlignmentStats() {
    const alignments = boats.map((boat) => {
      const noseDirection = new THREE.Vector2(
        Math.cos(boat.group.rotation.y),
        -Math.sin(boat.group.rotation.y),
      );
      return noseDirection.dot(boat.moveDirection);
    });

    if (!alignments.length) {
      return null;
    }

    const total = alignments.reduce((sum, alignment) => sum + alignment, 0);

    return {
      average: total / alignments.length,
      max: Math.max(...alignments),
      min: Math.min(...alignments),
    };
  }

  function installDebugHelpers() {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return;
    }

    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getAmbientLifeSnapshot: () => ({
        birdCount: flocks.reduce((count, flock) => count + flock.birds.length, 0),
        birdDistanceStats: getBirdDistanceStats(),
        birdFlockCount: flocks.length,
        birdFlockSizes: flocks.map((flock) => flock.birds.length),
        birdHeightStats: getBirdHeightStats(),
        boatCount: boats.length,
        boatDistanceStats: getBoatDistanceStats(),
        dockyardBoatStats: getDockyardBoatStats(),
        boatHeadingAlignmentStats: getBoatHeadingAlignmentStats(),
        boatMeshCounts: boats.map((boat) => countRenderableMeshes(boat.group)),
        boatTemplateNames,
        boatWakeCapacity: getWater()?.material?.uniforms?.boatWakeDataA?.value?.length ?? null,
        boatWakeCount: getWater()?.material?.uniforms?.boatWakeCount?.value ?? null,
        firstBirdPosition: flocks[0]?.group.position.toArray() ?? null,
        firstBoatPosition: boats[0]?.group.position.toArray() ?? null,
      }),
    };
  }

  function update(elapsedSeconds, deltaSeconds = 0) {
    const frameDelta = Number.isFinite(deltaSeconds) ? Math.min(deltaSeconds, 0.08) : 0;

    for (const mixer of mixers) {
      mixer.update(frameDelta);
    }
    for (const flock of flocks) {
      updateBirdFlock(flock, elapsedSeconds, frameDelta);
    }
    for (const boat of boats) {
      updateBoat(boat, elapsedSeconds, frameDelta);
    }
    updateBoatWakeUniforms();
  }

  function load(loader) {
    if (loadPromise) return loadPromise;

    loadPromise = Promise.allSettled([
      loader.loadAsync(AMBIENT_BIRD_MODEL_URL),
      loader.loadAsync(AMBIENT_BOAT_MODEL_URL),
    ]).then(([birdResult, boatResult]) => {
      if (birdResult.status === 'fulfilled') {
        try {
          setupBirds(birdResult.value);
        } catch (error) {
          console.warn('Ambient birds failed to set up.', error);
        }
      } else {
        console.warn('Ambient birds failed to load.', birdResult.reason);
      }

      if (boatResult.status === 'fulfilled') {
        try {
          setupBoats(boatResult.value);
        } catch (error) {
          console.warn('Ambient boats failed to set up.', error);
        }
      } else {
        console.warn('Ambient boats failed to load.', boatResult.reason);
      }

      installDebugHelpers();
      return {
        birdFlocks: flocks.length,
        birdCount: flocks.reduce((count, flock) => count + flock.birds.length, 0),
        boats: boats.length,
      };
    });

    return loadPromise;
  }

  return {
    load,
    update,
  };
}
