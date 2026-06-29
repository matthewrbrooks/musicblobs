import { DRUM_COLORS, DRUM_LABELS } from '../audio/drums.js';
import { NOTE_NAMES, NOTE_COLORS } from '../audio/keys.js';
import { FACE_ZONES, FACE_COLORS } from '../audio/vocals.js';

export function flashHit(which, color) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.style.background = color + '18';
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 80);
}

export function spawnRipple(cx, cy, color) {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const r = document.createElement('div');
      r.className = 'ripple ripple-' + (i + 1);
      r.style.left = cx + 'px';
      r.style.top = cy + 'px';
      r.style.borderColor = color;
      r.style.boxShadow = `0 0 8px ${color}, inset 0 0 5px ${color}55`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 680);
    }, i * 80);
  }
}

export function showLabel(type, idx, cx, cy) {
  let labelEl = document.getElementById('tap-lbl-' + type);
  if (!labelEl) {
    labelEl = document.createElement('div');
    labelEl.id = 'tap-lbl-' + type;
    labelEl.className = 'tap-label';
    document.getElementById('stage').appendChild(labelEl);
  }
  const texts = { drum: DRUM_LABELS, key: NOTE_NAMES, face: FACE_ZONES };
  const colors = { drum: DRUM_COLORS, key: NOTE_COLORS, face: FACE_COLORS };
  labelEl.textContent = texts[type][idx];
  labelEl.style.color = colors[type][idx];
  labelEl.style.border = `1px solid ${colors[type][idx]}55`;
  labelEl.style.background = colors[type][idx] + '22';
  labelEl.style.left = (cx - 40) + 'px';
  labelEl.style.top = (cy - 20) + 'px';
  labelEl.style.transform = 'translateY(0px)';
  labelEl.classList.remove('show');
  void labelEl.offsetWidth;
  labelEl.classList.add('show');
  clearTimeout(labelEl._t);
  labelEl._t = setTimeout(() => labelEl.classList.remove('show'), 700);
}

export function showBassLabel(freq, cx, cy) {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const name = noteNames[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  let el = document.getElementById('tap-lbl-bass');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tap-lbl-bass';
    el.className = 'tap-label';
    document.getElementById('stage').appendChild(el);
  }
  if (el._t) clearTimeout(el._t);
  el.textContent = name + octave;
  el.style.color = '#44ee88';
  el.style.border = '1px solid #44ee8855';
  el.style.background = '#44ee8818';
  el.style.left = (cx - 20) + 'px';
  el.style.top = (cy - 20) + 'px';
  el.style.transform = 'translateY(0px)';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  el._t = setTimeout(() => el.classList.remove('show'), 700);
}

export function showCountdown(text, isRec) {
  const el = document.getElementById('face-countdown');
  el.textContent = text;
  el.classList.toggle('rec', !!isRec);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

export function hideCountdown() {
  const el = document.getElementById('face-countdown');
  el.classList.remove('show');
  el.classList.remove('rec');
}
