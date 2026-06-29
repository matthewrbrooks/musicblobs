import * as THREE from 'three';
import { buildDrumbo } from './blobs/drumbo.js';
import { buildKeebo } from './blobs/keebo.js';
import { buildFacey } from './blobs/facey.js';

export const canvas = document.getElementById('stage-canvas');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 5);
export const sceneClock = new THREE.Clock();

scene.add(new THREE.AmbientLight(0x8866aa, 1.5));
[
  { color: 0xdd66ff, intensity: 3.4, pos: [0,  3, 3] },
  { color: 0xff7788, intensity: 2.6, pos: [-4, -1, 2] },
  { color: 0x66bbff, intensity: 2.4, pos: [4,   1, 2] },
  { color: 0x88ff88, intensity: 1.6, pos: [0,  -3, 3] },
].forEach(L => {
  const pl = new THREE.PointLight(L.color, L.intensity, 14);
  pl.position.set(...L.pos);
  scene.add(pl);
});

export const drumBlob = buildDrumbo();
export const keyBlob  = buildKeebo();
export const faceBlob = buildFacey();
scene.add(drumBlob.group);
scene.add(keyBlob.group);
scene.add(faceBlob.group);

export let viewHalfW = 3, viewHalfH = 2;

export const blobReg = [
  { obj: drumBlob, name: 'drum', label: 'Drumbo', x: -2.0, y: 0, vx: 0, vy: 0, radius: 0.8,  homeX: -2.0, homeY: 0, color: '#ff5577' },
  { obj: keyBlob,  name: 'key',  label: 'Keebo',  x:  0.0, y: 0, vx: 0, vy: 0, radius: 0.8,  homeX:  0.0, homeY: 0, color: '#7788ff' },
  { obj: faceBlob, name: 'face', label: 'Facey',  x:  2.0, y: 0, vx: 0, vy: 0, radius: 0.85, homeX:  2.0, homeY: 0, color: '#cc88ff' },
];
export const blobByName = {};
blobReg.forEach(b => { blobByName[b.name] = b; });

function recomputeViewBounds() {
  const visH = 2 * Math.abs(camera.position.z) * Math.tan(camera.fov * Math.PI / 360);
  const visW = visH * camera.aspect;
  viewHalfW = visW / 2;
  viewHalfH = visH / 2;
  const spread = Math.min(viewHalfW * 0.65, 2.3);
  blobReg[0].homeX = -spread;
  blobReg[1].homeX =  0;
  blobReg[2].homeX =  spread;
}

export function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  recomputeViewBounds();
}

resize();
blobReg.forEach(b => { b.x = b.homeX; b.y = b.homeY; });
window.addEventListener('resize', resize);

export function worldToScreen(x, y) {
  const v = new THREE.Vector3(x, y, 0);
  v.project(camera);
  const r = canvas.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * r.width + r.left,
    y: (-v.y * 0.5 + 0.5) * r.height + r.top,
  };
}

export function updateNameLabels() {
  blobReg.forEach(b => {
    const el = document.getElementById('name-' + b.name);
    if (!el) return;
    const s = worldToScreen(b.x, b.y - b.radius * 1.05);
    el.style.left = s.x + 'px';
    el.style.top  = s.y + 'px';
  });
}
