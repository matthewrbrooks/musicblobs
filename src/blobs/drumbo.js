import * as THREE from 'three';
import { blobifyGeometry } from './shared.js';
import { getBeatPulse } from '../loop.js';

const DRUMBO_PAD_RADIUS  = 0.42;
const DRUMBO_PAD_HEIGHT  = 0.08;
const DRUMBO_PAD_SPACING = 0.48;
const DRUMBO_PAD_Z       = 1.50;

export function buildDrumbo() {
  const group = new THREE.Group();

  const bodyGeo = new THREE.IcosahedronGeometry(1.3, 4);
  blobifyGeometry(bodyGeo, 1.1, 0.22);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x4a1f6e, roughness: 0.5, metalness: 0.35,
    emissive: 0x3a0a55, emissiveIntensity: 0.9
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.userData = { kind: 'body', blobName: 'drum' };
  group.add(body);

  const padPositions = [
    new THREE.Vector3(-DRUMBO_PAD_SPACING,  DRUMBO_PAD_SPACING, DRUMBO_PAD_Z),
    new THREE.Vector3( DRUMBO_PAD_SPACING,  DRUMBO_PAD_SPACING, DRUMBO_PAD_Z),
    new THREE.Vector3(-DRUMBO_PAD_SPACING, -DRUMBO_PAD_SPACING, DRUMBO_PAD_Z),
    new THREE.Vector3( DRUMBO_PAD_SPACING, -DRUMBO_PAD_SPACING, DRUMBO_PAD_Z),
  ];
  const padColors = [0xff3366, 0x33ddff, 0xff8833, 0x66ff33];
  const padMeshes = [];
  padPositions.forEach((pos, i) => {
    const pg = new THREE.CylinderGeometry(DRUMBO_PAD_RADIUS, DRUMBO_PAD_RADIUS, DRUMBO_PAD_HEIGHT, 32);
    const pm = new THREE.MeshStandardMaterial({
      color: padColors[i], roughness: 0.3, metalness: 0.6,
      emissive: padColors[i], emissiveIntensity: 0.55
    });
    const pad = new THREE.Mesh(pg, pm);
    pad.position.copy(pos);
    pad.lookAt(new THREE.Vector3(0, 0, 0));
    pad.rotateX(Math.PI / 2);
    pad.userData = { kind: 'drum-pad', index: i };
    group.add(pad);
    padMeshes.push(pad);
  });

  const eyeGeo = new THREE.SphereGeometry(0.11, 12, 12);
  [-DRUMBO_PAD_SPACING, DRUMBO_PAD_SPACING].forEach(x => {
    const em = new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 3 });
    const eye = new THREE.Mesh(eyeGeo, em);
    eye.position.set(x, DRUMBO_PAD_SPACING + DRUMBO_PAD_RADIUS + 0.15, 1.15);
    group.add(eye);
  });

  group.scale.setScalar(0.5);

  return {
    group, body, padMeshes, padColors,
    pulse(zoneIdx) {
      const pad = padMeshes[zoneIdx];
      const mat = pad.material;
      mat.emissiveIntensity = 2.5;
      pad.scale.set(1, 1.5, 1);
      setTimeout(() => { mat.emissiveIntensity = 0.55; pad.scale.set(1, 1, 1); }, 140);
    },
    tick(t) {
      group.rotation.y = Math.sin(t * 0.18) * 0.2;
      group.rotation.x = Math.sin(t * 0.13) * 0.07;
      const s = 1 + Math.sin(t * 1.2) * 0.02;
      body.scale.set(s, s, s);
      body.material.emissiveIntensity = 0.9 + getBeatPulse() * 0.7;
    }
  };
}
