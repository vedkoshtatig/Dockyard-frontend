import * as THREE from 'three';
import {
  HANGING_LOAD_CAMERA_FOLLOW_SPEED,
  HANGING_LOAD_DESCEND_SECONDS,
  HANGING_LOAD_MOTION,
  HANGING_LOAD_OFFSCREEN_BLOCK_LIFT,
  HANGING_LOAD_OFFSCREEN_MAX_LIFT,
  HANGING_LOAD_OFFSCREEN_MIN_LIFT,
  HANGING_LOAD_OFFSCREEN_PROJECTED_Y,
  HANGING_LOAD_VISIBLE_TOP_PROJECTED_Y_PADDING,
  HANGING_LOAD_RETRACT_SECONDS,
  HANGING_LOAD_SETTLE_TIMEOUT_PADDING_SECONDS,
  INTRO_HANGING_LOAD_DESCEND_SECONDS,
  STACK_DROP_HEIGHT,
} from '../core/constants.js';
import { easeInOutSmoother } from './easing.js';
import { findStackTargetObject, isHangingContainerPart, isHangingLoadPart } from './objectLookup.js';

export function createHangingLoadSystem({
  getMountedBlockTopPoint = () => null,
  getNextPart = () => null,
  getProjectedY = () => Number.NaN,
  getStackBlockHeight = () => 0,
  getStackWorldPoint = () => new THREE.Vector3(),
  hasStackAnchor = () => false,
  mountNextStackPart = () => null,
  onIntroControlsUnlocked = () => {},
  setGameStatus = () => {},
} = {}) {
  let hangingLoad = null;
  let baseVisibleTopProjectedY = null;
  const hangingLoadQuaternion = new THREE.Quaternion();
  const hangingLoadBounds = new THREE.Box3();
  const hangingLoadPivot = new THREE.Vector3();

  function setup(root, magnetRoot = null) {
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
    const carrierBounds = new THREE.Box3();
    for (const carrier of carrierContainers) {
      carrierBounds.union(new THREE.Box3().setFromObject(carrier));
    }
    const magnet = magnetRoot
      ? installCraneMagnet(pivot, magnetRoot, carrierBounds)
      : null;

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
      magnet,
      phase: Math.random() * Math.PI * 2,
      targetName: targetObject?.name ?? null,
    };

    if (magnet) {
      for (const part of parts) {
        part.visible = false;
      }
      positionMagnetAboveBlock();
    }

    setCarrierVisible(false);
    setAssemblyVisible(false);
    installDebugHelpers(parts, targetObject, pivot, mountLocalPosition);
  }

  function getCraneMagnetBounds(magnetRoot) {
    const bounds = new THREE.Box3();
    magnetRoot.updateWorldMatrix(true, true);
    magnetRoot.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const isMagnetSurface = materials.some((material) => {
        const materialName = material?.name?.toLowerCase() ?? '';
        return materialName.includes('crane_magnet') || materialName.includes('magnet_shader');
      });
      if (!isMagnetSurface) return;
      bounds.union(new THREE.Box3().setFromObject(object));
    });
    return bounds;
  }

  function getGeometryBoundsInSpace(root, space, includeMesh = () => true) {
    const bounds = new THREE.Box3();
    const inverseSpaceMatrix = new THREE.Matrix4().copy(space.matrixWorld).invert();
    const meshToSpaceMatrix = new THREE.Matrix4();
    const point = new THREE.Vector3();

    root.updateWorldMatrix(true, true);
    space.updateWorldMatrix(true, false);
    root.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry || !includeMesh(mesh)) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const geometryBounds = mesh.geometry.boundingBox;
      if (!geometryBounds || geometryBounds.isEmpty()) return;

      meshToSpaceMatrix.multiplyMatrices(inverseSpaceMatrix, mesh.matrixWorld);
      for (const x of [geometryBounds.min.x, geometryBounds.max.x]) {
        for (const y of [geometryBounds.min.y, geometryBounds.max.y]) {
          for (const z of [geometryBounds.min.z, geometryBounds.max.z]) {
            bounds.expandByPoint(point.set(x, y, z).applyMatrix4(meshToSpaceMatrix));
          }
        }
      }
    });
    return bounds;
  }

  function isMagnetSurfaceMesh(mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return materials.some((material) => {
      const materialName = material?.name?.toLowerCase() ?? '';
      return materialName.includes('crane_magnet') || materialName.includes('magnet_shader');
    });
  }

  function installCraneMagnet(pivot, magnetRoot, carrierBounds) {
    magnetRoot.name = 'crane_magnet_carrier';
    pivot.add(magnetRoot);
    magnetRoot.position.set(0, 0, 0);
    magnetRoot.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        material.envMapIntensity = 0.72;
        material.roughness = Math.min(material.roughness ?? 0.62, 0.62);
        material.needsUpdate = true;
      }
    });

    const magnetSize = getCraneMagnetBounds(magnetRoot).getSize(new THREE.Vector3());
    const carrierSize = carrierBounds.getSize(new THREE.Vector3());
    const desiredDiameter = Math.max(carrierSize.x, carrierSize.z, getStackBlockHeight()) * 0.36;
    const currentDiameter = Math.max(magnetSize.x, magnetSize.z, 0.001);
    magnetRoot.scale.multiplyScalar(THREE.MathUtils.clamp(desiredDiameter / currentDiameter, 0.12, 3));
    return magnetRoot;
  }

  function positionMagnetAboveBlock() {
    const magnet = hangingLoad?.magnet;
    if (!magnet) return;
    const mountPosition = hangingLoad.mountLocalPosition;
    magnet.position.set(
      mountPosition.x,
      mountPosition.y + Math.max(getStackBlockHeight(), 0.5),
      mountPosition.z,
    );
    magnet.updateWorldMatrix(true, true);
  }

  function alignObjectToMagnetOrigin(object) {
    const magnet = hangingLoad?.magnet;
    if (!magnet || !object) return;

    object.updateWorldMatrix(true, true);
    magnet.updateWorldMatrix(true, true);
    const objectBounds = getGeometryBoundsInSpace(object, hangingLoad.pivot);
    const magnetBounds = getGeometryBoundsInSpace(magnet, hangingLoad.pivot, isMagnetSurfaceMesh);
    if (objectBounds.isEmpty() || magnetBounds.isEmpty()) return;

    const objectCenter = objectBounds.getCenter(new THREE.Vector3());
    const magnetCenter = magnetBounds.getCenter(new THREE.Vector3());
    const objectTopLocalPoint = new THREE.Vector3(objectCenter.x, objectBounds.max.y, objectCenter.z);
    // The corrected GLB origin anchors the crane assembly, while the visible
    // contact plate sits below it. Attach the roof to that physical surface.
    const magnetContactLocalPoint = new THREE.Vector3(magnetCenter.x, magnetBounds.min.y, magnetCenter.z);
    object.position.add(magnetContactLocalPoint.sub(objectTopLocalPoint));
    object.updateWorldMatrix(true, true);
  }

  function installDebugHelpers(parts, targetObject, pivot, mountLocalPosition) {
    if (!import.meta.env.DEV || !hangingLoad) {
      return;
    }

    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getHangingLoadSnapshot: () => ({
        baseVisibleTopProjectedY,
        partNames: parts.map((part) => part.name),
        hiddenCarrierNames: hangingLoad.carrierContainerNames,
        mountedBlockTopProjectedY: getMountedBlockTopProjectedYAtPosition(pivot.position),
        stackTargetName: targetObject?.name ?? null,
        basePosition: hangingLoad.basePosition.toArray(),
        mountLocalPosition: mountLocalPosition.toArray(),
        pivotPosition: pivot.position.toArray(),
        pivotQuaternion: pivot.quaternion.toArray(),
      }),
    };
  }

  function hasLoad() {
    return Boolean(hangingLoad);
  }

  function setCarrierVisible(isVisible) {
    if (!hangingLoad) {
      return;
    }

    for (const container of hangingLoad.carrierContainers) {
      container.visible = isVisible;
    }
  }

  function setAssemblyVisible(isVisible) {
    if (!hangingLoad) {
      return;
    }

    hangingLoad.pivot.visible = isVisible;
  }

  function updateCarrierVisibility() {
    setCarrierVisible(false);
  }

  function update(elapsedSeconds, deltaSeconds) {
    if (!hangingLoad) return;

    const { pivot, baseQuaternion, phase } = hangingLoad;
    updatePosition(deltaSeconds);

    const loadTime = elapsedSeconds * HANGING_LOAD_MOTION.speed;
    const sideToSideSwing = Math.sin(loadTime + phase) * HANGING_LOAD_MOTION.sideToSideSwing
      + Math.sin(loadTime * 1.63 + phase * 0.42) * HANGING_LOAD_MOTION.gustSwing;
    const frontBackSwing = Math.sin(loadTime * 0.74 + phase + 1.35) * HANGING_LOAD_MOTION.frontBackSwing
      + Math.sin(loadTime * 1.27 + phase * 0.61) * HANGING_LOAD_MOTION.gustSwing * 0.55;

    hangingLoadQuaternion.setFromEuler(new THREE.Euler(frontBackSwing, 0, sideToSideSwing, 'XYZ'));
    pivot.quaternion.copy(baseQuaternion).multiply(hangingLoadQuaternion);
  }

  function updatePosition(deltaSeconds) {
    if (!hangingLoad) {
      return;
    }

    const frameDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
    const readyPosition = getBasePosition();
    hangingLoad.basePosition.copy(getHoistPosition(readyPosition, frameDelta));

    if (hangingLoad.hoistCycle) {
      hangingLoad.pivot.position.copy(hangingLoad.basePosition);
      return;
    }

    const smoothing = 1 - Math.exp(-frameDelta * HANGING_LOAD_CAMERA_FOLLOW_SPEED);
    hangingLoad.pivot.position.lerp(hangingLoad.basePosition, smoothing);
  }

  function getBasePosition() {
    const position = hangingLoad.initialBasePosition.clone();
    position.y += getStackLift(position);
    return getVisibleReadyPosition(position);
  }

  function getStackLift(basePosition) {
    const nextPart = getNextPart();
    if (!nextPart || !hasStackAnchor()) {
      return 0;
    }

    const carrierPoint = getCarrierPoint(basePosition);
    if (!carrierPoint) {
      return 0;
    }

    const desiredBottomPoint = getStackWorldPoint(0, nextPart.finalY + STACK_DROP_HEIGHT, 0);
    return Math.max(0, desiredBottomPoint.y - carrierPoint.bottomY);
  }

  function getHoistPosition(readyPosition, deltaSeconds) {
    const cycle = hangingLoad?.hoistCycle;
    if (!cycle) {
      return readyPosition;
    }

    if (cycle.phase === 'held') {
      const offscreenPosition = getOffscreenPosition(readyPosition);
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
        return getHoistPosition(readyPosition, 0);
      }

      return cycle.targetPosition;
    }

    const onComplete = cycle.onComplete;
    hangingLoad.hoistCycle = null;
    onComplete?.();
    return position;
  }

  function getOffscreenPosition(readyPosition) {
    const position = readyPosition.clone();
    const minimumLift = Math.max(HANGING_LOAD_OFFSCREEN_MIN_LIFT, getStackBlockHeight() * HANGING_LOAD_OFFSCREEN_BLOCK_LIFT);
    let lift = minimumLift;

    while (lift <= HANGING_LOAD_OFFSCREEN_MAX_LIFT) {
      const candidate = position.clone();
      candidate.y += lift;

      if (isAboveVisibleFrame(candidate)) {
        return candidate;
      }

      lift *= 1.35;
    }

    position.y += HANGING_LOAD_OFFSCREEN_MAX_LIFT;
    return position;
  }

  function isAboveVisibleFrame(pivotPosition) {
    const bottomPoint = getBottomWorldPoint(pivotPosition);
    if (!bottomPoint) {
      return false;
    }

    const projectedY = getProjectedY(bottomPoint);
    return Number.isFinite(projectedY) && projectedY >= HANGING_LOAD_OFFSCREEN_PROJECTED_Y;
  }

  function getBottomWorldPoint(pivotPosition) {
    const carrierPoint = getCarrierPoint(pivotPosition);
    if (!carrierPoint) {
      return null;
    }

    return new THREE.Vector3(carrierPoint.center.x, carrierPoint.bottomY, carrierPoint.center.z);
  }

  function startIntroDescend() {
    if (!hangingLoad) {
      onIntroControlsUnlocked();
      return;
    }

    const targetPosition = getBasePosition();
    const startPosition = getOffscreenPosition(targetPosition);

    hangingLoad.pivot.position.copy(startPosition);
    hangingLoad.basePosition.copy(startPosition);
    setAssemblyVisible(true);
    hangingLoad.hoistCycle = {
      duration: INTRO_HANGING_LOAD_DESCEND_SECONDS,
      elapsed: 0,
      onComplete: () => {
        const readyPosition = getBasePosition();
        hangingLoad.basePosition.copy(readyPosition);
        hangingLoad.pivot.position.copy(readyPosition);
        setAssemblyVisible(true);
        updateCarrierVisibility();
        captureVisibleTopProjection();
        onIntroControlsUnlocked();
      },
      phase: 'descending',
      startPosition,
      targetPosition,
    };
    updateCarrierVisibility();
  }

  function startRetract() {
    if (!hangingLoad) {
      return;
    }

    const readyPosition = getBasePosition();
    const startPosition = hangingLoad.pivot.position.clone();
    const targetPosition = getOffscreenPosition(readyPosition);

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
    updateCarrierVisibility();
  }

  function settleAfterDrop(hasNextPart) {
    if (!hasNextPart) {
      return waitForRetracted();
    }

    return lowerWithNextBlock();
  }

  function waitForRetracted() {
    if (!hangingLoad?.hoistCycle || hangingLoad.hoistCycle.phase !== 'retracting') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = createTimedResolver(resolve, HANGING_LOAD_RETRACT_SECONDS);
      runWhenHeld(finish);
    });
  }

  function lowerWithNextBlock() {
    if (!hangingLoad) {
      mountNextStackPart();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const finish = createTimedResolver(
        resolve,
        HANGING_LOAD_RETRACT_SECONDS + HANGING_LOAD_DESCEND_SECONDS,
      );

      runWhenHeld(() => {
        let targetPosition = getBasePosition();
        let startPosition = hangingLoad.hoistCycle?.targetPosition.clone()
          ?? getOffscreenPosition(targetPosition);

        hangingLoad.pivot.position.copy(startPosition);
        mountNextStackPart({ snapHangingLoadToBase: false });
        targetPosition = getBasePosition();
        startPosition = getOffscreenPosition(targetPosition);
        hangingLoad.pivot.position.copy(startPosition);
        hangingLoad.hoistCycle = {
          duration: HANGING_LOAD_DESCEND_SECONDS,
          elapsed: 0,
          onComplete: finish,
          phase: 'descending',
          startPosition,
          targetPosition,
        };
        updateCarrierVisibility();
        setGameStatus('Next block incoming');
      });
    });
  }

  function createTimedResolver(resolve, animationSeconds) {
    let didResolve = false;
    const timeoutId = window.setTimeout(
      finish,
      (animationSeconds + HANGING_LOAD_SETTLE_TIMEOUT_PADDING_SECONDS) * 1000,
    );

    function finish() {
      if (didResolve) {
        return;
      }

      didResolve = true;
      window.clearTimeout(timeoutId);
      resolve();
    }

    return finish;
  }

  function captureVisibleTopProjection() {
    const topPoint = getMountedBlockTopPoint();
    if (!topPoint) {
      return;
    }

    const projectedY = getProjectedY(topPoint);
    if (Number.isFinite(projectedY)) {
      baseVisibleTopProjectedY = projectedY;
    }
  }

  function getVisibleReadyPosition(position) {
    if (!Number.isFinite(baseVisibleTopProjectedY)) {
      return position;
    }

    const topLimit = Math.min(
      baseVisibleTopProjectedY + HANGING_LOAD_VISIBLE_TOP_PROJECTED_Y_PADDING,
      0.98,
    );
    const projectedY = getMountedBlockTopProjectedYAtPosition(position);

    if (!Number.isFinite(projectedY) || projectedY <= topLimit) {
      return position;
    }

    return lowerPositionUntilMountedBlockTopVisible(position, topLimit);
  }

  function getMountedBlockTopProjectedYAtPosition(position) {
    return withPivotPosition(position, () => {
      const topPoint = getMountedBlockTopPoint();
      return topPoint ? getProjectedY(topPoint) : Number.NaN;
    });
  }

  function withPivotPosition(position, readValue) {
    if (!hangingLoad || !position) {
      return Number.NaN;
    }

    const originalPosition = hangingLoad.pivot.position.clone();
    hangingLoad.pivot.position.copy(position);
    hangingLoad.pivot.updateWorldMatrix(true, true);
    const value = readValue();
    hangingLoad.pivot.position.copy(originalPosition);
    hangingLoad.pivot.updateWorldMatrix(true, true);
    return value;
  }

  function lowerPositionUntilMountedBlockTopVisible(position, topLimit) {
    const blockHeight = Math.max(getStackBlockHeight(), 1);
    const maxLowerDistance = Math.max(HANGING_LOAD_OFFSCREEN_MAX_LIFT, blockHeight * 8);
    const visiblePosition = position.clone();
    const step = Math.max(blockHeight * 0.5, 1);
    let loweredDistance = 0;
    let visibleProjectedY = getMountedBlockTopProjectedYAtPosition(visiblePosition);

    while (
      Number.isFinite(visibleProjectedY) &&
      visibleProjectedY > topLimit &&
      loweredDistance < maxLowerDistance
    ) {
      visiblePosition.y -= step;
      loweredDistance += step;
      visibleProjectedY = getMountedBlockTopProjectedYAtPosition(visiblePosition);
    }

    if (!Number.isFinite(visibleProjectedY)) {
      return position;
    }

    if (visibleProjectedY > topLimit) {
      return visiblePosition;
    }

    let clippedY = position.y;
    let visibleY = visiblePosition.y;
    const candidate = position.clone();

    for (let iteration = 0; iteration < 18; iteration += 1) {
      candidate.y = (clippedY + visibleY) / 2;
      const projectedY = getMountedBlockTopProjectedYAtPosition(candidate);

      if (!Number.isFinite(projectedY)) {
        break;
      }

      if (projectedY <= topLimit) {
        visibleY = candidate.y;
      } else {
        clippedY = candidate.y;
      }
    }

    const adjusted = position.clone();
    adjusted.y = visibleY;
    return adjusted;
  }

  function runWhenHeld(callback) {
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

  function getCarrierPoint(pivotPosition = hangingLoad?.pivot.position) {
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

  function prepareForStackMount({ snapHangingLoadToBase = true } = {}) {
    if (!hangingLoad) {
      return false;
    }

    hangingLoad.basePosition.copy(getBasePosition());
    if (snapHangingLoadToBase) {
      hangingLoad.pivot.position.copy(hangingLoad.basePosition);
    }
    positionMagnetAboveBlock();

    return true;
  }

  function attachObject(object) {
    if (!hangingLoad) {
      return;
    }

    if (object.parent !== hangingLoad.pivot) {
      hangingLoad.pivot.attach(object);
    }
  }

  function isHoldingObject(object) {
    return Boolean(hangingLoad && object.parent === hangingLoad.pivot);
  }

  function isSettled() {
    return Boolean(hangingLoad && !hangingLoad.hoistCycle);
  }

  function getMountLocalPosition() {
    return hangingLoad?.mountLocalPosition ?? null;
  }

  function getPivotPositionArray() {
    return hangingLoad?.pivot.position.toArray() ?? null;
  }

  function resetToBase() {
    if (!hangingLoad) {
      return;
    }

    hangingLoad.hoistCycle = null;
    hangingLoad.pivot.position.copy(getBasePosition());
    hangingLoad.pivot.quaternion.copy(hangingLoad.baseQuaternion);
  }

  return {
    alignObjectToMagnetOrigin,
    attachObject,
    getMountLocalPosition,
    getPivotPositionArray,
    hasLoad,
    isHoldingObject,
    isSettled,
    prepareForStackMount,
    resetToBase,
    setup,
    settleAfterDrop,
    startIntroDescend,
    startRetract,
    update,
    updateCarrierVisibility,
  };
}
