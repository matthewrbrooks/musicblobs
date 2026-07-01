import { DRUM_FNS, DRUM_COLORS } from '../audio/drums.js';
import { NOTE_FREQS, NOTE_COLORS, playNote } from '../audio/keys.js';
import { FACE_COLORS, VOCAL_INDICES, playVocal } from '../audio/vocals.js';
import { playSample, sampleSlots } from '../audio/sampler.js';
import { flashHit, spawnRipple, showLabel, showBassLabel } from '../ui/effects.js';
import { blobPulse } from '../blobs/shared.js';
import { drumBlob, keyBlob, faceBlob, bassipedeBlob, worldToScreen } from '../scene.js';
import { recordEvent } from '../loop.js';
import { playBass, stretchToFreq, BASS_COLOR } from '../audio/bass.js';
import { markFeedbackActive } from '../ui/feedbackBus.js';

export function triggerDrum(i, cx, cy) {
  DRUM_FNS[i]();
  blobPulse(drumBlob, i);
  flashHit('drum', DRUM_COLORS[i]);
  spawnRipple(cx, cy, DRUM_COLORS[i]);
  showLabel('drum', i, cx, cy);
  recordEvent('drum', i);
  markFeedbackActive('drum');
}

export function triggerKey(i, cx, cy) {
  playNote(NOTE_FREQS[i]);
  blobPulse(keyBlob, i);
  flashHit('key', NOTE_COLORS[i]);
  spawnRipple(cx, cy, NOTE_COLORS[i]);
  showLabel('key', i, cx, cy);
  recordEvent('key', i);
  markFeedbackActive('key');
}

export function triggerFaceVocal(idx, cx, cy) {
  playVocal(idx);
  blobPulse(faceBlob, idx);
  flashHit('face', FACE_COLORS[idx]);
  spawnRipple(cx, cy, FACE_COLORS[idx]);
  showLabel('face', idx, cx, cy);
  recordEvent('face', idx);
  markFeedbackActive('face');
}

export function triggerFaceNose(cx, cy) {
  const ok = playSample();
  flashHit('face', FACE_COLORS[2]);
  spawnRipple(cx, cy, FACE_COLORS[2]);
  showLabel('face', 2, cx, cy);
  if (faceBlob.pulseNose) faceBlob.pulseNose();
  if (ok) { recordEvent('sample', 0); markFeedbackActive('face'); }
}

export function triggerBassPluck(brightness, cx, cy) {
  const bassObj = bassipedeBlob;
  const stretchNorm = bassObj.getStretchNorm();
  const freq = stretchToFreq(stretchNorm);
  playBass(freq, 1, brightness);
  blobPulse(bassObj, 0);
  flashHit('bass', BASS_COLOR);
  spawnRipple(cx, cy, BASS_COLOR);
  showBassLabel(freq, cx, cy);
  recordEvent('bass', Math.round(stretchNorm * 10000));
  markFeedbackActive('bass');
}

export function triggerRandomClick(blob, contactX, contactY) {
  const s = worldToScreen(contactX, contactY);
  if (blob.name === 'drum') {
    triggerDrum(Math.floor(Math.random() * 4), s.x, s.y);
  } else if (blob.name === 'key') {
    triggerKey(Math.floor(Math.random() * 8), s.x, s.y);
  } else if (blob.name === 'bass') {
    triggerBassPluck(0.5 + Math.random() * 0.5, s.x, s.y);
  } else if (blob.name === 'face') {
    const pool = sampleSlots.length > 0 ? [...VOCAL_INDICES, 2] : VOCAL_INDICES;
    const idx = pool[Math.floor(Math.random() * pool.length)];
    if (idx === 2) { triggerFaceNose(s.x, s.y); }
    else { triggerFaceVocal(idx, s.x, s.y); }
  }
}
