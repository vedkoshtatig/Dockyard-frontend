import * as THREE from 'three';
import { SKYBOX_TEXTURE_SCROLL_SPEED } from '../core/constants.js';
import { isNamedSkyboxObject } from './objectLookup.js';

const skyboxBounds = new THREE.Box3();
const skyboxSize = new THREE.Vector3();

export function setupImportedSkybox(root, scene) {
  const skyboxes = [];

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (isNamedSkyboxObject(object)) {
      skyboxes.push(object);
    }
  });

  if (skyboxes.length === 0) return null;

  const importedSkybox = skyboxes[0];
  scene.attach(importedSkybox);

  importedSkybox.name = 'skybox';
  importedSkybox.frustumCulled = false;
  importedSkybox.renderOrder = -1000;
  importedSkybox.position.set(0, 0, 0);

  const materials = Array.isArray(importedSkybox.material)
    ? importedSkybox.material
    : [importedSkybox.material];
  const skyboxMaterials = materials.map((material) => {
    const map = material?.map ? material.map.clone() : null;
    configureSkyboxTexture(map);

    return new THREE.MeshBasicMaterial({
      map,
      color: map ? 0xffdce1 : 0xe59aaf,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
  });
  importedSkybox.material = Array.isArray(importedSkybox.material)
    ? skyboxMaterials
    : skyboxMaterials[0];

  if (import.meta.env.DEV) {
    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getSkyboxSnapshot: () => {
        const activeMaterials = Array.isArray(importedSkybox.material)
          ? importedSkybox.material
          : [importedSkybox.material];
        return {
          name: importedSkybox.name,
          visible: importedSkybox.visible,
          position: importedSkybox.position.toArray(),
          scale: importedSkybox.scale.toArray(),
          materialMaps: activeMaterials.map((material) => material?.map?.image?.currentSrc
            ?? material?.map?.image?.src
            ?? material?.map?.name
            ?? null),
        };
      },
    };
  }

  for (let index = 1; index < skyboxes.length; index += 1) {
    skyboxes[index].visible = false;
  }

  return importedSkybox;
}

export function updateImportedSkybox(importedSkybox, { camera, controls, elapsedSeconds = 0 }) {
  if (!importedSkybox) return;

  importedSkybox.position.copy(camera.position);
  updateSkyboxTextureScroll(importedSkybox, elapsedSeconds);
  skyboxBounds.setFromObject(importedSkybox);
  skyboxBounds.getSize(skyboxSize);

  const currentDiameter = Math.max(skyboxSize.x, skyboxSize.y, skyboxSize.z);
  const targetDiameter = controls.maxDistance * 2.6;
  if (currentDiameter > 0 && currentDiameter < targetDiameter) {
    const scaleBoost = targetDiameter / currentDiameter;
    importedSkybox.scale.multiplyScalar(scaleBoost);
  }
}

function configureSkyboxTexture(texture) {
  if (!texture) {
    return;
  }

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
}

function updateSkyboxTextureScroll(importedSkybox, elapsedSeconds) {
  const materials = Array.isArray(importedSkybox.material)
    ? importedSkybox.material
    : [importedSkybox.material];
  const offset = THREE.MathUtils.euclideanModulo(
    -elapsedSeconds * SKYBOX_TEXTURE_SCROLL_SPEED,
    1,
  );

  for (const material of materials) {
    if (material?.map) {
      material.map.offset.x = offset;
    }
  }
}
