import * as THREE from 'three';

export function easeInOutSmoother(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function easeOutCubic(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
