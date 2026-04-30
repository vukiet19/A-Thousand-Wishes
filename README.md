# Origami Flight

An immersive one-page React + Three.js artwork where hundreds of colorful low-poly origami cranes fly from deep space toward the viewer.

## Setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## Implementation Notes

- Each crane is built from lightweight folded-paper parts in `src/App.jsx`: body, left wing, right wing, neck/head, and tail.
- The flock uses five `InstancedMesh` layers, one per crane part, so the wings can flap while hundreds of reusable parts still render efficiently.
- The procedural crane geometry includes UVs, deliberate fold-shading, and a local generated paper texture used for subtle grain and bump.
- Per-crane state lives in typed arrays for position, velocity, acceleration, color, scale, wing phase, flap rhythm, fold proportions, and z-depth.
- Motion uses a boids-inspired simulation with separation, loose alignment, light cohesion, broad flow targets, and procedural gusts.
- Crane orientation follows velocity, with banking, pitch, wing follow-through, neck motion, and tail secondary motion.
- Cursor and touch movement create a gentle steering disturbance at each crane's current depth.
- Click or tap creates a delayed wave through the flock, so cranes react based on distance and depth.
- The scene lowers crane count, particle count, and speed when `prefers-reduced-motion` is enabled.
