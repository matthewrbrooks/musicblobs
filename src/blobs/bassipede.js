import * as THREE from 'three';
import { getBeatPulse } from '../loop.js';

// TWEAKABLES
export const BASS_MIN_LENGTH = 1.1;  // world units
export const BASS_MAX_LENGTH = 2.5;  // world units (one octave range)
export const BASS_INITIAL_LENGTH = 1.8;
const BASS_TUBE_RADIUS = 0.18;
const BASS_HEAD_RADIUS = 0.28;
const BASS_TAIL_RADIUS = 0.18;

export function buildBassipede() {
  const group = new THREE.Group();

  // Head
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x22bb66, roughness: 0.3, metalness: 0.5,
    emissive: 0x115533, emissiveIntensity: 0.1,
  });
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BASS_HEAD_RADIUS, 16, 12),
    headMat
  );
  headMesh.userData = { kind: 'body', blobName: 'bass' };
  group.add(headMesh);

  // Eyes (decorative)
  [[-0.12, 0.14], [0.12, 0.14]].forEach(([ex, ey]) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ffcc, emissiveIntensity: 2.5 })
    );
    eye.position.set(ex, ey, BASS_HEAD_RADIUS * 0.88);
    group.add(eye);
  });

  // Body cylinder (unit height, scaled/rotated each frame)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a9955, roughness: 0.4, metalness: 0.3,
    emissive: 0x0a4422, emissiveIntensity: 0.1,
  });
  const bodyMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(BASS_TUBE_RADIUS, BASS_TUBE_RADIUS, 1, 10, 1),
    bodyMat
  );
  bodyMesh.userData = { kind: 'bass-body' };
  group.add(bodyMesh);

  // Tail
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x33dd77, roughness: 0.3, metalness: 0.5,
    emissive: 0x33dd77, emissiveIntensity: 0.15,
  });
  const tailMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BASS_TAIL_RADIUS, 12, 8),
    tailMat
  );
  tailMesh.userData = { kind: 'bass-tail' };
  group.add(tailMesh);

  // Guitar pick (3-sided cone = triangle shape)
  const pickMat = new THREE.MeshStandardMaterial({
    color: 0xffee44, roughness: 0.2, metalness: 0.6,
    emissive: 0xffee44, emissiveIntensity: 0.6,
  });
  const pickMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.22, 3),
    pickMat
  );
  pickMesh.userData = { kind: 'bass-body' }; // drag it across the body to pluck
  group.add(pickMesh);

  // Mutable state (world coords)
  let tailWorldX = 0;
  let tailWorldY = 0;
  let tailInControl = false;

  const obj = {
    group,
    get tailWorldX() { return tailWorldX; },
    set tailWorldX(v) { tailWorldX = v; },
    get tailWorldY() { return tailWorldY; },
    set tailWorldY(v) { tailWorldY = v; },
    get tailInControl() { return tailInControl; },
    set tailInControl(v) { tailInControl = v; },

    getStretchNorm() {
      const headX = group.position.x, headY = group.position.y;
      const len = Math.sqrt((tailWorldX - headX) ** 2 + (tailWorldY - headY) ** 2);
      return Math.max(0, Math.min(1, (len - BASS_MIN_LENGTH) / (BASS_MAX_LENGTH - BASS_MIN_LENGTH)));
    },

    pulse() {
      const baseEI = 0.1;
      headMat.emissiveIntensity = 1.0;
      headMesh.scale.setScalar(1.3);
      bodyMat.emissiveIntensity = 0.6;
      setTimeout(() => {
        headMat.emissiveIntensity = baseEI;
        headMesh.scale.setScalar(1);
        bodyMat.emissiveIntensity = baseEI;
      }, 180);
    },

    tick(t) {
      const headX = group.position.x, headY = group.position.y;
      const dx = tailWorldX - headX;
      const dy = tailWorldY - headY;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const angle = Math.atan2(dy, dx);

      // Body: position at midpoint, rotate and scale to length
      bodyMesh.position.set(dx / 2, dy / 2, -0.05);
      bodyMesh.rotation.z = angle - Math.PI / 2;
      bodyMesh.scale.set(1, len, 1);

      // Tail
      tailMesh.position.set(dx, dy, 0);
      tailMat.emissiveIntensity = tailInControl ? 0.9 : 0.15;

      // Pick: midpoint + perpendicular-left offset
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      pickMesh.position.set(dx / 2 + perpX * 0.38, dy / 2 + perpY * 0.38, 0.1);
      pickMesh.rotation.z = angle - Math.PI / 2;

      // Pick gentle float animation
      pickMesh.position.z = 0.1 + Math.sin(t * 1.4) * 0.04;

      // Beat pulse on head
      headMat.emissiveIntensity = 0.1 + getBeatPulse() * 0.5;
    },
  };

  return obj;
}
