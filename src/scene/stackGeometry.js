import * as THREE from 'three';
import {
  STACK_BLOCK_MATERIAL_COLOR_INTENSITY,
  STACK_BLOCK_SCALE,
  STACK_RANDOM_X_RANGE,
  STACK_RANDOM_Z_RANGE,
} from '../core/constants.js';
import {
  baseObjectName,
  findStackTargetObject,
  isNamedSkyboxObject,
  materialsForObject,
  normalizeObjectKey,
} from './objectLookup.js';

const brandedFallingBlockTextures = new WeakMap();
const FALLING_BLOCK_BRAND = 'TRUEIGTECH';

export function createFallingBlockTemplate(source, definition) {
  const group = new THREE.Group();
  group.name = `${definition.label} template`;
  source.updateWorldMatrix(true, true);

  source.traverse((object) => {
    if (!isFallingBlockMesh(object)) {
      return;
    }

    const mesh = object.clone(true);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.applyMatrix4(object.matrixWorld);
    group.add(mesh);
  });

  if (!group.children.length) {
    console.warn(`${definition.label} did not contain a container mesh.`);
    return null;
  }

  normalizeObjectToBottomCenter(group);
  group.scale.setScalar(STACK_BLOCK_SCALE);
  prepareFallingBlockObject(group);

  return group;
}

export function prepareFallingBlockObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.material = createMatteFallingBlockMaterialSet(child.material);
  });
}

function createMatteFallingBlockMaterialSet(material) {
  if (Array.isArray(material)) {
    return material.map(createMatteFallingBlockMaterial);
  }

  return createMatteFallingBlockMaterial(material);
}

function createMatteFallingBlockMaterial(material) {
  if (!material) {
    return material;
  }

  if (material.userData?.matteFallingBlockMaterial) {
    return material;
  }

  const color = material.color
    ? material.color.clone()
    : new THREE.Color(0xffffff);
  color.multiplyScalar(STACK_BLOCK_MATERIAL_COLOR_INTENSITY);

  const matteMaterial = new THREE.MeshLambertMaterial({
    alphaMap: material.alphaMap ?? null,
    aoMap: material.aoMap ?? null,
    aoMapIntensity: Math.min(material.aoMapIntensity ?? 1, 0.75),
    color,
    emissive: material.emissive
      ? material.emissive.clone().multiplyScalar(0.12)
      : new THREE.Color(0x000000),
    emissiveMap: material.emissiveMap ?? null,
    emissiveIntensity: Math.min(material.emissiveIntensity ?? 0, 0.12),
    map: createBrandedFallingBlockTexture(material.map),
    name: material.name,
    opacity: material.opacity,
    side: material.side,
    transparent: material.transparent,
    vertexColors: material.vertexColors,
  });

  matteMaterial.toneMapped = material.toneMapped;
  matteMaterial.userData = {
    ...material.userData,
    matteFallingBlockMaterial: true,
  };

  return matteMaterial;
}

function createBrandedFallingBlockTexture(sourceTexture) {
  if (!sourceTexture?.image?.width || !sourceTexture.image.height) {
    return sourceTexture ?? null;
  }

  const cachedTexture = brandedFallingBlockTextures.get(sourceTexture);
  if (cachedTexture) {
    return cachedTexture;
  }

  const sourceImage = sourceTexture.image;
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return sourceTexture;
  }

  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  paintContainerBrand(context, canvas.width, canvas.height);

  const brandedTexture = new THREE.CanvasTexture(canvas);
  brandedTexture.colorSpace = sourceTexture.colorSpace;
  brandedTexture.flipY = false;
  brandedTexture.wrapS = sourceTexture.wrapS;
  brandedTexture.wrapT = sourceTexture.wrapT;
  brandedTexture.repeat.copy(sourceTexture.repeat);
  brandedTexture.offset.copy(sourceTexture.offset);
  brandedTexture.center.copy(sourceTexture.center);
  brandedTexture.rotation = sourceTexture.rotation;
  brandedTexture.needsUpdate = true;
  brandedFallingBlockTextures.set(sourceTexture, brandedTexture);

  return brandedTexture;
}

function paintContainerBrand(context, width, height) {
  paintBrandPatch(context, width * 0.278, height * 0.313, width * 0.35, height * 0.078, 0);
  paintBrandPatch(context, width * 0.145, height * 0.72, width * 0.33, height * 0.082, Math.PI / 2);
}

function paintBrandPatch(context, centerX, centerY, patchWidth, patchHeight, rotation) {
  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);

  // The subtle panel beneath the type covers the original baked-in wording,
  // while keeping the label at home on the worn container surface.
  context.fillStyle = 'rgba(94, 117, 146, 0.86)';
  context.fillRect(-patchWidth / 2, -patchHeight / 2, patchWidth, patchHeight);
  context.strokeStyle = 'rgba(28, 48, 74, 0.2)';
  context.lineWidth = Math.max(1, patchHeight * 0.045);
  for (let x = -patchWidth / 2; x <= patchWidth / 2; x += patchHeight * 0.32) {
    context.beginPath();
    context.moveTo(x, -patchHeight / 2);
    context.lineTo(x, patchHeight / 2);
    context.stroke();
  }

  context.fillStyle = '#e4e9e8';
  context.font = `800 ${Math.round(patchHeight * 0.63)}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(FALLING_BLOCK_BRAND, 0, 1);
  context.restore();
}

export function measureDockyardStackAnchor(root, scene) {
  root.updateWorldMatrix(true, true);

  const targetObject = findStackTargetObject(root);
  if (targetObject) {
    const targetBox = getObjectWorldBox(targetObject);

    if (!targetBox.isEmpty()) {
      return createStackAnchorFromTargetObject(root, targetObject, targetBox);
    }
  }

  const box = new THREE.Box3();
  let hasContainerStack = false;

  root.traverse((object) => {
    if (!isDockyardStackAnchorMesh(object)) {
      return;
    }

    const objectBox = new THREE.Box3().setFromObject(object);
    if (objectBox.isEmpty()) {
      return;
    }

    box.union(objectBox);
    hasContainerStack = true;
  });

  if (!hasContainerStack) {
    console.warn('No dockyard container stack found. Using the measured scene bounds.');
    box.setFromObject(root);
  }

  return createStackAnchorFromBox(box, null, scene);
}

export function getObjectParentSpaceBox(object) {
  object.updateWorldMatrix(true, true);

  const parentMatrixInverse = object.parent
    ? new THREE.Matrix4().copy(object.parent.matrixWorld).invert()
    : new THREE.Matrix4();
  const box = new THREE.Box3();

  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) {
      return;
    }

    child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) {
      return;
    }

    const childBox = child.geometry.boundingBox.clone();
    childBox.applyMatrix4(child.matrixWorld);
    childBox.applyMatrix4(parentMatrixInverse);
    box.union(childBox);
  });

  if (box.isEmpty()) {
    box.set(object.position, object.position);
  }

  return box;
}

export function placeObjectParentBottomCenter(object, targetX, targetZ, targetBottomY) {
  const box = getObjectParentSpaceBox(object);
  const center = box.getCenter(new THREE.Vector3());

  object.position.x += targetX - center.x;
  object.position.z += targetZ - center.z;
  object.position.y += targetBottomY - box.min.y;
  object.updateMatrixWorld(true);

  return object.position.y;
}

export function placeObjectWorldBottomCenter(object, targetX, targetZ, targetBottomY) {
  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const currentWorldPosition = new THREE.Vector3();
  const targetWorldPosition = new THREE.Vector3();

  object.getWorldPosition(currentWorldPosition);
  targetWorldPosition.copy(currentWorldPosition);
  targetWorldPosition.x += targetX - center.x;
  targetWorldPosition.z += targetZ - center.z;
  targetWorldPosition.y += targetBottomY - box.min.y;

  object.position.copy(
    object.parent ? object.parent.worldToLocal(targetWorldPosition) : targetWorldPosition,
  );
  object.updateMatrixWorld(true);

  return object.position.y;
}

export function getObjectBottomCenter(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  return new THREE.Vector3(center.x, box.min.y, center.z);
}

function isFallingBlockMesh(object) {
  if (!object.isMesh || !object.geometry) {
    return false;
  }

  const key = normalizeObjectKey(object.name);
  if (isNamedSkyboxObject(object) || key.includes('sky') || key.includes('ground')) {
    return false;
  }

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  if (Math.max(size.x, size.y, size.z) > 40) {
    return false;
  }

  return materialsForObject(object).some((material) => {
    const materialName = material?.name?.toLowerCase() ?? '';
    return materialName.startsWith('container');
  });
}

function normalizeObjectToBottomCenter(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const bottomCenter = new THREE.Vector3(
    (box.min.x + box.max.x) * 0.5,
    box.min.y,
    (box.min.z + box.max.z) * 0.5,
  );

  for (const child of object.children) {
    child.position.sub(bottomCenter);
  }

  object.updateMatrixWorld(true);
}

function getObjectWorldBox(object) {
  object.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(object);
  if (!box.isEmpty()) {
    return box;
  }

  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);
  box.set(worldPosition, worldPosition);
  return box;
}

function createStackAnchorFromTargetObject(root, targetObject, targetBox) {
  const anchorParent = targetObject ?? root;
  const topFaceWorldCenter = getObjectTopFaceWorldCenter(targetObject, targetBox);
  const anchorParentPosition = anchorParent.worldToLocal(topFaceWorldCenter.clone());
  const anchorGroup = new THREE.Group();

  anchorGroup.name = `stack_follow_anchor_${normalizeObjectKey(targetObject.name)}`;
  anchorGroup.position.copy(anchorParentPosition);
  anchorParent.add(anchorGroup);
  cancelInheritedWorldScale(anchorGroup, anchorParent);
  anchorGroup.updateWorldMatrix(true, true);
  const topFaceExtents = getObjectTopFaceExtentsInAnchorSpace(targetObject, anchorGroup, targetBox);

  return {
    center: new THREE.Vector3(0, 0, 0),
    group: anchorGroup,
    halfWidthX: topFaceExtents.x,
    halfWidthZ: topFaceExtents.z,
    targetName: targetObject.name,
    topY: 0,
  };
}

function cancelInheritedWorldScale(object, parent) {
  const parentScale = new THREE.Vector3();
  parent.getWorldScale(parentScale);
  object.scale.set(
    parentScale.x ? 1 / parentScale.x : 1,
    parentScale.y ? 1 / parentScale.y : 1,
    parentScale.z ? 1 / parentScale.z : 1,
  );
}

function getObjectTopFaceWorldCenter(object, fallbackBox) {
  if (object.isMesh && object.geometry) {
    object.geometry.computeBoundingBox();
    const localBox = object.geometry.boundingBox;

    if (localBox) {
      return new THREE.Vector3(
        (localBox.min.x + localBox.max.x) * 0.5,
        localBox.max.y,
        (localBox.min.z + localBox.max.z) * 0.5,
      ).applyMatrix4(object.matrixWorld);
    }
  }

  const fallbackCenter = fallbackBox.getCenter(new THREE.Vector3());
  return new THREE.Vector3(fallbackCenter.x, fallbackBox.max.y, fallbackCenter.z);
}

function getObjectTopFaceExtentsInAnchorSpace(object, anchorGroup, fallbackBox) {
  if (object.isMesh && object.geometry) {
    object.geometry.computeBoundingBox();
    const localBox = object.geometry.boundingBox;

    if (localBox) {
      const anchorPoints = [
        new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.min.z),
        new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.min.z),
        new THREE.Vector3(localBox.min.x, localBox.max.y, localBox.max.z),
        new THREE.Vector3(localBox.max.x, localBox.max.y, localBox.max.z),
      ].map((point) => anchorGroup.worldToLocal(point.applyMatrix4(object.matrixWorld)));

      const extents = anchorPoints.reduce(
        (extents, point) => ({
          x: Math.max(extents.x, Math.abs(point.x)),
          z: Math.max(extents.z, Math.abs(point.z)),
        }),
        { x: 0, z: 0 },
      );

      return {
        x: Math.max(extents.x, 0.1),
        z: Math.max(extents.z, 0.1),
      };
    }
  }

  const fallbackSize = fallbackBox.getSize(new THREE.Vector3());
  return {
    x: Math.max(fallbackSize.x * 0.5, STACK_RANDOM_X_RANGE),
    z: Math.max(fallbackSize.z * 0.5, STACK_RANDOM_Z_RANGE),
  };
}

function createStackAnchorFromBox(box, targetName, scene) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const anchorGroup = new THREE.Group();

  anchorGroup.name = targetName
    ? `stack_follow_anchor_${normalizeObjectKey(targetName)}`
    : 'stack_follow_anchor_fallback';
  anchorGroup.position.set(center.x, box.max.y, center.z);
  scene.add(anchorGroup);
  anchorGroup.updateWorldMatrix(true, true);

  return {
    center: new THREE.Vector3(0, 0, 0),
    group: anchorGroup,
    halfWidthX: size.x / 2,
    halfWidthZ: size.z / 2,
    targetName,
    topY: 0,
  };
}

function isDockyardStackAnchorMesh(object) {
  if (!object.isMesh || !object.visible) {
    return false;
  }

  const name = baseObjectName(object.name);
  if (!name.startsWith('dockyard_static_scene') || name.includes('truck') || name.includes('hanging')) {
    return false;
  }

  return materialsForObject(object).some((material) => {
    const materialName = material?.name?.toLowerCase() ?? '';
    return /^container[1-5]$/.test(materialName);
  });
}
