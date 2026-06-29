import * as THREE from 'three';
import { blobifyGeometry } from './shared.js';
import { getBeatPulse } from '../loop.js';
import { FACE_ZONES, FACE_COLORS } from '../audio/vocals.js';
import { isCountingDown, isRecordingSample, lockedSlot, sampleSlots } from '../audio/sampler.js';

const MOUTH_REST_SCALE    = { x: 1.8, y: 0.5, z: 0.45 };
const MOUTH_STRETCH_SCALE_Y = 5.0;

export function buildFacey() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(1.2, 64, 64);
  blobifyGeometry(bodyGeo, 5.7, 0.28);
  const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: 0x3a1660, roughness: 0.45, metalness: 0.45,
    emissive: 0x250a45, emissiveIntensity: 1.1
  }));
  bodyMesh.scale.y = 1.25;
  bodyMesh.userData = { kind: 'body', blobName: 'face' };
  group.add(bodyMesh);

  const faceParts = [];

  // Eyes
  const eyePositions = [new THREE.Vector3(-0.4, 0.38, 1.1), new THREE.Vector3(0.4, 0.38, 1.1)];
  const eyeColors = [0xff55cc, 0xcc33ff];
  eyePositions.forEach((pos, i) => {
    const eg = new THREE.SphereGeometry(0.18, 16, 16);
    const em = new THREE.MeshStandardMaterial({ color: eyeColors[i], emissive: eyeColors[i], emissiveIntensity: 2 });
    const eye = new THREE.Mesh(eg, em);
    eye.position.copy(pos);
    eye.userData = { kind: 'face-vocal', partIdx: i };
    group.add(eye);
    faceParts.push({ mesh: eye, label: FACE_ZONES[i], color: FACE_COLORS[i] });
    const pg = new THREE.SphereGeometry(0.08, 10, 10);
    const pm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x330066, emissiveIntensity: 1 });
    const pupil = new THREE.Mesh(pg, pm);
    pupil.position.copy(pos);
    pupil.position.z += 0.12;
    group.add(pupil);
  });

  // Nose
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-0.13, 0.18);
  noseShape.lineTo(-0.13, -0.18);
  noseShape.lineTo(0.20, 0);
  noseShape.lineTo(-0.13, 0.18);
  const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2
  });
  noseGeo.center();
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0xff7733, emissive: 0xff7733, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.3
  });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.04, 1.18);
  nose.userData = { kind: 'face-nose', partIdx: 2 };
  group.add(nose);
  faceParts.push({ mesh: nose, label: FACE_ZONES[2], color: FACE_COLORS[2] });

  // Mouth
  const mouthGeo = new THREE.SphereGeometry(0.15, 24, 16);
  mouthGeo.translate(0, -0.15, 0);
  const mouthMat = new THREE.MeshStandardMaterial({
    color: 0x33ffaa, emissive: 0x33ffaa, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.5
  });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.25, 1.05);
  mouth.scale.set(MOUTH_REST_SCALE.x, MOUTH_REST_SCALE.y, MOUTH_REST_SCALE.z);
  mouth.userData = { kind: 'face-mouth', partIdx: 3 };
  group.add(mouth);
  faceParts.push({ mesh: mouth, label: FACE_ZONES[3], color: FACE_COLORS[3] });

  // Forehead gem
  const fg = new THREE.OctahedronGeometry(0.14, 0);
  const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 4, metalness: 1, roughness: 0 });
  const forehead = new THREE.Mesh(fg, fm);
  forehead.position.set(0, 0.88, 1.05);
  forehead.userData = { kind: 'face-vocal', partIdx: 4 };
  group.add(forehead);
  faceParts.push({ mesh: forehead, label: FACE_ZONES[4], color: FACE_COLORS[4] });

  // Cheeks
  const chkColors = [0xffee44, 0x44ccff];
  [[-0.85, 0], [0.85, 0]].forEach(([x, y], i) => {
    const cg = new THREE.SphereGeometry(0.22, 14, 14);
    const cm = new THREE.MeshStandardMaterial({ color: chkColors[i], emissive: chkColors[i], emissiveIntensity: 1.2, transparent: true, opacity: 0.75 });
    const chk = new THREE.Mesh(cg, cm);
    chk.position.set(x, y, 0.95);
    chk.userData = { kind: 'face-vocal', partIdx: 5 + i };
    group.add(chk);
    faceParts.push({ mesh: chk, label: FACE_ZONES[5 + i], color: FACE_COLORS[5 + i] });
  });

  // Ears
  const earMeshes = [];
  let lockRing = null;
  [-1, 1].forEach((side, i) => {
    const isLeft = (i === 0);
    const outerColor    = isLeft ? 0xffdd44 : 0xff44aa;
    const outerEmissive = isLeft ? 0xeeb822 : 0xff2288;
    const innerColor    = isLeft ? 0x886600 : 0x991155;
    const innerEmissive = isLeft ? 0x664400 : 0x661133;
    const earGroup = new THREE.Group();
    const eg = new THREE.SphereGeometry(0.28, 18, 18);
    const em = new THREE.MeshStandardMaterial({
      color: outerColor, emissive: outerEmissive, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.3
    });
    const outerEar = new THREE.Mesh(eg, em);
    outerEar.scale.set(0.55, 1.0, 0.7);
    outerEar.userData = { kind: 'face-ear', partIdx: 7 + i };
    earGroup.add(outerEar);
    const ig = new THREE.SphereGeometry(0.16, 12, 12);
    const im = new THREE.MeshStandardMaterial({ color: innerColor, emissive: innerEmissive, emissiveIntensity: 1.8 });
    const innerEar = new THREE.Mesh(ig, im);
    innerEar.scale.set(0.45, 0.75, 0.4);
    innerEar.position.set(side * 0.08, 0, 0.08);
    earGroup.add(innerEar);
    if (isLeft) {
      const ringGeo = new THREE.TorusGeometry(0.34, 0.022, 10, 36);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xffee66, emissive: 0xffdd44, emissiveIntensity: 5, transparent: true, opacity: 0
      });
      lockRing = new THREE.Mesh(ringGeo, ringMat);
      lockRing.rotation.x = Math.PI * 0.18;
      earGroup.add(lockRing);
    }
    earGroup.position.set(side * 1.15, 0.35, 0.1);
    earGroup.rotation.z = side * 0.2;
    group.add(earGroup);
    earMeshes.push(outerEar);
    faceParts.push({ mesh: outerEar, label: FACE_ZONES[7 + i], color: FACE_COLORS[7 + i] });
  });

  group.scale.setScalar(0.5);

  return {
    group, faceParts, body: bodyMesh, mouth, nose, earMeshes,
    pulse(zoneIdx) {
      const p = faceParts[zoneIdx];
      if (!p || zoneIdx === 3) return;
      p.mesh.material.emissiveIntensity *= 3;
      const os = p.mesh.scale.x;
      p.mesh.scale.setScalar(os * 1.35);
      setTimeout(() => { p.mesh.material.emissiveIntensity /= 3; p.mesh.scale.setScalar(os); }, 180);
    },
    pulseNose() {
      const m = nose.material;
      const baseEI = sampleSlots.length > 0 ? 1.6 : 0.7;
      m.emissiveIntensity = 4.0;
      nose.scale.setScalar(1.3);
      setTimeout(() => { m.emissiveIntensity = baseEI; nose.scale.setScalar(1.0); }, 180);
    },
    setMouthStretch(s) {
      const sy = MOUTH_REST_SCALE.y + s * (MOUTH_STRETCH_SCALE_Y - MOUTH_REST_SCALE.y);
      const sx = MOUTH_REST_SCALE.x - s * (MOUTH_REST_SCALE.x - 0.7);
      mouth.scale.set(sx, sy, MOUTH_REST_SCALE.z);
    },
    tick(t) {
      group.rotation.y = Math.sin(t * 0.19) * 0.22;
      group.rotation.x = Math.sin(t * 0.11) * 0.08;
      const s = 1 + Math.sin(t * 0.85) * 0.022;
      bodyMesh.scale.set(s, s * 1.25, s);
      bodyMesh.material.emissiveIntensity = 1.1 + getBeatPulse() * 0.75;
      const blinkT = t % 4.0;
      const blinkScale = blinkT > 3.85 ? Math.max(0.1, (4.0 - blinkT) * 7) : 1;
      faceParts[0].mesh.scale.y = blinkScale;
      faceParts[1].mesh.scale.y = blinkScale;
      faceParts[4].mesh.rotation.y = t * 1.5;
      faceParts[4].mesh.rotation.z = t * 0.7;
      const hasAny = sampleSlots.length > 0;
      const targetEI = hasAny ? (1.6 + Math.sin(t * 3) * 0.4) : 0.55;
      nose.material.emissiveIntensity += (targetEI - nose.material.emissiveIntensity) * 0.08;
      if (isCountingDown || isRecordingSample) {
        earMeshes.forEach((e, i) => { e.material.emissiveIntensity = 2.5 + Math.sin(t * 8 + i * 1.5) * 1.2; });
      } else {
        earMeshes.forEach(e => { e.material.emissiveIntensity += (1.4 - e.material.emissiveIntensity) * 0.1; });
      }
      if (lockRing) {
        const targetOp = (lockedSlot !== null) ? 0.95 : 0;
        lockRing.material.opacity += (targetOp - lockRing.material.opacity) * 0.12;
        lockRing.rotation.z += 0.025;
        lockRing.rotation.x = Math.PI * 0.18 + Math.sin(t * 1.7) * 0.08;
      }
    }
  };
}
