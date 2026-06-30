import './style.css';
import { gate } from './gate.js';
await gate();
import { renderer, scene, camera, sceneClock, blobReg, drumBlob, keyBlob, faceBlob, bassipedeBlob, updateNameLabels } from './scene.js';
import { updatePhysics } from './physics/physics.js';
import { setFireEventCallback, updateButtons } from './loop.js';
import { updateSampleIndicator } from './audio/sampler.js';
import { initDispatch } from './interaction/dispatch.js';
import { initControls } from './ui/controls.js';
import { initFeedback, updateFeedback, markFeedbackActive } from './ui/feedback.js';
import { initDebug } from './ui/debug.js';
import { flashHit } from './ui/effects.js';
import { blobPulse } from './blobs/shared.js';
import { DRUM_FNS, DRUM_COLORS } from './audio/drums.js';
import { NOTE_FREQS, NOTE_COLORS, playNote } from './audio/keys.js';
import { FACE_COLORS, playVocal } from './audio/vocals.js';
import { playSample } from './audio/sampler.js';
import { playBass, stretchToFreq } from './audio/bass.js';

// Wire the loop engine's fireEvent to audio + visual feedback
setFireEventCallback((type, index, ps) => {
  if (type === 'drum') {
    DRUM_FNS[index](ps);
    flashHit('drum', DRUM_COLORS[index]);
    blobPulse(drumBlob, index);
  } else if (type === 'key') {
    playNote(NOTE_FREQS[index], ps);
    flashHit('key', NOTE_COLORS[index]);
    blobPulse(keyBlob, index);
  } else if (type === 'face') {
    playVocal(index, ps);
    flashHit('face', FACE_COLORS[index]);
    blobPulse(faceBlob, index);
  } else if (type === 'bass') {
    const freq = stretchToFreq(index / 10000);
    playBass(freq, ps, 0.5);
    blobPulse(bassipedeBlob, 0);
  } else if (type === 'sample') {
    if (playSample(ps)) {
      flashHit('face', FACE_COLORS[2]);
      if (faceBlob.pulseNose) faceBlob.pulseNose();
    }
  }
  markFeedbackActive();
});

initControls();
initDispatch();
initFeedback();
initDebug();
updateButtons();
updateSampleIndicator();

let lastFrame = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = sceneClock.getElapsedTime();

  updatePhysics(dt);

  blobReg.forEach(b => {
    b.obj.group.position.set(b.x, b.y, 0);
    b.obj.tick(t);
  });

  updateNameLabels();
  renderer.render(scene, camera);
  updateFeedback();
}

animate();
