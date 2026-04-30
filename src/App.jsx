import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const CAMERA_Z = 28;
const FAR_Z = -168;
const EXIT_START_Z = -30;
const EXIT_COMMIT_Z = -8;
const EXIT_RESET_Z = CAMERA_Z + 6;
const EXIT_OFFSCREEN_TIME = 0.22;
const DEPTH_RANGE = CAMERA_Z - FAR_Z;
const TAU = Math.PI * 2;
const HERO_LAYER = 0;
const MID_LAYER = 1;
const BACK_LAYER = 2;
const EXIT_LEFT = 0;
const EXIT_RIGHT = 1;
const EXIT_TOP = 2;
const EXIT_BOTTOM = 3;
const EXIT_LOWER_LEFT = 4;
const EXIT_LOWER_RIGHT = 5;
const EXIT_FLYBY = 6;

const CRANE_PALETTE = [
  { h: 0.03, s: 0.36, l: 0.82 },
  { h: 0.08, s: 0.4, l: 0.8 },
  { h: 0.13, s: 0.36, l: 0.83 },
  { h: 0.38, s: 0.34, l: 0.81 },
  { h: 0.49, s: 0.38, l: 0.82 },
  { h: 0.58, s: 0.38, l: 0.82 },
  { h: 0.72, s: 0.34, l: 0.84 },
  { h: 0.91, s: 0.35, l: 0.83 },
];

const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const wrap01 = (value) => value - Math.floor(value);
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const easeInOutSine = (value) => -(Math.cos(Math.PI * clamp01(value)) - 1) * 0.5;
const easeOutCubic = (value) => 1 - (1 - clamp01(value)) ** 3;
const wingbeatCurve = (cycle) => {
  const t = wrap01(cycle);

  if (t < 0.08) {
    return 1 - easeInOutSine(t / 0.08) * 0.04;
  }
  if (t < 0.34) {
    return 1 - easeOutCubic((t - 0.08) / 0.26) * 2;
  }
  if (t < 0.43) {
    return -1 + Math.sin(((t - 0.34) / 0.09) * Math.PI) * 0.05;
  }
  if (t < 0.88) {
    return -1 + easeInOutSine((t - 0.43) / 0.45) * 2;
  }

  return 1 - easeInOutSine((t - 0.88) / 0.12) * 0.03;
};

function usePerformanceTier() {
  const [tier, setTier] = useState({
    cranes: 220,
    particles: 620,
    reducedMotion: false,
  });

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateTier = () => {
      const mobile = window.innerWidth < 760;
      const cores = navigator.hardwareConcurrency || 4;
      const reducedMotion = motionQuery.matches;

      let cranes = mobile ? 124 : 220;
      if (cores <= 4) cranes = mobile ? 92 : 170;
      if (reducedMotion) cranes = mobile ? 58 : 82;

      setTier({
        cranes,
        particles: reducedMotion ? 140 : mobile ? 340 : 620,
        reducedMotion,
      });
    };

    updateTier();
    window.addEventListener('resize', updateTier);
    motionQuery.addEventListener('change', updateTier);

    return () => {
      window.removeEventListener('resize', updateTier);
      motionQuery.removeEventListener('change', updateTier);
    };
  }, []);

  return tier;
}

function createPaperTextures() {
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const context = canvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');

  context.fillStyle = '#f8f0e3';
  context.fillRect(0, 0, size, size);
  bumpContext.fillStyle = '#808080';
  bumpContext.fillRect(0, 0, size, size);

  const image = context.getImageData(0, 0, size, size);
  const bump = bumpContext.getImageData(0, 0, size, size);
  const pixels = image.data;
  const bumpPixels = bump.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const grain =
      (Math.random() - 0.5) * 14 +
      Math.sin(x * 0.21 + y * 0.038) * 3.4 +
      Math.sin(y * 0.13) * 2.2 +
      Math.sin((x + y) * 0.052) * 1.8;
    const fiber = Math.sin(x * 0.62 + Math.sin(y * 0.047) * 2.2) * 4;
    const fleck = Math.random() > 0.982 ? random(-18, 22) : 0;

    pixels[i] = clamp(pixels[i] + grain + fiber * 0.34 + fleck, 0, 255);
    pixels[i + 1] = clamp(pixels[i + 1] + grain * 0.9 + fiber * 0.26 + fleck * 0.7, 0, 255);
    pixels[i + 2] = clamp(pixels[i + 2] + grain * 0.72 + fiber * 0.18 + fleck * 0.45, 0, 255);

    const bumpValue = clamp(128 + grain * 1.1 + fiber * 1.8 + fleck * 0.35, 0, 255);
    bumpPixels[i] = bumpValue;
    bumpPixels[i + 1] = bumpValue;
    bumpPixels[i + 2] = bumpValue;
  }
  context.putImageData(image, 0, 0);
  bumpContext.putImageData(bump, 0, 0);

  context.globalAlpha = 0.09;
  context.strokeStyle = '#b38f70';
  context.lineWidth = 0.7;
  for (let i = 0; i < 86; i += 1) {
    const y = random(-20, size + 20);
    context.beginPath();
    context.moveTo(-24, y);
    context.bezierCurveTo(
      size * 0.32,
      y + random(-7, 7),
      size * 0.7,
      y + random(-7, 7),
      size + 24,
      y + random(-2, 2),
    );
    context.stroke();

    bumpContext.globalAlpha = 0.18;
    bumpContext.strokeStyle = '#8c8c8c';
    bumpContext.lineWidth = 0.55;
    bumpContext.beginPath();
    bumpContext.moveTo(-24, y + random(-1.5, 1.5));
    bumpContext.bezierCurveTo(
      size * 0.32,
      y + random(-6, 6),
      size * 0.7,
      y + random(-6, 6),
      size + 24,
      y + random(-2, 2),
    );
    bumpContext.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.25, 2.25);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.set(2.25, 2.25);
  bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTexture.magFilter = THREE.LinearFilter;
  bumpTexture.needsUpdate = true;

  return { map: texture, bumpMap: bumpTexture };
}

function v(x, y, z) {
  return [x, y, z];
}

function uvFor(point) {
  return [
    point[0] * 0.22 + point[2] * 0.16 + 0.5,
    point[1] * 0.42 - point[2] * 0.1 + 0.5,
  ];
}

function createFoldedGeometry(faces) {
  const positions = [];
  const colors = [];
  const uvs = [];

  const addTriangle = (a, b, c, shade) => {
    positions.push(...a, ...b, ...c);
    colors.push(shade, shade, shade, shade, shade, shade, shade, shade, shade);
    uvs.push(...uvFor(a), ...uvFor(b), ...uvFor(c));
  };

  // Faces remain split so the normals stay crisp, but each face has deliberate fold shading.
  faces.forEach(({ points, shade }) => {
    for (let i = 1; i < points.length - 1; i += 1) {
      addTriangle(points[0], points[i], points[i + 1], shade);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function createBodyGeometry() {
  const ridgeFront = v(0, 0.34, 0.48);
  const ridgeMid = v(0, 0.42, 0.03);
  const ridgeRear = v(0, 0.3, -0.5);
  const keelFront = v(0, -0.3, 0.42);
  const keelMid = v(0, -0.36, -0.08);
  const keelRear = v(0, -0.21, -0.56);
  const chest = v(0, 0.01, 0.88);
  const tailSocket = v(0, 0.02, -0.86);
  const leftShoulder = v(-0.5, 0.08, 0.2);
  const rightShoulder = v(0.5, 0.08, 0.2);
  const leftHip = v(-0.36, -0.04, -0.42);
  const rightHip = v(0.36, -0.04, -0.42);
  const leftBellyFront = v(-0.25, -0.18, 0.3);
  const rightBellyFront = v(0.25, -0.18, 0.3);
  const leftBellyRear = v(-0.23, -0.17, -0.32);
  const rightBellyRear = v(0.23, -0.17, -0.32);
  const leftRidgeCatch = v(-0.035, 0.36, 0.38);
  const rightRidgeCatch = v(0.035, 0.36, 0.38);

  return createFoldedGeometry([
    { points: [ridgeFront, leftRidgeCatch, chest], shade: 1.12 },
    { points: [ridgeFront, chest, rightRidgeCatch], shade: 1.02 },
    { points: [ridgeFront, leftShoulder, leftRidgeCatch], shade: 1.03 },
    { points: [ridgeFront, rightRidgeCatch, rightShoulder], shade: 0.92 },
    { points: [leftRidgeCatch, ridgeMid, chest], shade: 1.05 },
    { points: [rightRidgeCatch, chest, ridgeMid], shade: 0.95 },
    { points: [ridgeMid, leftShoulder, ridgeRear, leftHip], shade: 0.98 },
    { points: [ridgeMid, rightHip, ridgeRear, rightShoulder], shade: 0.8 },
    { points: [ridgeRear, tailSocket, leftHip], shade: 0.92 },
    { points: [ridgeRear, rightHip, tailSocket], shade: 0.76 },
    { points: [keelFront, chest, leftBellyFront], shade: 0.77 },
    { points: [keelFront, rightBellyFront, chest], shade: 0.84 },
    { points: [leftBellyFront, chest, leftShoulder], shade: 0.86 },
    { points: [rightBellyFront, rightShoulder, chest], shade: 0.78 },
    { points: [keelMid, leftBellyFront, leftBellyRear], shade: 0.72 },
    { points: [keelMid, rightBellyRear, rightBellyFront], shade: 0.66 },
    { points: [leftBellyRear, leftHip, tailSocket, keelRear], shade: 0.7 },
    { points: [rightBellyRear, keelRear, tailSocket, rightHip], shade: 0.62 },
    { points: [leftBellyFront, leftShoulder, leftHip, leftBellyRear], shade: 0.82 },
    { points: [rightBellyFront, rightBellyRear, rightHip, rightShoulder], shade: 0.73 },
    { points: [keelMid, keelFront, leftBellyFront], shade: 0.68 },
    { points: [keelMid, rightBellyFront, keelFront], shade: 0.61 },
    { points: [keelRear, keelMid, leftBellyRear], shade: 0.58 },
    { points: [keelRear, rightBellyRear, keelMid], shade: 0.54 },
  ]);
}

function createWingGeometry(side) {
  const rootTop = v(0, 0.1, 0.14);
  const rootBottom = v(0, -0.1, -0.08);
  const rootRear = v(side * 0.12, -0.18, -0.15);
  const shoulder = v(side * 0.45, 0.2, 0.13);
  const leadingInner = v(side * 0.92, 0.48, 0.09);
  const leadingOuter = v(side * 1.56, 0.36, 0.02);
  const tipUpper = v(side * 2.72, 0.15, -0.06);
  const tip = v(side * 3.02, 0.01, -0.12);
  const tipLower = v(side * 2.62, -0.16, -0.18);
  const creaseInner = v(side * 0.82, 0.07, 0.03);
  const creaseOuter = v(side * 1.74, -0.02, -0.08);
  const valleyInner = v(side * 0.75, -0.32, -0.14);
  const valleyOuter = v(side * 1.24, -0.5, -0.22);
  const trailingOuter = v(side * 2.1, -0.44, -0.29);
  const trailingCorner = v(side * 1.52, -0.56, -0.25);
  const creaseHighlightA = v(side * 1.0, 0.12, 0.045);
  const creaseHighlightB = v(side * 1.82, 0.02, -0.055);
  const creaseShadowA = v(side * 0.92, -0.04, -0.02);
  const creaseShadowB = v(side * 1.68, -0.13, -0.13);

  return createFoldedGeometry([
    { points: [rootTop, shoulder, creaseInner], shade: 1.12 },
    { points: [shoulder, leadingInner, creaseHighlightA, creaseInner], shade: 1.06 },
    { points: [leadingInner, leadingOuter, creaseHighlightB, creaseHighlightA], shade: 0.98 },
    { points: [leadingOuter, tipUpper, tip, creaseHighlightB], shade: 0.9 },
    { points: [creaseInner, creaseHighlightA, creaseShadowA], shade: 0.92 },
    { points: [creaseHighlightA, creaseHighlightB, creaseShadowB, creaseShadowA], shade: 1.03 },
    { points: [creaseHighlightB, tip, tipLower, creaseShadowB], shade: 0.78 },
    { points: [rootBottom, creaseInner, creaseShadowA, valleyInner], shade: 0.82 },
    { points: [valleyInner, creaseShadowA, creaseShadowB, valleyOuter], shade: 0.72 },
    { points: [valleyOuter, creaseShadowB, tipLower, trailingOuter], shade: 0.64 },
    { points: [rootRear, rootBottom, valleyInner], shade: 0.72 },
    { points: [rootRear, valleyInner, trailingCorner], shade: 0.62 },
    { points: [trailingCorner, valleyInner, valleyOuter], shade: 0.7 },
    { points: [trailingCorner, valleyOuter, trailingOuter], shade: 0.58 },
    { points: [trailingOuter, tipLower, tip], shade: 0.56 },
    { points: [rootTop, creaseInner, rootBottom], shade: 0.96 },
  ]);
}

function createNeckGeometry() {
  const baseLeft = v(-0.1, -0.05, 0);
  const baseRight = v(0.1, -0.05, 0);
  const baseTop = v(0, 0.13, 0.07);
  const throat = v(0, 0.15, 0.42);
  const neckRidge = v(0, 0.5, 0.58);
  const neckLeftFold = v(-0.08, 0.36, 0.48);
  const neckRightFold = v(0.08, 0.36, 0.48);
  const cheekLeft = v(-0.13, 0.58, 0.88);
  const cheekRight = v(0.13, 0.58, 0.88);
  const crown = v(0, 0.75, 0.88);
  const chin = v(0, 0.43, 0.95);
  const beakTop = v(0, 0.59, 1.34);
  const beakLow = v(0, 0.48, 1.27);

  return createFoldedGeometry([
    { points: [baseLeft, baseTop, neckLeftFold], shade: 1.06 },
    { points: [baseRight, neckRightFold, baseTop], shade: 0.82 },
    { points: [baseLeft, throat, baseRight], shade: 0.76 },
    { points: [baseLeft, neckLeftFold, throat], shade: 0.9 },
    { points: [baseRight, throat, neckRightFold], shade: 0.7 },
    { points: [neckLeftFold, neckRidge, throat], shade: 0.98 },
    { points: [neckRightFold, throat, neckRidge], shade: 0.78 },
    { points: [neckRidge, cheekLeft, crown], shade: 1.04 },
    { points: [neckRidge, crown, cheekRight], shade: 0.86 },
    { points: [neckRidge, cheekRight, chin], shade: 0.75 },
    { points: [neckRidge, chin, cheekLeft], shade: 0.9 },
    { points: [cheekLeft, beakTop, crown], shade: 0.96 },
    { points: [cheekRight, crown, beakTop], shade: 0.82 },
    { points: [cheekLeft, chin, beakLow], shade: 0.8 },
    { points: [cheekRight, beakLow, chin], shade: 0.66 },
    { points: [crown, beakTop, beakLow, chin], shade: 0.76 },
  ]);
}

function createTailGeometry() {
  const baseLeft = v(-0.2, -0.02, 0);
  const baseRight = v(0.2, -0.02, 0);
  const baseTop = v(0, 0.15, -0.04);
  const crease = v(0, 0.35, -0.6);
  const leftFold = v(-0.16, 0.27, -0.44);
  const rightFold = v(0.16, 0.24, -0.44);
  const topTip = v(0, 0.92, -1.47);
  const edge = v(0, 0.48, -1.06);
  const lowerTip = v(0, -0.12, -0.78);
  const leftLower = v(-0.12, 0.06, -0.62);
  const rightLower = v(0.12, 0.04, -0.62);

  return createFoldedGeometry([
    { points: [baseLeft, baseTop, leftFold], shade: 1.02 },
    { points: [baseTop, baseRight, rightFold], shade: 0.84 },
    { points: [leftFold, baseTop, crease], shade: 0.96 },
    { points: [rightFold, crease, baseTop], shade: 0.76 },
    { points: [baseLeft, leftFold, leftLower], shade: 0.78 },
    { points: [baseRight, rightLower, rightFold], shade: 0.66 },
    { points: [leftFold, crease, edge, leftLower], shade: 0.86 },
    { points: [rightFold, rightLower, edge, crease], shade: 0.68 },
    { points: [crease, topTip, edge], shade: 0.98 },
    { points: [edge, lowerTip, leftLower], shade: 0.72 },
    { points: [edge, rightLower, lowerTip], shade: 0.58 },
  ]);
}

function createCraneGeometries() {
  return {
    body: createBodyGeometry(),
    leftWing: createWingGeometry(-1),
    rightWing: createWingGeometry(1),
    neck: createNeckGeometry(),
    tail: createTailGeometry(),
  };
}

function assignExitPath(data, index) {
  const layer = data.layer[index];
  const hero = layer === HERO_LAYER;
  const mid = layer === MID_LAYER;
  const pick = Math.random();
  let side = EXIT_RIGHT;

  if (hero) {
    if (pick < 0.26) side = EXIT_FLYBY;
    else if (pick < 0.48) side = EXIT_LOWER_LEFT;
    else if (pick < 0.7) side = EXIT_LOWER_RIGHT;
    else if (pick < 0.82) side = EXIT_RIGHT;
    else if (pick < 0.94) side = EXIT_LEFT;
    else side = EXIT_TOP;
  } else if (mid) {
    if (pick < 0.2) side = EXIT_LEFT;
    else if (pick < 0.4) side = EXIT_RIGHT;
    else if (pick < 0.56) side = EXIT_TOP;
    else if (pick < 0.72) side = EXIT_BOTTOM;
    else if (pick < 0.86) side = EXIT_LOWER_LEFT;
    else side = EXIT_LOWER_RIGHT;
  } else {
    if (pick < 0.32) side = EXIT_LEFT;
    else if (pick < 0.64) side = EXIT_RIGHT;
    else if (pick < 0.82) side = EXIT_TOP;
    else side = EXIT_BOTTOM;
  }

  data.exitSide[index] = side;
  data.exitSeed[index] = random(0, TAU);
  data.exitAge[index] = 0;
  data.offscreenTime[index] = 0;

  switch (side) {
    case EXIT_LEFT:
      data.exitX[index] = random(-1.68, -1.38);
      data.exitY[index] = random(-0.82, -0.12);
      break;
    case EXIT_RIGHT:
      data.exitX[index] = random(1.38, 1.68);
      data.exitY[index] = random(-0.5, 0.78);
      break;
    case EXIT_TOP:
      data.exitX[index] = random(0.78, 1.28);
      data.exitY[index] = random(1.32, 1.62);
      break;
    case EXIT_BOTTOM:
      data.exitX[index] = random(-0.7, 0.7);
      data.exitY[index] = random(-1.52, -1.28);
      break;
    case EXIT_LOWER_LEFT:
      data.exitX[index] = random(-1.58, -1.26);
      data.exitY[index] = random(-1.42, -1.12);
      break;
    case EXIT_LOWER_RIGHT:
      data.exitX[index] = random(1.26, 1.58);
      data.exitY[index] = random(-1.42, -1.12);
      break;
    case EXIT_FLYBY:
    default:
      data.exitX[index] = random(0.18, 0.58) * (Math.random() < 0.5 ? -1 : 1);
      data.exitY[index] = random(-0.32, 0.18);
      break;
  }
}

function resetCrane(data, index, startSpread, reducedMotion) {
  const layer = data.layer[index];
  const hero = layer === HERO_LAYER;
  const mid = layer === MID_LAYER;
  const entryRadius = hero ? random(2.8, 7.4) : mid ? random(6.2, 25) : random(18, 46);
  const entryAngle = random(0, TAU);
  const speedScale = reducedMotion ? 0.45 : 1;
  const lane = random(-1, 1);

  if (startSpread) {
    data.z[index] = hero ? random(-78, -8) : mid ? random(-132, 8) : random(FAR_Z, -54);
  } else {
    data.z[index] = hero ? random(-96, -54) : mid ? random(-148, -102) : FAR_Z - random(0, 30);
  }

  data.x[index] = Math.cos(entryAngle) * entryRadius + random(-1.1, 1.1);
  data.y[index] =
    Math.sin(entryAngle) * entryRadius * (hero ? 0.34 : mid ? 0.43 : 0.5) +
    lane * (hero ? 1.2 : mid ? 2.8 : 6.5) +
    random(hero ? -1.2 : -2.1, hero ? 1.2 : 2.1);
  if (hero && data.y[index] > 0.4) {
    data.y[index] -= random(2.2, 4.6);
  }
  if (hero && data.x[index] < -1.4 && data.y[index] > -1.4) {
    data.x[index] += random(1.6, 3.4);
    data.y[index] -= random(1.4, 3.2);
  }
  if (!hero && data.x[index] < -2.2 && data.y[index] > 1.5) {
    data.y[index] -= random(1.8, 4.8);
  }
  data.vx[index] = random(hero ? -0.38 : -0.55, hero ? 0.38 : 0.55) * speedScale;
  data.vy[index] = random(hero ? -0.24 : -0.34, hero ? 0.24 : 0.34) * speedScale;
  data.vz[index] = random(hero ? 5.4 : mid ? 7.8 : 5.6, hero ? 8.4 : mid ? 13.2 : 10.2) * speedScale;
  data.ax[index] = 0;
  data.ay[index] = 0;
  data.az[index] = 0;
  data.cruise[index] =
    random(hero ? 5.8 : mid ? 8.2 : 6.2, hero ? 8.8 : mid ? 14.0 : 10.6) * speedScale;
  data.size[index] = hero ? random(0.82, 1.08) : mid ? random(0.42, 0.72) : random(0.2, 0.38);
  data.phase[index] = random(0, TAU);
  data.flapSpeed[index] =
    random(hero ? 0.92 : mid ? 1.12 : 0.82, hero ? 1.42 : mid ? 2.05 : 1.52) *
    (reducedMotion ? 0.58 : 1);
  data.roll[index] = random(-0.2, 0.2);
  data.homeAngle[index] = entryAngle + random(-0.7, 0.7);
  data.homeRadius[index] = hero ? random(4.2, 10.5) : mid ? random(8.5, 24) : random(22, 45);
  data.homeY[index] = hero ? random(-4.8, 1.3) : mid ? random(-6.2, 5.8) : random(-13, 11);
  data.lane[index] = lane;
  data.wakeCue[index] = 0;
  data.wakeRoll[index] = 0;
  data.exitState[index] = 0;
  data.exitSide[index] = EXIT_RIGHT;
  data.exitX[index] = 0;
  data.exitY[index] = 0;
  data.exitAge[index] = 0;
  data.exitSeed[index] = random(0, TAU);
  data.offscreenTime[index] = 0;
  data.noise[index] = random(0, 1000);
  data.bodyScale[index] = random(0.95, 1.1);
  data.wingScale[index] = hero ? random(0.96, 1.1) : random(0.88, 1.1);
  data.neckScale[index] = random(0.9, 1.16);
  data.tailScale[index] = random(0.92, 1.18);

  const colorSeed = CRANE_PALETTE[Math.floor(Math.random() * CRANE_PALETTE.length)];
  const color = new THREE.Color().setHSL(
    (colorSeed.h + random(-0.018, 0.018) + 1) % 1,
    clamp01(colorSeed.s + random(-0.045, 0.04) + (hero ? 0.03 : mid ? -0.02 : -0.14)),
    clamp01(colorSeed.l + random(-0.035, 0.045) + (hero ? 0.04 : mid ? -0.01 : -0.13)),
  );
  data.color[index * 3] = color.r;
  data.color[index * 3 + 1] = color.g;
  data.color[index * 3 + 2] = color.b;
}

function createCraneData(count, reducedMotion) {
  const data = {
    layer: new Uint8Array(count),
    hero: new Uint8Array(count),
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    vz: new Float32Array(count),
    ax: new Float32Array(count),
    ay: new Float32Array(count),
    az: new Float32Array(count),
    cruise: new Float32Array(count),
    size: new Float32Array(count),
    phase: new Float32Array(count),
    flapSpeed: new Float32Array(count),
    roll: new Float32Array(count),
    homeAngle: new Float32Array(count),
    homeRadius: new Float32Array(count),
    homeY: new Float32Array(count),
    lane: new Float32Array(count),
    wakeCue: new Float32Array(count),
    wakeRoll: new Float32Array(count),
    exitState: new Uint8Array(count),
    exitSide: new Int8Array(count),
    exitX: new Float32Array(count),
    exitY: new Float32Array(count),
    exitAge: new Float32Array(count),
    exitSeed: new Float32Array(count),
    offscreenTime: new Float32Array(count),
    noise: new Float32Array(count),
    bodyScale: new Float32Array(count),
    wingScale: new Float32Array(count),
    neckScale: new Float32Array(count),
    tailScale: new Float32Array(count),
    color: new Float32Array(count * 3),
  };

  const heroCount = Math.min(12, Math.max(6, Math.floor(count * 0.055)));
  const midEnd = heroCount + Math.floor((count - heroCount) * 0.58);
  for (let i = 0; i < count; i += 1) {
    data.layer[i] = i < heroCount ? HERO_LAYER : i < midEnd ? MID_LAYER : BACK_LAYER;
    data.hero[i] = data.layer[i] === HERO_LAYER ? 1 : 0;
    resetCrane(data, i, true, reducedMotion);
  }

  return data;
}

function setCraneColor(meshes, data, color, index) {
  color.setRGB(data.color[index * 3], data.color[index * 3 + 1], data.color[index * 3 + 2]);
  for (let i = 0; i < meshes.length; i += 1) {
    meshes[i].setColorAt(index, color);
  }
}

function CraneField({ count, reducedMotion, interactionRef }) {
  const bodyRef = useRef();
  const leftWingRef = useRef();
  const rightWingRef = useRef();
  const neckRef = useRef();
  const tailRef = useRef();
  const meshesRef = useRef([]);
  const baseObject = useMemo(() => new THREE.Object3D(), []);
  const partObject = useMemo(() => new THREE.Object3D(), []);
  const finalMatrix = useMemo(() => new THREE.Matrix4(), []);
  const geometries = useMemo(() => createCraneGeometries(), []);
  const paperTextures = useMemo(() => createPaperTextures(), []);
  const data = useMemo(() => createCraneData(count, reducedMotion), [count, reducedMotion]);
  const color = useMemo(() => new THREE.Color(), []);
  const paperMaterialProps = useMemo(
    () => ({
      map: paperTextures?.map,
      bumpMap: paperTextures?.bumpMap,
      bumpScale: 0.012,
      vertexColors: true,
      flatShading: false,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      emissive: '#0d0708',
      emissiveIntensity: 0.032,
      envMapIntensity: 0.18,
      dithering: true,
    }),
    [paperTextures],
  );

  useLayoutEffect(() => {
    const meshes = [
      bodyRef.current,
      leftWingRef.current,
      rightWingRef.current,
      neckRef.current,
      tailRef.current,
    ].filter(Boolean);

    if (meshes.length !== 5) return;

    meshesRef.current = meshes;
    for (let i = 0; i < meshes.length; i += 1) {
      meshes[i].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    for (let i = 0; i < count; i += 1) {
      setCraneColor(meshes, data, color, i);
    }

    for (let i = 0; i < meshes.length; i += 1) {
      meshes[i].instanceColor.needsUpdate = true;
    }
  }, [color, count, data]);

  const writePart = useCallback(
    (mesh, index, x, y, z, rx, ry, rz, sx = 1, sy = 1, sz = 1) => {
      partObject.position.set(x, y, z);
      partObject.rotation.set(rx, ry, rz);
      partObject.scale.set(sx, sy, sz);
      partObject.updateMatrix();
      finalMatrix.multiplyMatrices(baseObject.matrix, partObject.matrix);
      mesh.setMatrixAt(index, finalMatrix);
    },
    [baseObject, finalMatrix, partObject],
  );

  useFrame((state, delta) => {
    const meshes = meshesRef.current;
    if (meshes.length !== 5) return;

    const elapsed = state.clock.getElapsedTime();
    const now = performance.now() / 1000;
    const dt = Math.min(delta, reducedMotion ? 0.032 : 0.038);
    const interaction = interactionRef.current;
    const pointerActive = interaction.active && now - interaction.lastMove < 3.2;
    const burstAge = now - interaction.burstTime;
    const aspect = state.size.width / state.size.height;
    const compactTitle = state.size.width < 720;
    const fov = THREE.MathUtils.degToRad(state.camera.fov);
    const baseNeighborRadiusSq = reducedMotion ? 40 : 56;
    const baseSeparationRadiusSq = reducedMotion ? 5.8 : 8.4;
    const simScale = reducedMotion ? 0.45 : 1;
    let colorsChanged = false;

    for (let i = 0; i < count; i += 1) {
      const xi = data.x[i];
      const yi = data.y[i];
      const zi = data.z[i];
      const depthT = clamp01((CAMERA_Z - zi) / DEPTH_RANGE);
      const layer = data.layer[i];
      const hero = layer === HERO_LAYER;
      const mid = layer === MID_LAYER;
      const phase = data.phase[i];
      const noiseSeed = data.noise[i];
      const distanceToCamera = Math.max(0.01, state.camera.position.z - zi);
      const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
      const viewWidth = viewHeight * aspect;
      let exitState = data.exitState[i];
      if (exitState === 0 && zi >= EXIT_START_Z) {
        assignExitPath(data, i);
        exitState = 1;
        data.exitState[i] = exitState;
      }
      if (exitState === 1 && zi >= EXIT_COMMIT_Z) {
        exitState = 2;
        data.exitState[i] = exitState;
      }
      if (exitState > 0) {
        data.exitAge[i] += dt;
      }
      const exitStartT = exitState > 0 ? smoothstep(EXIT_START_Z, EXIT_COMMIT_Z, zi) : 0;
      const exitCommitT = exitState === 2 ? smoothstep(EXIT_COMMIT_Z, CAMERA_Z - 2, zi) : 0;

      let ax = 0;
      let ay = 0;
      let az = (data.cruise[i] - data.vz[i]) * 0.5;
      let wakeCue = 0;
      let sepX = 0;
      let sepY = 0;
      let sepZ = 0;
      let avgX = 0;
      let avgY = 0;
      let avgVX = 0;
      let avgVY = 0;
      let avgVZ = 0;
      let neighborCount = 0;

      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;

        const dx = xi - data.x[j];
        const dy = yi - data.y[j];
        const neighborHero = data.layer[j] === HERO_LAYER;
        const dz = (zi - data.z[j]) * (hero || neighborHero ? 0.42 : 0.28);
        if (Math.abs(dz) > (hero || neighborHero ? 11.5 : 8.5)) continue;

        const d2 = dx * dx + dy * dy + dz * dz + 0.0001;
        const neighborRadiusSq =
          baseNeighborRadiusSq + (hero || neighborHero ? 20 : layer === BACK_LAYER ? -12 : 0);
        if (d2 > neighborRadiusSq) continue;

        const separationRadiusSq =
          baseSeparationRadiusSq + (hero || neighborHero ? 6.2 : layer === BACK_LAYER ? -2 : 0);
        if (d2 < separationRadiusSq) {
          const inv = 1 / d2;
          sepX += dx * inv;
          sepY += dy * inv;
          sepZ += dz * inv * 0.2;
        }

        avgX += data.x[j];
        avgY += data.y[j];
        avgVX += data.vx[j];
        avgVY += data.vy[j];
        avgVZ += data.vz[j];
        neighborCount += 1;
      }

      if (neighborCount > 0) {
        const invCount = 1 / neighborCount;
        const exitFlockBlend = 1 - exitCommitT * 0.78;
        const sepPower = (hero ? 4.8 : layer === BACK_LAYER ? 2.4 : 3.3) * exitFlockBlend;
        const alignPower = (hero ? 0.11 : layer === BACK_LAYER ? 0.09 : 0.15) * exitFlockBlend;
        const cohesionPower =
          (hero ? 0.01 : layer === BACK_LAYER ? 0.008 : 0.016) * (1 - exitCommitT * 0.92);
        ax += sepX * sepPower * simScale;
        ay += sepY * sepPower * simScale;
        az += sepZ * (hero ? 0.45 : 0.7) * simScale;
        ax += (avgVX * invCount - data.vx[i]) * alignPower * simScale;
        ay += (avgVY * invCount - data.vy[i]) * alignPower * 0.9 * simScale;
        az += (avgVZ * invCount - data.vz[i]) * 0.1 * simScale;
        ax += (avgX * invCount - xi) * cohesionPower * simScale;
        ay += (avgY * invCount - yi) * cohesionPower * simScale;
      }

      const flowAngle =
        data.homeAngle[i] +
        Math.sin(elapsed * (hero ? 0.036 : 0.052) + noiseSeed) * (hero ? 0.34 : 0.54) +
        Math.sin(elapsed * 0.017 + phase) * (hero ? 0.16 : 0.26);
      const ribbon = data.lane[i];
      const flowRadius =
        data.homeRadius[i] *
        (hero ? 0.78 + (1 - depthT) * 0.18 : mid ? 0.64 + depthT * 0.62 : 0.78 + depthT * 0.72);
      const targetX =
        Math.cos(flowAngle) * flowRadius +
        Math.sin(elapsed * (hero ? 0.07 : 0.09) + phase) * (hero ? 1.1 : mid ? 2.2 : 4.8) +
        ribbon * (hero ? 0.45 : mid ? 1.4 : 4.2);
      const targetY =
        Math.sin(flowAngle * (hero ? 0.96 : 1.17) + ribbon * 0.46) *
          flowRadius *
          (hero ? 0.25 : mid ? 0.36 : 0.44) +
        data.homeY[i] * (hero ? 0.82 : mid ? 0.92 : 1.05) +
        Math.cos(elapsed * (hero ? 0.055 : 0.075) + noiseSeed) * (hero ? 0.7 : mid ? 1.25 : 2.6);

      ax += (targetX - xi) * (hero ? 0.04 : mid ? 0.028 : 0.018) * simScale;
      ay += (targetY - yi) * (hero ? 0.044 : mid ? 0.032 : 0.02) * simScale;

      const boundsX = hero ? 8 + depthT * 15 : mid ? 10 + depthT * 28 : 24 + depthT * 38;
      const boundsY = hero ? 4.8 + depthT * 9 : mid ? 6 + depthT * 18 : 14 + depthT * 24;
      const boundsForce = 1 - exitCommitT * 0.95;
      if (boundsForce > 0.01) {
        if (xi > boundsX) ax -= (xi - boundsX) * 0.14 * boundsForce;
        if (xi < -boundsX) ax += (-boundsX - xi) * 0.14 * boundsForce;
        if (yi > boundsY) ay -= (yi - boundsY) * 0.14 * boundsForce;
        if (yi < -boundsY) ay += (-boundsY - yi) * 0.14 * boundsForce;
      }

      const titleFrame = smoothstep(-122, EXIT_START_Z, zi) * (1 - exitCommitT);
      if (titleFrame > 0) {
        const normalizedX = (xi - state.camera.position.x) / (viewWidth * 0.5);
        const normalizedY = (yi - state.camera.position.y) / (viewHeight * 0.5);
        const titleRight = compactTitle ? 0.48 : -0.08;
        const titleBottom = compactTitle ? 0.36 : 0.26;
        const titleZone =
          clamp01((titleRight - normalizedX) / (compactTitle ? 1.38 : 0.82)) *
          clamp01((normalizedY - titleBottom) / (compactTitle ? 0.56 : 0.66)) *
          titleFrame;
        ax += titleZone * (hero ? 2.2 : compactTitle ? 1.25 : 0.75) * simScale;
        ay -= titleZone * (hero ? 2.8 : compactTitle ? 1.7 : 1.05) * simScale;
      }

      const radial = Math.hypot(xi, yi);
      const clearCenterRadius = hero ? 2.4 + (1 - depthT) * 2.2 : 2.2 + (1 - depthT) * 3.4;
      if (radial < clearCenterRadius && radial > 0.001 && zi > -108) {
        const centerPush = (clearCenterRadius - radial) * (hero ? 0.22 : 0.18);
        ax += (xi / radial) * centerPush;
        ay += (yi / radial) * centerPush;
      }

      const gustA = Math.sin(xi * 0.075 + zi * 0.021 + elapsed * 0.55 + noiseSeed);
      const gustB = Math.cos(yi * 0.09 - zi * 0.017 + elapsed * 0.42 + phase);
      const gustC = Math.sin((xi + yi) * 0.045 + elapsed * 0.27 + noiseSeed * 0.2);
      const gustPower = hero ? 0.18 : mid ? 0.28 : 0.36;
      ax += gustA * gustPower * simScale;
      ay += gustB * gustPower * 0.78 * simScale;
      az += gustC * (hero ? 0.08 : 0.14) * simScale;

      if (exitState > 0) {
        const targetNormX = data.exitX[i];
        const targetNormY = data.exitY[i];
        const exitTargetX = state.camera.position.x + targetNormX * viewWidth * 0.5;
        const exitTargetY = state.camera.position.y + targetNormY * viewHeight * 0.5;
        const routeX = exitTargetX - xi;
        const routeY = exitTargetY - yi;
        const routeStrength =
          (hero ? 0.072 : mid ? 0.058 : 0.042) *
          (0.55 + exitStartT * 1.2 + exitCommitT * 2.4) *
          simScale;
        const exitIsolation = 1 - exitCommitT * (hero ? 0.62 : 0.76);

        ax = ax * exitIsolation + routeX * routeStrength;
        ay = ay * exitIsolation + routeY * routeStrength;
        az +=
          (data.cruise[i] * (hero ? 0.42 : mid ? 0.34 : 0.26) + 1.2) *
          (0.35 + exitCommitT) *
          simScale;
        wakeCue += clamp(targetNormX * (0.32 + exitCommitT * 0.48), -1.1, 1.1);
      }

      if (pointerActive) {
        const cursorX = state.camera.position.x + interaction.x * viewWidth * 0.5;
        const cursorY = state.camera.position.y + interaction.y * viewHeight * 0.5;
        const dx = xi - cursorX;
        const dy = yi - cursorY;
        const dist = Math.hypot(dx, dy) + 0.001;
        const invDist = 1 / dist;
        const pointerSpeedRaw = Math.hypot(interaction.vx, interaction.vy);
        const pointerSpeed = Math.min(3.8, pointerSpeedRaw);
        const dirX =
          pointerSpeedRaw > 0.018 ? interaction.vx / pointerSpeedRaw : Math.sin(elapsed * 0.23);
        const dirY =
          pointerSpeedRaw > 0.018 ? interaction.vy / pointerSpeedRaw : Math.cos(elapsed * 0.19);
        const along = dx * dirX + dy * dirY;
        const cross = dx * -dirY + dy * dirX;
        const wakeLength = Math.max(3.8, distanceToCamera * (hero ? 0.12 : 0.085)) + pointerSpeed * 2.4;
        const wakeWidth = Math.max(1.6, distanceToCamera * (hero ? 0.052 : 0.04));
        const wakeShape =
          Math.exp(-(cross * cross) / (wakeWidth * wakeWidth)) *
          smoothstep(wakeLength, 0, Math.abs(along)) *
          clamp01((-along + wakeLength * 0.28) / wakeLength);
        const localRadius = Math.max(2.1, distanceToCamera * 0.052);
        const localEddy = smoothstep(localRadius, 0, dist) * 0.45;
        const influence = Math.max(wakeShape, localEddy) * (hero ? 1.1 : mid ? 1 : 0.78);
        const swirl = clamp(cross / wakeWidth, -1, 1);

        ax +=
          (dirX * 1.7 - dirY * swirl * 0.9 + dx * invDist * 0.45) *
          influence *
          simScale;
        ay +=
          (dirY * 1.7 + dirX * swirl * 0.9 + dy * invDist * 0.45) *
          influence *
          simScale;
        az += influence * (hero ? 0.34 : 0.5) * simScale;
        wakeCue += clamp(-swirl * influence * 1.45 + localEddy * dirX * 0.4, -1.4, 1.4);
      }

      if (burstAge > 0 && burstAge < 2.7) {
        const cursorX = state.camera.position.x + interaction.burstX * viewWidth * 0.5;
        const cursorY = state.camera.position.y + interaction.burstY * viewHeight * 0.5;
        const dx = xi - cursorX;
        const dy = yi - cursorY;
        const dist = Math.hypot(dx, dy) + 0.001;
        const delayedAge = burstAge - Math.abs(zi - 6) * 0.0085 - depthT * 0.16;

        if (delayedAge > 0 && delayedAge < 1.9) {
          const waveRadius = delayedAge * (hero ? 13.5 : mid ? 16.8 : 19.5);
          const ringWidth = hero ? 10 : mid ? 16 : 26;
          const ring = Math.exp(-((dist - waveRadius) ** 2) / ringWidth);
          const force =
            ring *
            smoothstep(1.9, 0.08, delayedAge) *
            (hero ? 4.4 : mid ? 5.4 : 4.0) *
            simScale;
          const invDist = 1 / dist;
          const twist = 0.22 + depthT * 0.2;
          ax += (dx * invDist - dy * invDist * twist) * force;
          ay += (dy * invDist + dx * invDist * twist) * force;
          az += force * (hero ? 0.08 : 0.12);
          wakeCue += clamp((dx * invDist * 0.25 - dy * invDist) * ring * 1.2, -1.2, 1.2);
        }
      }

      data.wakeCue[i] = wakeCue;
      data.ax[i] = ax;
      data.ay[i] = ay;
      data.az[i] = az;
    }

    for (let i = 0; i < count; i += 1) {
      const layer = data.layer[i];
      const hero = layer === HERO_LAYER;
      const mid = layer === MID_LAYER;
      data.vx[i] += data.ax[i] * dt;
      data.vy[i] += data.ay[i] * dt;
      data.vz[i] += data.az[i] * dt;

      const capExitT =
        data.exitState[i] > 0 ? smoothstep(EXIT_START_Z, CAMERA_Z - 1, data.z[i]) : 0;
      const maxSpeed =
        (hero ? 11.4 : mid ? 17.2 : 12.4) *
        (1 + capExitT * (reducedMotion ? 0.12 : hero ? 0.42 : 0.28));
      const speed = Math.hypot(data.vx[i], data.vy[i], data.vz[i]);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        data.vx[i] *= scale;
        data.vy[i] *= scale;
        data.vz[i] *= scale;
      }
      if (data.vz[i] < data.cruise[i] * 0.52) {
        data.vz[i] += (data.cruise[i] * 0.52 - data.vz[i]) * 0.18;
      }

      data.x[i] += data.vx[i] * dt;
      data.y[i] += data.vy[i] * dt;
      data.z[i] += data.vz[i] * dt;

      let shouldReset = false;
      if (data.exitState[i] > 0) {
        const exitDistance = state.camera.position.z - data.z[i];
        if (exitDistance > 0.08) {
          const exitViewHeight = 2 * Math.tan(fov / 2) * exitDistance;
          const exitViewWidth = exitViewHeight * aspect;
          const screenX = (data.x[i] - state.camera.position.x) / (exitViewWidth * 0.5);
          const screenY = (data.y[i] - state.camera.position.y) / (exitViewHeight * 0.5);
          const offscreenMargin =
            data.exitSide[i] === EXIT_FLYBY ? 1.72 : hero ? 1.26 : mid ? 1.38 : 1.5;
          const offscreen =
            Math.abs(screenX) > offscreenMargin || Math.abs(screenY) > offscreenMargin;

          data.offscreenTime[i] = offscreen
            ? data.offscreenTime[i] + dt
            : Math.max(0, data.offscreenTime[i] - dt * 0.65);
          shouldReset =
            data.offscreenTime[i] > (reducedMotion ? 0.16 : EXIT_OFFSCREEN_TIME) ||
            data.z[i] > EXIT_RESET_Z;
        } else {
          shouldReset = true;
        }
      } else if (data.z[i] > EXIT_RESET_Z) {
        shouldReset = true;
      }

      if (shouldReset) {
        resetCrane(data, i, false, reducedMotion);
        setCraneColor(meshes, data, color, i);
        colorsChanged = true;
      }

      const speedAfter = Math.hypot(data.vx[i], data.vy[i], data.vz[i]);
      const yaw = Math.atan2(data.vx[i], data.vz[i]);
      const pitch = -Math.atan2(data.vy[i], Math.max(0.001, Math.hypot(data.vx[i], data.vz[i])));
      const exitT = capExitT;
      const exitCommitVisual =
        data.exitState[i] === 2 ? smoothstep(EXIT_COMMIT_Z, CAMERA_Z - 2, data.z[i]) : 0;
      const exitBankTarget =
        data.exitState[i] > 0
          ? clamp(data.exitX[i] * (hero ? 0.58 : 0.44) - data.exitY[i] * 0.08, -0.82, 0.82) *
            exitT
          : 0;
      const wakeEase = 1 - Math.exp(-dt * (Math.abs(data.wakeCue[i]) > 0.001 ? 8.2 : 2.4));
      data.wakeRoll[i] += (data.wakeCue[i] - data.wakeRoll[i]) * wakeEase;
      const bankTarget = clamp(
        -data.vx[i] * (hero ? 0.086 : 0.075) -
          data.ax[i] * 0.014 +
          data.wakeRoll[i] * 0.34 +
          exitBankTarget,
        hero ? -0.92 : -0.74,
        hero ? 0.92 : 0.74,
      );
      data.roll[i] += (bankTarget - data.roll[i]) * (1 - Math.exp(-dt * (hero ? 4.4 : 3.6)));

      const phase = data.phase[i];
      const turbulence = Math.sin(elapsed * 0.62 + data.noise[i] + data.x[i] * 0.035) * 0.16;
      const flapRate =
        data.flapSpeed[i] *
        (0.7 + speedAfter * (hero ? 0.05 : 0.038) + Math.abs(data.roll[i]) * 0.16) *
        (1 - exitCommitVisual * (hero ? 0.16 : 0.07));
      const wingCycle = elapsed * flapRate * (1 / TAU) + phase * (1 / TAU) + turbulence * 0.035;
      const wingPose = wingbeatCurve(wingCycle);
      const bodyPose = wingbeatCurve(wingCycle - (hero ? 0.055 : 0.04));
      const neckPose = wingbeatCurve(wingCycle - (hero ? 0.1 : 0.075));
      const tailPose = wingbeatCurve(wingCycle - (hero ? 0.13 : 0.1));
      const slowSway = Math.sin(elapsed * 0.31 + phase) * (hero ? 0.024 : 0.018);
      const wingAmp =
        (reducedMotion ? 0.08 : hero ? 0.45 : mid ? 0.38 : 0.26) *
        (0.9 +
          speedAfter * 0.018 +
          Math.abs(data.wakeRoll[i]) * 0.12 +
          exitCommitVisual * (hero ? 0.22 : 0.12));
      const wingLift = (reducedMotion ? 0.08 : hero ? 0.15 : 0.13) + wingPose * wingAmp;
      const bankAsymmetry = data.roll[i] * (hero ? 0.3 : 0.24) + data.wakeRoll[i] * 0.08;
      const leftLift = wingLift - bankAsymmetry;
      const rightLift = wingLift + bankAsymmetry;
      const bodyFloat = -bodyPose * (hero ? 0.038 : 0.026) + slowSway * 0.4;
      const scale = data.size[i] * (1 - bodyPose * (hero ? 0.018 : 0.012));
      const exitPitch =
        data.exitState[i] > 0
          ? exitCommitVisual * (-0.08 + clamp(data.exitY[i], -1, 1) * 0.045) * (hero ? 1.2 : 0.8)
          : 0;
      let renderX = data.x[i];
      let renderY = data.y[i];

      baseObject.position.set(renderX, renderY, data.z[i]);
      baseObject.rotation.set(
        pitch + slowSway - wingLift * 0.03 - bodyPose * 0.018 + exitPitch,
        yaw,
        data.roll[i] + wingPose * (hero ? 0.025 : 0.018) + exitCommitVisual * data.exitX[i] * 0.05,
      );
      baseObject.scale.setScalar(scale);
      baseObject.updateMatrix();

      writePart(meshes[0], i, 0, bodyFloat, 0, 0, 0, 0, data.bodyScale[i], 1.04, 1.04);
      writePart(
        meshes[1],
        i,
        -0.35,
        0.055 + bodyFloat,
        0.04,
        -0.04 - bodyPose * 0.018,
        -0.035 - data.roll[i] * 0.035,
        -leftLift,
        data.wingScale[i],
        1,
        1,
      );
      writePart(
        meshes[2],
        i,
        0.35,
        0.055 + bodyFloat,
        0.04,
        -0.04 - bodyPose * 0.018,
        0.035 - data.roll[i] * 0.035,
        rightLift,
        data.wingScale[i],
        1,
        1,
      );
      writePart(
        meshes[3],
        i,
        0,
        0.035 + bodyFloat,
        0.58,
        0.09 + neckPose * 0.04 - pitch * 0.06,
        data.roll[i] * -0.08 + data.wakeRoll[i] * 0.035,
        0,
        1,
        data.neckScale[i],
        data.neckScale[i],
      );
      writePart(
        meshes[4],
        i,
        0,
        0.02 + bodyFloat,
        -0.58,
        -0.075 - tailPose * 0.052 + pitch * 0.05,
        data.roll[i] * 0.06 - data.wakeRoll[i] * 0.03,
        0,
        1,
        data.tailScale[i],
        data.tailScale[i],
      );
    }

    for (let i = 0; i < meshes.length; i += 1) {
      meshes[i].instanceMatrix.needsUpdate = true;
      if (colorsChanged && meshes[i].instanceColor) {
        meshes[i].instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[geometries.body, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={leftWingRef}
        args={[geometries.leftWing, undefined, count]}
        frustumCulled={false}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={rightWingRef}
        args={[geometries.rightWing, undefined, count]}
        frustumCulled={false}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh ref={neckRef} args={[geometries.neck, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh ref={tailRef} args={[geometries.tail, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
    </>
  );
}

function StarField({ count, reducedMotion }) {
  const pointsRef = useRef();
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const radius = Math.pow(Math.random(), 0.6);
      positions[i * 3] = random(-68, 68) * radius;
      positions[i * 3 + 1] = random(-42, 42) * radius;
      positions[i * 3 + 2] = random(FAR_Z - 8, 12);

      color.setHSL(random(0.06, 0.62), random(0.14, 0.34), random(0.62, 0.88));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current || reducedMotion) return;
    pointsRef.current.rotation.z += delta * 0.004;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.055}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.56}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CameraRig({ interactionRef, reducedMotion }) {
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const targetPosition = useMemo(() => new THREE.Vector3(0, 0, CAMERA_Z), []);

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000;
    const elapsed = clock.getElapsedTime();
    const interaction = interactionRef.current;
    const pointerActive = interaction.active && now - interaction.lastMove < 3.2;
    const ease = 1 - Math.exp(-delta * 2.8);

    const autoX = reducedMotion ? 0 : Math.sin(elapsed * 0.075) * 0.26;
    const autoY = reducedMotion ? 0 : Math.cos(elapsed * 0.064) * 0.16;
    targetPosition.set(
      pointerActive ? interaction.x * 1.1 : autoX,
      pointerActive ? interaction.y * 0.7 : autoY,
      CAMERA_Z,
    );

    camera.position.lerp(targetPosition, ease);
    lookAt.set(camera.position.x * 0.12, camera.position.y * 0.1, -78);
    camera.lookAt(lookAt);
  });

  return null;
}

function BurstEcho({ interactionRef }) {
  const ringRef = useRef();
  const materialRef = useRef();
  const { camera, size } = useThree();

  useFrame(() => {
    if (!ringRef.current || !materialRef.current) return;

    const interaction = interactionRef.current;
    const age = performance.now() / 1000 - interaction.burstTime;
    if (age < 0 || age > 1.35) {
      ringRef.current.visible = false;
      return;
    }

    const z = 8;
    const distanceToCamera = camera.position.z - z;
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distanceToCamera;
    const viewWidth = viewHeight * (size.width / size.height);

    ringRef.current.visible = true;
    ringRef.current.position.set(
      camera.position.x + interaction.burstX * viewWidth * 0.5,
      camera.position.y + interaction.burstY * viewHeight * 0.5,
      z,
    );
    ringRef.current.scale.setScalar(1 + age * 13.5);
    materialRef.current.opacity = (1 - age / 1.35) * 0.3;
  });

  return (
    <mesh ref={ringRef} visible={false}>
      <ringGeometry args={[0.18, 0.23, 96]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#fff2cc"
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Scene({ tier, interactionRef }) {
  return (
    <>
      <color attach="background" args={['#050306']} />
      <fog attach="fog" args={['#050306', 28, 158]} />

      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#fff2df', '#130b12', 1.45]} />
      <directionalLight position={[5.5, 9, 14]} intensity={2.65} color="#fff1d8" />
      <directionalLight position={[-7, 2, -12]} intensity={0.72} color="#b5fff0" />
      <pointLight position={[-9, -3, 12]} intensity={2.0} color="#7cefd9" distance={48} />
      <pointLight position={[10, 7, -24]} intensity={1.25} color="#ffb7aa" distance={76} />

      <CameraRig interactionRef={interactionRef} reducedMotion={tier.reducedMotion} />
      <StarField count={tier.particles} reducedMotion={tier.reducedMotion} />
      <CraneField
        count={tier.cranes}
        reducedMotion={tier.reducedMotion}
        interactionRef={interactionRef}
      />
      <BurstEcho interactionRef={interactionRef} />
    </>
  );
}

export default function App() {
  const tier = usePerformanceTier();
  const interactionRef = useRef({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lastMove: -100,
    burstX: 0,
    burstY: 0,
    burstTime: -100,
  });

  const updateInteraction = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const now = performance.now() / 1000;
    const interaction = interactionRef.current;
    const hasRecentMove = interaction.active && now - interaction.lastMove < 0.18;
    if (hasRecentMove) {
      const dt = clamp(now - interaction.lastMove, 0.016, 0.12);
      interaction.vx += ((x - interaction.x) / dt - interaction.vx) * 0.36;
      interaction.vy += ((y - interaction.y) / dt - interaction.vy) * 0.36;
    } else {
      interaction.vx = 0;
      interaction.vy = 0;
    }
    interaction.active = true;
    interaction.x = x;
    interaction.y = y;
    interaction.lastMove = now;
  }, []);

  const triggerBurst = useCallback(
    (event) => {
      updateInteraction(event);
      interactionRef.current.burstX = interactionRef.current.x;
      interactionRef.current.burstY = interactionRef.current.y;
      interactionRef.current.burstTime = performance.now() / 1000;
    },
    [updateInteraction],
  );

  return (
    <main className="experience" aria-label="A Thousand Paper Cranes immersive 3D artwork">
      <Canvas
        className="flight-canvas"
        dpr={[1, tier.reducedMotion ? 1.12 : 1.55]}
        camera={{ fov: 57, position: [0, 0, CAMERA_Z], near: 0.1, far: 190 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor('#050306', 1);
        }}
        onPointerMove={updateInteraction}
        onPointerDown={triggerBurst}
        onPointerLeave={() => {
          interactionRef.current.active = false;
          interactionRef.current.vx = 0;
          interactionRef.current.vy = 0;
        }}
      >
        <Scene tier={tier} interactionRef={interactionRef} />
      </Canvas>

      <section className="title-layer" aria-label="Experience title">
        <p className="kicker">Interactive WebGL Artwork</p>
        <h1>A Thousand Paper Cranes</h1>
        <p className="instruction">Move your cursor to guide the flock. Tap to send a ripple.</p>
      </section>
      <div className="vignette" aria-hidden="true" />
    </main>
  );
}
