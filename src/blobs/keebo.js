import * as THREE from 'three';
import { blobifyGeometry } from './shared.js';
import { getBeatPulse } from '../loop.js';

const KEY_Z        = 1.6;
const KEY_Z_PRESSED = 1.5;

export function buildKeebo() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.SphereGeometry(1.35, 64, 64);
  blobifyGeometry(bodyGeo, 2.4, 0.08);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a3d7a, roughness: 0.35, metalness: 0.55,
    emissive: 0x0a2055, emissiveIntensity: 1.0
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.userData = { kind: 'body', blobName: 'key' };
  group.add(body);

  const keyColors = [0xcc55ff, 0x8855ff, 0x5588ff, 0x33aaff, 0x33ffcc, 0x77ff55, 0xffee33, 0xff8833];
  const keyMeshes = [];
  const totalW = 2.0, startX = -totalW / 2 + totalW / 16;
  for (let i = 0; i < 8; i++) {
    const x = startX + i * (totalW / 8);
    const kg = new THREE.BoxGeometry(0.19, 0.55, 0.08);
    const km = new THREE.MeshStandardMaterial({
      color: keyColors[i], roughness: 0.25, metalness: 0.7,
      emissive: keyColors[i], emissiveIntensity: 0.7
    });
    const key = new THREE.Mesh(kg, km);
    key.position.set(x, 0, KEY_Z);
    key.userData = { kind: 'key-pad', index: i };
    group.add(key);
    keyMeshes.push(key);
  }

  [-0.5, 0.5].forEach((x, i) => {
    const sg = new THREE.SphereGeometry(0.07, 8, 8);
    const sm = new THREE.MeshStandardMaterial({ color: keyColors[i * 4], emissive: keyColors[i * 4], emissiveIntensity: 3 });
    const s = new THREE.Mesh(sg, sm);
    s.position.set(x, 1.55, 0.3);
    s.userData = { kind: 'body', blobName: 'key' };
    group.add(s);
    const cg = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const cm = new THREE.MeshStandardMaterial({ color: 0x8888aa, roughness: 0.5 });
    const cyl = new THREE.Mesh(cg, cm);
    cyl.position.set(x, 1.3, 0.3);
    group.add(cyl);
  });

  group.scale.setScalar(0.5);

  return {
    group, body, keyMeshes, keyColors,
    pulse(zoneIdx) {
      const key = keyMeshes[zoneIdx];
      key.material.emissiveIntensity = 3.5;
      key.position.z = KEY_Z_PRESSED;
      setTimeout(() => { key.material.emissiveIntensity = 0.7; key.position.z = KEY_Z; }, 200);
    },
    tick(t) {
      group.rotation.y = Math.sin(t * 0.22) * 0.18;
      group.rotation.x = Math.sin(t * 0.15) * 0.05;
      const s = 1 + Math.sin(t * 0.9) * 0.018;
      body.scale.set(s, s, s);
      body.material.emissiveIntensity = 1.0 + getBeatPulse() * 0.7;
      keyMeshes.forEach((k, i) => {
        k.position.z = KEY_Z + Math.sin(t * 1.8 + i * 0.8) * 0.012;
      });
    }
  };
}
