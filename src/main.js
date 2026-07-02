import './style.css';
import { gate } from './gate.js';
await gate();
import { renderer, scene, camera, sceneClock, blobReg, drumBlob, keyBlob, faceBlob, bassipedeBlob, updateNameLabels } from './scene.js';
import { updatePhysics, initPhysics } from './physics/physics.js';
import { setFireEventCallback, updateButtons } from './loop.js';
import { updateSampleIndicator } from './audio/sampler.js';
import { initDispatch } from './interaction/dispatch.js';
import { initControls } from './ui/controls.js';
import { initFeedback, updateFeedback } from './ui/feedback.js';
import { markFeedbackActive } from './ui/feedbackBus.js';
import { initDebug, applySettings } from './ui/debug.js';
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
    markFeedbackActive('drum');
  } else if (type === 'key') {
    playNote(NOTE_FREQS[index], ps);
    flashHit('key', NOTE_COLORS[index]);
    blobPulse(keyBlob, index);
    markFeedbackActive('key');
  } else if (type === 'face') {
    playVocal(index, ps);
    flashHit('face', FACE_COLORS[index]);
    blobPulse(faceBlob, index);
    markFeedbackActive('face');
  } else if (type === 'bass') {
    const freq = stretchToFreq(index / 10000);
    playBass(freq, ps, 0.5);
    blobPulse(bassipedeBlob, 0);
    markFeedbackActive('bass');
  } else if (type === 'sample') {
    if (playSample(ps)) {
      flashHit('face', FACE_COLORS[2]);
      if (faceBlob.pulseNose) faceBlob.pulseNose();
      markFeedbackActive('face');
    }
  }
});

initControls();
initDispatch();
initFeedback();
initDebug();
initPhysics();
updateButtons();
updateSampleIndicator();

fetch('/settings.json')
  .then(r => r.ok ? r.json() : null)
  .then(data => { if (data) applySettings(data); })
  .catch(() => {});

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
