import * as THREE from 'three';
import { scene } from '../scene.js';
import { screenToWorld } from '../scene.js';

// 3 rings per tap × 8 concurrent taps with headroom
const POOL_SIZE = 24;
const RING_DURATION = 320; // ms

// Each tap spawns 3 rings: different start delays and max sizes
const RING_CONFIGS = [
  { delay: 0,   maxRadius: 0.35 },
  { delay: 80,  maxRadius: 0.25 },
  { delay: 160, maxRadius: 0.175 },
];

const pool = [];
let poolIdx = 0;

let flashMesh = null;
let flashTimeout = null;

export function initSceneEffects() {
  // All 24 ring meshes share one geometry — geometry is read-only data
  const geo = new THREE.RingGeometry(0.8, 1, 48);

  for (let i = 0; i < POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, mat, active: false, activateAt: 0, maxRadius: 1 });
  }

  // Single reused flash plane — large enough to cover any viewport
  const flashGeo = new THREE.PlaneGeometry(100, 100);
  const flashMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
  });
  flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.renderOrder = 20;
  flashMesh.frustumCulled = false;
  flashMesh.position.set(0, 0, 4); // in front of camera (z=5), within near/far
  flashMesh.visible = false;
  scene.add(flashMesh);
}

export function spawnRipple(cx, cy, colorStr) {
  const wp = screenToWorld(cx, cy);
  const now = performance.now();

  RING_CONFIGS.forEach(({ delay, maxRadius }) => {
    const slot = pool[poolIdx % POOL_SIZE];
    poolIdx++;
    slot.active = true;
    slot.activateAt = now + delay;
    slot.maxRadius = maxRadius;
    slot.mat.color.set(colorStr);
    slot.mat.opacity = 0;
    slot.mesh.position.set(wp.x, wp.y, 0);
    slot.mesh.scale.setScalar(0);
    slot.mesh.visible = false;
  });
}

export function flashHit(_which, colorStr) {
  if (!flashMesh) return;
  clearTimeout(flashTimeout);
  flashMesh.material.color.set(colorStr);
  flashMesh.material.opacity = 0.09;
  flashMesh.visible = true;
  flashTimeout = setTimeout(() => { flashMesh.visible = false; }, 80);
}

export function tickSceneEffects() {
  if (!pool.length) return;
  const now = performance.now();

  pool.forEach(slot => {
    if (!slot.active) return;
    if (now < slot.activateAt) return;

    const progress = (now - slot.activateAt) / RING_DURATION;
    if (progress >= 1) {
      slot.active = false;
      slot.mesh.visible = false;
      return;
    }

    const eased = 1 - Math.pow(1 - progress, 2); // quadratic ease-out
    slot.mesh.scale.setScalar((0.5 + 0.5 * eased) * slot.maxRadius);
    slot.mat.opacity = (1 - progress) * 0.95;
    slot.mesh.visible = true;
  });
}
