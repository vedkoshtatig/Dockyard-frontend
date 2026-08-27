import * as THREE from 'three';
import {
  SHIP_INTRO_START_AXIS,
  SHIP_INTRO_START_DISTANCE,
  SHIP_MOTION,
  SHIP_WAKE_BASE_STRENGTH,
  SHIP_WAKE_INTRO_BOOST,
  SHIP_WAKE_MAX_STRENGTH,
  SHIP_WAKE_PADDING,
  SHIP_WAKE_SMOOTHING,
  SHIP_WAKE_SPEED_RESPONSE,
  WATER_ANIMATION_SPEED,
} from '../core/constants.js';
import { easeInOutSmoother } from './easing.js';
import { baseObjectName, materialsForObject, normalizeObjectKey } from './objectLookup.js';

export function createFloatingShipSystem({
  getIntroCameraAnimation = () => null,
  getModelRoot = () => null,
  getWater = () => null,
} = {}) {
  let floatingShip = null;
  const shipBounds = new THREE.Box3();
  const shipBoundsSize = new THREE.Vector3();
  const shipBoundsCenter = new THREE.Vector3();
  const shipWobbleQuaternion = new THREE.Quaternion();

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

  function installDebugHelpers() {
    if (!import.meta.env.DEV || !floatingShip) {
      return;
    }

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
        getModelRoot()?.traverse((object) => {
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
        getModelRoot()?.traverse((object) => {
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

  function updateWaterInteraction(deltaSeconds = 0) {
    const water = getWater();
    if (!water || !floatingShip) return;

    shipBounds.setFromObject(floatingShip.object);
    shipBounds.getSize(shipBoundsSize);
    shipBounds.getCenter(shipBoundsCenter);
    const wakeCenter = new THREE.Vector3(shipBoundsCenter.x, 0, shipBoundsCenter.z);
    const frameDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
    let planarSpeed = 0;

    if (floatingShip.previousWakeCenter && frameDelta > 0) {
      planarSpeed = wakeCenter.distanceTo(floatingShip.previousWakeCenter) / frameDelta;
    }

    if (!floatingShip.previousWakeCenter) {
      floatingShip.previousWakeCenter = wakeCenter.clone();
    } else {
      floatingShip.previousWakeCenter.copy(wakeCenter);
    }

    const introCameraAnimation = getIntroCameraAnimation();
    const introWakeProgress = introCameraAnimation
      ? 1 - THREE.MathUtils.clamp(introCameraAnimation.elapsed / introCameraAnimation.duration, 0, 1)
      : 0;
    const targetWakeStrength = THREE.MathUtils.clamp(
      SHIP_WAKE_BASE_STRENGTH
        + planarSpeed * SHIP_WAKE_SPEED_RESPONSE
        + introWakeProgress * SHIP_WAKE_INTRO_BOOST,
      SHIP_WAKE_BASE_STRENGTH,
      SHIP_WAKE_MAX_STRENGTH,
    );
    const wakeSmoothing = frameDelta > 0
      ? 1 - Math.exp(-frameDelta * SHIP_WAKE_SMOOTHING)
      : 1;

    floatingShip.wakeStrength = THREE.MathUtils.lerp(
      floatingShip.wakeStrength ?? targetWakeStrength,
      targetWakeStrength,
      wakeSmoothing,
    );

    water.material.uniforms.shipCenter.value.set(shipBoundsCenter.x, shipBoundsCenter.z);
    water.material.uniforms.shipHalfSize.value.set(
      Math.max(shipBoundsSize.x * 0.5 + SHIP_WAKE_PADDING * 1.6, 1),
      Math.max(shipBoundsSize.z * 0.5 + SHIP_WAKE_PADDING * 1.6, 1),
    );
    water.material.uniforms.shipWakeStrength.value = floatingShip.wakeStrength;
  }

  function getIntroStartOffset() {
    if (!floatingShip) {
      return null;
    }

    const axis = SHIP_INTRO_START_AXIS.clone();
    if (axis.lengthSq() < 0.0001) {
      axis.set(0, 0, -1);
    }

    return axis.normalize().multiplyScalar(SHIP_INTRO_START_DISTANCE);
  }

  function getIntroOffset() {
    const introCameraAnimation = getIntroCameraAnimation();
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

  function setup(root) {
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
      previousWakeCenter: null,
      wakeStrength: SHIP_WAKE_BASE_STRENGTH,
    };

    installDebugHelpers();
    updateWaterInteraction();
  }

  function update(elapsedSeconds, deltaSeconds = 0) {
    if (!floatingShip) return;

    const { object, basePosition, baseQuaternion, phase } = floatingShip;
    const introOffset = getIntroOffset();
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

    updateWaterInteraction(deltaSeconds);
  }

  return {
    getIntroStartOffset,
    setup,
    update,
  };
}
