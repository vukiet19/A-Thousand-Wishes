import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const CAMERA_Z = 28;
const FAR_Z = -168;
const RESPAWN_Z = 20;
const DEPTH_RANGE = CAMERA_Z - FAR_Z;
const TAU = Math.PI * 2;

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
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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

function createPaperTexture() {
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  context.fillStyle = '#f8f0e3';
  context.fillRect(0, 0, size, size);

  const image = context.getImageData(0, 0, size, size);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const grain =
      (Math.random() - 0.5) * 18 +
      Math.sin(x * 0.17 + y * 0.035) * 4 +
      Math.sin(y * 0.11) * 2;

    pixels[i] = clamp(pixels[i] + grain, 0, 255);
    pixels[i + 1] = clamp(pixels[i + 1] + grain * 0.9, 0, 255);
    pixels[i + 2] = clamp(pixels[i + 2] + grain * 0.72, 0, 255);
  }
  context.putImageData(image, 0, 0);

  context.globalAlpha = 0.12;
  context.strokeStyle = '#b89678';
  context.lineWidth = 0.7;
  for (let i = 0; i < 70; i += 1) {
    const y = random(-20, size + 20);
    context.beginPath();
    context.moveTo(-20, y);
    context.bezierCurveTo(size * 0.32, y + random(-8, 8), size * 0.7, y + random(-8, 8), size + 20, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.25, 2.25);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
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
  const ridge = v(0, 0.36, 0.03);
  const keel = v(0, -0.3, -0.04);
  const chest = v(0, 0.02, 0.78);
  const tailSocket = v(0, 0.03, -0.74);
  const leftShoulder = v(-0.43, 0.05, 0.08);
  const rightShoulder = v(0.43, 0.05, 0.08);
  const leftHip = v(-0.34, -0.05, -0.34);
  const rightHip = v(0.34, -0.05, -0.34);

  return createFoldedGeometry([
    { points: [ridge, leftShoulder, chest], shade: 1.08 },
    { points: [ridge, chest, rightShoulder], shade: 0.98 },
    { points: [ridge, rightShoulder, rightHip, tailSocket], shade: 0.84 },
    { points: [ridge, tailSocket, leftHip, leftShoulder], shade: 0.95 },
    { points: [keel, chest, leftShoulder], shade: 0.76 },
    { points: [keel, rightShoulder, chest], shade: 0.83 },
    { points: [keel, leftHip, tailSocket], shade: 0.72 },
    { points: [keel, tailSocket, rightHip], shade: 0.66 },
    { points: [keel, leftShoulder, leftHip], shade: 0.8 },
    { points: [keel, rightHip, rightShoulder], shade: 0.74 },
  ]);
}

function createWingGeometry(side) {
  const rootTop = v(0, 0.08, 0.12);
  const rootBottom = v(0, -0.08, -0.08);
  const shoulder = v(side * 0.42, 0.17, 0.14);
  const leadingFold = v(side * 1.08, 0.48, 0.08);
  const centerCrease = v(side * 1.08, 0.02, 0.02);
  const valleyFold = v(side * 0.76, -0.3, -0.12);
  const tip = v(side * 2.48, 0.09, 0.0);
  const tipEdge = v(side * 2.7, 0.16, -0.08);
  const trailingKnee = v(side * 1.55, -0.52, -0.18);
  const trailingEdge = v(side * 1.84, -0.42, -0.24);

  return createFoldedGeometry([
    { points: [rootTop, shoulder, centerCrease], shade: 1.1 },
    { points: [shoulder, leadingFold, tip, centerCrease], shade: 1.0 },
    { points: [leadingFold, tipEdge, tip], shade: 0.88 },
    { points: [rootBottom, centerCrease, valleyFold], shade: 0.84 },
    { points: [valleyFold, centerCrease, tip, trailingKnee], shade: 0.74 },
    { points: [trailingKnee, tip, trailingEdge], shade: 0.68 },
    { points: [rootTop, centerCrease, rootBottom], shade: 0.94 },
    { points: [rootBottom, valleyFold, trailingKnee], shade: 0.78 },
  ]);
}

function createNeckGeometry() {
  const baseLeft = v(-0.08, -0.04, 0);
  const baseRight = v(0.08, -0.04, 0);
  const baseTop = v(0, 0.11, 0.06);
  const neckTop = v(0, 0.48, 0.55);
  const neckLow = v(0, 0.18, 0.45);
  const cheekLeft = v(-0.12, 0.55, 0.86);
  const cheekRight = v(0.12, 0.55, 0.86);
  const crown = v(0, 0.73, 0.88);
  const chin = v(0, 0.42, 0.93);
  const beak = v(0, 0.53, 1.3);

  return createFoldedGeometry([
    { points: [baseLeft, baseTop, neckTop], shade: 1.06 },
    { points: [baseRight, neckTop, baseTop], shade: 0.84 },
    { points: [baseLeft, neckLow, baseRight], shade: 0.78 },
    { points: [baseLeft, neckTop, neckLow], shade: 0.92 },
    { points: [baseRight, neckLow, neckTop], shade: 0.74 },
    { points: [neckTop, cheekLeft, crown], shade: 1.0 },
    { points: [neckTop, crown, cheekRight], shade: 0.86 },
    { points: [neckTop, cheekRight, chin], shade: 0.78 },
    { points: [cheekLeft, beak, crown], shade: 0.94 },
    { points: [cheekRight, chin, beak], shade: 0.7 },
    { points: [crown, beak, chin], shade: 0.84 },
  ]);
}

function createTailGeometry() {
  const baseLeft = v(-0.18, -0.02, 0);
  const baseRight = v(0.18, -0.02, 0);
  const baseTop = v(0, 0.14, -0.05);
  const crease = v(0, 0.32, -0.58);
  const tip = v(0, 0.9, -1.42);
  const lowerTip = v(0, -0.1, -0.72);
  const edge = v(0, 0.44, -1.02);

  return createFoldedGeometry([
    { points: [baseLeft, baseTop, crease], shade: 1.02 },
    { points: [baseTop, baseRight, crease], shade: 0.86 },
    { points: [baseLeft, crease, lowerTip], shade: 0.78 },
    { points: [baseRight, lowerTip, crease], shade: 0.7 },
    { points: [crease, tip, edge], shade: 0.94 },
    { points: [crease, edge, lowerTip], shade: 0.76 },
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

function resetCrane(data, index, startSpread, reducedMotion) {
  const hero = data.hero[index] === 1;
  const entryRadius = hero ? random(5.5, 13) : random(4, 32);
  const entryAngle = random(0, TAU);
  const speedScale = reducedMotion ? 0.45 : 1;

  data.z[index] = startSpread
    ? (hero ? random(-108, 10) : random(FAR_Z, RESPAWN_Z))
    : FAR_Z - random(0, 34);
  data.x[index] = Math.cos(entryAngle) * entryRadius + random(-1.2, 1.2);
  data.y[index] = Math.sin(entryAngle) * entryRadius * 0.56 + random(-2.4, 2.4);
  data.vx[index] = random(-0.55, 0.55) * speedScale;
  data.vy[index] = random(-0.36, 0.36) * speedScale;
  data.vz[index] = random(hero ? 6.7 : 7.4, hero ? 10.4 : 13.8) * speedScale;
  data.ax[index] = 0;
  data.ay[index] = 0;
  data.az[index] = 0;
  data.cruise[index] = random(hero ? 7.2 : 8.0, hero ? 11.2 : 14.8) * speedScale;
  data.size[index] = hero ? random(0.82, 1.08) : random(0.35, 0.65);
  data.phase[index] = random(0, TAU);
  data.flapSpeed[index] = random(hero ? 1.12 : 1.25, hero ? 1.74 : 2.28) * (reducedMotion ? 0.58 : 1);
  data.roll[index] = random(-0.2, 0.2);
  data.homeAngle[index] = entryAngle + random(-0.7, 0.7);
  data.homeRadius[index] = hero ? random(4.5, 11.5) : random(5.5, 25);
  data.homeY[index] = random(-4.8, 4.8);
  data.noise[index] = random(0, 1000);
  data.bodyScale[index] = random(0.95, 1.1);
  data.wingScale[index] = random(0.9, 1.12);
  data.neckScale[index] = random(0.9, 1.16);
  data.tailScale[index] = random(0.92, 1.18);

  const colorSeed = CRANE_PALETTE[Math.floor(Math.random() * CRANE_PALETTE.length)];
  const color = new THREE.Color().setHSL(
    (colorSeed.h + random(-0.018, 0.018) + 1) % 1,
    clamp01(colorSeed.s + random(-0.045, 0.04)),
    clamp01(colorSeed.l + random(-0.035, 0.045)),
  );
  data.color[index * 3] = color.r;
  data.color[index * 3 + 1] = color.g;
  data.color[index * 3 + 2] = color.b;
}

function createCraneData(count, reducedMotion) {
  const data = {
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
    noise: new Float32Array(count),
    bodyScale: new Float32Array(count),
    wingScale: new Float32Array(count),
    neckScale: new Float32Array(count),
    tailScale: new Float32Array(count),
    color: new Float32Array(count * 3),
  };

  const heroCount = Math.max(5, Math.floor(count * 0.065));
  for (let i = 0; i < count; i += 1) {
    data.hero[i] = i < heroCount ? 1 : 0;
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
  const paperTexture = useMemo(() => createPaperTexture(), []);
  const data = useMemo(() => createCraneData(count, reducedMotion), [count, reducedMotion]);
  const color = useMemo(() => new THREE.Color(), []);
  const paperMaterialProps = useMemo(
    () => ({
      map: paperTexture,
      bumpMap: paperTexture,
      bumpScale: 0.018,
      vertexColors: true,
      flatShading: false,
      side: THREE.DoubleSide,
      roughness: 0.98,
      metalness: 0,
      emissive: '#10070a',
      emissiveIntensity: 0.045,
    }),
    [paperTexture],
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
    const fov = THREE.MathUtils.degToRad(state.camera.fov);
    const neighborRadiusSq = reducedMotion ? 42 : 58;
    const separationRadiusSq = reducedMotion ? 5.8 : 8.4;
    const simScale = reducedMotion ? 0.45 : 1;
    let colorsChanged = false;

    for (let i = 0; i < count; i += 1) {
      const xi = data.x[i];
      const yi = data.y[i];
      const zi = data.z[i];
      const depthT = clamp01((CAMERA_Z - zi) / DEPTH_RANGE);
      const phase = data.phase[i];
      const noiseSeed = data.noise[i];

      let ax = 0;
      let ay = 0;
      let az = (data.cruise[i] - data.vz[i]) * 0.5;
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
        const dz = (zi - data.z[j]) * 0.28;
        if (Math.abs(dz) > 8.5) continue;

        const d2 = dx * dx + dy * dy + dz * dz + 0.0001;
        if (d2 > neighborRadiusSq) continue;

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
        ax += sepX * 3.25 * simScale;
        ay += sepY * 3.25 * simScale;
        az += sepZ * 0.7 * simScale;
        ax += (avgVX * invCount - data.vx[i]) * 0.16 * simScale;
        ay += (avgVY * invCount - data.vy[i]) * 0.14 * simScale;
        az += (avgVZ * invCount - data.vz[i]) * 0.1 * simScale;
        ax += (avgX * invCount - xi) * 0.018 * simScale;
        ay += (avgY * invCount - yi) * 0.018 * simScale;
      }

      const flowAngle =
        data.homeAngle[i] +
        Math.sin(elapsed * 0.052 + noiseSeed) * 0.54 +
        Math.sin(elapsed * 0.017 + phase) * 0.24;
      const flowRadius = data.homeRadius[i] * (0.64 + depthT * 0.6);
      const targetX = Math.cos(flowAngle) * flowRadius + Math.sin(elapsed * 0.09 + phase) * 2.0;
      const targetY =
        Math.sin(flowAngle * 1.17) * flowRadius * 0.42 +
        data.homeY[i] * (0.65 + depthT * 0.45) +
        Math.cos(elapsed * 0.075 + noiseSeed) * 1.25;

      ax += (targetX - xi) * 0.03 * simScale;
      ay += (targetY - yi) * 0.032 * simScale;

      const boundsX = 8.5 + depthT * 32;
      const boundsY = 5.3 + depthT * 18;
      if (xi > boundsX) ax -= (xi - boundsX) * 0.14;
      if (xi < -boundsX) ax += (-boundsX - xi) * 0.14;
      if (yi > boundsY) ay -= (yi - boundsY) * 0.14;
      if (yi < -boundsY) ay += (-boundsY - yi) * 0.14;

      const radial = Math.hypot(xi, yi);
      const clearCenterRadius = 1.9 + (1 - depthT) * 2.7;
      if (radial < clearCenterRadius && radial > 0.001 && zi > -108) {
        const centerPush = (clearCenterRadius - radial) * 0.18;
        ax += (xi / radial) * centerPush;
        ay += (yi / radial) * centerPush;
      }

      const gustA = Math.sin(xi * 0.075 + zi * 0.021 + elapsed * 0.55 + noiseSeed);
      const gustB = Math.cos(yi * 0.09 - zi * 0.017 + elapsed * 0.42 + phase);
      const gustC = Math.sin((xi + yi) * 0.045 + elapsed * 0.27 + noiseSeed * 0.2);
      ax += gustA * 0.28 * simScale;
      ay += gustB * 0.22 * simScale;
      az += gustC * 0.14 * simScale;

      const distanceToCamera = Math.max(0.01, state.camera.position.z - zi);
      const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
      const viewWidth = viewHeight * aspect;

      if (pointerActive) {
        const cursorX = state.camera.position.x + interaction.x * viewWidth * 0.5;
        const cursorY = state.camera.position.y + interaction.y * viewHeight * 0.5;
        const dx = xi - cursorX;
        const dy = yi - cursorY;
        const dist = Math.hypot(dx, dy) + 0.001;
        const radius = Math.max(2.4, distanceToCamera * 0.065);
        const influence = smoothstep(radius, 0, dist);
        const invDist = 1 / dist;

        ax += (dx * invDist * 2.7 - dy * invDist * 0.55) * influence * simScale;
        ay += (dy * invDist * 2.7 + dx * invDist * 0.55) * influence * simScale;
        az += influence * 0.55 * simScale;
      }

      if (burstAge > 0 && burstAge < 2.2) {
        const cursorX = state.camera.position.x + interaction.burstX * viewWidth * 0.5;
        const cursorY = state.camera.position.y + interaction.burstY * viewHeight * 0.5;
        const dx = xi - cursorX;
        const dy = yi - cursorY;
        const dist = Math.hypot(dx, dy) + 0.001;
        const delayedAge = burstAge - Math.abs(zi - 7) * 0.011;

        if (delayedAge > 0 && delayedAge < 1.6) {
          const waveRadius = delayedAge * 15.5;
          const ring = Math.exp(-((dist - waveRadius) ** 2) / 8.5);
          const force = ring * (1 - delayedAge / 1.6) * 5.2 * simScale;
          const invDist = 1 / dist;
          ax += (dx * invDist - dy * invDist * 0.18) * force;
          ay += (dy * invDist + dx * invDist * 0.18) * force;
          az += force * 0.12;
        }
      }

      data.ax[i] = ax;
      data.ay[i] = ay;
      data.az[i] = az;
    }

    for (let i = 0; i < count; i += 1) {
      data.vx[i] += data.ax[i] * dt;
      data.vy[i] += data.ay[i] * dt;
      data.vz[i] += data.az[i] * dt;

      const maxSpeed = data.hero[i] === 1 ? 13.5 : 17.5;
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

      if (data.z[i] > RESPAWN_Z) {
        resetCrane(data, i, false, reducedMotion);
        setCraneColor(meshes, data, color, i);
        colorsChanged = true;
      }

      const speedAfter = Math.hypot(data.vx[i], data.vy[i], data.vz[i]);
      const yaw = Math.atan2(data.vx[i], data.vz[i]);
      const pitch = -Math.atan2(data.vy[i], Math.max(0.001, Math.hypot(data.vx[i], data.vz[i])));
      const bankTarget = clamp(-data.vx[i] * 0.075 - data.ax[i] * 0.018, -0.62, 0.62);
      data.roll[i] += (bankTarget - data.roll[i]) * (1 - Math.exp(-dt * 3.6));

      const phase = data.phase[i];
      const turbulence = Math.sin(elapsed * 0.62 + data.noise[i] + data.x[i] * 0.035) * 0.18;
      const flapRate = data.flapSpeed[i] * (0.82 + speedAfter * 0.035 + Math.abs(data.roll[i]) * 0.16);
      const flap = Math.sin(elapsed * flapRate + phase + turbulence);
      const softFlap = Math.sin(elapsed * flapRate * 0.5 + phase * 0.73);
      const wingLift = (reducedMotion ? 0.12 : 0.18) + flap * (reducedMotion ? 0.1 : 0.38);
      const leftLift = wingLift - data.roll[i] * 0.24;
      const rightLift = wingLift + data.roll[i] * 0.24;
      const bodyFloat = softFlap * 0.03;
      const scale = data.size[i] * (1 + softFlap * 0.014);

      baseObject.position.set(data.x[i], data.y[i], data.z[i]);
      baseObject.rotation.set(
        pitch + Math.sin(elapsed * 0.31 + phase) * 0.028 - wingLift * 0.032,
        yaw,
        data.roll[i] + flap * 0.03,
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
        -0.035 - softFlap * 0.018,
        -0.025,
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
        -0.035 - softFlap * 0.018,
        0.025,
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
        0.09 + softFlap * 0.042 - pitch * 0.06,
        data.roll[i] * -0.08,
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
        -0.075 - softFlap * 0.052 + pitch * 0.05,
        data.roll[i] * 0.06,
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
    lastMove: -100,
    burstX: 0,
    burstY: 0,
    burstTime: -100,
  });

  const updateInteraction = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    interactionRef.current.active = true;
    interactionRef.current.x = x;
    interactionRef.current.y = y;
    interactionRef.current.lastMove = performance.now() / 1000;
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
