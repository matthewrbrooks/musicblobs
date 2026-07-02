import * as THREE from 'three';
import { canvas, camera, blobReg, blobByName, faceBlob, viewHalfW, viewHalfH } from '../scene.js';
import { setDraggedBlob, getDraggedBlob } from '../physics/physics.js';
import { triggerDrum, triggerKey, triggerFaceVocal, triggerFaceNose, triggerBassPluck } from './triggers.js';
import { setMouthStretch, getMouthStretch, startSampleRecord, toggleLock } from '../audio/sampler.js';
import { FACE_COLORS } from '../audio/vocals.js';
import { flashHit, spawnRipple, showLabel } from '../ui/effects.js';
import { blobPulse } from '../blobs/shared.js';
import { ensureAudio } from '../audio/context.js';
import { BASS_MIN_LENGTH, BASS_MAX_LENGTH } from '../blobs/bassipede.js';

const raycaster = new THREE.Raycaster();

let keyDragActive = false;
let keyDragLastIdx = null;
let mouthDragActive = false;
let mouthDragStartY = 0;
let mouthDragStartStretch = 0;
let dragOffsetX = 0, dragOffsetY = 0;

let bassTailDragActive = false;
let bassTailTouchId = null;
let bassHeadTailDX = 0, bassHeadTailDY = 0;

let bodyDragTouchId = null;
let mouthDragTouchId = null;
let keyDragTouchId = null;

// Per-pointer bass pluck crossing tracker (key = touch identifier, or 'mouse')
let mouseIsDown = false;
const pluckTrackers = new Map();

function clientToNDC(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((cx - r.left) / r.width) * 2 - 1,
    -((cy - r.top) / r.height) * 2 + 1
  );
}

function screenToWorld(cx, cy) {
  const ndc = clientToNDC(cx, cy);
  const v = new THREE.Vector3(ndc.x, ndc.y, 0.5);
  v.unproject(camera);
  const dir = v.sub(camera.position).normalize();
  const dist = -camera.position.z / dir.z;
  const p = camera.position.clone().add(dir.multiplyScalar(dist));
  return { x: p.x, y: p.y };
}

function collectPickables() {
  const out = [];
  blobReg.forEach(b => {
    b.obj.group.traverse(o => {
      if (o.isMesh && o.userData && o.userData.kind) out.push(o);
    });
  });
  return out;
}

function checkKeyAreaHit(hits) {
  if (!hits || hits.length === 0) return null;
  const hit = hits[0];
  const ud = hit.object.userData || {};
  if (ud.kind === 'key-pad') return { type: 'key-pad', idx: ud.index };
  if (ud.kind === 'body' && ud.blobName === 'key') {
    const lp = hit.object.worldToLocal(hit.point.clone());
    if (Math.abs(lp.x) < 2.1 && Math.abs(lp.y) < 0.9 && lp.z > 0.5) return { type: 'key-strip' };
  }
  return null;
}

// Signed perpendicular distance from world point to bass body axis.
function bassBodySide(wx, wy) {
  const bassReg = blobByName['bass'];
  if (!bassReg) return 0;
  const headX = bassReg.x, headY = bassReg.y;
  const tailX = bassReg.obj.tailWorldX, tailY = bassReg.obj.tailWorldY;
  const dx = tailX - headX, dy = tailY - headY;
  const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
  const perpX = -dy / len, perpY = dx / len;
  return (wx - headX) * perpX + (wy - headY) * perpY;
}

// Called on every move for each active pointer — fires pluck if body axis is crossed.
function trackBassPluck(cx, cy, trackerId) {
  const wp = screenToWorld(cx, cy);
  const sign = bassBodySide(wp.x, wp.y);
  const key = trackerId ?? 'mouse';
  const prev = pluckTrackers.get(key);
  if (prev && prev.sign !== 0 && Math.sign(sign) !== Math.sign(prev.sign)) {
    const elapsed = performance.now() - prev.time;
    const dist = Math.hypot(cx - prev.sx, cy - prev.sy);
    const brightness = elapsed > 0 ? Math.min(1, (dist / elapsed) / 2.5) : 0.5;
    triggerBassPluck(brightness, cx, cy);
  }
  pluckTrackers.set(key, { sign, sx: cx, sy: cy, time: performance.now() });
}

function updateTailDrag(cx, cy) {
  const bassReg = blobByName['bass'];
  if (!bassReg) return;
  const bassObj = bassReg.obj;
  const wp = screenToWorld(cx, cy);
  const dx = wp.x - bassReg.x, dy = wp.y - bassReg.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
  const clamped = Math.max(BASS_MIN_LENGTH, Math.min(BASS_MAX_LENGTH, dist));
  bassObj.tailInControl = dist >= BASS_MIN_LENGTH * 0.85 && dist <= BASS_MAX_LENGTH * 1.15;
  const s = clamped / dist;
  bassObj.tailWorldX = bassReg.x + dx * s;
  bassObj.tailWorldY = bassReg.y + dy * s;
}

function processDown(cx, cy, touchId) {
  const ndc = clientToNDC(cx, cy);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(collectPickables());
  if (hits.length === 0) return;

  const keyHit = checkKeyAreaHit(hits);
  if (keyHit) {
    keyDragActive = true;
    keyDragLastIdx = null;
    keyDragTouchId = touchId;
    if (keyHit.type === 'key-pad') { triggerKey(keyHit.idx, cx, cy); keyDragLastIdx = keyHit.idx; }
    return;
  }

  const ud = hits[0].object.userData;
  if (!ud?.kind) return;

  switch (ud.kind) {
    case 'drum-pad':
      triggerDrum(ud.index, cx, cy);
      break;
    case 'face-vocal':
      triggerFaceVocal(ud.partIdx, cx, cy);
      break;
    case 'face-mouth':
      mouthDragActive = true;
      mouthDragTouchId = touchId;
      mouthDragStartY = cy;
      mouthDragStartStretch = getMouthStretch();
      break;
    case 'face-ear': {
      const idx = ud.partIdx;
      if (idx === 7) toggleLock(); else startSampleRecord();
      flashHit('face', FACE_COLORS[idx]);
      spawnRipple(cx, cy, FACE_COLORS[idx]);
      showLabel('face', idx, cx, cy);
      blobPulse(faceBlob, idx);
      break;
    }
    case 'face-nose':
      triggerFaceNose(cx, cy);
      break;
    case 'bass-tail':
      bassTailDragActive = true;
      bassTailTouchId = touchId;
      break;
    case 'bass-body':
      // Pluck crossing tracked globally in move handlers — nothing to initialise here
      break;
    case 'body': {
      const blob = blobByName[ud.blobName];
      if (!blob) break;
      setDraggedBlob(blob);
      bodyDragTouchId = touchId;
      const wp = screenToWorld(cx, cy);
      dragOffsetX = blob.x - wp.x;
      dragOffsetY = blob.y - wp.y;
      if (ud.blobName === 'bass') {
        bassHeadTailDX = blob.obj.tailWorldX - blob.x;
        bassHeadTailDY = blob.obj.tailWorldY - blob.y;
      }
      break;
    }
  }
}

function handleMouseDown(e) {
  ensureAudio();
  mouseIsDown = true;
  // Seed the pluck tracker so the first move has a valid previous side
  const wp = screenToWorld(e.clientX, e.clientY);
  pluckTrackers.set('mouse', { sign: bassBodySide(wp.x, wp.y), sx: e.clientX, sy: e.clientY, time: performance.now() });
  processDown(e.clientX, e.clientY, null);
}

function handleTouchStart(e) {
  e.preventDefault();
  ensureAudio();
  for (const t of e.changedTouches) {
    const wp = screenToWorld(t.clientX, t.clientY);
    pluckTrackers.set(t.identifier, { sign: bassBodySide(wp.x, wp.y), sx: t.clientX, sy: t.clientY, time: performance.now() });
    processDown(t.clientX, t.clientY, t.identifier);
  }
}

function handlePointerMove(e) {
  const cx = e.clientX ?? e.touches?.[0]?.clientX;
  const cy = e.clientY ?? e.touches?.[0]?.clientY;
  if (cx == null || cy == null) return;

  // Always check bass pluck crossing for mouse while button is held
  if (mouseIsDown) trackBassPluck(cx, cy, null);

  if (mouthDragActive) {
    setMouthStretch(mouthDragStartStretch + (cy - mouthDragStartY) / 180);
    faceBlob.setMouthStretch(getMouthStretch());
    if (e.cancelable) e.preventDefault?.();
    return;
  }

  const draggedBlob = getDraggedBlob();
  if (draggedBlob) {
    const wp = screenToWorld(cx, cy);
    const nx = wp.x + dragOffsetX;
    const ny = wp.y + dragOffsetY;
    draggedBlob.vx = (nx - draggedBlob.x) * 60;
    draggedBlob.vy = (ny - draggedBlob.y) * 60;
    draggedBlob.x = Math.max(-viewHalfW + draggedBlob.radius, Math.min(viewHalfW - draggedBlob.radius, nx));
    draggedBlob.y = Math.max(-viewHalfH + draggedBlob.radius, Math.min(viewHalfH - draggedBlob.radius, ny));
    if (draggedBlob.name === 'bass') {
      draggedBlob.obj.tailWorldX = draggedBlob.x + bassHeadTailDX;
      draggedBlob.obj.tailWorldY = draggedBlob.y + bassHeadTailDY;
    }
    if (e.cancelable) e.preventDefault?.();
    return;
  }

  if (bassTailDragActive) {
    updateTailDrag(cx, cy);
    if (e.cancelable) e.preventDefault?.();
    return;
  }

  if (keyDragActive) {
    raycaster.setFromCamera(clientToNDC(cx, cy), camera);
    const keyHit = checkKeyAreaHit(raycaster.intersectObjects(collectPickables()));
    if (keyHit?.type === 'key-pad') {
      if (keyHit.idx !== keyDragLastIdx) { triggerKey(keyHit.idx, cx, cy); keyDragLastIdx = keyHit.idx; }
    } else {
      keyDragLastIdx = null;
    }
    if (e.cancelable) e.preventDefault?.();
  }
}

function handleTouchMove(e) {
  for (const touch of e.touches) {
    const { clientX: cx, clientY: cy, identifier: id } = touch;

    // Always check bass pluck crossing for every active touch
    trackBassPluck(cx, cy, id);

    if (bassTailDragActive && id === bassTailTouchId) {
      updateTailDrag(cx, cy);
      if (e.cancelable) e.preventDefault();
    } else if (mouthDragActive && id === mouthDragTouchId) {
      setMouthStretch(mouthDragStartStretch + (cy - mouthDragStartY) / 180);
      faceBlob.setMouthStretch(getMouthStretch());
      if (e.cancelable) e.preventDefault();
    } else if (getDraggedBlob() && id === bodyDragTouchId) {
      const wp = screenToWorld(cx, cy);
      const nx = wp.x + dragOffsetX;
      const ny = wp.y + dragOffsetY;
      const db = getDraggedBlob();
      db.vx = (nx - db.x) * 60;
      db.vy = (ny - db.y) * 60;
      db.x = Math.max(-viewHalfW + db.radius, Math.min(viewHalfW - db.radius, nx));
      db.y = Math.max(-viewHalfH + db.radius, Math.min(viewHalfH - db.radius, ny));
      if (db.name === 'bass') {
        db.obj.tailWorldX = db.x + bassHeadTailDX;
        db.obj.tailWorldY = db.y + bassHeadTailDY;
      }
      if (e.cancelable) e.preventDefault();
    } else if (keyDragActive && id === keyDragTouchId) {
      raycaster.setFromCamera(clientToNDC(cx, cy), camera);
      const keyHit = checkKeyAreaHit(raycaster.intersectObjects(collectPickables()));
      if (keyHit?.type === 'key-pad') {
        if (keyHit.idx !== keyDragLastIdx) { triggerKey(keyHit.idx, cx, cy); keyDragLastIdx = keyHit.idx; }
      } else {
        keyDragLastIdx = null;
      }
      if (e.cancelable) e.preventDefault();
    }
  }
}

function handlePointerUp() {
  mouseIsDown = false;
  pluckTrackers.delete('mouse');
  mouthDragActive = false;
  mouthDragTouchId = null;
  setDraggedBlob(null);
  bodyDragTouchId = null;
  keyDragActive = false;
  keyDragLastIdx = null;
  keyDragTouchId = null;
  bassTailDragActive = false;
  bassTailTouchId = null;
  if (blobByName['bass']) blobByName['bass'].obj.tailInControl = false;
}

function handleTouchEnd(e) {
  for (const touch of e.changedTouches) {
    const { identifier: id } = touch;
    pluckTrackers.delete(id);
    if (bassTailDragActive && id === bassTailTouchId) {
      bassTailDragActive = false;
      bassTailTouchId = null;
      if (blobByName['bass']) blobByName['bass'].obj.tailInControl = false;
    }
    if (getDraggedBlob() && id === bodyDragTouchId) {
      setDraggedBlob(null);
      bodyDragTouchId = null;
    }
    if (mouthDragActive && id === mouthDragTouchId) {
      mouthDragActive = false;
      mouthDragTouchId = null;
    }
    if (keyDragActive && id === keyDragTouchId) {
      keyDragActive = false;
      keyDragLastIdx = null;
      keyDragTouchId = null;
    }
  }
}

export function initDispatch() {
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerUp);
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchEnd);
}
