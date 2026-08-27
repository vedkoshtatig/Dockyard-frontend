import * as THREE from 'three';
import {
  DUST_DRAG,
  DUST_DURATION_RANGE,
  DUST_EXPANSION,
  DUST_GRAVITY,
  DUST_PARTICLE_COUNT,
  LANDING_SCREEN_BLUR_PIXELS,
  LANDING_SCREEN_EFFECT_DURATION,
  LANDING_SCREEN_SCALE,
  LANDING_SCREEN_SHAKE_PIXELS,
  LANDING_SHAKE_DURATION,
  LANDING_SHAKE_STRENGTH,
  WATER_SPLASH_DURATION_RANGE,
  WATER_SPLASH_GRAVITY,
  WATER_SPLASH_IMPACT_SPEED_RESPONSE,
  WATER_SPLASH_PARTICLE_COUNT,
  WATER_SPLASH_RING_DURATION,
  WATER_SPLASH_RING_EXPANSION,
} from '../core/constants.js';
import { createDustTexture, createSplashTexture } from './assets.js';
import { easeOutCubic } from './easing.js';

export function createEffectsSystem({ scene, getStackAnchor, getWater }) {
  const dustTexture = createDustTexture();
  const splashTexture = createSplashTexture();
  const dustParticles = [];
  const splashEffects = [];
  const emptyShakeOffset = new THREE.Vector3();

  let landingShakeRemaining = 0;
  let landingScreenEffectRemaining = 0;

  function triggerLandingImpact(part, isHeavyImpact) {
    landingShakeRemaining = LANDING_SHAKE_DURATION;
    landingScreenEffectRemaining = LANDING_SCREEN_EFFECT_DURATION;
    document.body.classList.add('screen-impact-active');
    spawnLandingDust(part, isHeavyImpact);
  }

  function spawnLandingDust(part, isHeavyImpact) {
    const stackAnchor = getStackAnchor();
    const box = new THREE.Box3().setFromObject(part.object);
    const center = box.getCenter(new THREE.Vector3());
    const width = Math.max(box.max.x - box.min.x, stackAnchor.halfWidthX * 0.24, 1);
    const depth = Math.max(box.max.z - box.min.z, stackAnchor.halfWidthZ * 0.24, 1);
    const count = Math.round(DUST_PARTICLE_COUNT * (isHeavyImpact ? 1.6 : 1));

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const angleJitter = THREE.MathUtils.randFloatSpread(0.75);
      const travelAngle = angle + angleJitter;
      const edgeSpread = THREE.MathUtils.randFloat(0.2, 0.92);
      const opacity = THREE.MathUtils.randFloat(0.38, isHeavyImpact ? 0.82 : 0.7);
      const initialScale = THREE.MathUtils.randFloat(0.2, isHeavyImpact ? 0.58 : 0.5);
      const fallsDownward = Math.random() < 0.36;
      const material = new THREE.SpriteMaterial({
        color: 0xd8c39c,
        depthWrite: false,
        map: dustTexture,
        opacity,
        transparent: true,
      });
      const sprite = new THREE.Sprite(material);

      sprite.position.set(
        center.x + Math.cos(angle) * width * edgeSpread,
        box.min.y + THREE.MathUtils.randFloat(0.02, isHeavyImpact ? 0.62 : 0.46),
        center.z + Math.sin(angle) * depth * edgeSpread,
      );
      sprite.scale.setScalar(initialScale);
      scene.add(sprite);

      dustParticles.push({
        age: 0,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: THREE.MathUtils.randFloat(4, 8),
        driftStrength: THREE.MathUtils.randFloat(0.025, isHeavyImpact ? 0.075 : 0.06),
        initialOpacity: opacity,
        initialScale,
        lifetime: THREE.MathUtils.randFloat(DUST_DURATION_RANGE[0], DUST_DURATION_RANGE[1]),
        sprite,
        spin: THREE.MathUtils.randFloatSpread(2.8),
        velocity: new THREE.Vector3(
          Math.cos(travelAngle) * THREE.MathUtils.randFloat(0.75, isHeavyImpact ? 2.25 : 1.75),
          fallsDownward
            ? THREE.MathUtils.randFloat(-0.65, -0.15)
            : THREE.MathUtils.randFloat(0.35, isHeavyImpact ? 1.65 : 1.25),
          Math.sin(travelAngle) * THREE.MathUtils.randFloat(0.75, isHeavyImpact ? 2.25 : 1.75),
        ),
      });
    }
  }

  function updateDustParticles(delta) {
    for (let index = dustParticles.length - 1; index >= 0; index -= 1) {
      const particle = dustParticles[index];
      particle.age += delta;

      if (particle.age >= particle.lifetime) {
        removeDustParticle(index);
        continue;
      }

      const progress = particle.age / particle.lifetime;
      const material = particle.sprite.material;
      particle.velocity.y -= DUST_GRAVITY * delta;
      particle.velocity.multiplyScalar(Math.max(1 - DUST_DRAG * delta, 0.2));
      particle.sprite.position.addScaledVector(particle.velocity, delta);
      particle.sprite.position.x +=
        Math.sin(particle.driftPhase + particle.age * particle.driftSpeed) *
        particle.driftStrength *
        (1 - progress);
      particle.sprite.position.z +=
        Math.cos(particle.driftPhase + particle.age * particle.driftSpeed * 0.82) *
        particle.driftStrength *
        (1 - progress);
      particle.sprite.scale.setScalar(particle.initialScale * (1 + progress * DUST_EXPANSION));
      material.opacity = particle.initialOpacity * Math.pow(1 - progress, 1.35);
      material.rotation += particle.spin * delta;
    }
  }

  function clearDustParticles() {
    for (let index = dustParticles.length - 1; index >= 0; index -= 1) {
      removeDustParticle(index);
    }
  }

  function removeDustParticle(index) {
    const [particle] = dustParticles.splice(index, 1);
    particle.sprite.removeFromParent();
    particle.sprite.material.dispose();
  }

  function maybeTriggerBlockWaterSplash(block) {
    const water = getWater();
    if (!water || block.hasSplashed || !block.object.visible) {
      return;
    }

    const box = new THREE.Box3().setFromObject(block.object);
    if (box.isEmpty()) {
      return;
    }

    const crossedWaterSurface = block.previousWaterBottomY > water.position.y && box.min.y <= water.position.y;
    block.previousWaterBottomY = box.min.y;
    if (!crossedWaterSurface) {
      return;
    }

    block.hasSplashed = true;
    const center = box.getCenter(new THREE.Vector3());
    spawnBlockWaterSplash(
      new THREE.Vector3(center.x, water.position.y, center.z),
      Math.abs(block.velocity.y),
      Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 1),
    );
  }

  function spawnBlockWaterSplash(position, impactSpeed, impactSize) {
    const water = getWater();
    if (!water) {
      return;
    }

    const strength = THREE.MathUtils.clamp(
      0.7 + impactSpeed * WATER_SPLASH_IMPACT_SPEED_RESPONSE,
      0.8,
      2.2,
    );
    const ringRadius = Math.max(impactSize * 0.34, 0.9);
    const ringGeometry = new THREE.RingGeometry(0.78, 1, 72);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xcff8ff,
      depthWrite: false,
      opacity: 0.75,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);

    ring.position.set(position.x, water.position.y + 0.08, position.z);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 4;
    ring.scale.setScalar(ringRadius);
    scene.add(ring);

    splashEffects.push({
      age: 0,
      endScale: ringRadius * WATER_SPLASH_RING_EXPANSION * strength,
      lifetime: WATER_SPLASH_RING_DURATION,
      material: ringMaterial,
      mesh: ring,
      startScale: ringRadius,
      type: 'ring',
    });

    const particleCount = Math.round(WATER_SPLASH_PARTICLE_COUNT * THREE.MathUtils.clamp(strength, 0.8, 1.8));
    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * ringRadius * 0.8;
      const lateralSpeed = THREE.MathUtils.randFloat(0.9, 3.2) * strength;
      const liftSpeed = THREE.MathUtils.randFloat(2.2, 5.8) * strength;
      const lifetime = THREE.MathUtils.randFloat(
        WATER_SPLASH_DURATION_RANGE[0],
        WATER_SPLASH_DURATION_RANGE[1],
      );
      const opacity = THREE.MathUtils.randFloat(0.46, 0.9);
      const initialScale = THREE.MathUtils.randFloat(0.16, 0.42) * strength;
      const material = new THREE.SpriteMaterial({
        color: 0xe5fbff,
        depthWrite: false,
        map: splashTexture,
        opacity,
        transparent: true,
      });
      const sprite = new THREE.Sprite(material);

      sprite.position.set(
        position.x + Math.cos(angle) * radius,
        water.position.y + THREE.MathUtils.randFloat(0.08, 0.35),
        position.z + Math.sin(angle) * radius,
      );
      sprite.scale.setScalar(initialScale);
      scene.add(sprite);

      splashEffects.push({
        age: 0,
        initialOpacity: opacity,
        initialScale,
        lifetime,
        material,
        sprite,
        type: 'spray',
        velocity: new THREE.Vector3(
          Math.cos(angle) * lateralSpeed,
          liftSpeed,
          Math.sin(angle) * lateralSpeed,
        ),
      });
    }
  }

  function updateSplashEffects(delta) {
    for (let index = splashEffects.length - 1; index >= 0; index -= 1) {
      const effect = splashEffects[index];
      effect.age += delta;

      if (effect.age >= effect.lifetime) {
        removeSplashEffect(index);
        continue;
      }

      const progress = effect.age / effect.lifetime;
      const fade = Math.pow(1 - progress, 1.4);

      if (effect.type === 'ring') {
        const scale = THREE.MathUtils.lerp(effect.startScale, effect.endScale, easeOutCubic(progress));
        effect.mesh.scale.setScalar(scale);
        effect.material.opacity = 0.75 * fade;
        continue;
      }

      effect.velocity.y -= WATER_SPLASH_GRAVITY * delta;
      effect.sprite.position.addScaledVector(effect.velocity, delta);
      effect.sprite.scale.setScalar(effect.initialScale * (1 + progress * 1.6));
      effect.material.opacity = effect.initialOpacity * fade;
    }
  }

  function clearSplashEffects() {
    for (let index = splashEffects.length - 1; index >= 0; index -= 1) {
      removeSplashEffect(index);
    }
  }

  function removeSplashEffect(index) {
    const [effect] = splashEffects.splice(index, 1);

    if (effect.type === 'ring') {
      effect.mesh.removeFromParent();
      effect.mesh.geometry.dispose();
      effect.material.dispose();
      return;
    }

    effect.sprite.removeFromParent();
    effect.material.dispose();
  }

  function updateLandingScreenEffect(delta) {
    if (landingScreenEffectRemaining <= 0) {
      if (document.body.classList.contains('screen-impact-active')) {
        clearLandingImpact();
      }
      return;
    }

    landingScreenEffectRemaining = Math.max(landingScreenEffectRemaining - delta, 0);
    const progress = landingScreenEffectRemaining / LANDING_SCREEN_EFFECT_DURATION;
    const easedProgress = progress * progress;
    const shakePixels = LANDING_SCREEN_SHAKE_PIXELS * easedProgress;
    const blurPixels = LANDING_SCREEN_BLUR_PIXELS * Math.pow(progress, 2.2);

    document.body.style.setProperty(
      '--impact-shake-x',
      `${THREE.MathUtils.randFloatSpread(shakePixels * 2).toFixed(2)}px`,
    );
    document.body.style.setProperty(
      '--impact-shake-y',
      `${THREE.MathUtils.randFloatSpread(shakePixels).toFixed(2)}px`,
    );
    document.body.style.setProperty('--impact-blur', `${blurPixels.toFixed(2)}px`);
    document.body.style.setProperty(
      '--impact-scale',
      String(1 + (LANDING_SCREEN_SCALE - 1) * easedProgress),
    );
  }

  function clearLandingImpact() {
    landingShakeRemaining = 0;
    landingScreenEffectRemaining = 0;
    document.body.classList.remove('screen-impact-active');
    document.body.style.setProperty('--impact-shake-x', '0px');
    document.body.style.setProperty('--impact-shake-y', '0px');
    document.body.style.setProperty('--impact-blur', '0px');
    document.body.style.setProperty('--impact-scale', '1');
  }

  function getLandingShakeOffset(delta) {
    if (landingShakeRemaining <= 0) {
      return emptyShakeOffset.set(0, 0, 0);
    }

    landingShakeRemaining = Math.max(landingShakeRemaining - delta, 0);
    const strength = LANDING_SHAKE_STRENGTH * (landingShakeRemaining / LANDING_SHAKE_DURATION);

    return emptyShakeOffset.set(
      THREE.MathUtils.randFloatSpread(strength * 2),
      THREE.MathUtils.randFloatSpread(strength),
      THREE.MathUtils.randFloatSpread(strength * 0.7),
    );
  }

  return {
    clearDustParticles,
    clearLandingImpact,
    clearSplashEffects,
    getLandingShakeOffset,
    maybeTriggerBlockWaterSplash,
    triggerLandingImpact,
    updateDustParticles,
    updateLandingScreenEffect,
    updateSplashEffects,
  };
}
