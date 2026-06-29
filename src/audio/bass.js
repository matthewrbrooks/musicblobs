import { ensureAudio, getReverb } from './context.js';

// TWEAKABLES
const BASS_MIN_FREQ = 41.20;  // E1
const BASS_MAX_FREQ = 82.41;  // E2
let BASS_LONGER_IS_LOWER = true;
let BASS_PITCH_MODE = 'free'; // 'free' | 'semitone' | 'scale'

export const BASS_COLOR = '#44ee88';

export function stretchToFreq(stretchNorm) {
  const norm = BASS_LONGER_IS_LOWER ? (1 - stretchNorm) : stretchNorm;
  if (BASS_PITCH_MODE === 'semitone') {
    const semi = Math.round(norm * 12);
    return BASS_MIN_FREQ * Math.pow(2, semi / 12);
  }
  return BASS_MIN_FREQ * Math.pow(2, norm); // free / scale fallback
}

export function playBass(freq, ps = 1, brightness = 0.5) {
  const ac = ensureAudio();
  const f = freq * ps;
  const t = ac.currentTime;

  const osc1 = ac.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = f;

  const osc2 = ac.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = f * 2;

  const gainMain = ac.createGain();
  gainMain.gain.setValueAtTime(0, t);
  gainMain.gain.linearRampToValueAtTime(0.55, t + 0.008);
  gainMain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

  const gainHarm = ac.createGain();
  gainHarm.gain.value = brightness * 0.35;

  osc1.connect(gainMain);
  osc2.connect(gainHarm);
  gainHarm.connect(gainMain);
  gainMain.connect(getReverb());
  gainMain.connect(ac.destination);

  osc1.start(t); osc2.start(t);
  osc1.stop(t + 0.75); osc2.stop(t + 0.75);
}
