import * as THREE from 'three';
import {
  WATER_ANIMATION_SPEED,
  WATER_BOAT_WAKE_MAX_COUNT,
  WATER_EDGE_PADDING,
  WATER_HORIZON_BLEND_DISTANCE,
  WATER_HORIZON_CURVE_RADIUS,
  WATER_HORIZON_CURVE_START,
  WATER_QUALITY,
  WATER_SETTINGS,
  WATER_SHIMMER_SPEED,
  WATER_SIZE_MULTIPLIER,
  WATER_SIZE_PADDING,
} from '../core/constants.js';

function materialNameForIndex(material, index) {
  if (Array.isArray(material)) {
    return material[index]?.name ?? '';
  }

  return material?.name ?? '';
}

function createBoatWakeDataA() {
  return Array.from(
    { length: WATER_BOAT_WAKE_MAX_COUNT },
    () => new THREE.Vector4(9999, 9999, 0, 0),
  );
}

function createBoatWakeDataB() {
  return Array.from(
    { length: WATER_BOAT_WAKE_MAX_COUNT },
    () => new THREE.Vector4(0, 1, 0, 0),
  );
}

function getMaterialBounds(root, materialNames) {
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const rootLocalVertex = new THREE.Vector3();

  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;

    const position = object.geometry.attributes.position;
    const groups = object.geometry.groups.length
      ? object.geometry.groups
      : [{ start: 0, count: position.count, materialIndex: 0 }];

    object.updateWorldMatrix(true, false);
    groups.forEach((group) => {
      const materialName = materialNameForIndex(object.material, group.materialIndex);
      if (!materialNames.has(materialName)) return;

      const start = group.start;
      const end = Math.min(group.start + group.count, position.count);
      for (let index = start; index < end; index += 1) {
        vertex.fromBufferAttribute(position, index);
        object.localToWorld(vertex);
        rootLocalVertex.copy(vertex);
        root.worldToLocal(rootLocalVertex);
        bounds.expandByPoint(rootLocalVertex);
      }
    });
  });

  return bounds.isEmpty() ? null : bounds;
}

function createWaterMaterial(dockBounds, sunLight) {
  const centerX = (dockBounds.min.x + dockBounds.max.x) * 0.5;
  const centerZ = (dockBounds.min.z + dockBounds.max.z) * 0.5;
  const halfSizeX = (dockBounds.max.x - dockBounds.min.x) * 0.5 + WATER_EDGE_PADDING;
  const halfSizeZ = (dockBounds.max.z - dockBounds.min.z) * 0.5 + WATER_EDGE_PADDING;
  const quality = WATER_SETTINGS[WATER_QUALITY] ?? WATER_SETTINGS.HIGH;

  return new THREE.ShaderMaterial({
    depthWrite: true,
    transparent: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      shimmerTime: { value: 0 },
      dockCenter: { value: new THREE.Vector2(centerX, centerZ) },
      dockHalfSize: { value: new THREE.Vector2(halfSizeX, halfSizeZ) },
      shipCenter: { value: new THREE.Vector2(9999, 9999) },
      shipHalfSize: { value: new THREE.Vector2(1, 1) },
      shipWakeStrength: { value: 0 },
      boatWakeCount: { value: 0 },
      boatWakeDataA: { value: createBoatWakeDataA() },
      boatWakeDataB: { value: createBoatWakeDataB() },
      sunDirection: { value: sunLight.position.clone().normalize() },
      normalIntensity: { value: quality.normalIntensity },
      foamIntensity: { value: quality.foamIntensity },
      reflectionStrength: { value: quality.reflectionStrength },
      horizonCurveStart: { value: WATER_HORIZON_CURVE_START },
      horizonCurveRadius: { value: WATER_HORIZON_CURVE_RADIUS },
      horizonBlendDistance: { value: WATER_HORIZON_BLEND_DISTANCE },
    },
    vertexShader: `
      #define BOAT_WAKE_MAX_COUNT ${WATER_BOAT_WAKE_MAX_COUNT}

      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      varying float vCrest;
      varying float vHorizonBlend;
      varying float vCameraDistance;

      uniform float time;
      uniform vec2 dockCenter;
      uniform vec2 dockHalfSize;
      uniform vec2 shipCenter;
      uniform vec2 shipHalfSize;
      uniform float shipWakeStrength;
      uniform float boatWakeCount;
      uniform float horizonCurveStart;
      uniform float horizonCurveRadius;
      uniform float horizonBlendDistance;
      uniform vec4 boatWakeDataA[BOAT_WAKE_MAX_COUNT];
      uniform vec4 boatWakeDataB[BOAT_WAKE_MAX_COUNT];

      float waveLayer(vec2 point, vec2 direction, float frequency, float speed, float amplitude, float steepness) {
        float phase = dot(point, normalize(direction)) * frequency + time * speed;
        float rounded = sin(phase);
        float crest = pow(max(0.0, rounded), 2.0) * steepness;
        return (rounded + crest * 0.28) * amplitude;
      }

      float oceanHeight(vec2 point) {
        point += vec2(
          sin(point.y * 0.025 + time * 0.19) * 2.4,
          sin(point.x * 0.021 - time * 0.17) * 2.1
        );
        float height = 0.0;
        height += waveLayer(point, vec2(0.78, 0.32), 0.026, 0.78, 0.95, 0.78);
        height += waveLayer(point, vec2(-0.31, 0.95), 0.041, -0.64, 0.66, 0.66);
        height += waveLayer(point, vec2(0.22, 0.72), 0.068, 1.05, 0.4, 0.58);
        height += waveLayer(point, vec2(-0.92, 0.39), 0.118, 1.42, 0.24, 0.42);
        height += sin(point.x * 0.11 + sin(point.y * 0.05 + time * 0.36) * 2.1 - time * 1.45) * 0.18;
        return height;
      }

      float hash1(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      float centerPulseRing(vec2 point, float cycleLength, float seed, float reach, float width, float amplitude) {
        float distanceToCenter = length(point - dockCenter);
        float cyclePosition = time / cycleLength + seed;
        float cycleIndex = floor(cyclePosition);
        float phase = fract(cyclePosition);
        float randomGate = step(0.36, hash1(cycleIndex + seed * 41.0));
        float birthFade = smoothstep(0.04, 0.18, phase);
        float deathFade = 1.0 - smoothstep(0.72, 1.0, phase);
        float reachJitter = mix(0.82, 1.14, hash1(cycleIndex + seed * 19.0));
        float radius = phase * reach * reachJitter;
        float bandDistance = abs(distanceToCenter - radius);
        float leadingBand = exp(-(bandDistance * bandDistance) / (width * width));
        float trailingBand = exp(-pow(max(distanceToCenter - radius + width * 2.4, 0.0), 2.0) / (width * width * 5.2));
        float waveShape = sin((distanceToCenter - radius) * 0.72) * 0.42 + 0.58;
        return (leadingBand * waveShape + trailingBand * 0.32) * birthFade * deathFade * randomGate * amplitude;
      }

      float centerRippleHeight(vec2 point) {
        return centerPulseRing(point, 9.6, 0.17, 116.0, 5.8, 0.92)
          + centerPulseRing(point, 14.2, 2.83, 132.0, 7.4, 0.62)
          + centerPulseRing(point, 21.0, 5.41, 145.0, 9.0, 0.42);
      }

      float boatWakeActivity(int index) {
        return 1.0 - step(boatWakeCount, float(index));
      }

      float boatWakeHeight(vec2 point) {
        float wakeHeight = 0.0;

        for (int index = 0; index < BOAT_WAKE_MAX_COUNT; index += 1) {
          float wakeActive = boatWakeActivity(index);
          vec4 wakeA = boatWakeDataA[index];
          vec4 wakeB = boatWakeDataB[index];
          vec2 direction = normalize(wakeB.xy);
          vec2 offset = point - wakeA.xy;
          float behind = -dot(offset, direction);
          float side = dot(offset, vec2(-direction.y, direction.x));
          float trailLength = max(wakeA.z, 1.0);
          float baseWidth = max(wakeB.z, 0.25);
          float distanceRatio = clamp(behind / trailLength, 0.0, 1.0);
          float trailFade = smoothstep(0.0, 4.0, behind) * (1.0 - smoothstep(0.72, 1.0, distanceRatio));
          float wakeWidth = mix(baseWidth * 0.75, baseWidth * 4.2, distanceRatio);
          float edgeDistance = abs(side) - wakeWidth * 0.62;
          float edgeFalloff = exp(-(edgeDistance * edgeDistance) / max(wakeWidth * wakeWidth * 0.2, 0.001));
          float centerFalloff = exp(-(side * side) / max(wakeWidth * wakeWidth * 0.9, 0.001))
            * (1.0 - distanceRatio)
            * 0.32;
          float ripple = sin(behind * 0.72 + abs(side) * 0.9 - time * (4.4 + wakeB.w * 0.18));

          wakeHeight += wakeActive * wakeA.w * trailFade * (edgeFalloff + centerFalloff) * ripple * 0.42;
        }

        return wakeHeight;
      }

      void main() {
        vUv = uv;
        vec3 transformed = position;
        vec2 waterPoint = (modelMatrix * vec4(position, 1.0)).xz;
        vec2 shipScale = max(shipHalfSize, vec2(1.0));
        float shipDistance = length((waterPoint - shipCenter) / shipScale);
        float shipWake = shipWakeStrength * (1.0 - smoothstep(0.72, 3.8, shipDistance));
        float wakeRipple = sin(shipDistance * 18.0 - time * 4.1) * shipWake * 0.24;
        float cameraDistance = length(waterPoint - cameraPosition.xz);
        float distantCalm = 1.0 - smoothstep(360.0, 820.0, cameraDistance) * 0.72;
        vWave = (oceanHeight(waterPoint) + centerRippleHeight(waterPoint) * 0.78 + wakeRipple + boatWakeHeight(waterPoint)) * distantCalm;
        vCrest = smoothstep(0.08, 0.52, vWave);
        transformed.z += vWave * 0.44;

        // The water is intentionally planar around the dock and all ambient
        // traffic. Past that area it follows a shallow spherical falloff. This
        // creates an ocean horizon and puts the finite mesh edge below view.
        float curveDistance = max(cameraDistance - horizonCurveStart, 0.0);
        transformed.z -= (curveDistance * curveDistance) / (2.0 * horizonCurveRadius);
        vHorizonBlend = smoothstep(
          horizonCurveStart - horizonBlendDistance,
          horizonCurveStart + horizonBlendDistance,
          cameraDistance
        );
        vCameraDistance = cameraDistance;

        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      #define BOAT_WAKE_MAX_COUNT ${WATER_BOAT_WAKE_MAX_COUNT}

      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      varying float vCrest;
      varying float vHorizonBlend;
      varying float vCameraDistance;

      uniform float time;
      uniform float shimmerTime;
      uniform vec2 dockCenter;
      uniform vec2 dockHalfSize;
      uniform vec2 shipCenter;
      uniform vec2 shipHalfSize;
      uniform float shipWakeStrength;
      uniform float boatWakeCount;
      uniform vec4 boatWakeDataA[BOAT_WAKE_MAX_COUNT];
      uniform vec4 boatWakeDataB[BOAT_WAKE_MAX_COUNT];
      uniform vec3 sunDirection;
      uniform float normalIntensity;
      uniform float foamIntensity;
      uniform float reflectionStrength;

      float rectDistance(vec2 point, vec2 center, vec2 halfSize) {
        vec2 q = abs(point - center) - halfSize;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      }

      float hash(vec2 point) {
        vec3 p = fract(vec3(point.xyx) * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        vec2 curve = local * local * (3.0 - 2.0 * local);

        float a = hash(cell);
        float b = hash(cell + vec2(1.0, 0.0));
        float c = hash(cell + vec2(0.0, 1.0));
        float d = hash(cell + vec2(1.0, 1.0));

        return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
      }

      float waveLayer(vec2 point, vec2 direction, float frequency, float speed, float amplitude, float steepness) {
        float phase = dot(point, normalize(direction)) * frequency + time * speed;
        float rounded = sin(phase);
        float crest = pow(max(0.0, rounded), 2.0) * steepness;
        return (rounded + crest * 0.28) * amplitude;
      }

      float oceanHeight(vec2 point) {
        point += vec2(
          sin(point.y * 0.025 + time * 0.19) * 2.4,
          sin(point.x * 0.021 - time * 0.17) * 2.1
        );
        float height = 0.0;
        height += waveLayer(point, vec2(0.78, 0.32), 0.026, 0.78, 0.95, 0.78);
        height += waveLayer(point, vec2(-0.31, 0.95), 0.041, -0.64, 0.66, 0.66);
        height += waveLayer(point, vec2(0.22, 0.72), 0.068, 1.05, 0.4, 0.58);
        height += waveLayer(point, vec2(-0.92, 0.39), 0.118, 1.42, 0.24, 0.42);
        height += sin(point.x * 0.11 + sin(point.y * 0.05 + time * 0.36) * 2.1 - time * 1.45) * 0.18;
        return height;
      }

      vec3 oceanNormal(vec2 point) {
        float sampleStep = 0.55;
        float left = oceanHeight(point - vec2(sampleStep, 0.0));
        float right = oceanHeight(point + vec2(sampleStep, 0.0));
        float back = oceanHeight(point - vec2(0.0, sampleStep));
        float front = oceanHeight(point + vec2(0.0, sampleStep));
        vec3 normal = normalize(vec3(left - right, sampleStep * 2.0, back - front));

        float rippleA = sin(point.x * 0.22 + point.y * 0.05 + time * 0.92);
        float rippleB = sin(point.x * -0.08 + point.y * 0.24 - time * 0.78);
        float rippleNoise = noise(point * 0.14 + vec2(time * -0.08, time * 0.06)) - 0.5;
        normal.xz += vec2(rippleA * 0.07 + rippleNoise * 0.08, rippleB * 0.07 - rippleNoise * 0.07) * normalIntensity;

        return normalize(normal);
      }

      float hash1(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      float centerPulseMask(vec2 point, float cycleLength, float seed, float reach, float width, float strength) {
        float distanceToCenter = length(point - dockCenter);
        float cyclePosition = time / cycleLength + seed;
        float cycleIndex = floor(cyclePosition);
        float phase = fract(cyclePosition);
        float randomGate = step(0.36, hash1(cycleIndex + seed * 41.0));
        float birthFade = smoothstep(0.04, 0.18, phase);
        float deathFade = 1.0 - smoothstep(0.72, 1.0, phase);
        float reachJitter = mix(0.82, 1.14, hash1(cycleIndex + seed * 19.0));
        float radius = phase * reach * reachJitter;
        float bandDistance = abs(distanceToCenter - radius);
        float ring = 1.0 - smoothstep(width * 0.32, width, bandDistance);
        float breakup = noise(point * 0.31 + vec2(shimmerTime * -0.07, shimmerTime * 0.05));
        return ring * smoothstep(0.36, 0.88, breakup + ring * 0.52) * birthFade * deathFade * randomGate * strength;
      }

      float centerRippleFoam(vec2 point) {
        return centerPulseMask(point, 9.6, 0.17, 116.0, 6.2, 0.9)
          + centerPulseMask(point, 14.2, 2.83, 132.0, 8.0, 0.54)
          + centerPulseMask(point, 21.0, 5.41, 145.0, 9.8, 0.34);
      }

      float boatWakeActivity(int index) {
        return 1.0 - step(boatWakeCount, float(index));
      }

      float boatWakeFoam(vec2 point) {
        float foam = 0.0;

        for (int index = 0; index < BOAT_WAKE_MAX_COUNT; index += 1) {
          float wakeActive = boatWakeActivity(index);
          vec4 wakeA = boatWakeDataA[index];
          vec4 wakeB = boatWakeDataB[index];
          vec2 direction = normalize(wakeB.xy);
          vec2 offset = point - wakeA.xy;
          float behind = -dot(offset, direction);
          float side = dot(offset, vec2(-direction.y, direction.x));
          float absSide = abs(side);
          float trailLength = max(wakeA.z, 1.0);
          float baseWidth = max(wakeB.z, 0.25);
          float distanceRatio = clamp(behind / trailLength, 0.0, 1.0);
          float trailFade = smoothstep(0.0, 3.6, behind) * (1.0 - smoothstep(0.64, 1.0, distanceRatio));
          float wakeWidth = mix(baseWidth * 0.85, baseWidth * 5.2, distanceRatio);
          float edgeDistance = absSide - wakeWidth * 0.72;
          float leftRight = exp(-(edgeDistance * edgeDistance) / max(wakeWidth * wakeWidth * 0.18, 0.001));
          float propWash = exp(-(side * side) / max(wakeWidth * wakeWidth * 0.42, 0.001))
            * (1.0 - smoothstep(0.0, 0.38, distanceRatio))
            * 0.58;
          float broken = noise(point * 0.42 + vec2(shimmerTime * -0.44 + float(index) * 13.1, shimmerTime * 0.27));
          float rib = sin(behind * 0.76 + absSide * 1.35 - shimmerTime * (5.2 + wakeB.w * 0.24)) * 0.5 + 0.5;
          float breakup = smoothstep(0.28, 0.82, broken * 0.62 + rib * 0.45 + leftRight * 0.34);

          foam += wakeActive * wakeA.w * trailFade * (leftRight * 0.82 + propWash) * breakup;
        }

        return clamp(foam, 0.0, 1.0);
      }

      void main() {
        vec2 waterPoint = vWorldPosition.xz;
        float signedWallDistance = rectDistance(waterPoint, dockCenter, dockHalfSize);
        float outsideDock = smoothstep(-0.04, 0.36, signedWallDistance);
        float wallBand = 1.0 - smoothstep(0.03, 1.35, signedWallDistance);
        float foamBreakup = noise(waterPoint * 0.52 + vec2(shimmerTime * 0.18, -shimmerTime * 0.12)) * 0.62
          + noise(waterPoint * 1.05 + vec2(shimmerTime * -0.28, shimmerTime * 0.16)) * 0.38;
        float wallFoam = outsideDock * wallBand * smoothstep(0.34, 0.78, foamBreakup + vCrest * 0.58) * foamIntensity;
        float surfaceNoise = noise(waterPoint * 0.024 + vec2(shimmerTime * 0.018, shimmerTime * -0.014));
        float smallNoise = noise(waterPoint * 0.055 + vec2(shimmerTime * -0.06, shimmerTime * 0.045)) * 0.72
          + noise(waterPoint * 0.11 + vec2(shimmerTime * 0.08, shimmerTime * -0.052)) * 0.28;
        float fineRipples = sin(waterPoint.x * 0.08 + waterPoint.y * 0.055 + shimmerTime * 0.92)
          * sin(waterPoint.x * -0.06 + waterPoint.y * 0.095 - shimmerTime * 0.84);
        vec2 shipScale = max(shipHalfSize, vec2(1.0));
        vec2 shipVector = waterPoint - shipCenter;
        float shipDistance = length(shipVector / shipScale);
        float shipContact = shipWakeStrength * (1.0 - smoothstep(0.62, 1.42, shipDistance)) * 0.42;
        float shipWakeBand = shipWakeStrength * (1.0 - smoothstep(0.72, 7.6, shipDistance)) * 0.34;
        float shipRipple = (sin(shipDistance * 19.0 - time * 3.95) * 0.5 + 0.5)
          * shipWakeBand
          * (0.45 + noise(waterPoint * 0.74 + vec2(shimmerTime * -0.22, shimmerTime * 0.17)) * 0.55);
        vec3 normal = oceanNormal(waterPoint);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sun = normalize(sunDirection);
        float ndv = clamp(dot(normal, viewDirection), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 3.0);
        float horizonReflection = smoothstep(0.0, 0.58, fresnel);
        float broadShade = surfaceNoise * 2.0 - 1.0;
        float waveSlope = clamp((1.0 - normal.y) * 4.8, 0.0, 1.0);
        float longHighlight = sin(waterPoint.x * 0.032 + waterPoint.y * 0.018 + shimmerTime * 0.34) * 0.5 + 0.5;
        float crossHighlight = sin(waterPoint.x * -0.045 + waterPoint.y * 0.061 - shimmerTime * 0.48) * 0.5 + 0.5;

        vec3 deep = vec3(0.004, 0.075, 0.17);
        vec3 mid = vec3(0.008, 0.235, 0.42);
        vec3 teal = vec3(0.018, 0.45, 0.54);
        vec3 shallow = vec3(0.2, 0.67, 0.69);
        float depthTint = clamp(0.52 + broadShade * 0.27 + smallNoise * 0.23 + vWave * 0.1, 0.0, 1.0);
        float mottling = noise(waterPoint * 0.045 + vec2(shimmerTime * 0.025, shimmerTime * -0.02)) * 2.0 - 1.0;
        vec3 color = mix(deep, mid, depthTint);
        color = mix(color, teal, clamp(0.34 + smallNoise * 0.28 + fineRipples * 0.1, 0.0, 0.64));
        color = mix(color, shallow, clamp(vCrest * 0.28 + max(vWave, 0.0) * 0.15, 0.0, 0.48));
        color *= 1.08 + mottling * 0.07;
        color += vec3(0.08, 0.3, 0.34) * waveSlope * (0.32 + longHighlight * crossHighlight * 0.78);
        color += vec3(0.05, 0.19, 0.2) * max(fineRipples, 0.0) * (1.0 - vHorizonBlend) * 0.42;

        vec3 reflectedSun = reflect(-sun, normal);
        float sharpSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 96.0);
        float broadSpec = pow(max(dot(reflectedSun, viewDirection), 0.0), 18.0);
        float sunFacing = max(dot(reflectedSun, viewDirection), 0.0);
        float warmReflectionBand = smoothstep(0.12, 0.82, fresnel)
          * (0.42 + 0.58 * (sin(waterPoint.x * 0.018 + waterPoint.y * 0.011 + shimmerTime * 0.16) * 0.5 + 0.5));
        float sunsetRibbon = smoothstep(
          0.28,
          0.86,
          sin(waterPoint.x * 0.014 - waterPoint.y * 0.009 + shimmerTime * 0.11) * 0.5
            + surfaceNoise * 0.42
        );
        vec3 sunsetReflection = mix(
          vec3(1.0, 0.48, 0.27),
          vec3(1.0, 0.42, 0.62),
          clamp(surfaceNoise * 0.72 + horizonReflection * 0.28, 0.0, 1.0)
        );
        float streakMask = smoothstep(0.48, 0.92, noise(waterPoint * vec2(0.08, 0.22) + vec2(shimmerTime * -0.08, shimmerTime * 0.18)));
        float crestMask = smoothstep(0.08, 0.56, vWave + smallNoise * 0.38);
        float crestFoam = vCrest
          * smoothstep(0.5, 0.88, noise(waterPoint * 0.16 + vec2(shimmerTime * -0.12, shimmerTime * 0.09)))
          * foamIntensity;
        float centerFoam = centerRippleFoam(waterPoint) * foamIntensity;
        float boatWake = boatWakeFoam(waterPoint) * foamIntensity;
        float boatReflection = boatWake;
        float shipReflection = shipWakeStrength
          * exp(-dot(shipVector / (shipScale * 1.15), shipVector / (shipScale * 1.15)))
          * (0.5 + surfaceNoise * 0.5);
        float sunRayBreakup = 0.35 + streakMask * 0.65;
        float pinkSunPath = (pow(sunFacing, 7.0) * 0.72 + broadSpec * 0.34)
          * sunRayBreakup
          * (0.35 + crestMask * 0.65)
          * reflectionStrength;
        vec2 reflectionDirection = normalize(cameraPosition.xz - dockCenter + vec2(0.001));
        vec2 reflectionSide = vec2(-reflectionDirection.y, reflectionDirection.x);
        vec2 reflectionOffset = waterPoint - dockCenter;
        float reflectionSideDistance = abs(dot(reflectionOffset, reflectionSide));
        float reflectionAlongDistance = dot(reflectionOffset, reflectionDirection);
        float reflectionColumn = exp(-reflectionSideDistance * 0.014)
          * smoothstep(-80.0, 40.0, reflectionAlongDistance)
          * (0.24 + streakMask * 0.5 + max(fineRipples, 0.0) * 0.26)
          * (0.58 + waveSlope * 0.42);
        float glint = (sharpSpec * 0.7 + broadSpec * 0.26) * streakMask * (0.32 + crestMask * 0.62) * reflectionStrength;
        vec3 skyReflection = mix(vec3(0.24, 0.55, 0.76), vec3(0.76, 0.91, 0.98), horizonReflection);
        float aerialPerspective = smoothstep(180.0, 900.0, vCameraDistance);

        color = mix(color, skyReflection, clamp((fresnel * 0.3 + crestMask * 0.05) * reflectionStrength, 0.0, 0.3));
        float warmReflectionStrength = warmReflectionBand * 0.17
          + sunsetRibbon * (0.045 + waveSlope * 0.055)
          + broadSpec * 0.09;
        color = mix(color, sunsetReflection, clamp(warmReflectionStrength, 0.0, 0.2));
        color = mix(color, vec3(0.16, 0.055, 0.12), clamp(shipReflection * 0.16 + boatReflection * 0.2, 0.0, 0.26));
        color += vec3(1.0, 0.34, 0.52) * pinkSunPath * 0.58;
        color += vec3(1.0, 0.64, 0.32) * pinkSunPath * sunsetRibbon * 0.28;
        color = mix(color, skyReflection, vHorizonBlend * 0.34);
        color = mix(color, vec3(0.36, 0.62, 0.73), aerialPerspective * 0.16);
        float visibleWaterBody = (1.0 - vHorizonBlend) * (1.0 - aerialPerspective * 0.45);
        color = mix(color, vec3(0.012, 0.255, 0.43), visibleWaterBody * 0.5);
        color += mix(vec3(1.0, 0.38, 0.57), vec3(1.0, 0.68, 0.34), surfaceNoise)
          * reflectionColumn
          * 0.2;
        color += vec3(1.0, 0.92, 0.72) * glint * 1.35;
        color += vec3(1.0, 0.34, 0.52) * pinkSunPath * 0.42;
        color += vec3(0.08, 0.18, 0.18) * shipRipple * 0.14;
        color += vec3(0.05, 0.13, 0.14) * boatWake * 0.08;
        color = mix(color, vec3(0.72, 0.86, 0.84), clamp(wallFoam * 0.08 + crestFoam * 0.08 + centerFoam * 0.34 + boatWake * 0.28 + shipContact * 0.14 + shipRipple * 0.1, 0.0, 0.5));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function setupWater(root, { scene, sunLight }) {
  const sceneBounds = new THREE.Box3().setFromObject(root);
  const dockBounds = getMaterialBounds(root, new Set(['Material.051'])) ?? sceneBounds;
  const sceneSize = sceneBounds.getSize(new THREE.Vector3());
  const dockSize = dockBounds.getSize(new THREE.Vector3());
  const dockCenter = dockBounds.getCenter(new THREE.Vector3());
  const waterSize = Math.max(sceneSize.x, sceneSize.z, dockSize.x, dockSize.z) * WATER_SIZE_MULTIPLIER
    + WATER_SIZE_PADDING;
  const waterLevel = dockBounds.min.y + Math.max(1.1, dockSize.y * 0.12);
  const quality = WATER_SETTINGS[WATER_QUALITY] ?? WATER_SETTINGS.HIGH;

  const geometry = new THREE.PlaneGeometry(waterSize, waterSize, quality.segments, quality.segments);
  const material = createWaterMaterial(dockBounds, sunLight);
  const water = new THREE.Mesh(geometry, material);
  water.name = 'surrounding_water';
  water.frustumCulled = false;
  water.rotation.x = -Math.PI / 2;
  water.position.set(dockCenter.x, waterLevel, dockCenter.z);
  water.renderOrder = -1;
  water.userData.bounds = {
    center: dockCenter.clone(),
    halfSize: waterSize * 0.5,
    size: waterSize,
  };
  water.userData.level = waterLevel;
  scene.add(water);

  return water;
}

export function updateWater(water, elapsedSeconds) {
  if (!water) return;
  water.material.uniforms.time.value = elapsedSeconds * WATER_ANIMATION_SPEED;
  water.material.uniforms.shimmerTime.value = elapsedSeconds * WATER_SHIMMER_SPEED;
}
