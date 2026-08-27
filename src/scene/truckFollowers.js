import * as THREE from 'three';
import {
  MAX_TRUCK_PATH_DISTANCE,
  MOTION_PATH_NAMES,
  TRUCK_SPACING_UNITS,
  TRUCK_SPEED_UNITS_PER_SECOND,
} from '../core/constants.js';
import { baseObjectName, materialsForObject } from './objectLookup.js';

export function createTruckFollowerSystem(root) {
  const followers = [];
  setupTruckFollowers(root, followers);

  return {
    update(elapsedSeconds) {
      updateTruckFollowers(root, followers, elapsedSeconds);
    },
  };
}

function materialUsesTruckTexture(material) {
  if (!material) return false;

  const mapName = material.map?.name ?? '';
  const imageName = material.map?.image?.name ?? material.map?.image?.src ?? '';
  return (
    material.name.toLowerCase().includes('truck') ||
    mapName.toLowerCase().includes('truck') ||
    imageName.toLowerCase().includes('truck')
  );
}

function isTruckObject(object) {
  if (!object.isMesh) return false;

  const name = baseObjectName(object.name);
  return (
    name.startsWith('truck') ||
    name.startsWith('vehicle') ||
    materialsForObject(object).some(materialUsesTruckTexture)
  );
}

function findMotionPath(root) {
  const paths = new Map();

  root.traverse((object) => {
    const name = baseObjectName(object.name);
    if (!MOTION_PATH_NAMES.includes(name) || !object.geometry?.attributes?.position) return;
    paths.set(name, object);
  });

  return MOTION_PATH_NAMES.map((name) => paths.get(name)).find(Boolean) ?? null;
}

function collectPathPoints(root, pathObject) {
  const pathPointData = pathObject.userData?.dockyard_path_points;
  if (pathPointData) {
    try {
      const pathPoints = typeof pathPointData === 'string' ? JSON.parse(pathPointData) : pathPointData;
      if (Array.isArray(pathPoints)) {
        return pathPoints
          .filter((point) => Array.isArray(point) && point.length >= 3)
          .map((point) => new THREE.Vector3(point[0], point[1], point[2]));
      }
    } catch (error) {
      console.warn('Failed to parse roadn path points.', error);
    }
  }

  const position = pathObject.geometry?.attributes?.position;
  if (!position) return [];

  root.updateWorldMatrix(true, true);
  pathObject.updateWorldMatrix(true, false);

  const points = [];
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();

  for (let index = 0; index < position.count; index += 1) {
    localPoint.fromBufferAttribute(position, index);
    worldPoint.copy(localPoint);
    pathObject.localToWorld(worldPoint);

    const rootPoint = root.worldToLocal(worldPoint.clone());
    const previous = points[points.length - 1];
    if (!previous || previous.distanceToSquared(rootPoint) > 0.0001) {
      points.push(rootPoint);
    }
  }

  return points;
}

function collectTruckObjects(root) {
  const trucks = [];

  root.traverse((object) => {
    if (isTruckObject(object)) {
      trucks.push(object);
    }
  });

  return trucks;
}

function findClosestCurveOffset(curve, point) {
  let closestOffset = 0;
  let closestDistance = Infinity;
  const sampleCount = 720;

  for (let index = 0; index <= sampleCount; index += 1) {
    const offset = index / sampleCount;
    const curvePoint = curve.getPointAt(offset);
    const distance = curvePoint.distanceToSquared(point);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestOffset = offset;
    }
  }

  return {
    distance: Math.sqrt(closestDistance),
    offset: closestOffset,
  };
}

function rootLocalPositionForObject(root, object) {
  const worldPosition = new THREE.Vector3();
  object.getWorldPosition(worldPosition);
  return root.worldToLocal(worldPosition);
}

function setObjectRootLocalPosition(root, object, rootPosition) {
  const worldPosition = root.localToWorld(rootPosition.clone());
  object.position.copy(object.parent ? object.parent.worldToLocal(worldPosition) : worldPosition);
}

function setupTruckFollowers(root, followers) {
  const pathObject = findMotionPath(root);
  if (!pathObject) {
    console.warn('No roadn path found for truck animation.');
    return;
  }

  const points = collectPathPoints(root, pathObject);
  if (points.length < 2) {
    console.warn('The roadn path does not have enough points for truck animation.');
    return;
  }

  pathObject.visible = false;

  const isClosedPath = points[0].distanceTo(points[points.length - 1]) < 2.5;
  const curve = new THREE.CatmullRomCurve3(points, isClosedPath, 'catmullrom', 0.2);
  const pathLength = curve.getLength();
  if (pathLength <= 0) {
    console.warn('The roadn path length is zero.');
    return;
  }

  const trucks = collectTruckObjects(root);

  trucks.forEach((truck, index) => {
    const truckRootPosition = rootLocalPositionForObject(root, truck);
    const nearestPath = findClosestCurveOffset(curve, truckRootPosition);
    if (nearestPath.distance > MAX_TRUCK_PATH_DISTANCE) {
      return;
    }

    const startOffset = Number.isFinite(nearestPath.offset)
      ? nearestPath.offset
      : index / Math.max(trucks.length, 1);
    const pathPoint = curve.getPointAt(startOffset);
    const tangent = curve.getTangentAt(startOffset).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);

    followers.push({
      truck,
      curve,
      pathLength,
      startOffset,
      yOffset: truckRootPosition.y - pathPoint.y,
      yawOffset: truck.rotation.y - heading,
      isClosedPath,
    });
  });

  spaceTruckFollowers(followers, pathLength, isClosedPath);
}

function spaceTruckFollowers(followers, pathLength, isClosedPath) {
  if (followers.length < 2 || pathLength <= 0) return;

  const minimumOffsetGap = Math.min(
    TRUCK_SPACING_UNITS / pathLength,
    0.85 / followers.length,
  );
  followers.sort((a, b) => a.startOffset - b.startOffset);

  for (let index = 1; index < followers.length; index += 1) {
    const previous = followers[index - 1];
    const current = followers[index];
    const offsetGap = current.startOffset - previous.startOffset;

    if (offsetGap < minimumOffsetGap) {
      current.startOffset = previous.startOffset + minimumOffsetGap;
    }
  }

  const lastFollower = followers[followers.length - 1];
  if (isClosedPath) {
    followers.forEach((follower) => {
      follower.startOffset = THREE.MathUtils.euclideanModulo(follower.startOffset, 1);
    });
    return;
  }

  if (lastFollower.startOffset > 0.98) {
    const firstOffset = Math.max(0.02, 0.98 - minimumOffsetGap * (followers.length - 1));
    followers.forEach((follower, index) => {
      follower.startOffset = firstOffset + minimumOffsetGap * index;
    });
  }
}

function updateTruckFollowers(root, followers, elapsedSeconds) {
  for (const follower of followers) {
    const distanceOffset = (elapsedSeconds * TRUCK_SPEED_UNITS_PER_SECOND) / follower.pathLength;
    let pathOffset = follower.startOffset + distanceOffset;

    if (follower.isClosedPath) {
      pathOffset %= 1;
    } else {
      pathOffset %= 2;
      pathOffset = pathOffset <= 1 ? pathOffset : 2 - pathOffset;
    }

    const point = follower.curve.getPointAt(pathOffset);
    point.y += follower.yOffset;
    setObjectRootLocalPosition(root, follower.truck, point);

    const tangent = follower.curve.getTangentAt(pathOffset).normalize();
    const heading = Math.atan2(tangent.x, tangent.z);
    follower.truck.rotation.y = heading + follower.yawOffset;
  }
}
