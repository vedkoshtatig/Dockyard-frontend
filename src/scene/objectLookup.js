import {
  HANGING_CONTAINER_OBJECT_KEYS,
  HANGING_LOAD_OBJECT_KEYS,
  SKYBOX_OBJECT_NAMES,
  STACK_TARGET_OBJECT_KEYS,
} from '../core/constants.js';

export function baseObjectName(name) {
  return name.replace(/\.\d+$/, '').toLowerCase();
}

export function normalizeObjectKey(name) {
  return baseObjectName(name).replace(/[\s.-]+/g, '_');
}

export function getObjectLookupKeys(name) {
  const rawName = name.trim().toLowerCase();

  return new Set([
    rawName,
    rawName.replace(/[\s-]+/g, '_'),
    rawName.replace(/[\s.-]+/g, '_'),
    rawName.replace(/[\s._-]+/g, ''),
    normalizeObjectKey(name),
  ]);
}

export function objectHasLookupKey(object, targetKey) {
  return getObjectLookupKeys(object.name).has(targetKey);
}

export function isNamedSkyboxObject(object) {
  return SKYBOX_OBJECT_NAMES.has(normalizeObjectKey(object.name));
}

export function isHangingLoadPart(object) {
  const objectKeys = getObjectLookupKeys(object.name);
  const isPlacementTarget =
    objectKeys.has('hangingcontainer001') ||
    objectKeys.has('hanging_container_001') ||
    objectKeys.has('hangingcontainer.001') ||
    objectKeys.has('hanging_container001');

  if (isPlacementTarget) {
    return false;
  }

  return [...HANGING_LOAD_OBJECT_KEYS].some((key) => objectKeys.has(key));
}

export function isHangingContainerPart(object) {
  const objectKeys = getObjectLookupKeys(object.name);
  return [...HANGING_CONTAINER_OBJECT_KEYS].some((key) => objectKeys.has(key));
}

export function findStackTargetObject(root) {
  let bestTarget = null;
  let bestPriority = Number.POSITIVE_INFINITY;

  root.traverse((object) => {
    for (let index = 0; index < STACK_TARGET_OBJECT_KEYS.length; index += 1) {
      if (index >= bestPriority) {
        break;
      }

      if (objectHasLookupKey(object, STACK_TARGET_OBJECT_KEYS[index])) {
        bestTarget = object;
        bestPriority = index;
        break;
      }
    }
  });

  return bestTarget;
}

export function materialsForObject(object) {
  if (!object.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
}
