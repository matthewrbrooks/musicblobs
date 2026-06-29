import * as THREE from 'three';
import { canvas, camera, blobReg, blobByName, faceBlob, viewHalfW, viewHalfH } from '../scene.js';
import { setDraggedBlob, getDraggedBlob } from '../physics/physics.js';
import { triggerDrum, triggerKey, triggerFaceVocal, triggerFaceNose } from './triggers.js';
import { setMouthStretch, getMouthStretch, startSampleRecord, toggleLock } from '../audio/sampler.js';
import { FACE_COLORS } from '../audio/vocals.js';
import { flashHit, spawnRipple, showLabel } from '../ui/effects.js';
import { blobPulse } from '../blobs/shared.js';
import { ensureAudio } from '../audio/context.js';

const raycaster = new THREE.Raycaster();

let keyDragActive = false;
let keyDragLastIdx = null;
let mouthDragActive = false;
let mouthDragStartY = 0;
let mouthDragStartStretch = 0;
let dragOffsetX = 0, dragOffsetY = 0;

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
    if (Math.abs(lp.x) < 1.05 && Math.abs(lp.y) < 0.35 && lp.z > 0.5) return { type: 'key-strip' };
  }
  return null;
}

function handlePointerDown(e) {
  if (e.touches) e.preventDefault(); // stop iOS synthesising a mousedown after touchstart
  ensureAudio();
  const cx = e.clientX ?? e.touches?.[0]?.clientX;
  const cy = e.clientY ?? e.touches?.[0]?.clientY;
  if (cx == null || cy == null) return;

  const ndc = clientToNDC(cx, cy);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(collectPickables());
  if (hits.length === 0) return;

  const keyHit = checkKeyAreaHit(hits);
  if (keyHit) {
    keyDragActive = true;
    keyDragLastIdx = null;
    if (keyHit.type === 'key-pad') { triggerKey(keyHit.idx, cx, cy); keyDragLastIdx = keyHit.idx; }
    e.preventDefault?.();
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
      mouthDragStartY = cy;
      mouthDragStartStretch = getMouthStretch();
      e.preventDefault?.();
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
    case 'body': {
      const blob = blobByName[ud.blobName];
      if (!blob) break;
      setDraggedBlob(blob);
      const wp = screenToWorld(cx, cy);
      dragOffsetX = blob.x - wp.x;
      dragOffsetY = blob.y - wp.y;
      e.preventDefault?.();
      break;
    }
  }
}

function handlePointerMove(e) {
  const cx = e.clientX ?? e.touches?.[0]?.clientX;
  const cy = e.clientY ?? e.touches?.[0]?.clientY;

  if (mouthDragActive) {
    if (cy != null) {
      setMouthStretch(mouthDragStartStretch + (cy - mouthDragStartY) / 180);
      faceBlob.setMouthStretch(getMouthStretch());
      if (e.cancelable) e.preventDefault?.();
    }
    return;
  }

  const draggedBlob = getDraggedBlob();
  if (draggedBlob) {
    if (cx == null || cy == null) return;
    const wp = screenToWorld(cx, cy);
    const nx = wp.x + dragOffsetX;
    const ny = wp.y + dragOffsetY;
    draggedBlob.vx = (nx - draggedBlob.x) * 60;
    draggedBlob.vy = (ny - draggedBlob.y) * 60;
    draggedBlob.x = Math.max(-viewHalfW + draggedBlob.radius, Math.min(viewHalfW - draggedBlob.radius, nx));
    draggedBlob.y = Math.max(-viewHalfH + draggedBlob.radius, Math.min(viewHalfH - draggedBlob.radius, ny));
    if (e.cancelable) e.preventDefault?.();
    return;
  }

  if (keyDragActive) {
    if (cx == null || cy == null) return;
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

function handlePointerUp() {
  mouthDragActive = false;
  setDraggedBlob(null);
  keyDragActive = false;
  keyDragLastIdx = null;
}

export function initDispatch() {
  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', handlePointerUp);
  window.addEventListener('touchmove', handlePointerMove, { passive: false });
  window.addEventListener('touchend', handlePointerUp);
  window.addEventListener('touchcancel', handlePointerUp);
}
