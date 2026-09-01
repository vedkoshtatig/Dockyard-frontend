import * as THREE from 'three';
import {
  BLENDER_CAMERA_VIEW,
  CAMERA_BASE_RETURN_SPEED,
  CAMERA_BASE_STACK_VIEW_Y,
  CAMERA_STACK_FULL_RISE_BLOCKS,
  CAMERA_STACK_FOLLOW_SPEED,
  CAMERA_STACK_MAX_TILT_DOWN_DEGREES,
  CAMERA_STACK_MAX_RISE,
  CAMERA_STACK_RISE_AFTER_FULL_BLOCKS_MULTIPLIER,
  CAMERA_STACK_RISE_PER_BLOCK,
  CAMERA_STACK_TILT_DOWN_DEGREES_PER_BLOCK,
  CAMERA_TOP_CLEARANCE_BLOCKS,
  CAMERA_TOP_PADDING,
  COLLAPSE_CAMERA_FOLLOW_SPEED,
  INTRO_CAMERA_DURATION_SECONDS,
  INTRO_CAMERA_START_PROGRESS,
  LOCK_CAMERA_TO_BLENDER_VIEW,
  SLIDER_ORBIT_DEGREES_PER_HEIGHT_UNIT,
  WORLD_UP_AXIS,
} from '../core/constants.js';
import { easeInOutSmoother } from './easing.js';

export function createCameraSystem({
  camera,
  cameraHeightElement,
  controls,
  getActiveDrop = () => null,
  getCurrentStackTopY = () => 0,
  getFirstStackTopY = () => 0,
  getIntroStackTopY = () => 0,
  getShipIntroStartOffset = () => null,
  getStackAnchor = () => null,
  getStackBlockHeight = () => CAMERA_TOP_PADDING,
  getStackWorldPoint = (x, y, z) => new THREE.Vector3(x, y, z),
  onBaseReturnComplete = () => {},
  onIntroCameraFinished = () => {},
  onShipIntroFrame = () => {},
  onShipIntroStarted = () => {},
  onStackBrowseActiveChange = () => {},
  renderer,
} = {}) {
  let defaultCamera = null;
  let defaultTarget = null;
  let cameraTargetMinY = 0;
  let automaticMinDistance = 0.2;
  let automaticMaxDistance = 500;
  let baseStackTopProjectedY = null;
  let introCameraAnimation = null;
  let collapseCameraStartFollowBlocks = 0;
  let currentFollowBlocks = 0;
  let returningCameraToBase = false;
  let topReturnAnimation = null;
  let manualCameraActive = false;
  let manualOrbitBoundsActive = false;
  let manualFollowReferenceBlocks = null;
  let manualPanRadius = 2;
  let manualTargetMinY = -Infinity;
  let manualTargetMaxY = Infinity;
  let stackBrowsePointerId = null;
  let stackBrowseStartY = 0;
  let stackBrowseStartBlocks = 0;

  controls.addEventListener('start', beginManualCameraControl);
  controls.addEventListener('change', limitDownwardManualPan);
  renderer.domElement.addEventListener('pointerdown', startMouseStackBrowse);
  renderer.domElement.addEventListener('pointermove', updateMouseStackBrowse);
  renderer.domElement.addEventListener('pointerup', stopMouseStackBrowse);
  renderer.domElement.addEventListener('pointercancel', stopMouseStackBrowse);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  function startMouseStackBrowse(event) {
    if (event.button !== 2 || introCameraAnimation || !defaultCamera || !defaultTarget) return;
    event.preventDefault();
    topReturnAnimation = null;
    clearManualCameraControl();
    stackBrowsePointerId = event.pointerId;
    stackBrowseStartY = event.clientY;
    stackBrowseStartBlocks = currentFollowBlocks;
    manualCameraActive = true;
    manualOrbitBoundsActive = false;
    manualFollowReferenceBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    onStackBrowseActiveChange(true);
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function updateMouseStackBrowse(event) {
    if (event.pointerId !== stackBrowsePointerId) return;
    event.preventDefault();
    const maxFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    const browsePixels = Math.max(Math.min(window.innerHeight * 0.5, 360), 180);
    const blockDelta = ((stackBrowseStartY - event.clientY) / browsePixels) * Math.max(maxFollowBlocks, 1);
    const desiredFollowBlocks = THREE.MathUtils.clamp(stackBrowseStartBlocks + blockDelta, 0, maxFollowBlocks);
    applyCameraState(getStackFollowCameraState(desiredFollowBlocks));
    controls.update();
  }

  function stopMouseStackBrowse(event) {
    if (event.pointerId !== stackBrowsePointerId) return;
    renderer.domElement.releasePointerCapture?.(event.pointerId);
    stackBrowsePointerId = null;
  }

  function limitDownwardManualPan() {
    if (!manualCameraActive) return;
    const clampedTargetY = THREE.MathUtils.clamp(controls.target.y, manualTargetMinY, manualTargetMaxY);
    const correction = clampedTargetY - controls.target.y;
    if (correction === 0) return;
    controls.target.y = clampedTargetY;
    camera.position.y += correction;
  }

  function beginManualCameraControl() {
    if (!defaultCamera || !defaultTarget || introCameraAnimation || manualOrbitBoundsActive) return;

    topReturnAnimation = null;
    manualCameraActive = true;
    manualOrbitBoundsActive = true;
    manualFollowReferenceBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const maxFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    const atStackTop = maxFollowBlocks <= 0.05 || currentFollowBlocks >= maxFollowBlocks - 0.05;
    const atStackBottom = currentFollowBlocks <= 0.05;
    const orbitX = THREE.MathUtils.degToRad(atStackTop || atStackBottom ? 6 : 11);
    const orbitUp = THREE.MathUtils.degToRad(atStackTop ? 0 : 4);
    const orbitDown = THREE.MathUtils.degToRad(atStackBottom ? 0 : 3);
    const distance = Math.max(offset.length(), 0.01);

    controls.minAzimuthAngle = spherical.theta - orbitX;
    controls.maxAzimuthAngle = spherical.theta + orbitX;
    controls.minPolarAngle = Math.max(0.05, spherical.phi - orbitUp);
    controls.maxPolarAngle = Math.min(Math.PI - 0.05, spherical.phi + orbitDown);
    controls.minDistance = distance * 0.88;
    controls.maxDistance = distance * 1.12;
    controls.cursor.copy(controls.target);
    manualTargetMinY = atStackBottom ? controls.target.y : cameraTargetMinY;
    manualTargetMaxY = atStackTop ? controls.target.y : controls.target.y + manualPanRadius * 0.28;
    controls.minTargetRadius = 0;
    controls.maxTargetRadius = manualPanRadius;
  }

  function clearManualCameraControl(endStackBrowse = true) {
    manualCameraActive = false;
    manualOrbitBoundsActive = false;
    manualFollowReferenceBlocks = null;
    manualTargetMinY = -Infinity;
    manualTargetMaxY = Infinity;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minTargetRadius = 0;
    controls.maxTargetRadius = Infinity;
    controls.minDistance = automaticMinDistance;
    controls.maxDistance = automaticMaxDistance;
    if (endStackBrowse) onStackBrowseActiveChange(false);
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
    manualPanRadius = Math.max(framedMaxDim * 0.018, 1.5);

    camera.fov = BLENDER_CAMERA_VIEW.fov;
    camera.up.copy(BLENDER_CAMERA_VIEW.up).normalize();
    camera.position.copy(BLENDER_CAMERA_VIEW.position).sub(center);
    controls.target.copy(BLENDER_CAMERA_VIEW.target).sub(center);

    const cameraDistance = camera.position.distanceTo(controls.target);
    camera.near = Math.max(cameraDistance / 1000, 0.01);
    camera.far = Math.max(cameraDistance + framedMaxDim * 6, 1000);
    camera.updateProjectionMatrix();

    automaticMaxDistance = Math.max(cameraDistance * 4, framedMaxDim * 2);
    automaticMinDistance = Math.max(cameraDistance / 100, 0.2);
    controls.maxDistance = automaticMaxDistance;
    controls.minDistance = automaticMinDistance;
    controls.update();

    defaultCamera = camera.position.clone();
    defaultTarget = controls.target.clone();
    cameraTargetMinY = controls.target.y;
    currentFollowBlocks = 0;

    if (import.meta.env.DEV) {
      window.__dockyardDebug = {
        ...(window.__dockyardDebug ?? {}),
        getCameraSnapshot: () => ({
          position: camera.position.toArray(),
          target: controls.target.toArray(),
          followBlocks: currentFollowBlocks,
          stackRise: getCameraStackRise(currentFollowBlocks),
          stackTiltDegrees: getCameraTiltDegrees(currentFollowBlocks),
          up: camera.up.toArray(),
          fov: camera.fov,
        }),
      };
    }
  }

  function resetView() {
    if (!defaultCamera || !defaultTarget) return;
    clearManualCameraControl();
    const wasIntroCameraActive = Boolean(introCameraAnimation);
    introCameraAnimation = null;
    returningCameraToBase = false;
    topReturnAnimation = null;
    currentFollowBlocks = 0;
    camera.position.copy(defaultCamera);
    controls.target.copy(defaultTarget);
    controls.update();
    updateSlider();

    if (wasIntroCameraActive) {
      onIntroCameraFinished();
    }
  }

  function moveToStackTop() {
    if (!defaultCamera || !defaultTarget) return;
    introCameraAnimation = null;
    returningCameraToBase = false;
    clearManualCameraControl(false);
    const topFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    const topState = getStackFollowCameraState(topFollowBlocks);
    topReturnAnimation = {
      duration: 0.8,
      elapsed: 0,
      endPosition: topState.position,
      endTarget: topState.target,
      endFollowBlocks: topFollowBlocks,
      startPosition: camera.position.clone(),
      startTarget: controls.target.clone(),
      startFollowBlocks: currentFollowBlocks,
    };
  }

  function updateTopReturn(delta) {
    if (!topReturnAnimation) return false;
    topReturnAnimation.elapsed += delta;
    const progress = THREE.MathUtils.clamp(topReturnAnimation.elapsed / topReturnAnimation.duration, 0, 1);
    const eased = easeInOutSmoother(progress);
    camera.position.lerpVectors(topReturnAnimation.startPosition, topReturnAnimation.endPosition, eased);
    controls.target.lerpVectors(topReturnAnimation.startTarget, topReturnAnimation.endTarget, eased);
    currentFollowBlocks = THREE.MathUtils.lerp(
      topReturnAnimation.startFollowBlocks,
      topReturnAnimation.endFollowBlocks,
      eased,
    );
    controls.update();
    updateSlider();
    if (progress >= 1) {
      topReturnAnimation = null;
      onStackBrowseActiveChange(false);
    }
    return true;
  }

  function resize() {
    const { innerWidth, innerHeight } = window;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.updatePixelRatio?.();
    renderer.setSize(innerWidth, innerHeight);
  }

  function frameBaseStackAtViewPosition() {
    if (LOCK_CAMERA_TO_BLENDER_VIEW) {
      baseStackTopProjectedY = getProjectedY(getStackTopPoint(getFirstStackTopY()));
      defaultCamera = camera.position.clone();
      defaultTarget = controls.target.clone();
      currentFollowBlocks = 0;
      return;
    }

    const focusPoint = getBaseStackFocusPoint();
    const desiredProjectedY = 1 - CAMERA_BASE_STACK_VIEW_Y * 2;
    const shiftAmount = getVerticalCameraShiftForProjectedY(focusPoint, desiredProjectedY);

    if (Math.abs(shiftAmount) >= 0.001) {
      shiftVertically(shiftAmount);
      cameraTargetMinY = controls.target.y;
      controls.update();
    }

    baseStackTopProjectedY = getProjectedY(getStackTopPoint(getFirstStackTopY()));
    defaultCamera = camera.position.clone();
    defaultTarget = controls.target.clone();
    currentFollowBlocks = 0;
  }

  function getBaseStackFocusPoint() {
    const stackAnchor = getStackAnchor();
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
    const stackAnchor = getStackAnchor();
    return getStackWorldPoint(stackAnchor.center.x, topY, stackAnchor.center.z);
  }

  function getProjectedY(point) {
    camera.updateMatrixWorld(true);
    return point.clone().project(camera).y;
  }

  function getCameraClearanceTopY(topY) {
    return topY + getStackBlockHeight() * CAMERA_TOP_CLEARANCE_BLOCKS;
  }

  function getCameraMaxTargetY(stackTopY = getCurrentStackTopY()) {
    return Math.max(cameraTargetMinY, getCameraClearanceTopY(stackTopY) + CAMERA_TOP_PADDING);
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

  function getStackFollowBlocksForTopY(stackTopY = getCurrentStackTopY()) {
    const stackAnchor = getStackAnchor();
    const blockHeight = Math.max(getStackBlockHeight(), 0.001);
    const baseTopY = Number.isFinite(stackAnchor?.topY)
      ? stackAnchor.topY
      : getFirstStackTopY() - blockHeight;

    return Math.max((stackTopY - baseTopY) / blockHeight, 0);
  }

  function getCameraTiltDegrees(followBlocks) {
    return Math.min(
      Math.max(followBlocks, 0) * CAMERA_STACK_TILT_DOWN_DEGREES_PER_BLOCK,
      CAMERA_STACK_MAX_TILT_DOWN_DEGREES,
    );
  }

  function getCameraStackRise(followBlocks) {
    const clampedFollowBlocks = Math.max(followBlocks, 0);
    const fullRiseBlocks = Math.min(clampedFollowBlocks, CAMERA_STACK_FULL_RISE_BLOCKS);
    const reducedRiseBlocks = Math.max(clampedFollowBlocks - CAMERA_STACK_FULL_RISE_BLOCKS, 0)
      * CAMERA_STACK_RISE_AFTER_FULL_BLOCKS_MULTIPLIER;

    return Math.min(
      (fullRiseBlocks + reducedRiseBlocks) * CAMERA_STACK_RISE_PER_BLOCK,
      CAMERA_STACK_MAX_RISE,
    );
  }

  function getStackFollowCameraState(followBlocks, baseCamera = defaultCamera, baseTarget = defaultTarget) {
    if (!baseCamera || !baseTarget) {
      return null;
    }

    const clampedFollowBlocks = Math.max(followBlocks, 0);
    const stackTiltDegrees = getCameraTiltDegrees(clampedFollowBlocks);
    const stackRise = getCameraStackRise(clampedFollowBlocks);
    const position = baseCamera.clone().addScaledVector(WORLD_UP_AXIS, stackRise);
    const direction = baseTarget.clone().sub(baseCamera);
    const right = new THREE.Vector3().crossVectors(direction, camera.up);

    if (right.lengthSq() > 0.000001) {
      right.normalize();
      direction.applyAxisAngle(right, THREE.MathUtils.degToRad(-stackTiltDegrees));
    }

    return {
      followBlocks: clampedFollowBlocks,
      position,
      stackRise,
      stackTiltDegrees,
      target: position.clone().add(direction),
    };
  }

  function applyCameraState(cameraState) {
    if (!cameraState) {
      return;
    }

    camera.position.copy(cameraState.position);
    controls.target.copy(cameraState.target);
    currentFollowBlocks = cameraState.followBlocks ?? currentFollowBlocks;
  }

  function startIntroAnimation() {
    if (!defaultCamera || !defaultTarget) {
      return;
    }

    const topTargetY = getCameraMaxTargetY(getIntroStackTopY());
    const startProgress = THREE.MathUtils.clamp(INTRO_CAMERA_START_PROGRESS, 0, 0.98);
    const startTargetY = THREE.MathUtils.lerp(
      topTargetY,
      defaultTarget.y,
      easeInOutSmoother(startProgress),
    );

    if (topTargetY <= defaultTarget.y + 0.01) {
      onIntroCameraFinished();
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
    onShipIntroStarted();

    applyCameraState(getSliderCameraState(
      introCameraAnimation.startTargetY,
      introCameraAnimation.baseCamera,
      introCameraAnimation.baseTarget,
    ));
    controls.update();
    updateSlider();
    onShipIntroFrame();
  }

  function finishIntroAnimation() {
    if (!introCameraAnimation) {
      return;
    }

    applyCameraState({
      position: introCameraAnimation.baseCamera,
      target: introCameraAnimation.baseTarget,
    });
    currentFollowBlocks = 0;
    introCameraAnimation = null;
    controls.update();
    updateSlider();
    onIntroCameraFinished();
  }

  function updateIntro(delta) {
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
      finishIntroAnimation();
    }

    return true;
  }

  function updateHeight(delta) {
    if (returningCameraToBase) {
      return;
    }

    if (updateTopReturn(delta)) return;

    const targetFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    if (manualCameraActive) {
      const hasNewStackHeight = Math.abs(targetFollowBlocks - (manualFollowReferenceBlocks ?? targetFollowBlocks)) > 0.05;
      if (!hasNewStackHeight) return;
      clearManualCameraControl();
    }

    const followSpeed = getActiveDrop()
      ? CAMERA_STACK_FOLLOW_SPEED * 1.25
      : CAMERA_STACK_FOLLOW_SPEED;

    moveStackFollowToward(targetFollowBlocks, delta, followSpeed);
  }

  function moveStackFollowToward(targetFollowBlocks, delta, speed) {
    if (!defaultCamera || !defaultTarget) {
      return;
    }

    const smoothing = 1 - Math.exp(-delta * speed);
    const nextFollowBlocks = THREE.MathUtils.lerp(
      currentFollowBlocks,
      Math.max(targetFollowBlocks, 0),
      smoothing,
    );

    applyCameraState(getStackFollowCameraState(nextFollowBlocks));
    controls.update();
  }

  function shiftVertically(amount) {
    if (amount === 0) {
      return;
    }

    camera.position.y += amount;
    controls.target.y += amount;
  }

  function startCollapseFollow() {
    collapseCameraStartFollowBlocks = currentFollowBlocks;
  }

  function updateCollapseFollow(delta, averageFallDistance) {
    const blockHeight = Math.max(getStackBlockHeight(), 0.001);
    const targetFollowBlocks = Math.max(
      collapseCameraStartFollowBlocks - averageFallDistance / blockHeight,
      0,
    );

    moveStackFollowToward(targetFollowBlocks, delta, COLLAPSE_CAMERA_FOLLOW_SPEED);
  }

  function requestBaseReturn() {
    clearManualCameraControl();
    topReturnAnimation = null;
    returningCameraToBase = true;
  }

  function resumeAutomaticFollow() {
    clearManualCameraControl();
  }

  function updateBaseReturn(delta) {
    if (!returningCameraToBase) {
      return;
    }

    const remainingFollowBlocks = currentFollowBlocks;

    if (Math.abs(remainingFollowBlocks) < 0.01) {
      applyCameraState(getStackFollowCameraState(0));
      controls.update();
      returningCameraToBase = false;
      onBaseReturnComplete();
      return;
    }

    moveStackFollowToward(0, delta, CAMERA_BASE_RETURN_SPEED);
  }

  function moveFromSlider() {
    if (!cameraHeightElement) {
      return;
    }

    introCameraAnimation = null;
    const maxFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
    const sliderMin = Number(cameraHeightElement.min);
    const sliderMax = Number(cameraHeightElement.max);
    const ratio = (Number(cameraHeightElement.value) - sliderMin) / (sliderMax - sliderMin);
    const desiredFollowBlocks = Math.max(maxFollowBlocks * ratio, 0);

    clearManualCameraControl();
    applyCameraState(getStackFollowCameraState(desiredFollowBlocks));
    manualCameraActive = true;
    manualFollowReferenceBlocks = maxFollowBlocks;
    onStackBrowseActiveChange(true);
    controls.update();
  }

  function updateSlider() {
    if (!cameraHeightElement) {
      return;
    }

    let ratio = 0;

    if (introCameraAnimation) {
      const heightRange = introCameraAnimation.topTargetY - cameraTargetMinY;
      ratio = heightRange
        ? THREE.MathUtils.clamp((controls.target.y - cameraTargetMinY) / heightRange, 0, 1)
        : 0;
    } else {
      const maxFollowBlocks = getStackFollowBlocksForTopY(getCurrentStackTopY());
      ratio = maxFollowBlocks
        ? THREE.MathUtils.clamp(currentFollowBlocks / maxFollowBlocks, 0, 1)
        : 0;
    }

    const sliderMin = Number(cameraHeightElement.min);
    const sliderMax = Number(cameraHeightElement.max);
    cameraHeightElement.value = String(Math.round(THREE.MathUtils.lerp(sliderMin, sliderMax, ratio)));
  }

  function getIntroAnimation() {
    return introCameraAnimation;
  }

  return {
    frameBaseStackAtViewPosition,
    frameObject,
    getIntroAnimation,
    getProjectedY,
    moveToStackTop,
    moveFromSlider,
    requestBaseReturn,
    resumeAutomaticFollow,
    resetView,
    resize,
    startCollapseFollow,
    startIntroAnimation,
    updateBaseReturn,
    updateCollapseFollow,
    updateHeight,
    updateIntro,
    updateSlider,
  };
}
