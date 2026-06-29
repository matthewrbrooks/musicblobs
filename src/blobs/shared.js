export function blobifyGeometry(geo, seed = 0, scale = 0.18) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const noise = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 + seed * 0.7) * Math.sin(z * 2.3 + seed * 0.4);
    const r = Math.sqrt(x * x + y * y + z * z);
    pos.setXYZ(i, x / r * (r + noise * scale), y / r * (r + noise * scale), z / r * (r + noise * scale));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function blobPulse(blobObj, zoneIdx) {
  if (!blobObj) return;
  blobObj.pulse(zoneIdx);
}
