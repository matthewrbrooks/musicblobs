import * as THREE from 'three';
import { blobifyGeometry } from './shared.js';
import { getBeatPulse } from '../loop.js';

const HEX_R         = 0.42;
const HEX_H         = HEX_R * Math.sqrt(3); // same-row center spacing ≈ 0.728
const ROW_DY        = HEX_R * 0.75;          // half row-to-row distance (3r/4)
const KEY_Z         = 1.5;
const KEY_Z_PRESSED = 1.38;
const KEY_DEPTH     = 0.12;

// 5 bottom + 4 top = 9 hexes, top row staggered by HEX_H/2.
// Each top hex shares two slanted edges with the two bottom hexes below it — true tessellation.
// Reading left→right across the full grid (interleaved): C D E F G A B C D
// Bottom row: C E G B D  (note indices 0 2 4 6 8)
// Top row:    D F A C    (note indices 1 3 5 7)
const HEX_POSITIONS = [
  [-2 * HEX_H, -ROW_DY],  // hex 0
  [    -HEX_H, -ROW_DY],  // hex 1
  [          0, -ROW_DY],  // hex 2
  [     HEX_H, -ROW_DY],  // hex 3
  [ 2 * HEX_H, -ROW_DY],  // hex 4
  [-1.5 * HEX_H, ROW_DY], // hex 5
  [-0.5 * HEX_H, ROW_DY], // hex 6
  [ 0.5 * HEX_H, ROW_DY], // hex 7
  [ 1.5 * HEX_H, ROW_DY], // hex 8
];

// Maps hex position index → NOTE_FREQS index
const KEY_NOTE_INDICES = [0, 2, 4, 6, 8, 1, 3, 5, 7];

export function buildKeebo() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(1.6, 64, 64);
  blobifyGeometry(bodyGeo, 2.4, 0.07);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a3d7a, roughness: 0.35, metalness: 0.55,
    emissive: 0x0a2055, emissiveIntensity: 1.0
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1.35, 1.0, 0.75);
  body.userData = { kind: 'body', blobName: 'key' };
  group.add(body);

  const keyColors = [0xcc55ff, 0x8855ff, 0x5588ff, 0x33aaff, 0x33ffcc, 0x77ff55, 0xffee33, 0xff8833, 0xff5533];
  const hexMeshes = [];
  const hexGeo = new THREE.CylinderGeometry(HEX_R, HEX_R, KEY_DEPTH, 6);

  const hexByNote = new Array(9);
  HEX_POSITIONS.forEach(([x, y], i) => {
    const noteIdx = KEY_NOTE_INDICES[i];
    const mat = new THREE.MeshStandardMaterial({
      color: keyColors[noteIdx], roughness: 0.55, metalness: 0.3,
      emissive: keyColors[noteIdx], emissiveIntensity: 0.15,
      flatShading: true
    });
    const key = new THREE.Mesh(hexGeo, mat);
    // rotation.x = π/2: hex cap faces +Z; rotation.z = π/6: pointy-top orientation
    key.rotation.set(Math.PI / 2, 0, Math.PI / 6);
    key.position.set(x, y, KEY_Z);
    key.userData = { kind: 'key-pad', index: noteIdx };
    group.add(key);
    hexMeshes.push(key);
    hexByNote[noteIdx] = key;
  });

  // Eyes on stalks above the top hex row
  [[-0.65, 0], [0.65, 4]].forEach(([x, ci]) => {
    const eyeMat = new THREE.MeshStandardMaterial({
      color: keyColors[ci], emissive: keyColors[ci], emissiveIntensity: 3
    });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
    eye.position.set(x, 1.6, 0.5);
    eye.userData = { kind: 'body', blobName: 'key' };
    group.add(eye);

    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x8888aa, roughness: 0.5 })
    );
    stalk.position.set(x, 1.35, 0.4);
    stalk.userData = { kind: 'body', blobName: 'key' };
    group.add(stalk);
  });

  group.scale.setScalar(0.5);

  return {
    group, body, hexMeshes, keyColors,
    pulse(noteIdx) {
      const key = hexByNote[noteIdx];
      if (!key) return;
      key.material.emissiveIntensity = 3.5;
      key.position.z = KEY_Z_PRESSED;
      setTimeout(() => { key.material.emissiveIntensity = 0.15; key.position.z = KEY_Z; }, 200);
    },
    tick(t) {
      group.rotation.y = Math.sin(t * 0.22) * 0.18;
      group.rotation.x = Math.sin(t * 0.15) * 0.05;
      const s = 1 + Math.sin(t * 0.9) * 0.018;
      body.scale.set(1.35 * s, 1.0 * s, 0.75 * s);
      body.material.emissiveIntensity = 1.0 + getBeatPulse() * 0.7;
      hexMeshes.forEach((k, i) => {
        k.position.z = KEY_Z + Math.sin(t * 1.8 + i * 0.8) * 0.012;
      });
    }
  };
}
