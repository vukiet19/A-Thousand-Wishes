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
const HOLD_NONE = 0;
const HOLD_GRABBED = 1;
const HOLD_RELEASING = 2;
const HOLD_STORED = 3;
const GRAB_MIN_Z = 4;
const GRAB_MAX_Z = 8;
const RELEASE_MOMENTUM_DURATION = 0.58;
const GMT7_OFFSET_MS = 7 * 60 * 60 * 1000;
const HISTORY_STORAGE_KEY = 'a-thousand-wishes:deposited-cranes:v1';

const CRANE_WHITE = 0;
const CRANE_RED = 1;
const CRANE_BLUE = 2;
const CRANE_COLOR_CONFIG = [
  {
    type: CRANE_WHITE,
    key: 'white',
    label: 'Pastel white',
    h: 0.105,
    s: 0.2,
    l: 0.86,
    noteClass: 'note-white',
  },
  {
    type: CRANE_RED,
    key: 'red',
    label: 'Pastel red',
    h: 0.988,
    s: 0.72,
    l: 0.69,
    noteClass: 'note-red',
  },
  {
    type: CRANE_BLUE,
    key: 'blue',
    label: 'Pastel blue',
    h: 0.565,
    s: 0.72,
    l: 0.62,
    noteClass: 'note-blue',
  },
];

const WISH_MESSAGES = [
  'A quiet wish for tomorrow.',
  'May this memory stay gentle.',
  'Keep going, even softly.',
  'Let the light find its way back.',
  'A small hope, folded carefully.',
  'For every goodbye, a kinder beginning.',
  'Carry this tenderness forward.',
  'May the next sky feel lighter.',
  'Hold this moment without hurry.',
  'A thousand small chances to begin again.',
];

const SKY_KEYFRAMES = [
  {
    hour: 0,
    top: '#071226',
    middle: '#10234a',
    horizon: '#243b63',
    fog: '#172a4b',
    ambient: 0.2,
    hemiSky: '#8eaddf',
    hemiGround: '#07101f',
    hemiIntensity: 0.48,
    sun: '#cfe2ff',
    sunIntensity: 0.22,
    rim: '#7ea7e9',
    rimIntensity: 0.68,
    cloudColor: '#cfdaf0',
    cloudOpacity: 0.32,
  },
  {
    hour: 5.15,
    top: '#142b55',
    middle: '#315383',
    horizon: '#e2a87a',
    fog: '#657a9a',
    ambient: 0.38,
    hemiSky: '#bacfe8',
    hemiGround: '#273651',
    hemiIntensity: 0.72,
    sun: '#ffd0a4',
    sunIntensity: 0.9,
    rim: '#ffb3a2',
    rimIntensity: 0.78,
    cloudColor: '#f4d6cb',
    cloudOpacity: 0.54,
  },
  {
    hour: 6.35,
    top: '#6fa8dd',
    middle: '#edb4c7',
    horizon: '#ffe1a8',
    fog: '#c9d7e7',
    ambient: 0.72,
    hemiSky: '#fff0d7',
    hemiGround: '#7b8ea7',
    hemiIntensity: 1.06,
    sun: '#ffd9a2',
    sunIntensity: 2.05,
    rim: '#ffc1c4',
    rimIntensity: 0.78,
    cloudColor: '#fff2e6',
    cloudOpacity: 0.82,
  },
  {
    hour: 9,
    top: '#62b4ed',
    middle: '#bdeafb',
    horizon: '#f8f2dc',
    fog: '#cdeafa',
    ambient: 0.9,
    hemiSky: '#f7fcff',
    hemiGround: '#9bbccc',
    hemiIntensity: 1.34,
    sun: '#fff0bd',
    sunIntensity: 2.7,
    rim: '#bcecff',
    rimIntensity: 0.56,
    cloudColor: '#ffffff',
    cloudOpacity: 0.95,
  },
  {
    hour: 15.8,
    top: '#78bde9',
    middle: '#c7eafa',
    horizon: '#fff1d2',
    fog: '#d2e8f1',
    ambient: 0.86,
    hemiSky: '#f7fbff',
    hemiGround: '#9fb4c0',
    hemiIntensity: 1.22,
    sun: '#ffe0a4',
    sunIntensity: 2.35,
    rim: '#ffd6a6',
    rimIntensity: 0.7,
    cloudColor: '#fff8ee',
    cloudOpacity: 0.88,
  },
  {
    hour: 18.15,
    top: '#5868aa',
    middle: '#e99aa3',
    horizon: '#ffc16f',
    fog: '#c9a9ba',
    ambient: 0.62,
    hemiSky: '#ffd9bd',
    hemiGround: '#67618c',
    hemiIntensity: 0.96,
    sun: '#ffac65',
    sunIntensity: 1.8,
    rim: '#ff9aa0',
    rimIntensity: 0.95,
    cloudColor: '#ffd4bd',
    cloudOpacity: 0.8,
  },
  {
    hour: 19.45,
    top: '#152850',
    middle: '#304c7a',
    horizon: '#8d6b7e',
    fog: '#495d7c',
    ambient: 0.38,
    hemiSky: '#9fb9dc',
    hemiGround: '#20283d',
    hemiIntensity: 0.68,
    sun: '#dbe8ff',
    sunIntensity: 0.55,
    rim: '#a9c5ff',
    rimIntensity: 0.82,
    cloudColor: '#d7dced',
    cloudOpacity: 0.46,
  },
  {
    hour: 21.2,
    top: '#071226',
    middle: '#10234a',
    horizon: '#1d355f',
    fog: '#182c4d',
    ambient: 0.2,
    hemiSky: '#86a9dc',
    hemiGround: '#07101f',
    hemiIntensity: 0.5,
    sun: '#d8e8ff',
    sunIntensity: 0.25,
    rim: '#86aff5',
    rimIntensity: 0.72,
    cloudColor: '#cbd6ee',
    cloudOpacity: 0.34,
  },
  {
    hour: 24,
    top: '#071226',
    middle: '#10234a',
    horizon: '#243b63',
    fog: '#172a4b',
    ambient: 0.2,
    hemiSky: '#8eaddf',
    hemiGround: '#07101f',
    hemiIntensity: 0.48,
    sun: '#cfe2ff',
    sunIntensity: 0.22,
    rim: '#7ea7e9',
    rimIntensity: 0.68,
    cloudColor: '#cfdaf0',
    cloudOpacity: 0.32,
  },
];

const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const wrap01 = (value) => value - Math.floor(value);
const nullRaycast = () => null;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const lerp = (start, end, amount) => start + (end - start) * amount;
const mixColor = (from, to, amount) => {
  const color = new THREE.Color(from).lerp(new THREE.Color(to), clamp01(amount));
  return `#${color.getHexString()}`;
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

const getCraneColorConfig = (colorType) => CRANE_COLOR_CONFIG[colorType] ?? CRANE_COLOR_CONFIG[0];

const hashUint32 = (value) => {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};

const getLayerColorCounts = (count) => {
  const quotas = [
    { type: CRANE_WHITE, base: Math.floor(count * 0.3), remainder: count * 0.3 - Math.floor(count * 0.3) },
    { type: CRANE_RED, base: Math.floor(count * 0.3), remainder: count * 0.3 - Math.floor(count * 0.3) },
    { type: CRANE_BLUE, base: Math.floor(count * 0.4), remainder: count * 0.4 - Math.floor(count * 0.4) },
  ];
  let assigned = quotas[0].base + quotas[1].base + quotas[2].base;
  quotas.sort((a, b) => b.remainder - a.remainder || b.type - a.type);
  for (let i = 0; assigned < count; i += 1, assigned += 1) {
    quotas[i % quotas.length].base += 1;
  }

  return {
    [CRANE_WHITE]: quotas.find((entry) => entry.type === CRANE_WHITE).base,
    [CRANE_RED]: quotas.find((entry) => entry.type === CRANE_RED).base,
    [CRANE_BLUE]: quotas.find((entry) => entry.type === CRANE_BLUE).base,
  };
};

const assignColorTypesForRange = (data, start, end) => {
  const count = Math.max(0, end - start);
  if (count <= 0) return;

  const counts = getLayerColorCounts(count);
  const colors = [];
  for (let i = 0; i < counts[CRANE_WHITE]; i += 1) colors.push(CRANE_WHITE);
  for (let i = 0; i < counts[CRANE_RED]; i += 1) colors.push(CRANE_RED);
  for (let i = 0; i < counts[CRANE_BLUE]; i += 1) colors.push(CRANE_BLUE);

  for (let i = colors.length - 1; i > 0; i -= 1) {
    const seed = hashUint32((start + 1) * 73856093 + (end + 1) * 19349663 + (i + 1) * 83492791);
    const j = seed % (i + 1);
    const temp = colors[i];
    colors[i] = colors[j];
    colors[j] = temp;
  }

  for (let i = 0; i < count; i += 1) {
    data.colorType[start + i] = colors[i];
  }
};

const getGMT7Parts = (date = new Date()) => {
  const shifted = new Date(date.getTime() + GMT7_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
  };
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatGMT7Display = (date = new Date(), withSeconds = false) => {
  const parts = getGMT7Parts(date);
  const time = `${pad2(parts.hours)}:${pad2(parts.minutes)}${
    withSeconds ? `:${pad2(parts.seconds)}` : ''
  }`;
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year} ${time} GMT+7`;
};

const getSkyPhase = (parts) => {
  const hour = parts.hours + parts.minutes / 60 + parts.seconds / 3600;
  if (hour >= 5 && hour < 7.25) return 'dawn';
  if (hour >= 7.25 && hour < 16.75) return 'day';
  if (hour >= 16.75 && hour < 18.85) return 'sunset';
  return 'night';
};

const getSkyTimeHours = (parts) => parts.hours + parts.minutes / 60 + parts.seconds / 3600;

const getSkyPreviewTimeHours = () => {
  if (typeof window === 'undefined') return null;

  const value = new URLSearchParams(window.location.search).get('skyTime');
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  return hours + minutes / 60 + seconds / 3600;
};

const getSkyKeyframesForTime = (timeHours) => {
  const time = ((timeHours % 24) + 24) % 24;
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i += 1) {
    const current = SKY_KEYFRAMES[i];
    const next = SKY_KEYFRAMES[i + 1];
    if (time >= current.hour && time <= next.hour) {
      const amount = smoothstep(0, 1, (time - current.hour) / Math.max(0.001, next.hour - current.hour));
      return { current, next, amount };
    }
  }

  return { current: SKY_KEYFRAMES[0], next: SKY_KEYFRAMES[1], amount: 0 };
};

const getContinuousSkyState = (timeHours) => {
  const time = ((timeHours % 24) + 24) % 24;
  const { current, next, amount } = getSkyKeyframesForTime(time);
  const sunT = clamp01((time - 5.35) / 13.35);
  const sunArc = Math.sin(Math.PI * sunT);
  const sunVisibility = smoothstep(5.05, 6.45, time) * (1 - smoothstep(18.35, 19.2, time));
  const moonT = time >= 18 ? (time - 18) / 12 : (time + 6) / 12;
  const moonArc = Math.sin(Math.PI * clamp01(moonT));
  const eveningStars = smoothstep(18.9, 21.1, time);
  const morningStars = 1 - smoothstep(4.7, 6.25, time);
  const starOpacity = Math.max(eveningStars, morningStars) * 0.86;
  const twilight =
    smoothstep(4.85, 6.55, time) * (1 - smoothstep(6.55, 8.0, time)) +
    smoothstep(16.9, 18.6, time) * (1 - smoothstep(18.6, 20.2, time));
  const night = Math.max(smoothstep(19.25, 21.0, time), 1 - smoothstep(4.6, 6.05, time));
  const moonVisibility = clamp01(night * 0.95 + twilight * 0.22);

  return {
    key: getSkyPhase({
      hours: Math.floor(time),
      minutes: Math.floor((time % 1) * 60),
      seconds: 0,
    }),
    timeHours: time,
    dayProgress: time / 24,
    top: mixColor(current.top, next.top, amount),
    middle: mixColor(current.middle, next.middle, amount),
    horizon: mixColor(current.horizon, next.horizon, amount),
    fog: mixColor(current.fog, next.fog, amount),
    ambient: lerp(current.ambient, next.ambient, amount),
    hemiSky: mixColor(current.hemiSky, next.hemiSky, amount),
    hemiGround: mixColor(current.hemiGround, next.hemiGround, amount),
    hemiIntensity: lerp(current.hemiIntensity, next.hemiIntensity, amount),
    sun: mixColor(current.sun, next.sun, amount),
    sunIntensity: lerp(current.sunIntensity, next.sunIntensity, amount) * (0.28 + sunVisibility * 0.72),
    rim: mixColor(current.rim, next.rim, amount),
    rimIntensity: lerp(current.rimIntensity, next.rimIntensity, amount),
    cloudColor: mixColor(current.cloudColor, next.cloudColor, amount),
    cloudOpacity: lerp(current.cloudOpacity, next.cloudOpacity, amount),
    sunVisibility,
    moonVisibility,
    starOpacity,
    night,
    twilight: clamp01(twilight),
    sunPosition: {
      x: lerp(-0.78, 0.82, sunT),
      y: -0.16 + sunArc * 0.78,
    },
    moonPosition: {
      x: lerp(0.86, -0.78, clamp01(moonT)),
      y: -0.1 + moonArc * 0.72,
    },
  };
};

const createHistoryEntry = ({ craneIndex, colorType, message }) => {
  const now = new Date();
  const colorConfig = getCraneColorConfig(colorType);
  return {
    id: `${now.getTime()}-${craneIndex}-${colorConfig.key}`,
    craneIndex,
    colorType,
    colorLabel: colorConfig.label,
    message,
    depositedAtISO: now.toISOString(),
    depositedAtGMT7Display: formatGMT7Display(now, false),
  };
};

const historyStorage = {
  list() {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((entry) => entry && entry.id) : [];
    } catch {
      return [];
    }
  },
  add(entry) {
    if (typeof window === 'undefined') return [entry];

    const next = [entry, ...this.list()].slice(0, 160);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage failures should not block the artwork or note reveal.
    }
    return next;
  },
  clear() {
    if (typeof window === 'undefined') return [];

    try {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return [];
  },
};

const isInteractionInDropZone = (interaction, vessel) => {
  if (!vessel || !Number.isFinite(vessel.dropX) || !Number.isFinite(vessel.dropY)) return false;

  const radiusX = Math.max(0.001, vessel.radiusX ?? 0.16);
  const radiusY = Math.max(0.001, vessel.radiusY ?? 0.13);
  const dx = (interaction.x - vessel.dropX) / radiusX;
  const dy = (interaction.y - vessel.dropY) / radiusY;
  return dx * dx + dy * dy <= 1;
};

function useGMT7Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return useMemo(() => {
    const parts = getGMT7Parts(now);
    const previewTimeHours = getSkyPreviewTimeHours();
    const skyTimeHours = previewTimeHours ?? getSkyTimeHours(parts);
    const skyStyle = getContinuousSkyState(skyTimeHours);
    return {
      parts,
      phase: skyStyle.key,
      skyTimeHours,
      dayProgress: skyStyle.dayProgress,
      skyStyle,
      previewTimeHours,
      dateLabel: `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`,
      timeLabel: `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`,
    };
  }, [now]);
}

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

function createSkyTexture(skyStyle) {
  if (typeof document === 'undefined') return null;

  const width = 96;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, skyStyle.top);
  gradient.addColorStop(0.48, skyStyle.middle);
  gradient.addColorStop(1, skyStyle.horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const sunX = width * (0.5 + skyStyle.sunPosition.x * 0.36);
  const sunY = height * (0.5 - skyStyle.sunPosition.y * 0.42);
  const glow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.42);
  glow.addColorStop(0, `rgba(255,239,195,${0.46 * skyStyle.sunVisibility})`);
  glow.addColorStop(0.45, `rgba(255,202,145,${0.18 * skyStyle.sunVisibility})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const moonX = width * (0.5 + skyStyle.moonPosition.x * 0.35);
  const moonY = height * (0.5 - skyStyle.moonPosition.y * 0.42);
  const moonGlow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, height * 0.3);
  moonGlow.addColorStop(0, `rgba(206,226,255,${0.28 * skyStyle.moonVisibility})`);
  moonGlow.addColorStop(0.5, `rgba(136,168,225,${0.12 * skyStyle.moonVisibility})`);
  moonGlow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = moonGlow;
  context.fillRect(0, 0, width, height);

  const horizonHaze = context.createLinearGradient(0, height * 0.54, 0, height);
  horizonHaze.addColorStop(0, 'rgba(255,255,255,0)');
  horizonHaze.addColorStop(1, `rgba(255,238,205,${0.14 * (1 - skyStyle.night) + skyStyle.twilight * 0.1})`);
  context.fillStyle = horizonHaze;
  context.fillRect(0, 0, width, height);

  const coolHaze = context.createLinearGradient(0, height * 0.62, 0, height);
  coolHaze.addColorStop(0, 'rgba(255,255,255,0)');
  coolHaze.addColorStop(1, `rgba(92,128,180,${0.12 * skyStyle.night})`);
  context.fillStyle = coolHaze;
  context.fillRect(0, 0, width, height);

  const vignette = context.createRadialGradient(width * 0.5, height * 0.48, height * 0.1, width * 0.5, height * 0.5, height * 0.78);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(1, `rgba(4,16,36,${0.1 + skyStyle.night * 0.18})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createCloudTexture(seed = 1) {
  if (typeof document === 'undefined') return null;

  let value = seed * 2654435761;
  const next = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let cluster = 0; cluster < 9; cluster += 1) {
    const cx = next() * canvas.width;
    const cy = canvas.height * (0.22 + next() * 0.58);
    const width = canvas.width * (0.16 + next() * 0.26);
    const height = canvas.height * (0.08 + next() * 0.18);

    for (let puff = 0; puff < 28; puff += 1) {
      const px = cx + (next() - 0.5) * width;
      const py = cy + (next() - 0.5) * height;
      const radius = canvas.width * (0.026 + next() * 0.07);
      const alpha = 0.36 + next() * 0.38;
      const gradient = context.createRadialGradient(px, py, 0, px, py, radius * (1.2 + next() * 0.9));
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(0.42, `rgba(255,255,255,${alpha * 0.72})`);
      gradient.addColorStop(0.68, `rgba(205,222,234,${alpha * 0.36})`);
      gradient.addColorStop(0.84, `rgba(146,177,196,${alpha * 0.22})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }

    context.globalAlpha = 0.24 + next() * 0.18;
    context.strokeStyle = '#ffffff';
    context.lineWidth = canvas.height * (0.012 + next() * 0.014);
    context.beginPath();
    context.moveTo(cx - width * 0.58, cy + height * (0.12 + next() * 0.28));
    context.bezierCurveTo(
      cx - width * 0.18,
      cy + height * (0.2 - next() * 0.24),
      cx + width * 0.22,
      cy + height * (0.08 + next() * 0.24),
      cx + width * 0.64,
      cy + height * (0.12 - next() * 0.18),
    );
    context.stroke();
    context.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createRadialGlowTexture(innerColor, outerColor = 'rgba(255,255,255,0)') {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.42, innerColor.replace(/,\s*[\d.]+\)$/, ',0.22)'));
  gradient.addColorStop(1, outerColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createMoonTexture() {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 256, 256);

  const disk = context.createRadialGradient(112, 92, 8, 128, 128, 118);
  disk.addColorStop(0, 'rgba(255,255,255,0.98)');
  disk.addColorStop(0.62, 'rgba(219,233,255,0.95)');
  disk.addColorStop(1, 'rgba(162,187,230,0.86)');
  context.fillStyle = disk;
  context.beginPath();
  context.arc(128, 128, 112, 0, TAU);
  context.fill();

  const craters = [
    [90, 92, 14, 0.18],
    [145, 76, 10, 0.12],
    [165, 142, 18, 0.14],
    [105, 158, 22, 0.1],
    [135, 178, 8, 0.12],
  ];
  for (let i = 0; i < craters.length; i += 1) {
    const [x, y, radius, alpha] = craters[i];
    const crater = context.createRadialGradient(x - radius * 0.25, y - radius * 0.25, 0, x, y, radius);
    crater.addColorStop(0, `rgba(255,255,255,${alpha * 0.75})`);
    crater.addColorStop(0.7, `rgba(95,125,176,${alpha})`);
    crater.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = crater;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  context.globalCompositeOperation = 'destination-in';
  context.beginPath();
  context.arc(128, 128, 112, 0, TAU);
  context.fillStyle = '#ffffff';
  context.fill();
  context.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createStarGeometry(count, seed = 1, spread = 1) {
  let value = seed * 2654435761;
  const next = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const radius = Math.pow(next(), 0.55);
    positions[i * 3] = (next() - 0.5) * 160 * radius * spread;
    positions[i * 3 + 1] = (next() - 0.5) * 96 * radius * spread;
    positions[i * 3 + 2] = FAR_Z + 16 + next() * 34;

    color.setHSL(0.58 + next() * 0.08, 0.18 + next() * 0.2, 0.76 + next() * 0.22);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
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
  data.held[index] = HOLD_NONE;
  data.grabPointerId[index] = -1;
  data.grabProgress[index] = 0;
  data.grabReleaseProgress[index] = 0;
  data.grabAge[index] = 0;
  data.grabStartX[index] = data.x[index];
  data.grabStartY[index] = data.y[index];
  data.grabStartZ[index] = data.z[index];
  data.grabX[index] = data.x[index];
  data.grabY[index] = data.y[index];
  data.grabZ[index] = data.z[index];
  data.grabPrevX[index] = data.x[index];
  data.grabPrevY[index] = data.y[index];
  data.grabPrevZ[index] = data.z[index];
  data.grabVelocityX[index] = 0;
  data.grabVelocityY[index] = 0;
  data.grabVelocityZ[index] = 0;
  data.grabOffsetX[index] = 0;
  data.grabOffsetY[index] = 0;
  data.grabOffsetZ[index] = 0;
  data.grabOffsetReady[index] = 0;
  data.grabPhase[index] = random(0, TAU);
  data.grabIntensity[index] = 0;
  data.grabBank[index] = 0;
  data.storedSlot[index] = -1;
  data.storedProgress[index] = 0;
  data.storedSize[index] = 0;
  data.storedX[index] = data.x[index];
  data.storedY[index] = data.y[index];
  data.storedZ[index] = data.z[index];
  data.storedVx[index] = 0;
  data.storedVy[index] = 0;
  data.storedVz[index] = 0;
  data.storedPitch[index] = 0;
  data.storedYaw[index] = 0;
  data.storedRoll[index] = 0;
  data.storedAngularX[index] = 0;
  data.storedAngularY[index] = 0;
  data.storedAngularZ[index] = 0;
  data.storedRadius[index] = 0;
  data.storedResting[index] = 0;
  data.storedRestTime[index] = 0;
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

  const colorSeed = getCraneColorConfig(data.colorType[index]);
  const colorType = data.colorType[index];
  const saturatedPaper = colorType !== CRANE_WHITE;
  const color = new THREE.Color().setHSL(
    (colorSeed.h + random(-0.01, 0.01) + 1) % 1,
    clamp01(colorSeed.s + random(-0.018, 0.026) + (hero ? 0.025 : mid ? 0 : saturatedPaper ? -0.015 : -0.04)),
    clamp01(colorSeed.l + random(-0.022, 0.026) + (hero ? 0.028 : mid ? -0.005 : saturatedPaper ? -0.035 : -0.06)),
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
    held: new Uint8Array(count),
    grabPointerId: new Int32Array(count),
    grabProgress: new Float32Array(count),
    grabReleaseProgress: new Float32Array(count),
    grabAge: new Float32Array(count),
    grabStartX: new Float32Array(count),
    grabStartY: new Float32Array(count),
    grabStartZ: new Float32Array(count),
    grabX: new Float32Array(count),
    grabY: new Float32Array(count),
    grabZ: new Float32Array(count),
    grabPrevX: new Float32Array(count),
    grabPrevY: new Float32Array(count),
    grabPrevZ: new Float32Array(count),
    grabVelocityX: new Float32Array(count),
    grabVelocityY: new Float32Array(count),
    grabVelocityZ: new Float32Array(count),
    grabOffsetX: new Float32Array(count),
    grabOffsetY: new Float32Array(count),
    grabOffsetZ: new Float32Array(count),
    grabOffsetReady: new Uint8Array(count),
    grabPhase: new Float32Array(count),
    grabIntensity: new Float32Array(count),
    grabBank: new Float32Array(count),
    storedSlot: new Int16Array(count),
    storedProgress: new Float32Array(count),
    storedSize: new Float32Array(count),
    storedX: new Float32Array(count),
    storedY: new Float32Array(count),
    storedZ: new Float32Array(count),
    storedVx: new Float32Array(count),
    storedVy: new Float32Array(count),
    storedVz: new Float32Array(count),
    storedPitch: new Float32Array(count),
    storedYaw: new Float32Array(count),
    storedRoll: new Float32Array(count),
    storedAngularX: new Float32Array(count),
    storedAngularY: new Float32Array(count),
    storedAngularZ: new Float32Array(count),
    storedRadius: new Float32Array(count),
    storedResting: new Uint8Array(count),
    storedRestTime: new Float32Array(count),
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
    colorType: new Uint8Array(count),
    messageIndex: new Uint16Array(count),
    color: new Float32Array(count * 3),
  };

  const heroCount = Math.min(12, Math.max(6, Math.floor(count * 0.055)));
  const midEnd = heroCount + Math.floor((count - heroCount) * 0.58);
  for (let i = 0; i < count; i += 1) {
    data.layer[i] = i < heroCount ? HERO_LAYER : i < midEnd ? MID_LAYER : BACK_LAYER;
    data.hero[i] = data.layer[i] === HERO_LAYER ? 1 : 0;
    data.messageIndex[i] = i % WISH_MESSAGES.length;
  }

  assignColorTypesForRange(data, 0, heroCount);
  assignColorTypesForRange(data, heroCount, midEnd);
  assignColorTypesForRange(data, midEnd, count);

  for (let i = 0; i < count; i += 1) {
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

function CraneField({ count, reducedMotion, interactionRef, depositRef, pickingRef, onDeposit }) {
  const bodyRef = useRef();
  const leftWingRef = useRef();
  const rightWingRef = useRef();
  const neckRef = useRef();
  const tailRef = useRef();
  const meshesRef = useRef([]);
  const { camera, gl } = useThree();
  const baseObject = useMemo(() => new THREE.Object3D(), []);
  const partObject = useMemo(() => new THREE.Object3D(), []);
  const finalMatrix = useMemo(() => new THREE.Matrix4(), []);
  const pickPointer = useMemo(() => new THREE.Vector2(), []);
  const pickRaycaster = useMemo(() => new THREE.Raycaster(), []);
  const pickWorld = useMemo(() => new THREE.Vector3(), []);
  const pickHits = useMemo(() => [], []);
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

  const setGrabPointerFromEvent = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      let pointerX = event.pointer?.x;
      let pointerY = event.pointer?.y;

      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        const sourceEvent = event.sourceEvent ?? event.nativeEvent ?? event;
        const target = sourceEvent.currentTarget ?? sourceEvent.target;
        const rect = target?.getBoundingClientRect?.();
        if (!rect || !Number.isFinite(sourceEvent.clientX) || !Number.isFinite(sourceEvent.clientY)) {
          return false;
        }
        pointerX = ((sourceEvent.clientX - rect.left) / rect.width) * 2 - 1;
        pointerY = -(((sourceEvent.clientY - rect.top) / rect.height) * 2 - 1);
      }

      const now = performance.now() / 1000;
      const hasRecentMove = now - interaction.lastMove < 0.18;
      if (hasRecentMove) {
        const dt = clamp(now - interaction.lastMove, 0.016, 0.12);
        interaction.vx += ((pointerX - interaction.x) / dt - interaction.vx) * 0.36;
        interaction.vy += ((pointerY - interaction.y) / dt - interaction.vy) * 0.36;
      } else {
        interaction.vx = 0;
        interaction.vy = 0;
      }

      interaction.x = clamp(pointerX, -1.15, 1.15);
      interaction.y = clamp(pointerY, -1.15, 1.15);
      interaction.active = false;
      interaction.lastMove = now;
      return true;
    },
    [interactionRef],
  );

  const releasePointerCapture = useCallback((event) => {
    const pointerId = event.pointerId;
    if (!Number.isFinite(pointerId)) return;

    try {
      event.target?.releasePointerCapture?.(pointerId);
    } catch {
      // Some browsers release capture automatically on pointerup/cancel.
    }
  }, []);

  const storeCraneInVessel = useCallback(
    (index) => {
      if (index < 0 || index >= count || data.held[index] === HOLD_STORED) return false;

      const vessel = depositRef.current;
      const interaction = interactionRef.current;
      const nextSlot = vessel.nextSlot ?? 0;
      const slot = nextSlot;
      vessel.nextSlot = nextSlot + 1;
      vessel.hovered = false;
      vessel.hoveredIndex = -1;
      vessel.pulse = 1;

      data.held[index] = HOLD_STORED;
      data.grabPointerId[index] = -1;
      data.grabProgress[index] = 0;
      data.grabReleaseProgress[index] = 0;
      data.grabAge[index] = 0;
      data.grabOffsetReady[index] = 0;
      data.storedSlot[index] = slot;
      data.storedProgress[index] = 0;
      data.storedSize[index] = clamp(
        data.size[index] * (data.hero[index] ? 0.48 : 0.78),
        0.34,
        data.hero[index] ? 0.62 : 0.54,
      );
      data.storedRadius[index] = data.storedSize[index] * (data.hero[index] ? 0.58 : 0.66);
      data.storedPitch[index] = random(0.16, 0.48) * (Math.random() < 0.5 ? -1 : 1);
      data.storedYaw[index] = random(-1.2, 1.2);
      data.storedRoll[index] = random(-0.86, 0.86);
      data.storedAngularX[index] = random(-1.2, 1.2) * (reducedMotion ? 0.28 : 1);
      data.storedAngularY[index] = random(-0.9, 0.9) * (reducedMotion ? 0.24 : 1);
      data.storedAngularZ[index] = random(-1.5, 1.5) * (reducedMotion ? 0.25 : 1);
      data.storedResting[index] = 0;
      data.storedRestTime[index] = 0;
      data.exitState[index] = 0;
      data.exitAge[index] = 0;
      data.offscreenTime[index] = 0;

      const centerX = vessel.centerX ?? data.x[index];
      const topY = vessel.topY ?? vessel.mouthY ?? data.y[index];
      const bottomY = vessel.bottomY ?? (vessel.centerY ?? data.y[index]);
      const centerZ = vessel.centerZ ?? data.z[index];
      const minX = vessel.boxMinX ?? centerX - (vessel.scale ?? 1.6) * 0.8;
      const maxX = vessel.boxMaxX ?? centerX + (vessel.scale ?? 1.6) * 0.8;
      const minZ = vessel.boxMinZ ?? centerZ - (vessel.scale ?? 1.6) * 0.45;
      const maxZ = vessel.boxMaxZ ?? centerZ + (vessel.scale ?? 1.6) * 0.45;
      const entryX = clamp(data.x[index] * 0.72 + centerX * 0.28 + random(-0.12, 0.12), minX + 0.08, maxX - 0.08);
      const entryZ = clamp(data.z[index] * 0.42 + centerZ * 0.58 + random(-0.08, 0.08), minZ + 0.08, maxZ - 0.08);
      const entryY = Math.max(topY + data.storedRadius[index] * 0.42, Math.min(data.y[index], topY + (vessel.scale ?? 1.6) * 0.34));
      data.x[index] = entryX;
      data.y[index] = Math.max(entryY, bottomY + data.storedRadius[index]);
      data.z[index] = entryZ;
      data.storedX[index] = data.x[index];
      data.storedY[index] = data.y[index];
      data.storedZ[index] = data.z[index];
      const lateralScale = reducedMotion ? 0.035 : 0.055;
      data.storedVx[index] = clamp(data.grabVelocityX[index] * lateralScale + random(-0.26, 0.26), -1.3, 1.3);
      data.storedVy[index] = Math.min(
        -(reducedMotion ? 0.42 : 0.88),
        data.grabVelocityY[index] * (reducedMotion ? 0.018 : 0.026) - (reducedMotion ? 0.48 : 0.95),
      );
      data.storedVz[index] = clamp(data.grabVelocityZ[index] * 0.045 + random(-0.18, 0.18), -0.85, 0.85);
      data.vx[index] = data.storedVx[index];
      data.vy[index] = data.storedVy[index];
      data.vz[index] = data.storedVz[index];
      data.ax[index] = 0;
      data.ay[index] = 0;
      data.az[index] = 0;
      data.grabIntensity[index] = reducedMotion ? 0.16 : 0.28;
      data.grabBank[index] = clamp((centerX - data.x[index]) * 0.035, -0.32, 0.32);

      if (interaction.grabbedIndex === index) {
        interaction.isGrabbing = false;
        interaction.grabReleaseRequested = false;
        interaction.grabbedIndex = -1;
        interaction.grabbedPointerId = -1;
      }

      onDeposit?.({
        craneIndex: index,
        colorType: data.colorType[index],
        message: WISH_MESSAGES[data.messageIndex[index] % WISH_MESSAGES.length],
      });

      return true;
    },
    [count, data, depositRef, interactionRef, onDeposit, reducedMotion],
  );

  const releaseGrabbedCrane = useCallback(
    (index) => {
      if (index < 0 || index >= count || data.held[index] !== HOLD_GRABBED) return;

      const interaction = interactionRef.current;
      const vessel = depositRef.current;
      if ((vessel.hovered && vessel.hoveredIndex === index) || isInteractionInDropZone(interaction, vessel)) {
        storeCraneInVessel(index);
        return;
      }

      data.held[index] = HOLD_RELEASING;
      data.grabPointerId[index] = -1;
      data.grabProgress[index] = Math.max(0.26, data.grabProgress[index]);
      data.grabReleaseProgress[index] = 0;
      data.grabAge[index] = 0;
      data.grabStartX[index] = data.x[index];
      data.grabStartY[index] = data.y[index];
      data.grabStartZ[index] = data.z[index];
      data.grabX[index] = data.x[index];
      data.grabY[index] = data.y[index];
      data.grabZ[index] = data.z[index];
      data.grabPrevX[index] = data.x[index];
      data.grabPrevY[index] = data.y[index];
      data.grabPrevZ[index] = data.z[index];
      data.grabOffsetReady[index] = 0;

      const releaseScale = reducedMotion ? 0.32 : 0.42;
      let releaseVx = data.grabVelocityX[index] * releaseScale + data.vx[index] * 0.32;
      let releaseVy = data.grabVelocityY[index] * releaseScale + data.vy[index] * 0.32;
      const lateralRelease = Math.hypot(releaseVx, releaseVy);
      const releasePower = clamp01(lateralRelease / (reducedMotion ? 11 : 18));
      const minForward = data.cruise[index] * (reducedMotion ? 0.46 : 0.58);
      const forwardBoost =
        data.cruise[index] * (reducedMotion ? 0.34 : 0.46) +
        lateralRelease * (reducedMotion ? 0.035 : 0.07);
      let releaseVz = Math.max(
        data.vz[index] * 0.26 + data.grabVelocityZ[index] * 0.16 + forwardBoost,
        minForward,
      );
      releaseVx = clamp(releaseVx, reducedMotion ? -11 : -18, reducedMotion ? 11 : 18);
      releaseVy = clamp(releaseVy, reducedMotion ? -9 : -15, reducedMotion ? 9 : 15);
      releaseVz = clamp(releaseVz, minForward, data.cruise[index] * (reducedMotion ? 1.2 : 1.65));

      const releaseMax = reducedMotion ? 13.2 : 22;
      const releaseSpeed = Math.hypot(releaseVx, releaseVy, releaseVz);
      if (releaseSpeed > releaseMax) {
        const scale = releaseMax / releaseSpeed;
        releaseVx *= scale;
        releaseVy *= scale;
        releaseVz = Math.max(minForward, releaseVz * scale);
      }

      data.vx[index] = releaseVx;
      data.vy[index] = releaseVy;
      data.vz[index] = releaseVz;
      data.grabVelocityX[index] = releaseVx;
      data.grabVelocityY[index] = releaseVy;
      data.grabVelocityZ[index] = releaseVz;
      data.grabIntensity[index] = Math.max(data.grabIntensity[index], releasePower);
      data.grabBank[index] = clamp(releaseVx * (reducedMotion ? 0.018 : 0.026), -0.42, 0.42);
      data.exitState[index] = 0;
      data.offscreenTime[index] = 0;

      if (interaction.grabbedIndex === index) {
        interaction.isGrabbing = false;
        interaction.grabReleaseRequested = false;
        interaction.grabbedIndex = -1;
        interaction.grabbedPointerId = -1;
      }
    },
    [count, data, depositRef, interactionRef, reducedMotion, storeCraneInVessel],
  );

  const startGrabCrane = useCallback(
    (index, event) => {
      if (index < 0 || index >= count) return;
      if (data.held[index] === HOLD_STORED) return;

      const interaction = interactionRef.current;
      const previousIndex = interaction.grabbedIndex;
      if (previousIndex >= 0 && previousIndex !== index) {
        releaseGrabbedCrane(previousIndex);
      }

      const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : -1;
      try {
        event.target?.setPointerCapture?.(pointerId);
      } catch {
        // Pointer capture is best-effort for R3F/DOM event interop.
      }

      setGrabPointerFromEvent(event);

      interaction.isGrabbing = true;
      interaction.grabReleaseRequested = false;
      interaction.grabbedIndex = index;
      interaction.grabbedPointerId = pointerId;
      interaction.active = false;
      interaction.suppressBurstUntil = performance.now() / 1000 + 0.12;

      data.held[index] = HOLD_GRABBED;
      data.grabPointerId[index] = pointerId;
      data.grabProgress[index] = Math.max(0.08, data.grabProgress[index]);
      data.grabReleaseProgress[index] = 0;
      data.grabAge[index] = 0;
      data.grabStartX[index] = data.x[index];
      data.grabStartY[index] = data.y[index];
      data.grabStartZ[index] = data.z[index];
      data.grabX[index] = data.x[index];
      data.grabY[index] = data.y[index];
      data.grabZ[index] = clamp(data.z[index] * 0.16 + 5.7, GRAB_MIN_Z, GRAB_MAX_Z);
      data.grabPrevX[index] = data.x[index];
      data.grabPrevY[index] = data.y[index];
      data.grabPrevZ[index] = data.z[index];
      data.grabVelocityX[index] = 0;
      data.grabVelocityY[index] = 0;
      data.grabVelocityZ[index] = 0;
      data.grabOffsetX[index] = 0;
      data.grabOffsetY[index] = 0;
      data.grabOffsetZ[index] = 0;
      data.grabOffsetReady[index] = 0;
      data.grabPhase[index] = random(0, TAU);
      data.grabIntensity[index] = 0;
      data.grabBank[index] = 0;
      data.vx[index] *= 0.3;
      data.vy[index] *= 0.3;
      data.vz[index] *= 0.18;
      data.ax[index] = 0;
      data.ay[index] = 0;
      data.az[index] = 0;
      data.wakeCue[index] = 0;
      data.wakeRoll[index] = 0;
      data.exitState[index] = 0;
      data.exitAge[index] = 0;
      data.offscreenTime[index] = 0;
    },
    [count, data, interactionRef, reducedMotion, releaseGrabbedCrane, setGrabPointerFromEvent],
  );

  const handleCranePointerDown = useCallback(
    (event) => {
      const instanceId = Number.isInteger(event.instanceId)
        ? event.instanceId
        : event.intersections?.find((hit) => Number.isInteger(hit.instanceId))?.instanceId;
      if (!Number.isInteger(instanceId)) return;
      event.stopPropagation();
      startGrabCrane(instanceId, event);
    },
    [startGrabCrane],
  );

  useEffect(() => {
    if (!pickingRef) return undefined;

    const pickCraneFromPointer = (event) => {
      const meshes = meshesRef.current;
      if (meshes.length !== 5) return false;

      const target = event.currentTarget ?? gl.domElement;
      const rect = target?.getBoundingClientRect?.();
      if (!rect || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;

      pickPointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      );
      pickRaycaster.setFromCamera(pickPointer, camera);
      pickHits.length = 0;
      pickRaycaster.intersectObjects(meshes, false, pickHits);

      for (let i = 0; i < pickHits.length; i += 1) {
        const instanceId = pickHits[i].instanceId;
        if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId >= count) continue;
        if (data.held[instanceId] === HOLD_STORED) continue;

        startGrabCrane(instanceId, {
          pointerId: event.pointerId,
          target: gl.domElement,
          currentTarget: gl.domElement,
          clientX: event.clientX,
          clientY: event.clientY,
          sourceEvent: event,
        });
        return true;
      }

      let bestIndex = -1;
      let bestScore = Infinity;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const aspect = rect.width / rect.height;
      for (let i = 0; i < count; i += 1) {
        if (data.held[i] === HOLD_STORED) continue;

        pickWorld.set(data.x[i], data.y[i], data.z[i]).project(camera);
        if (pickWorld.z < -1 || pickWorld.z > 1) continue;

        const distanceToCamera = Math.max(0.01, camera.position.z - data.z[i]);
        const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
        const radius = clamp((data.size[i] * (data.hero[i] ? 5.6 : 4.8)) / viewHeight, 0.018, data.hero[i] ? 0.12 : 0.07);
        const dx = pickPointer.x - pickWorld.x;
        const dy = pickPointer.y - pickWorld.y;
        const d2 = dx * dx + dy * dy * aspect;

        if (d2 < radius * radius && d2 < bestScore) {
          bestScore = d2;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        startGrabCrane(bestIndex, {
          pointerId: event.pointerId,
          target: gl.domElement,
          currentTarget: gl.domElement,
          clientX: event.clientX,
          clientY: event.clientY,
          sourceEvent: event,
        });
        return true;
      }

      return false;
    };

    pickingRef.current.pickCraneFromPointer = pickCraneFromPointer;
    return () => {
      if (pickingRef.current.pickCraneFromPointer === pickCraneFromPointer) {
        pickingRef.current.pickCraneFromPointer = null;
      }
    };
  }, [camera, count, data, gl, pickHits, pickPointer, pickRaycaster, pickWorld, pickingRef, startGrabCrane]);

  const handleCranePointerMove = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      if (!interaction.isGrabbing) return;
      if (interaction.grabbedPointerId >= 0 && event.pointerId !== interaction.grabbedPointerId) return;

      event.stopPropagation();
      setGrabPointerFromEvent(event);
    },
    [interactionRef, setGrabPointerFromEvent],
  );

  const handleCranePointerRelease = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      if (!interaction.isGrabbing && !interaction.grabReleaseRequested) return;
      if (interaction.grabbedPointerId >= 0 && event.pointerId !== interaction.grabbedPointerId) return;

      event.stopPropagation();
      releasePointerCapture(event);
      releaseGrabbedCrane(interaction.grabbedIndex);
    },
    [interactionRef, releaseGrabbedCrane, releasePointerCapture],
  );

  useFrame((state, delta) => {
    const meshes = meshesRef.current;
    if (meshes.length !== 5) return;

    const elapsed = state.clock.getElapsedTime();
    const now = performance.now() / 1000;
    const dt = Math.min(delta, reducedMotion ? 0.032 : 0.038);
    const interaction = interactionRef.current;
    const pointerActive = !interaction.isGrabbing && interaction.active && now - interaction.lastMove < 3.2;
    const burstAge = now - interaction.burstTime;
    const aspect = state.size.width / state.size.height;
    const compactTitle = state.size.width < 720;
    const fov = THREE.MathUtils.degToRad(state.camera.fov);
    const baseNeighborRadiusSq = reducedMotion ? 40 : 56;
    const baseSeparationRadiusSq = reducedMotion ? 5.8 : 8.4;
    const simScale = reducedMotion ? 0.45 : 1;
    let colorsChanged = false;
    const vessel = depositRef.current;
    vessel.hovered = false;
    vessel.hoveredIndex = -1;

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
      let heldStatus = data.held[i];
      if (
        heldStatus === HOLD_GRABBED &&
        (interaction.grabReleaseRequested ||
          !interaction.isGrabbing ||
          interaction.grabbedIndex !== i ||
          (interaction.grabbedPointerId >= 0 && data.grabPointerId[i] !== interaction.grabbedPointerId))
      ) {
        releaseGrabbedCrane(i);
        heldStatus = data.held[i];
      }

      if (heldStatus !== HOLD_NONE) {
        data.exitState[i] = 0;
        data.offscreenTime[i] = 0;
        data.grabAge[i] += dt;

        if (heldStatus === HOLD_STORED) {
          const vesselScale = vessel.scale ?? 1.65;
          const radius = Math.max(0.14, data.storedRadius[i] || data.storedSize[i] * 0.62);
          const minX = (vessel.boxMinX ?? (vessel.centerX ?? 8.4) - vesselScale * 0.9) + radius * 0.38;
          const maxX = (vessel.boxMaxX ?? (vessel.centerX ?? 8.4) + vesselScale * 0.9) - radius * 0.38;
          const minZ = (vessel.boxMinZ ?? (vessel.centerZ ?? 3.8) - vesselScale * 0.52) + radius * 0.34;
          const maxZ = (vessel.boxMaxZ ?? (vessel.centerZ ?? 3.8) + vesselScale * 0.52) - radius * 0.34;
          const floorY = (vessel.bottomY ?? (vessel.centerY ?? -5.5) - vesselScale * 0.56) + radius * 0.34;
          const ceilingY = (vessel.topY ?? (vessel.centerY ?? -5.5) + vesselScale * 0.62) + radius * 0.3;
          const resting = data.storedResting[i] === 1;
          let ax = -data.vx[i] * (resting ? 3.4 : 0.52);
          let ay = resting ? -data.vy[i] * 4.5 : -(reducedMotion ? 2.05 : 4.45) - data.vy[i] * 0.34;
          let az = -data.vz[i] * (resting ? 3.4 : 0.52);
          let contact = false;

          if (!resting) {
            data.storedAngularX[i] *= 1 - Math.min(0.08, dt * (reducedMotion ? 1.2 : 1.8));
            data.storedAngularY[i] *= 1 - Math.min(0.08, dt * (reducedMotion ? 1.0 : 1.5));
            data.storedAngularZ[i] *= 1 - Math.min(0.08, dt * (reducedMotion ? 1.2 : 1.9));
            data.storedPitch[i] += data.storedAngularX[i] * dt;
            data.storedYaw[i] += data.storedAngularY[i] * dt;
            data.storedRoll[i] += data.storedAngularZ[i] * dt;
          }

          if (data.x[i] < minX) {
            data.x[i] = minX;
            data.vx[i] = Math.abs(data.vx[i]) * (reducedMotion ? 0.18 : 0.32);
            contact = true;
          } else if (data.x[i] > maxX) {
            data.x[i] = maxX;
            data.vx[i] = -Math.abs(data.vx[i]) * (reducedMotion ? 0.18 : 0.32);
            contact = true;
          }
          if (data.z[i] < minZ) {
            data.z[i] = minZ;
            data.vz[i] = Math.abs(data.vz[i]) * (reducedMotion ? 0.16 : 0.28);
            contact = true;
          } else if (data.z[i] > maxZ) {
            data.z[i] = maxZ;
            data.vz[i] = -Math.abs(data.vz[i]) * (reducedMotion ? 0.16 : 0.28);
            contact = true;
          }
          if (data.y[i] < floorY) {
            data.y[i] = floorY;
            data.vy[i] = Math.abs(data.vy[i]) * (reducedMotion ? 0.12 : 0.22);
            data.vx[i] *= reducedMotion ? 0.62 : 0.72;
            data.vz[i] *= reducedMotion ? 0.62 : 0.72;
            contact = true;
          } else if (data.y[i] > ceilingY) {
            data.y[i] = ceilingY;
            data.vy[i] = Math.min(0, data.vy[i]) * 0.3;
          }

          for (let j = 0; j < count; j += 1) {
            if (
              j === i ||
              data.held[j] !== HOLD_STORED ||
              data.storedProgress[j] <= 0.08 ||
              data.storedSlot[j] >= data.storedSlot[i]
            ) {
              continue;
            }
            const otherRadius = Math.max(0.12, data.storedRadius[j] || data.storedSize[j] * 0.62);
            const dx = data.x[i] - data.x[j];
            const dz = data.z[i] - data.z[j];
            const dy = data.y[i] - data.y[j];
            const horizontalSq = dx * dx + dz * dz;
            const minDistance = (radius + otherRadius) * 0.82;
            const verticalLimit = (radius + otherRadius) * 0.72;
            if (horizontalSq < minDistance * minDistance && Math.abs(dy) < verticalLimit) {
              const horizontalDistance = Math.sqrt(horizontalSq) || 0.001;
              const nx = dx / horizontalDistance;
              const nz = dz / horizontalDistance;
              const overlap = minDistance - horizontalDistance;
              const liftTarget = data.y[j] + (radius + otherRadius) * (dy < 0.1 ? 0.46 : 0.34);
              data.x[i] = clamp(data.x[i] + nx * overlap * 0.38, minX, maxX);
              data.z[i] = clamp(data.z[i] + nz * overlap * 0.38, minZ, maxZ);
              if (data.y[i] < liftTarget) {
                data.y[i] = Math.min(ceilingY, data.y[i] + (liftTarget - data.y[i]) * 0.52);
                data.vy[i] = Math.max(data.vy[i], reducedMotion ? 0.04 : 0.08);
              }
              ax += nx * overlap * (reducedMotion ? 5.8 : 9.5);
              az += nz * overlap * (reducedMotion ? 5.8 : 9.5);
              data.vx[i] *= reducedMotion ? 0.58 : 0.68;
              data.vz[i] *= reducedMotion ? 0.58 : 0.68;
              contact = true;
            }
          }

          const storedSpeed = Math.hypot(data.vx[i], data.vy[i], data.vz[i]);
          if (contact && storedSpeed < (reducedMotion ? 0.42 : 0.58)) {
            data.storedRestTime[i] += dt;
          } else {
            data.storedRestTime[i] = Math.max(0, data.storedRestTime[i] - dt * 0.8);
          }
          if (data.storedRestTime[i] > (reducedMotion ? 0.22 : 0.38)) {
            data.storedResting[i] = 1;
            data.vx[i] *= 0.34;
            data.vy[i] *= 0.18;
            data.vz[i] *= 0.34;
            data.storedAngularX[i] *= 0.18;
            data.storedAngularY[i] *= 0.18;
            data.storedAngularZ[i] *= 0.18;
          }

          data.storedProgress[i] = Math.min(1, data.storedProgress[i] + dt / (reducedMotion ? 0.78 : 0.48));
          data.storedX[i] = data.x[i];
          data.storedY[i] = data.y[i];
          data.storedZ[i] = data.z[i];
          data.storedVx[i] = data.vx[i];
          data.storedVy[i] = data.vy[i];
          data.storedVz[i] = data.vz[i];
          data.ax[i] = ax;
          data.ay[i] = ay;
          data.az[i] = az;
          data.grabIntensity[i] += (0 - data.grabIntensity[i]) * (1 - Math.exp(-dt * 1.8));
          data.grabBank[i] += (0 - data.grabBank[i]) * (1 - Math.exp(-dt * 2.2));
          data.wakeCue[i] = 0;
          continue;
        }

        let grabTargetX = data.grabX[i];
        let grabTargetY = data.grabY[i];
        let grabTargetZ = data.grabZ[i];

        if (heldStatus === HOLD_GRABBED) {
          const grabZ = clamp(data.grabZ[i], GRAB_MIN_Z, GRAB_MAX_Z);
          const grabDistance = Math.max(1, state.camera.position.z - grabZ);
          const grabViewHeight = 2 * Math.tan(fov / 2) * grabDistance;
          const grabViewWidth = grabViewHeight * aspect;
          const pointerLead = reducedMotion ? 0.024 : 0.042;
          const pointerX = clamp(interaction.x + interaction.vx * pointerLead, -1.08, 1.08);
          const pointerY = clamp(interaction.y + interaction.vy * pointerLead, -1.08, 1.08);
          const targetXNoOffset = state.camera.position.x + pointerX * grabViewWidth * 0.5;
          const targetYNoOffset = state.camera.position.y + pointerY * grabViewHeight * 0.5;
          const hoverScale = reducedMotion ? 0.28 : 1;
          const grabEase = smoothstep(0, 1, data.grabProgress[i]);
          const hoverA = Math.sin(elapsed * 0.82 + data.grabPhase[i]);
          const hoverB = Math.cos(elapsed * 0.58 + data.grabPhase[i] * 0.73);
          const firstGrabFrame = !data.grabOffsetReady[i];

          if (firstGrabFrame) {
            data.grabOffsetX[i] = clamp(xi - targetXNoOffset, -3.2, 3.2);
            data.grabOffsetY[i] = clamp(yi - targetYNoOffset, -2.2, 2.2);
            data.grabOffsetZ[i] = 0;
            data.grabOffsetReady[i] = 1;
          }

          data.grabProgress[i] = Math.min(
            1,
            data.grabProgress[i] + dt / (reducedMotion ? 0.42 : 0.32),
          );

          const offsetFade = 1 - grabEase * 0.42;
          grabTargetX = targetXNoOffset + data.grabOffsetX[i] * offsetFade + hoverB * 0.12 * hoverScale;
          grabTargetY = targetYNoOffset + data.grabOffsetY[i] * offsetFade + hoverA * 0.1 * hoverScale;
          grabTargetZ = grabZ + Math.sin(elapsed * 0.42 + data.grabPhase[i]) * 0.18 * hoverScale;
          data.grabX[i] = grabTargetX;
          data.grabY[i] = grabTargetY;
          data.grabZ[i] = grabTargetZ;

          if (isInteractionInDropZone(interaction, vessel)) {
            vessel.hovered = true;
            vessel.hoveredIndex = i;
          } else if (Number.isFinite(vessel.mouthX)) {
            const mouthDx = (grabTargetX - vessel.mouthX) / Math.max(0.1, vessel.worldRadiusX ?? 1);
            const mouthDy = (grabTargetY - vessel.mouthY) / Math.max(0.1, vessel.worldRadiusY ?? 0.7);
            const mouthDz = (grabTargetZ - vessel.mouthZ) / Math.max(0.1, vessel.worldRadiusZ ?? 1);
            if (mouthDx * mouthDx + mouthDy * mouthDy + mouthDz * mouthDz < 1.15) {
              vessel.hovered = true;
              vessel.hoveredIndex = i;
            }
          }

          if (firstGrabFrame) {
            data.grabPrevX[i] = grabTargetX;
            data.grabPrevY[i] = grabTargetY;
            data.grabPrevZ[i] = grabTargetZ;
            data.grabVelocityX[i] = 0;
            data.grabVelocityY[i] = 0;
            data.grabVelocityZ[i] = 0;
          } else {
            const invDt = 1 / Math.max(dt, 0.001);
            const rawGrabVelocityX = clamp((grabTargetX - data.grabPrevX[i]) * invDt, -42, 42);
            const rawGrabVelocityY = clamp((grabTargetY - data.grabPrevY[i]) * invDt, -34, 34);
            const rawGrabVelocityZ = clamp((grabTargetZ - data.grabPrevZ[i]) * invDt, -8, 8);
            const grabVelocityEase = 1 - Math.exp(-dt * (reducedMotion ? 5.6 : 8.8));
            data.grabVelocityX[i] += (rawGrabVelocityX - data.grabVelocityX[i]) * grabVelocityEase;
            data.grabVelocityY[i] += (rawGrabVelocityY - data.grabVelocityY[i]) * grabVelocityEase;
            data.grabVelocityZ[i] += (rawGrabVelocityZ - data.grabVelocityZ[i]) * grabVelocityEase;
            data.grabPrevX[i] = grabTargetX;
            data.grabPrevY[i] = grabTargetY;
            data.grabPrevZ[i] = grabTargetZ;
          }

          const pointerSpeed = Math.min(5.2, Math.hypot(interaction.vx, interaction.vy));
          const grabGap = Math.min(9, Math.hypot(grabTargetX - xi, grabTargetY - yi));
          const lateralSpeed = Math.min(12, Math.hypot(data.vx[i], data.vy[i]));
          const rawDragIntensity = clamp01(
            pointerSpeed * (reducedMotion ? 0.08 : 0.13) +
              grabGap * (reducedMotion ? 0.035 : 0.055) +
              lateralSpeed * (reducedMotion ? 0.018 : 0.026),
          );
          const intensityEase =
            1 - Math.exp(-dt * (rawDragIntensity > data.grabIntensity[i] ? 8.4 : 4.2));
          data.grabIntensity[i] += (rawDragIntensity - data.grabIntensity[i]) * intensityEase;

          const bankFromPointer = clamp(interaction.vx * (reducedMotion ? 0.018 : 0.032), -0.34, 0.34);
          const bankFromLag = clamp((grabTargetX - xi) * (reducedMotion ? 0.014 : 0.022), -0.28, 0.28);
          const grabBankTarget = clamp(bankFromPointer + bankFromLag, -0.42, 0.42);
          data.grabBank[i] +=
            (grabBankTarget - data.grabBank[i]) * (1 - Math.exp(-dt * (reducedMotion ? 4.2 : 6.8)));

          const spring = (reducedMotion ? 8.2 : 14.1) + grabEase * (reducedMotion ? 3.6 : 8.7);
          const damping = (reducedMotion ? 7.1 : 9.7) + grabEase * (reducedMotion ? 1.8 : 3.4);
          data.ax[i] = (grabTargetX - xi) * spring - data.vx[i] * damping;
          data.ay[i] = (grabTargetY - yi) * spring - data.vy[i] * damping;
          data.az[i] = (grabTargetZ - zi) * (spring * 0.82) - data.vz[i] * damping;
        } else {
          const releaseDuration = reducedMotion
            ? RELEASE_MOMENTUM_DURATION * 1.28
            : RELEASE_MOMENTUM_DURATION;
          data.grabReleaseProgress[i] = Math.min(
            1,
            data.grabReleaseProgress[i] + dt / releaseDuration,
          );
          const releaseT = smoothstep(0, 1, data.grabReleaseProgress[i]);
          data.grabProgress[i] = Math.max(
            0,
            data.grabProgress[i] - dt / (reducedMotion ? 0.92 : 0.68),
          );
          data.grabIntensity[i] += (0 - data.grabIntensity[i]) * (1 - Math.exp(-dt * 1.9));
          data.grabBank[i] += (0 - data.grabBank[i]) * (1 - Math.exp(-dt * 2.4));

          const airDrag = (reducedMotion ? 0.11 : 0.075) * (0.65 + releaseT * 0.45);
          const forwardTarget =
            data.cruise[i] * (0.72 + data.grabIntensity[i] * (reducedMotion ? 0.14 : 0.28));
          data.ax[i] = -data.vx[i] * airDrag;
          data.ay[i] =
            -data.vy[i] * airDrag * 1.1 +
            Math.sin(elapsed * 0.42 + data.grabPhase[i]) * data.grabIntensity[i] * (reducedMotion ? 0.025 : 0.055);
          data.az[i] =
            (forwardTarget - data.vz[i]) * (reducedMotion ? 0.1 : 0.15) -
            Math.max(0, data.vz[i] - forwardTarget * 1.55) * 0.05;

          if (
            data.grabReleaseProgress[i] >= 1 ||
            data.grabAge[i] > releaseDuration + (reducedMotion ? 0.2 : 0.12)
          ) {
            data.held[i] = HOLD_NONE;
            data.grabAge[i] = 0;
            data.grabPointerId[i] = -1;
            data.grabOffsetReady[i] = 0;
            data.exitState[i] = 0;
            data.offscreenTime[i] = 0;
            data.vz[i] = Math.max(data.vz[i], data.cruise[i] * 0.64);
          }
        }

        data.wakeCue[i] = Math.sin(elapsed * 0.5 + data.grabPhase[i]) * 0.18;
        continue;
      }

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
        if (data.held[j] !== HOLD_NONE) continue;

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
      const heldStatus = data.held[i];
      data.vx[i] += data.ax[i] * dt;
      data.vy[i] += data.ay[i] * dt;
      data.vz[i] += data.az[i] * dt;

      const capExitT =
        heldStatus === HOLD_NONE && data.exitState[i] > 0
          ? smoothstep(EXIT_START_Z, CAMERA_Z - 1, data.z[i])
          : 0;
      const maxSpeed =
        heldStatus === HOLD_GRABBED
          ? reducedMotion
            ? 24
            : 38
          : heldStatus === HOLD_STORED
            ? reducedMotion
              ? 2.8
              : 4.8
          : heldStatus === HOLD_RELEASING
            ? reducedMotion
              ? 13.2
              : 22
            : (hero ? 11.4 : mid ? 17.2 : 12.4) *
              (1 + capExitT * (reducedMotion ? 0.12 : hero ? 0.42 : 0.28));
      const speed = Math.hypot(data.vx[i], data.vy[i], data.vz[i]);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        data.vx[i] *= scale;
        data.vy[i] *= scale;
        data.vz[i] *= scale;
      }
      if (heldStatus === HOLD_NONE && data.vz[i] < data.cruise[i] * 0.52) {
        data.vz[i] += (data.cruise[i] * 0.52 - data.vz[i]) * 0.18;
      }

      data.x[i] += data.vx[i] * dt;
      data.y[i] += data.vy[i] * dt;
      data.z[i] += data.vz[i] * dt;

      let shouldReset = false;
      if (heldStatus === HOLD_NONE && data.exitState[i] > 0) {
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
      } else if (heldStatus === HOLD_NONE && data.z[i] > EXIT_RESET_Z) {
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
        heldStatus === HOLD_NONE && data.exitState[i] === 2
          ? smoothstep(EXIT_COMMIT_Z, CAMERA_Z - 2, data.z[i])
          : 0;
      const holdVisual =
        heldStatus === HOLD_GRABBED
          ? smoothstep(0, 1, data.grabProgress[i])
          : heldStatus === HOLD_RELEASING
            ? smoothstep(0, 1, data.grabProgress[i]) * 0.75
            : 0;
      const storedVisual = heldStatus === HOLD_STORED ? smoothstep(0, 1, data.storedProgress[i]) : 0;
      const activeGrab = heldStatus === HOLD_GRABBED ? holdVisual : 0;
      const releaseVisual = heldStatus === HOLD_RELEASING ? holdVisual : 0;
      const motionVisual = activeGrab + releaseVisual * 0.82;
      const dragIntensity = motionVisual * data.grabIntensity[i];
      const dragBank = motionVisual * data.grabBank[i];
      const exitBankTarget =
        heldStatus === HOLD_NONE && data.exitState[i] > 0
          ? clamp(data.exitX[i] * (hero ? 0.58 : 0.44) - data.exitY[i] * 0.08, -0.82, 0.82) *
            exitT
          : 0;
      const wakeEase = 1 - Math.exp(-dt * (Math.abs(data.wakeCue[i]) > 0.001 ? 8.2 : 2.4));
      data.wakeRoll[i] += (data.wakeCue[i] - data.wakeRoll[i]) * wakeEase;
      const holdIdleRoll =
        holdVisual * Math.sin(elapsed * 0.56 + data.grabPhase[i]) * (reducedMotion ? 0.045 : 0.11);
      const dragFollowRoll = dragBank + dragIntensity * Math.sin(elapsed * 1.18 + data.grabPhase[i]) * (reducedMotion ? 0.025 : 0.06);
      const bankTarget = clamp(
        -data.vx[i] * (hero ? 0.086 : 0.075) -
          data.ax[i] * 0.014 +
          data.wakeRoll[i] * 0.34 +
          exitBankTarget +
          holdIdleRoll +
          dragFollowRoll,
        hero ? -0.92 : -0.74,
        hero ? 0.92 : 0.74,
      );
      data.roll[i] += (bankTarget - data.roll[i]) * (1 - Math.exp(-dt * (hero ? 4.4 : 3.6)));

      const phase = data.phase[i];
      const turbulence = Math.sin(elapsed * 0.62 + data.noise[i] + data.x[i] * 0.035) * 0.16;
      const flapRate =
        data.flapSpeed[i] *
        (0.7 + speedAfter * (hero ? 0.05 : 0.038) + Math.abs(data.roll[i]) * 0.16) *
        (1 - exitCommitVisual * (hero ? 0.16 : 0.07)) *
        (1 - holdVisual * (reducedMotion ? 0.18 : 0.3)) *
        (1 + motionVisual * (reducedMotion ? 0.16 : 0.72) * (0.25 + dragIntensity));
      const wingCycle = elapsed * flapRate * (1 / TAU) + phase * (1 / TAU) + turbulence * 0.035;
      const wingPose = wingbeatCurve(wingCycle);
      const bodyPose = wingbeatCurve(wingCycle - (hero ? 0.055 : 0.04));
      const neckPose = wingbeatCurve(wingCycle - (hero ? 0.1 : 0.075));
      const tailPose = wingbeatCurve(wingCycle - (hero ? 0.13 : 0.1));
      const slowSway = Math.sin(elapsed * 0.31 + phase) * (hero ? 0.024 : 0.018);
      const flockWingAmp =
        (reducedMotion ? 0.08 : hero ? 0.45 : mid ? 0.38 : 0.26) *
        (0.9 +
          speedAfter * 0.018 +
          Math.abs(data.wakeRoll[i]) * 0.12 +
          exitCommitVisual * (hero ? 0.22 : 0.12));
      const heldWingAmp =
        (reducedMotion ? 0.055 : 0.19) *
        (1 + dragIntensity * (reducedMotion ? 0.45 : 1.65)) *
        (1 + Math.sin(elapsed * 0.37 + data.grabPhase[i]) * 0.12);
      const storedRestVisual = heldStatus === HOLD_STORED && data.storedResting[i] === 1 ? 1 : 0;
      const storedWingAmp =
        (reducedMotion ? 0.01 : 0.026) *
        (1 - storedRestVisual * 0.55) *
        (1 + Math.sin(elapsed * 0.36 + data.grabPhase[i]) * 0.14);
      let wingAmp = flockWingAmp * (1 - holdVisual) + heldWingAmp * holdVisual;
      wingAmp = wingAmp * (1 - storedVisual) + storedWingAmp * storedVisual;
      const wingLift = (reducedMotion ? 0.08 : hero ? 0.15 : 0.13) + wingPose * wingAmp;
      const dragWingAsymmetry = dragBank * (reducedMotion ? 0.14 : 0.24);
      const bankAsymmetry = data.roll[i] * (hero ? 0.3 : 0.24) + data.wakeRoll[i] * 0.08 + dragWingAsymmetry;
      const leftLift = wingLift - bankAsymmetry;
      const rightLift = wingLift + bankAsymmetry;
      let bodyFloat =
        -bodyPose * (hero ? 0.038 : 0.026) +
        slowSway * 0.4 +
        holdVisual * Math.sin(elapsed * 0.5 + data.grabPhase[i]) * (reducedMotion ? 0.018 : 0.04) +
        dragIntensity * -bodyPose * (reducedMotion ? 0.018 : 0.045);
      bodyFloat +=
        storedVisual *
        (1 - storedRestVisual * 0.75) *
        Math.sin(elapsed * 0.46 + data.grabPhase[i]) *
        (reducedMotion ? 0.003 : 0.008);
      const heldTargetSize = Math.max(data.size[i], hero ? 0.92 : 0.7);
      const storedTargetSize = data.storedSize[i] > 0 ? data.storedSize[i] : data.size[i] * 0.42;
      let displaySize = data.size[i] + (heldTargetSize - data.size[i]) * holdVisual;
      displaySize = displaySize * (1 - storedVisual) + storedTargetSize * storedVisual;
      const scale = displaySize * (1 - bodyPose * (hero ? 0.018 : 0.012));
      const exitPitch =
        heldStatus === HOLD_NONE && data.exitState[i] > 0
          ? exitCommitVisual * (-0.08 + clamp(data.exitY[i], -1, 1) * 0.045) * (hero ? 1.2 : 0.8)
          : 0;
      const holdPitch =
        holdVisual * Math.sin(elapsed * 0.44 + data.grabPhase[i] * 0.7) * (reducedMotion ? 0.018 : 0.04);
      const dragPitch =
        motionVisual *
        clamp(
          -data.vy[i] * (reducedMotion ? 0.006 : 0.011) - data.ay[i] * (reducedMotion ? 0.0015 : 0.003),
          reducedMotion ? -0.04 : -0.095,
          reducedMotion ? 0.04 : 0.095,
        );
      const neckFollow = dragIntensity * (reducedMotion ? 0.035 : 0.075);
      const tailFollow = dragIntensity * (reducedMotion ? 0.045 : 0.11);
      let renderX = data.x[i];
      let renderY = data.y[i];
      const normalPitch =
        pitch * (1 - holdVisual * 0.62) +
        slowSway -
        wingLift * 0.03 -
        bodyPose * 0.018 +
        exitPitch +
        holdPitch +
        dragPitch;
      const normalYaw = yaw * (1 - holdVisual * 0.62);
      const normalRoll =
        data.roll[i] + wingPose * (hero ? 0.025 : 0.018) + exitCommitVisual * data.exitX[i] * 0.05;
      const storedWobble =
        (1 - storedRestVisual * 0.8) *
        Math.sin(elapsed * 0.4 + data.grabPhase[i]) *
        (reducedMotion ? 0.004 : 0.014);
      const storedPitch = data.storedPitch[i] + storedWobble;
      const storedYaw = data.storedYaw[i];
      const storedRoll =
        data.storedRoll[i] +
        (1 - storedRestVisual * 0.8) *
          Math.sin(elapsed * 0.32 + data.grabPhase[i]) *
          (reducedMotion ? 0.004 : 0.012);

      baseObject.position.set(renderX, renderY, data.z[i]);
      baseObject.rotation.set(
        normalPitch * (1 - storedVisual) + storedPitch * storedVisual,
        normalYaw * (1 - storedVisual) + storedYaw * storedVisual,
        normalRoll * (1 - storedVisual) + storedRoll * storedVisual,
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
        -0.04 - bodyPose * 0.018 - dragPitch * 0.18,
        -0.035 - data.roll[i] * 0.035 - dragBank * 0.08,
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
        -0.04 - bodyPose * 0.018 - dragPitch * 0.18,
        0.035 - data.roll[i] * 0.035 - dragBank * 0.08,
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
        0.09 + neckPose * 0.04 - pitch * 0.06 - dragPitch * 0.32 + neckFollow,
        data.roll[i] * -0.08 + data.wakeRoll[i] * 0.035 - dragBank * 0.22,
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
        -0.075 - tailPose * 0.052 + pitch * 0.05 + dragPitch * 0.44 - tailFollow,
        data.roll[i] * 0.06 - data.wakeRoll[i] * 0.03 + dragBank * 0.24,
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
      <instancedMesh
        ref={bodyRef}
        args={[geometries.body, undefined, count]}
        frustumCulled={false}
        onPointerDown={handleCranePointerDown}
        onPointerMove={handleCranePointerMove}
        onPointerUp={handleCranePointerRelease}
        onPointerCancel={handleCranePointerRelease}
        onLostPointerCapture={handleCranePointerRelease}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={leftWingRef}
        args={[geometries.leftWing, undefined, count]}
        frustumCulled={false}
        onPointerDown={handleCranePointerDown}
        onPointerMove={handleCranePointerMove}
        onPointerUp={handleCranePointerRelease}
        onPointerCancel={handleCranePointerRelease}
        onLostPointerCapture={handleCranePointerRelease}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={rightWingRef}
        args={[geometries.rightWing, undefined, count]}
        frustumCulled={false}
        onPointerDown={handleCranePointerDown}
        onPointerMove={handleCranePointerMove}
        onPointerUp={handleCranePointerRelease}
        onPointerCancel={handleCranePointerRelease}
        onLostPointerCapture={handleCranePointerRelease}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={neckRef}
        args={[geometries.neck, undefined, count]}
        frustumCulled={false}
        onPointerDown={handleCranePointerDown}
        onPointerMove={handleCranePointerMove}
        onPointerUp={handleCranePointerRelease}
        onPointerCancel={handleCranePointerRelease}
        onLostPointerCapture={handleCranePointerRelease}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
      <instancedMesh
        ref={tailRef}
        args={[geometries.tail, undefined, count]}
        frustumCulled={false}
        onPointerDown={handleCranePointerDown}
        onPointerMove={handleCranePointerMove}
        onPointerUp={handleCranePointerRelease}
        onPointerCancel={handleCranePointerRelease}
        onLostPointerCapture={handleCranePointerRelease}
      >
        <meshStandardMaterial {...paperMaterialProps} />
      </instancedMesh>
    </>
  );
}

function SkyBackdrop({ skyStyle }) {
  const texture = useMemo(() => createSkyTexture(skyStyle), [skyStyle]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return (
    <mesh position={[0, 0, FAR_Z + 18]} renderOrder={-100} raycast={nullRaycast}>
      <planeGeometry args={[520, 330]} />
      <meshBasicMaterial map={texture} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

function SkyCloudLayer({ skyStyle, reducedMotion, layer }) {
  const meshRef = useRef();
  const { camera, size } = useThree();
  const texture = useMemo(() => createCloudTexture(layer + 7), [layer]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !texture) return;

    const elapsed = clock.getElapsedTime();
    const z = layer === 0 ? FAR_Z + 54 : layer === 1 ? FAR_Z + 38 : FAR_Z + 22;
    const distanceToCamera = camera.position.z - z;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
    const viewWidth = viewHeight * (size.width / size.height);
    const layerConfig = [
      { x: -0.2, y: 0.28, width: 0.88, height: 0.24, speed: 0.0012, opacity: 0.58, rotation: -0.025 },
      { x: 0.18, y: 0.08, width: 0.78, height: 0.29, speed: -0.0018, opacity: 0.88, rotation: 0.03 },
      { x: 0.04, y: -0.18, width: 0.92, height: 0.34, speed: 0.0024, opacity: 0.56, rotation: -0.012 },
    ][layer];
    const motionScale = reducedMotion ? 0.16 : 1;

    texture.offset.x = wrap01(texture.offset.x + delta * layerConfig.speed * motionScale);
    texture.offset.y = 0.02 * Math.sin(elapsed * 0.012 + layer);
    meshRef.current.position.set(
      camera.position.x + layerConfig.x * viewWidth * 0.5 + Math.sin(elapsed * 0.025 + layer) * 0.8 * motionScale,
      camera.position.y + layerConfig.y * viewHeight * 0.5,
      z,
    );
    meshRef.current.rotation.z = layerConfig.rotation + Math.sin(elapsed * 0.016 + layer) * 0.006 * motionScale;
    meshRef.current.scale.set(viewWidth * layerConfig.width, viewHeight * layerConfig.height, 1);
    meshRef.current.material.opacity =
      skyStyle.cloudOpacity * layerConfig.opacity * (1 + Math.sin(elapsed * 0.02 + layer) * 0.04 * motionScale);
    meshRef.current.material.color.set(skyStyle.cloudColor);
  });

  return (
    <mesh ref={meshRef} raycast={nullRaycast} renderOrder={-80}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        color={skyStyle.cloudColor}
        transparent
        opacity={0.2}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function SkySun({ skyStyle, reducedMotion }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const diskRef = useRef();
  const { camera, size } = useThree();
  const glowTexture = useMemo(() => createRadialGlowTexture('rgba(255,226,151,0.76)'), []);

  useEffect(
    () => () => {
      glowTexture?.dispose();
    },
    [glowTexture],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const elapsed = clock.getElapsedTime();
    const aspect = size.width / size.height;
    const z = FAR_Z + 38;
    const distanceToCamera = camera.position.z - z;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
    const viewWidth = viewHeight * aspect;
    const floatY = reducedMotion ? 0 : Math.sin(elapsed * 0.014) * 0.22;

    groupRef.current.position.set(
      camera.position.x + skyStyle.sunPosition.x * viewWidth * 0.5,
      camera.position.y + skyStyle.sunPosition.y * viewHeight * 0.5 + floatY,
      z,
    );

    if (diskRef.current) diskRef.current.scale.setScalar(4.15);
    if (glowRef.current) glowRef.current.scale.setScalar(21);
    if (diskRef.current?.material) {
      diskRef.current.material.opacity = 0.95 * skyStyle.sunVisibility;
      diskRef.current.material.color.set(skyStyle.sun);
    }
    if (glowRef.current?.material) {
      glowRef.current.material.opacity = 0.68 * skyStyle.sunVisibility;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-70}>
      <mesh ref={glowRef} raycast={nullRaycast}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={diskRef} raycast={nullRaycast}>
        <circleGeometry args={[0.5, 64]} />
        <meshBasicMaterial
          color={skyStyle.sun}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SkyMoon({ skyStyle, reducedMotion }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const baseRef = useRef();
  const diskRef = useRef();
  const { camera, size } = useThree();
  const glowTexture = useMemo(() => createRadialGlowTexture('rgba(198,221,255,0.62)'), []);
  const moonTexture = useMemo(() => createMoonTexture(), []);

  useEffect(
    () => () => {
      glowTexture?.dispose();
      moonTexture?.dispose();
    },
    [glowTexture, moonTexture],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const elapsed = clock.getElapsedTime();
    const z = FAR_Z + 36;
    const distanceToCamera = camera.position.z - z;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
    const viewWidth = viewHeight * (size.width / size.height);
    const floatY = reducedMotion ? 0 : Math.sin(elapsed * 0.012 + 1.4) * 0.18;

    groupRef.current.position.set(
      camera.position.x + skyStyle.moonPosition.x * viewWidth * 0.5,
      camera.position.y + skyStyle.moonPosition.y * viewHeight * 0.5 + floatY,
      z,
    );
    if (baseRef.current) baseRef.current.scale.setScalar(3.35);
    if (diskRef.current) diskRef.current.scale.setScalar(3.32);
    if (glowRef.current) glowRef.current.scale.setScalar(14.5);
    if (baseRef.current?.material) {
      baseRef.current.material.opacity = 0.96 * skyStyle.moonVisibility;
    }
    if (diskRef.current?.material) {
      diskRef.current.material.opacity = 0.42 * skyStyle.moonVisibility;
    }
    if (glowRef.current?.material) {
      glowRef.current.material.opacity = 0.68 * skyStyle.moonVisibility;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-69}>
      <mesh ref={glowRef} raycast={nullRaycast}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={baseRef} raycast={nullRaycast}>
        <circleGeometry args={[0.5, 72]} />
        <meshBasicMaterial
          color="#f3f7ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={diskRef} raycast={nullRaycast}>
        <circleGeometry args={[0.5, 72]} />
        <meshBasicMaterial
          map={moonTexture}
          color="#edf5ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SkyStarField({ count, reducedMotion, skyStyle }) {
  const tinyRef = useRef();
  const mediumRef = useRef();
  const brightRef = useRef();
  const tinyGeometry = useMemo(() => createStarGeometry(Math.max(80, Math.floor(count * 0.68)), 17, 1.05), [count]);
  const mediumGeometry = useMemo(() => createStarGeometry(Math.max(24, Math.floor(count * 0.23)), 41, 0.9), [count]);
  const brightGeometry = useMemo(() => createStarGeometry(Math.max(8, Math.floor(count * 0.07)), 83, 0.76), [count]);

  useEffect(
    () => () => {
      tinyGeometry.dispose();
      mediumGeometry.dispose();
      brightGeometry.dispose();
    },
    [tinyGeometry, mediumGeometry, brightGeometry],
  );

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const twinkle = reducedMotion ? 1 : 0.88 + Math.sin(elapsed * 0.9) * 0.12;
    const opacity = skyStyle.starOpacity * twinkle;
    if (!reducedMotion) {
      if (tinyRef.current) tinyRef.current.rotation.z += delta * 0.0016;
      if (mediumRef.current) mediumRef.current.rotation.z -= delta * 0.0011;
      if (brightRef.current) brightRef.current.rotation.z += delta * 0.0007;
    }
    if (tinyRef.current?.material) tinyRef.current.material.opacity = opacity * 0.55;
    if (mediumRef.current?.material) mediumRef.current.material.opacity = opacity * 0.78;
    if (brightRef.current?.material) brightRef.current.material.opacity = opacity;
  });

  return (
    <>
      <points ref={tinyRef} geometry={tinyGeometry} frustumCulled={false} raycast={nullRaycast} renderOrder={-90}>
        <pointsMaterial
          size={0.045}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={mediumRef} geometry={mediumGeometry} frustumCulled={false} raycast={nullRaycast} renderOrder={-89}>
        <pointsMaterial
          size={0.085}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={brightRef} geometry={brightGeometry} frustumCulled={false} raycast={nullRaycast} renderOrder={-88}>
      <pointsMaterial
        size={0.14}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
      </points>
    </>
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
    <mesh ref={ringRef} visible={false} raycast={nullRaycast}>
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

function GlassDisplayBox({ depositRef, reducedMotion }) {
  const groupRef = useRef();
  const frontTopEdgeRef = useRef();
  const backTopEdgeRef = useRef();
  const leftTopEdgeRef = useRef();
  const rightTopEdgeRef = useRef();
  const frontPanelRef = useRef();
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const aspect = size.width / size.height;
    const mobile = size.width < 720;
    const z = mobile ? 4.65 : 3.65;
    const distanceToCamera = camera.position.z - z;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const viewHeight = 2 * Math.tan(fov / 2) * distanceToCamera;
    const viewWidth = viewHeight * aspect;
    const scale = mobile ? 2.15 : 3.05;
    const x = camera.position.x + (mobile ? 0.44 : 0.72) * viewWidth * 0.5;
    const y = camera.position.y - (mobile ? 0.75 : 0.72) * viewHeight * 0.5;
    const vessel = depositRef.current;
    const halfWidth = 1.04 * scale;
    const halfHeight = 0.58 * scale;
    const halfDepth = 0.54 * scale;

    groupRef.current.position.set(x, y, z);
    groupRef.current.scale.setScalar(scale);
    groupRef.current.rotation.set(0.012, -0.08, 0);

    vessel.centerX = x;
    vessel.centerY = y;
    vessel.centerZ = z;
    vessel.scale = scale;
    vessel.mouthX = x;
    vessel.mouthY = y + halfHeight;
    vessel.mouthZ = z + halfDepth * 0.18;
    vessel.topY = y + halfHeight;
    vessel.bottomY = y - halfHeight;
    vessel.boxMinX = x - halfWidth * 0.9;
    vessel.boxMaxX = x + halfWidth * 0.9;
    vessel.boxMinY = y - halfHeight;
    vessel.boxMaxY = y + halfHeight;
    vessel.boxMinZ = z - halfDepth * 0.86;
    vessel.boxMaxZ = z + halfDepth * 0.82;
    vessel.worldRadiusX = halfWidth;
    vessel.worldRadiusY = halfHeight * 0.46;
    vessel.worldRadiusZ = halfDepth;

    const mouthDistance = camera.position.z - vessel.mouthZ;
    const mouthViewHeight = 2 * Math.tan(fov / 2) * mouthDistance;
    const mouthViewWidth = mouthViewHeight * aspect;
    vessel.dropX = (vessel.mouthX - camera.position.x) / (mouthViewWidth * 0.5);
    vessel.dropY = (vessel.mouthY - camera.position.y) / (mouthViewHeight * 0.5);
    vessel.radiusX = mobile ? 0.43 : 0.37;
    vessel.radiusY = mobile ? 0.18 : 0.17;
    vessel.pulse = Math.max(0, (vessel.pulse ?? 0) - delta * (reducedMotion ? 1.15 : 1.7));

    const glow = vessel.hovered ? 1 : vessel.pulse;
    const edgeOpacity = 0.58 + glow * 0.3;
    const edgeEmission = 0.14 + glow * 0.72;
    const updateEdge = (mesh) => {
      if (!mesh?.material) return;
      mesh.material.opacity = edgeOpacity;
      mesh.material.emissiveIntensity = edgeEmission;
    };
    updateEdge(frontTopEdgeRef.current);
    updateEdge(backTopEdgeRef.current);
    updateEdge(leftTopEdgeRef.current);
    updateEdge(rightTopEdgeRef.current);
    if (frontPanelRef.current?.material) {
      frontPanelRef.current.material.opacity = 0.055 + glow * 0.035;
    }
  });

  const panelMaterial = (
    <meshPhysicalMaterial
      color="#d8f6ff"
      transparent
      opacity={0.2}
      roughness={0.025}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.03}
      transmission={0.42}
      thickness={0.28}
      ior={1.45}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
  const edgeMaterial = (
    <meshStandardMaterial
      color="#f6fdff"
      emissive="#9defff"
      emissiveIntensity={0.14}
      transparent
      opacity={0.58}
      roughness={0.04}
      metalness={0}
      depthWrite={false}
    />
  );
  const backEdgeMaterial = (
    <meshStandardMaterial
      color="#d9f6ff"
      emissive="#8edff2"
      emissiveIntensity={0.08}
      transparent
      opacity={0.34}
      roughness={0.06}
      metalness={0}
      depthWrite={false}
    />
  );

  return (
    <group ref={groupRef} renderOrder={7}>
      <mesh position={[0, 0, 0.57]} raycast={nullRaycast}>
        <boxGeometry args={[2.1, 1.16, 0.035]} />
        {panelMaterial}
      </mesh>
      <mesh ref={frontPanelRef} position={[0, 0, 0.61]} raycast={nullRaycast}>
        <boxGeometry args={[2.08, 1.1, 0.012]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.055} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0, -0.57]} raycast={nullRaycast}>
        <boxGeometry args={[2.1, 1.16, 0.035]} />
        <meshPhysicalMaterial
          color="#c8efff"
          transparent
          opacity={0.13}
          roughness={0.03}
          metalness={0}
          clearcoat={1}
          transmission={0.3}
          thickness={0.18}
          ior={1.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-1.05, 0, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.035, 1.16, 1.14]} />
        {panelMaterial}
      </mesh>
      <mesh position={[1.05, 0, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.035, 1.16, 1.14]} />
        {panelMaterial}
      </mesh>
      <mesh position={[0, -0.58, 0]} raycast={nullRaycast}>
        <boxGeometry args={[2.12, 0.045, 1.16]} />
        <meshPhysicalMaterial
          color="#d7f5ff"
          transparent
          opacity={0.24}
          roughness={0.025}
          metalness={0}
          clearcoat={1}
          transmission={0.36}
          thickness={0.18}
          ior={1.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={frontTopEdgeRef} position={[0, 0.6, 0.6]} raycast={nullRaycast}>
        <boxGeometry args={[2.18, 0.04, 0.05]} />
        {edgeMaterial}
      </mesh>
      <mesh ref={backTopEdgeRef} position={[0, 0.6, -0.6]} raycast={nullRaycast}>
        <boxGeometry args={[2.18, 0.036, 0.044]} />
        {backEdgeMaterial}
      </mesh>
      <mesh ref={leftTopEdgeRef} position={[-1.08, 0.6, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.05, 0.04, 1.2]} />
        {edgeMaterial}
      </mesh>
      <mesh ref={rightTopEdgeRef} position={[1.08, 0.6, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.05, 0.04, 1.2]} />
        {edgeMaterial}
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}-${sz}`} position={[sx * 1.08, 0, sz * 0.6]} raycast={nullRaycast}>
            <boxGeometry args={[0.045, 1.2, 0.045]} />
            {sx === 1 && sz === 1 ? edgeMaterial : backEdgeMaterial}
          </mesh>
        )),
      )}
      <mesh position={[0, -0.61, 0.6]} raycast={nullRaycast}>
        <boxGeometry args={[2.18, 0.045, 0.05]} />
        {edgeMaterial}
      </mesh>
      <mesh position={[0, -0.61, -0.6]} raycast={nullRaycast}>
        <boxGeometry args={[2.18, 0.04, 0.045]} />
        {backEdgeMaterial}
      </mesh>
      <mesh position={[-1.08, -0.61, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.05, 0.045, 1.2]} />
        {backEdgeMaterial}
      </mesh>
      <mesh position={[1.08, -0.61, 0]} raycast={nullRaycast}>
        <boxGeometry args={[0.05, 0.045, 1.2]} />
        {edgeMaterial}
      </mesh>

      <mesh position={[-0.52, 0.04, 0.63]} rotation={[0, 0, -0.16]} raycast={nullRaycast}>
        <boxGeometry args={[0.035, 0.82, 0.012]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0.62, -0.08, 0.63]} rotation={[0, 0, -0.16]} raycast={nullRaycast}>
        <boxGeometry args={[0.024, 0.58, 0.012]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, -0.46, 0.63]} raycast={nullRaycast}>
        <boxGeometry args={[1.42, 0.018, 0.012]} />
        <meshBasicMaterial color="#d9faff" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Scene({ tier, interactionRef, depositRef, pickingRef, onDeposit, sky }) {
  const skyStyle = sky.skyStyle;

  return (
    <>
      <color attach="background" args={[skyStyle.horizon]} />
      <fog attach="fog" args={[skyStyle.fog, skyStyle.key === 'night' ? 24 : 32, skyStyle.key === 'night' ? 140 : 162]} />

      <ambientLight intensity={skyStyle.ambient} />
      <hemisphereLight args={[skyStyle.hemiSky, skyStyle.hemiGround, skyStyle.hemiIntensity]} />
      <directionalLight
        position={[skyStyle.sunPosition.x * 12, 5 + skyStyle.sunPosition.y * 10, 12]}
        intensity={skyStyle.sunIntensity}
        color={skyStyle.sun}
      />
      <directionalLight position={[-7, 2, -12]} intensity={skyStyle.rimIntensity} color={skyStyle.rim} />
      <pointLight position={[-9, -3, 12]} intensity={0.55 + (1 - skyStyle.night) * 0.55} color="#ffffff" distance={46} />
      <pointLight position={[10, 7, -24]} intensity={0.42 + skyStyle.moonVisibility * 0.5} color={skyStyle.rim} distance={76} />

      <CameraRig interactionRef={interactionRef} reducedMotion={tier.reducedMotion} />
      <SkyBackdrop skyStyle={skyStyle} />
      <SkySun skyStyle={skyStyle} reducedMotion={tier.reducedMotion} />
      <SkyMoon skyStyle={skyStyle} reducedMotion={tier.reducedMotion} />
      <SkyCloudLayer skyStyle={skyStyle} reducedMotion={tier.reducedMotion} layer={0} />
      <SkyCloudLayer skyStyle={skyStyle} reducedMotion={tier.reducedMotion} layer={1} />
      <SkyCloudLayer skyStyle={skyStyle} reducedMotion={tier.reducedMotion} layer={2} />
      <SkyStarField count={tier.particles} reducedMotion={tier.reducedMotion} skyStyle={skyStyle} />
      <GlassDisplayBox depositRef={depositRef} reducedMotion={tier.reducedMotion} />
      <CraneField
        count={tier.cranes}
        reducedMotion={tier.reducedMotion}
        interactionRef={interactionRef}
        depositRef={depositRef}
        pickingRef={pickingRef}
        onDeposit={onDeposit}
      />
      <BurstEcho interactionRef={interactionRef} />
    </>
  );
}

function ClockDisplay({ clock }) {
  return (
    <div className="gmt-clock" aria-label="Date and time in GMT plus seven">
      <span className="clock-zone">GMT+7</span>
      <time dateTime={`${clock.dateLabel} ${clock.timeLabel}`}>
        <span>{clock.timeLabel}</span>
        <span>{clock.dateLabel}</span>
      </time>
    </div>
  );
}

function PaperNote({ note, onClose }) {
  useEffect(() => {
    if (!note) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [note, onClose]);

  if (!note) return null;

  const colorConfig = getCraneColorConfig(Number(note.colorType));

  return (
    <div className="note-backdrop" role="presentation" onPointerDown={onClose}>
      <article
        className={`paper-note ${colorConfig.noteClass}`}
        aria-label="Deposited crane message"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button className="note-close" type="button" aria-label="Close note" onClick={onClose}>
          x
        </button>
        <div className="note-folds" aria-hidden="true" />
        <p className="note-meta">
          {note.colorLabel} crane - {note.depositedAtGMT7Display}
        </p>
        <p className="note-message">{note.message}</p>
      </article>
    </div>
  );
}

function HistorySidebar({ open, history, onClose, onClear }) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const groups = useMemo(
    () =>
      CRANE_COLOR_CONFIG.map((config) => ({
        config,
        items: history.filter((entry) => Number(entry.colorType) === config.type),
      })),
    [history],
  );

  return (
    <>
      <div
        className={`sidebar-scrim ${open ? 'is-open' : ''}`}
        aria-hidden="true"
        onPointerDown={onClose}
      />
      <aside className={`history-sidebar ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-header">
          <div>
            <p className="sidebar-kicker">Wish vessel</p>
            <h2>History</h2>
          </div>
          <button className="sidebar-close" type="button" aria-label="Close history" onClick={onClose}>
            x
          </button>
        </div>

        {history.length > 0 ? (
          <button className="history-clear" type="button" onClick={onClear}>
            Clear history
          </button>
        ) : null}

        <div className="history-groups">
          {groups.map(({ config, items }) => (
            <section className="history-group" key={config.key}>
              <header>
                <span className={`history-swatch swatch-${config.key}`} aria-hidden="true" />
                <span>{config.label}</span>
                <span>{items.length}</span>
              </header>
              {items.length > 0 ? (
                items.map((entry) => (
                  <article className="history-item" key={entry.id}>
                    <p>{entry.message}</p>
                    <time dateTime={entry.depositedAtISO}>{entry.depositedAtGMT7Display}</time>
                  </article>
                ))
              ) : (
                <p className="history-empty">No wishes yet.</p>
              )}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const tier = usePerformanceTier();
  const clock = useGMT7Clock();
  const depositRef = useRef({
    hovered: false,
    hoveredIndex: -1,
    nextSlot: 0,
    pulse: 0,
    centerX: 8.4,
    centerY: -5.5,
    centerZ: 3.8,
    mouthX: 8.4,
    mouthY: -4.5,
    mouthZ: 3.8,
    topY: -4.5,
    bottomY: -6.5,
    boxMinX: 7.1,
    boxMaxX: 9.7,
    boxMinY: -6.5,
    boxMaxY: -4.5,
    boxMinZ: 2.9,
    boxMaxZ: 4.7,
    dropX: 0.65,
    dropY: -0.62,
    radiusX: 0.16,
    radiusY: 0.12,
    worldRadiusX: 1.4,
    worldRadiusY: 0.7,
    worldRadiusZ: 1.2,
    scale: 1.7,
  });
  const [historyEntries, setHistoryEntries] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pickingRef = useRef({
    pickCraneFromPointer: null,
  });
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
    suppressBurstUntil: -100,
    isGrabbing: false,
    grabbedIndex: -1,
    grabbedPointerId: -1,
    grabReleaseRequested: false,
  });

  useEffect(() => {
    setHistoryEntries(historyStorage.list());
  }, []);

  const handleDeposit = useCallback((payload) => {
    const entry = createHistoryEntry(payload);
    setHistoryEntries(historyStorage.add(entry));
    setActiveNote(entry);
  }, []);

  const closeNote = useCallback(() => {
    setActiveNote(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryEntries(historyStorage.clear());
  }, []);

  const updateInteraction = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const now = performance.now() / 1000;
    const interaction = interactionRef.current;
    const grabbingThisPointer =
      interaction.isGrabbing &&
      (interaction.grabbedPointerId < 0 || event.pointerId === interaction.grabbedPointerId);
    if (interaction.isGrabbing && !grabbingThisPointer) return;

    const hasRecentMove = (grabbingThisPointer || interaction.active) && now - interaction.lastMove < 0.18;
    if (hasRecentMove) {
      const dt = clamp(now - interaction.lastMove, 0.016, 0.12);
      interaction.vx += ((x - interaction.x) / dt - interaction.vx) * 0.36;
      interaction.vy += ((y - interaction.y) / dt - interaction.vy) * 0.36;
    } else {
      interaction.vx = 0;
      interaction.vy = 0;
    }
    interaction.active = !grabbingThisPointer;
    interaction.x = x;
    interaction.y = y;
    interaction.lastMove = now;
  }, []);

  const triggerBurst = useCallback(
    (event) => {
      if (interactionRef.current.isGrabbing) {
        updateInteraction(event);
        return;
      }

      if (pickingRef.current.pickCraneFromPointer?.(event)) {
        return;
      }

      updateInteraction(event);
      requestAnimationFrame(() => {
        const interaction = interactionRef.current;
        const now = performance.now() / 1000;
        if (interaction.isGrabbing || now < interaction.suppressBurstUntil) return;

        interaction.burstX = interaction.x;
        interaction.burstY = interaction.y;
        interaction.burstTime = now;
      });
    },
    [updateInteraction],
  );

  const releaseGrabInteraction = useCallback((event) => {
    const interaction = interactionRef.current;
    const pointerMatches =
      interaction.grabbedPointerId < 0 ||
      !Number.isFinite(event.pointerId) ||
      event.pointerId === interaction.grabbedPointerId;

    if (interaction.isGrabbing && pointerMatches) {
      interaction.isGrabbing = false;
      interaction.grabReleaseRequested = true;
    }

    interaction.active = false;
    interaction.vx = 0;
    interaction.vy = 0;
  }, []);

  useEffect(() => {
    const canvas = document.querySelector('.flight-canvas');
    if (!canvas) return undefined;

    const handleNativePointerDown = (event) => {
      if (interactionRef.current.isGrabbing) {
        updateInteraction(event);
        return;
      }

      if (pickingRef.current.pickCraneFromPointer?.(event)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      triggerBurst(event);
      event.stopPropagation();
    };

    canvas.addEventListener('pointerdown', handleNativePointerDown, true);
    canvas.addEventListener('pointermove', updateInteraction);
    canvas.addEventListener('pointerup', releaseGrabInteraction);
    canvas.addEventListener('pointercancel', releaseGrabInteraction);
    canvas.addEventListener('pointerleave', releaseGrabInteraction);

    return () => {
      canvas.removeEventListener('pointerdown', handleNativePointerDown, true);
      canvas.removeEventListener('pointermove', updateInteraction);
      canvas.removeEventListener('pointerup', releaseGrabInteraction);
      canvas.removeEventListener('pointercancel', releaseGrabInteraction);
      canvas.removeEventListener('pointerleave', releaseGrabInteraction);
    };
  }, [releaseGrabInteraction, triggerBurst, updateInteraction]);

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
        onPointerUp={releaseGrabInteraction}
        onPointerCancel={releaseGrabInteraction}
        onPointerLeave={releaseGrabInteraction}
      >
        <Scene
          tier={tier}
          interactionRef={interactionRef}
          depositRef={depositRef}
          pickingRef={pickingRef}
          onDeposit={handleDeposit}
          sky={clock}
        />
      </Canvas>

      <button
        className="menu-button"
        type="button"
        aria-label="Open wish history"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      <ClockDisplay clock={clock} />
      <section className="title-layer" aria-label="Experience title">
        <p className="kicker">Interactive WebGL Artwork</p>
        <h1>A Thousand Paper Cranes</h1>
        <p className="instruction">Move through the flock. Hold a crane and release it into the vessel.</p>
      </section>
      <HistorySidebar
        open={sidebarOpen}
        history={historyEntries}
        onClose={() => setSidebarOpen(false)}
        onClear={clearHistory}
      />
      <PaperNote note={activeNote} onClose={closeNote} />
      <div className="vignette" aria-hidden="true" />
    </main>
  );
}
