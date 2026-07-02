import { blobReg, viewHalfW, viewHalfH } from '../scene.js';
import { triggerRandomClick } from '../interaction/triggers.js';
import { registerTweakable } from '../ui/debug.js';

export let moveMode = 'bounce';
let draggedBlob = null;
let collidingPairs = new Set();

let COLLISION_DEBOUNCE_MS = 40;
const lastCollisionTime = new Map();

export function initPhysics() {
  registerTweakable('Collision ms', () => COLLISION_DEBOUNCE_MS, v => { COLLISION_DEBOUNCE_MS = v; }, 0, 200, 1);
}

export function setDraggedBlob(b) { draggedBlob = b; }
export function getDraggedBlob()  { return draggedBlob; }

export function setMoveMode(m) {
  moveMode = m;
  document.querySelectorAll('#move-picker button').forEach(b => {
    b.classList.toggle('active', b.dataset.move === m);
  });
}

export function updatePhysics(dt) {
  if (moveMode === 'avoid') {
    blobReg.forEach(b => {
      if (b === draggedBlob) return;
      let fx = 0, fy = 0;
      if (draggedBlob) {
        const dx = b.x - draggedBlob.x, dy = b.y - draggedBlob.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const safe = (b.radius + draggedBlob.radius) * 1.4;
        const reach = safe * 2.0;
        if (dist < reach) {
          const k = Math.pow(1 - dist / reach, 2) * 14;
          fx += (dx / dist) * k; fy += (dy / dist) * k;
        }
      }
      blobReg.forEach(o => {
        if (o === b || o === draggedBlob) return;
        const dx = b.x - o.x, dy = b.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const safe = b.radius + o.radius;
        if (dist < safe * 1.1) {
          const k = (1 - dist / (safe * 1.1)) * 6;
          fx += (dx / dist) * k; fy += (dy / dist) * k;
        }
      });
      fx += (b.homeX - b.x) * 2.2;
      fy += (b.homeY - b.y) * 2.2;
      b.vx = (b.vx + fx * dt) * Math.pow(0.05, dt);
      b.vy = (b.vy + fy * dt) * Math.pow(0.05, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      const r = b.radius;
      if (b.x < -viewHalfW + r) { b.x = -viewHalfW + r; b.vx = 0; }
      if (b.x >  viewHalfW - r) { b.x =  viewHalfW - r; b.vx = 0; }
      if (b.y < -viewHalfH + r) { b.y = -viewHalfH + r; b.vy = 0; }
      if (b.y >  viewHalfH - r) { b.y =  viewHalfH - r; b.vy = 0; }
    });
  } else {
    blobReg.forEach(b => {
      if (b === draggedBlob) return;
      b.vx *= Math.pow(0.5, dt); b.vy *= Math.pow(0.5, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
    });
    const stillTouching = new Set();
    for (let i = 0; i < blobReg.length; i++) {
      for (let j = i + 1; j < blobReg.length; j++) {
        const a = blobReg[i], b = blobReg[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const min = a.radius + b.radius;
        if (dist < min) {
          const pairKey = a.name + '-' + b.name;
          stillTouching.add(pairKey);
          const isNew = !collidingPairs.has(pairKey);
          const nx = dx / dist, ny = dy / dist;
          const overlap = min - dist;
          if (isNew) {
            const now = performance.now();
            const last = lastCollisionTime.get(pairKey) ?? -Infinity;
            if (now - last >= COLLISION_DEBOUNCE_MS) {
              lastCollisionTime.set(pairKey, now);
              triggerRandomClick(a, a.x + nx * a.radius, a.y + ny * a.radius);
              triggerRandomClick(b, b.x - nx * b.radius, b.y - ny * b.radius);
            }
          }
          if (a === draggedBlob) {
            b.x += nx * overlap; b.y += ny * overlap;
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const vN = rvx * nx + rvy * ny;
            if (vN < 0) { b.vx -= 2 * vN * nx; b.vy -= 2 * vN * ny; }
            b.vx += a.vx * 0.8; b.vy += a.vy * 0.8;
          } else if (b === draggedBlob) {
            a.x -= nx * overlap; a.y -= ny * overlap;
            const rvx = a.vx - b.vx, rvy = a.vy - b.vy;
            const vN = rvx * (-nx) + rvy * (-ny);
            if (vN < 0) { a.vx -= 2 * vN * (-nx); a.vy -= 2 * vN * (-ny); }
            a.vx += b.vx * 0.8; a.vy += b.vy * 0.8;
          } else {
            a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const vN = rvx * nx + rvy * ny;
            if (vN < 0) { a.vx += vN * nx; a.vy += vN * ny; b.vx -= vN * nx; b.vy -= vN * ny; }
          }
        }
      }
    }
    collidingPairs = stillTouching;
    blobReg.forEach(b => {
      if (b === draggedBlob) return;
      const r = b.radius;
      if (b.x < -viewHalfW + r) { b.x = -viewHalfW + r; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x >  viewHalfW - r) { b.x =  viewHalfW - r; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < -viewHalfH + r) { b.y = -viewHalfH + r; b.vy = Math.abs(b.vy) * 0.7; }
      if (b.y >  viewHalfH - r) { b.y =  viewHalfH - r; b.vy = -Math.abs(b.vy) * 0.7; }
    });
  }
}
