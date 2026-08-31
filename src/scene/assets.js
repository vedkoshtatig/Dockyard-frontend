import * as THREE from 'three';
import { isNamedSkyboxObject } from './objectLookup.js';

const TEXTURE_BY_MATERIAL = {
  'Material.051': 'zone.jpg',
  'Material.008': 'hangar_Base_Color.jpg',
  container1: 'container_Base_Color.jpg',
  container2: 'container2_Base_Color.jpg',
  container3: 'container3_Base_Color.jpg',
  container4: 'container4_Base_Color.jpg',
  container5: 'container5_Base_Color.jpg',
  'Material.017': 'truck_Base_Color.jpg',
  Material: 'ship-room_Base_Color.jpg',
  'Material.009': 'shipbody_Base_Color.jpg',
  'Material.041': 'block_Base_Color.jpg',
  'Material.007': 'factory_Base_Color.jpg',
};

export function applyManualTextures(root, textureLoader = new THREE.TextureLoader()) {
  const textureCache = new Map();

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (isNamedSkyboxObject(object)) return;

    object.castShadow = true;
    object.receiveShadow = true;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;

      const textureFile = TEXTURE_BY_MATERIAL[material.name];
      if (!textureFile) continue;

      if (!textureCache.has(textureFile)) {
        const texture = textureLoader.load(`/models/dockyard/textures/${textureFile}`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        textureCache.set(textureFile, texture);
      }

      material.map = textureCache.get(textureFile);
      material.color.set(0xffffff);
      material.metalness = material.name === 'Material.009' ? 0.12 : 0.02;
      material.roughness = material.name === 'Material.009' ? 0.58 : 0.76;
      material.envMapIntensity = 0.62;
      material.needsUpdate = true;
    }
  });
}

export function hideImportedSkyDomes(root) {
  root.traverse((object) => {
    if (!object.isMesh || isNamedSkyboxObject(object)) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const usesSkyTexture = materials.some((material) => {
      const mapName = material?.map?.name ?? '';
      const imageName = material?.map?.image?.name ?? '';
      const imageSrc = material?.map?.image?.currentSrc ?? material?.map?.image?.src ?? '';
      const textureLabel = `${mapName} ${imageName} ${imageSrc}`.toLowerCase();
      return textureLabel.includes('sky') || textureLabel.includes('cloudy');
    });

    if (usesSkyTexture) {
      object.visible = false;
      object.scale.setScalar(0);
    }
  });
}

export function getAssetUrl(url) {
  return url;
}

export function preferReliableGltfTextureLoader(loader) {
  loader.register((parser) => ({
    name: 'DockyardTextureLoaderFallback',
    beforeRoot() {
      // Embedded GLB textures can stall in Chrome's ImageBitmap blob-fetch path on reload.
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
      parser.textureLoader.setRequestHeader(parser.options.requestHeader);
    },
  }));
}

export function createDustTexture() {
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 64;
  dustCanvas.height = 64;

  const context = dustCanvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(226, 213, 184, 0.72)');
    gradient.addColorStop(0.45, 'rgba(199, 178, 137, 0.34)');
    gradient.addColorStop(1, 'rgba(199, 178, 137, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, dustCanvas.width, dustCanvas.height);
  }

  const texture = new THREE.CanvasTexture(dustCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSplashTexture() {
  const splashCanvas = document.createElement('canvas');
  splashCanvas.width = 64;
  splashCanvas.height = 64;

  const context = splashCanvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(245, 253, 255, 0.95)');
    gradient.addColorStop(0.36, 'rgba(183, 232, 245, 0.58)');
    gradient.addColorStop(1, 'rgba(183, 232, 245, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, splashCanvas.width, splashCanvas.height);
  }

  const texture = new THREE.CanvasTexture(splashCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
