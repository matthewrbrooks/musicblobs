import { ensureAudio, getReverb } from './context.js';
import { showCountdown, hideCountdown } from '../ui/effects.js';

export const MAX_SAMPLES = 100;
export const sampleSlots = [];       // AudioBuffer[]
export let lockedSlot = null;        // null = random mode; integer = locked to that slot
export let lastPlayedSlot = null;

let micStream = null;
export let isCountingDown = false;
export let isRecordingSample = false;
const activeSampleSources = [];

let faceyMonophonic = true;

let mouthStretch = 0;

export function getMouthStretch() { return mouthStretch; }

export function pitchRateFromStretch(s) {
  s = Math.max(0, Math.min(1, s));
  return Math.pow(2, 1 - s * 2);
}

export function setMouthStretch(s) {
  mouthStretch = Math.max(0, Math.min(1, s));
  const rate = pitchRateFromStretch(mouthStretch);
  activeSampleSources.forEach(src => {
    try { src.playbackRate.value = rate; } catch (e) {}
  });
}

async function ensureMic() {
  if (micStream) return micStream;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Microphone not available');
  }
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return micStream;
}

export function updateSampleIndicator() {
  const el = document.getElementById('sample-indicator');
  if (!el) return;
  const n = sampleSlots.length;
  let text, loaded;
  if (n === 0) {
    text = 'no samples';
    loaded = false;
  } else if (lockedSlot !== null) {
    text = `${n} sample${n > 1 ? 's' : ''} · 🔒 #${lockedSlot + 1}`;
    loaded = true;
  } else {
    text = `${n} sample${n > 1 ? 's' : ''} · 🎲 random`;
    loaded = true;
  }
  el.textContent = text;
  el.classList.toggle('loaded', loaded);
}

export function storeSampleBuffer(buf) {
  if (sampleSlots.length >= MAX_SAMPLES) {
    sampleSlots.shift();
    if (lockedSlot !== null) lockedSlot = lockedSlot === 0 ? null : lockedSlot - 1;
    if (lastPlayedSlot !== null) lastPlayedSlot = lastPlayedSlot === 0 ? null : lastPlayedSlot - 1;
  }
  sampleSlots.push(buf);
  lockedSlot = sampleSlots.length - 1;
  updateSampleIndicator();
}

export function toggleLock() {
  if (sampleSlots.length === 0) return;
  if (lockedSlot !== null) {
    lockedSlot = null;
  } else if (lastPlayedSlot !== null) {
    lockedSlot = lastPlayedSlot;
  } else {
    lockedSlot = sampleSlots.length - 1;
  }
  updateSampleIndicator();
}

export async function startSampleRecord() {
  if (isCountingDown || isRecordingSample) return;
  isCountingDown = true;
  try {
    await ensureMic();
  } catch (e) {
    console.error('Mic error', e);
    showCountdown('NO MIC');
    setTimeout(() => { hideCountdown(); isCountingDown = false; }, 1400);
    return;
  }

  for (let n = 3; n >= 1; n--) {
    showCountdown(String(n), false);
    await new Promise(r => setTimeout(r, 1000));
    if (!isCountingDown) return;
  }

  isRecordingSample = true;
  showCountdown('● REC', true);

  const chunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(micStream);
  } catch (e) {
    console.error('Recorder error', e);
    showCountdown('NO REC');
    setTimeout(() => { hideCountdown(); isCountingDown = false; isRecordingSample = false; }, 1400);
    return;
  }
  recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = async () => {
    hideCountdown();
    isCountingDown = false;
    isRecordingSample = false;
    if (chunks.length === 0) { updateSampleIndicator(); return; }
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    try {
      const arrayBuf = await blob.arrayBuffer();
      const ac = ensureAudio();
      const buf = await ac.decodeAudioData(arrayBuf);
      storeSampleBuffer(buf);
    } catch (e) {
      console.error('Decode failed', e);
    }
  };
  recorder.start();
  setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 2000);
}

export function pickPlaybackSlot() {
  if (sampleSlots.length === 0) return null;
  if (lockedSlot !== null) return lockedSlot;
  return Math.floor(Math.random() * sampleSlots.length);
}

export function playSample(ps = 1) {
  const slot = pickPlaybackSlot();
  if (slot === null) { updateSampleIndicator(); return false; }
  const ac = ensureAudio();
  if (faceyMonophonic) {
    activeSampleSources.forEach(s => { try { s.stop(); } catch (e) {} });
  }
  const src = ac.createBufferSource();
  src.buffer = sampleSlots[slot];
  src.playbackRate.value = pitchRateFromStretch(mouthStretch) * ps;
  src.connect(getReverb());
  src.connect(ac.destination);
  activeSampleSources.push(src);
  src.onended = () => {
    const i = activeSampleSources.indexOf(src);
    if (i >= 0) activeSampleSources.splice(i, 1);
  };
  src.start();
  lastPlayedSlot = slot;
  return true;
}
