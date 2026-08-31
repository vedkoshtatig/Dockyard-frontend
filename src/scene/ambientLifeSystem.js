import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  AMBIENT_BIRD_AREA_RADIUS,
  AMBIENT_BIRD_FLOCK_COUNT,
  AMBIENT_BIRD_FLOCK_SIZE_RANGE,
  AMBIENT_BIRD_FLOCK_SPREAD,
  AMBIENT_BIRD_FORWARD_OFFSET,
  AMBIENT_BIRD_HEIGHT_RANGE,
  AMBIENT_BIRD_MIN_RADIUS,
  AMBIENT_BIRD_MODEL_URL,
  AMBIENT_BIRD_ORBIT_SPEED_RANGE,
  AMBIENT_BIRD_SINGLE_COUNT,
  AMBIENT_BIRD_SIZE_RANGE,
  AMBIENT_BOAT_COUNT,
  AMBIENT_BOAT_EDGE_PADDING,
  AMBIENT_BOAT_FORWARD_OFFSET,
  AMBIENT_BOAT_LANE_FLATTENING_RANGE,
  AMBIENT_BOAT_LANE_RADIUS_RANGE,
  AMBIENT_BOAT_LENGTH_RANGE,
  AMBIENT_BOAT_MODEL_CLEARANCE_RADIUS,
  AMBIENT_BOAT_MODEL_URL,
  AMBIENT_BOAT_SPEED_RANGE,
  AMBIENT_BOAT_WATER_OFFSET,
} from '../core/constants.js';

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();
const tempPosition = new THREE.Vector3();
const tempNextPosition = new THREE.Vector3();

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

function clearGroup(group) {
  while (group.children.length) {
    group.remove(group.children[0]);
  }
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
      action.timeScale = THREE.MathUtils.randFloat(0.86, 1.22);
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

    for (let birdIndex = 0; birdIndex < flockSize; birdIndex += 1) {
      const bird = createBirdInstance(template, animations, flockSize > 1);
      bird.position.set(
        THREE.MathUtils.randFloatSpread(spread),
        THREE.MathUtils.randFloatSpread(spread * 0.28),
        THREE.MathUtils.randFloatSpread(spread * 0.72),
      );
      bird.rotation.set(
        bird.rotation.x + THREE.MathUtils.randFloatSpread(0.12),
        bird.rotation.y + THREE.MathUtils.randFloatSpread(0.28),
        bird.rotation.z + THREE.MathUtils.randFloatSpread(0.12),
      );
      bird.userData.basePosition = bird.position.clone();
      bird.userData.baseRotation = bird.rotation.clone();
      bird.userData.flightPhase = Math.random() * Math.PI * 2;
      bird.userData.flightSpeed = THREE.MathUtils.randFloat(1.2, 2.2);
      birdEntries.push(bird);
      flock.add(bird);
    }

    const waterInfo = getWaterInfo();
    const orbitCenter = getModelCenter();
    const orbitRadius = THREE.MathUtils.randFloat(AMBIENT_BIRD_MIN_RADIUS, AMBIENT_BIRD_AREA_RADIUS);
    const radiusX = orbitRadius * THREE.MathUtils.randFloat(0.76, 1.16);
    const radiusZ = orbitRadius * THREE.MathUtils.randFloat(0.72, 1.12);
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
        randomIntegerRange(AMBIENT_BIRD_FLOCK_SIZE_RANGE),
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
    const templates = [];

    sceneRoot.traverse((object) => {
      if (object.isMesh && countRenderableMeshes(object) > 0) {
        templates.push(object);
      }
    });

    return templates.length ? templates : [sceneRoot];
  }

  function createBoatInstance(template, index) {
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
    scaleObjectToDimension(boat, randomRange(AMBIENT_BOAT_LENGTH_RANGE), true);

    return boat;
  }

  function createBoatLane(template, index) {
    const waterInfo = getWaterInfo();
    const modelClearanceRadius = getModelClearanceRadius();
    const maxWaterRadius = Math.max(
      AMBIENT_BOAT_LANE_RADIUS_RANGE[0] + 40,
      waterInfo.halfSize - AMBIENT_BOAT_EDGE_PADDING,
    );
    const minLaneRadius = Math.min(
      maxWaterRadius - 32,
      Math.max(AMBIENT_BOAT_LANE_RADIUS_RANGE[0], modelClearanceRadius),
    );
    const maxLaneRadius = Math.max(
      minLaneRadius + 32,
      Math.min(AMBIENT_BOAT_LANE_RADIUS_RANGE[1], maxWaterRadius),
    );
    const orbitRadius = THREE.MathUtils.randFloat(minLaneRadius, maxLaneRadius);
    const flattenA = randomRange(AMBIENT_BOAT_LANE_FLATTENING_RANGE);
    const flattenB = randomRange(AMBIENT_BOAT_LANE_FLATTENING_RANGE);
    const boat = {
      angle: (index / Math.max(AMBIENT_BOAT_COUNT, 1)) * Math.PI * 2 + THREE.MathUtils.randFloatSpread(0.42),
      center: waterInfo.center,
      direction: Math.random() < 0.5 ? -1 : 1,
      group: new THREE.Group(),
      heaveAmount: THREE.MathUtils.randFloat(0.08, 0.24),
      heaveSpeed: THREE.MathUtils.randFloat(0.72, 1.15),
      phase: Math.random() * Math.PI * 2,
      pitchAmount: THREE.MathUtils.randFloat(0.008, 0.026),
      pitchSpeed: THREE.MathUtils.randFloat(0.5, 0.9),
      radiusX: Math.min(maxLaneRadius, orbitRadius * flattenA),
      radiusZ: Math.min(maxLaneRadius, orbitRadius * flattenB),
      rollAmount: THREE.MathUtils.randFloat(0.018, 0.048),
      rollSpeed: THREE.MathUtils.randFloat(0.62, 1.05),
      speed: randomRange(AMBIENT_BOAT_SPEED_RANGE),
    };

    boat.group.name = `ambient_boat_${index + 1}`;
    boat.group.add(createBoatInstance(template, index));
    updateBoat(boat, 0, 0);
    boatsRoot.add(boat.group);
    boats.push(boat);
  }

  function setupBoats(gltf) {
    clearGroup(boatsRoot);
    boats.length = 0;

    const templates = findBoatTemplates(gltf.scene);
    if (!templates.length) {
      console.warn('No boat templates found in ambient boat model.');
      return;
    }

    for (let index = 0; index < AMBIENT_BOAT_COUNT; index += 1) {
      createBoatLane(templates[index % templates.length], index);
    }
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
      const baseRotation = bird.userData.baseRotation;
      if (!basePosition || !baseRotation) continue;

      const phase = bird.userData.flightPhase;
      const speed = bird.userData.flightSpeed;
      bird.position.y = basePosition.y + Math.sin(elapsedSeconds * speed + phase) * 0.28;
      bird.rotation.x = baseRotation.x + Math.sin(elapsedSeconds * speed * 0.7 + phase) * 0.025;
      bird.rotation.z = baseRotation.z + Math.sin(elapsedSeconds * speed + phase) * 0.045;
    }
  }

  function updateBoat(boat, elapsedSeconds, deltaSeconds) {
    const waterInfo = getWaterInfo();
    const radiusAverage = Math.max((boat.radiusX + boat.radiusZ) * 0.5, 1);
    boat.angle += (boat.speed / radiusAverage) * boat.direction * deltaSeconds;

    const waterY = waterInfo.level + AMBIENT_BOAT_WATER_OFFSET;
    const heave = Math.sin(elapsedSeconds * boat.heaveSpeed + boat.phase) * boat.heaveAmount;
    setOrbitPosition(tempPosition, boat.center, boat.radiusX, boat.radiusZ, boat.angle, waterY + heave);
    setOrbitPosition(
      tempNextPosition,
      boat.center,
      boat.radiusX,
      boat.radiusZ,
      boat.angle + boat.direction * 0.01,
      waterY + heave,
    );

    boat.group.position.copy(tempPosition);
    orientAlongPlanarMotion(boat.group, tempPosition, tempNextPosition, AMBIENT_BOAT_FORWARD_OFFSET);
    boat.group.rotation.x = Math.sin(elapsedSeconds * boat.pitchSpeed + boat.phase) * boat.pitchAmount;
    boat.group.rotation.z = Math.sin(elapsedSeconds * boat.rollSpeed + boat.phase) * boat.rollAmount;
  }

  function installDebugHelpers() {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return;
    }

    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getAmbientLifeSnapshot: () => ({
        birdCount: flocks.reduce((count, flock) => count + flock.birds.length, 0),
        birdFlockCount: flocks.length,
        boatCount: boats.length,
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
