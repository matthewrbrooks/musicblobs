import { playWoodblock } from './audio/metronome.js';

export let bpm = 90;
export let loopEvents = [];
export let isRecording = false;
export let isPlaying = false;
export let isCountingIn = false;
export let countInDisplay = 0;
export let loopStart = null;
export let loopDuration = 0;

let playbackTimeout = null;
let rafId = null;
let metronomeTimer = null;

export let wonkiness = 0;
export let quantizeGrid = 16;

// Registered by main.js after blobs are created — avoids a circular import
let _fireEventCb = null;
export function setFireEventCallback(fn) { _fireEventCb = fn; }

export function getLoopDuration() { return (60000 / bpm) * 8; }
export function getBeatMs() { return 60000 / bpm; }
export function getGridMs() { return getBeatMs() * (4 / quantizeGrid); }

export function getBeatPulse() {
  if (!loopStart) return 0;
  if (isCountingIn) return 0;
  if (!isRecording && !isPlaying) return 0;
  const beatMs = getBeatMs();
  const elapsed = performance.now() - loopStart;
  if (elapsed < 0) return 0;
  const phase = (elapsed % beatMs) / beatMs;
  const pulse = Math.pow(1 - phase, 2.5);
  const beatNum = Math.floor(elapsed / beatMs);
  return (beatNum % 4 === 0) ? pulse * 1.35 : pulse;
}

export function setQuantizeGrid(g) {
  quantizeGrid = g;
  document.querySelectorAll('.grid-picker button[data-grid]').forEach(b => {
    b.classList.toggle('active', +b.dataset.grid === g);
  });
}

export function setWonkiness(v) {
  wonkiness = Math.max(-1, Math.min(1, v));
}

function transformEventTime(t, w, gridMs, loopDur) {
  if (Math.abs(w) < 0.005) return t;
  const gridT = Math.round(t / gridMs) * gridMs;
  let result;
  if (w < 0) {
    result = t * (1 + w) + gridT * (-w);
  } else {
    const distance = t - gridT;
    let direction = distance >= 0 ? 1 : -1;
    if (distance === 0) direction = Math.random() < 0.5 ? -1 : 1;
    const maxPush = gridMs * 0.45;
    const push = direction * w * maxPush * (0.7 + Math.random() * 0.3);
    result = t + push;
  }
  return ((result % loopDur) + loopDur) % loopDur;
}

function computeWonkPitch(w) {
  if (w <= 0) return 1;
  const maxCents = w * w * 700;
  const cents = (Math.random() * 2 - 1) * maxCents;
  return Math.pow(2, cents / 1200);
}

export function setTempo(v) {
  bpm = v;
  document.getElementById('tempo-val').textContent = v + ' BPM';
  loopDuration = getLoopDuration();
  if (isPlaying) restartPlayback();
}

export function recordEvent(type, index) {
  if (!isRecording) return;
  const t = (performance.now() - loopStart) % loopDuration;
  loopEvents.push({ t, type, index });
}

function fireEvent(type, index, pitchScale) {
  if (_fireEventCb) _fireEventCb(type, index, pitchScale);
}

export function recBtnClick() {
  if (isCountingIn) { stopMetronome(); updateButtons(); return; }
  if (isRecording) { stopRecording(); } else { startRecording(); }
}

export function playBtnClick() {
  if (isCountingIn) { stopMetronome(); updateButtons(); return; }
  if (isRecording) { stopRecording(); return; }
  if (isPlaying) { stopPlaybackNow(); }
  else if (loopEvents.length > 0) { startPlaybackFresh(); }
}

export function updateButtons() {
  const rec = document.getElementById('rec-btn');
  const play = document.getElementById('play-btn');
  if (isCountingIn) {
    rec.className = 'counting';
    rec.textContent = '● ' + countInDisplay;
  } else if (isRecording) {
    rec.className = 'recording';
    rec.textContent = '■ STOP';
  } else {
    rec.className = '';
    rec.textContent = '● REC';
  }
  if (isPlaying) {
    play.className = 'playing';
    play.textContent = '■ STOP';
  } else if (loopEvents.length > 0) {
    play.className = '';
    play.textContent = '▶ PLAY';
  } else {
    play.className = 'disabled';
    play.textContent = '▶ PLAY';
  }
}

function startRecording() {
  loopDuration = getLoopDuration();
  if (isPlaying && loopEvents.length > 0) {
    isRecording = true;
    updateButtons();
    startMetronomeForOverdub();
  } else {
    loopEvents = [];
    isPlaying = false;
    isRecording = false;
    clearTimeout(playbackTimeout);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    document.getElementById('loop-bar').style.width = '0%';
    startCountInThenRecord();
  }
}

function stopRecording() {
  if (isCountingIn) { stopMetronome(); updateButtons(); return; }
  const wasOverdub = isPlaying;
  isRecording = false;
  stopMetronome();
  if (!wasOverdub) {
    if (loopEvents.length > 0) {
      isPlaying = true;
      loopStart = performance.now();
      schedulePlayback();
      if (!rafId) animateLoopBar();
    } else {
      isPlaying = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      document.getElementById('loop-bar').style.width = '0%';
    }
  }
  updateButtons();
}

function startPlaybackFresh() {
  isPlaying = true;
  loopDuration = getLoopDuration();
  loopStart = performance.now();
  schedulePlayback();
  if (!rafId) animateLoopBar();
  updateButtons();
}

function stopPlaybackNow() {
  isPlaying = false;
  clearTimeout(playbackTimeout);
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.getElementById('loop-bar').style.width = '0%';
  updateButtons();
}

export function clearLoop() {
  isRecording = false; isPlaying = false;
  loopEvents = [];
  clearTimeout(playbackTimeout);
  stopMetronome();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  document.getElementById('loop-bar').style.width = '0%';
  updateButtons();
}

function schedulePlayback() {
  clearTimeout(playbackTimeout);
  if (!isPlaying) return;
  const now = performance.now();
  const elapsed = (now - loopStart) % loopDuration;
  const gridMs = getGridMs();
  loopEvents.forEach(ev => {
    const tT = transformEventTime(ev.t, wonkiness, gridMs, loopDuration);
    let delay = tT - elapsed;
    if (delay < 0) delay += loopDuration;
    const pitchScale = computeWonkPitch(wonkiness);
    setTimeout(() => {
      if (!isPlaying) return;
      fireEvent(ev.type, ev.index, pitchScale);
    }, delay);
  });
  playbackTimeout = setTimeout(() => {
    if (isPlaying) { loopStart = performance.now(); schedulePlayback(); }
  }, loopDuration - elapsed + 2);
}

function restartPlayback() {
  clearTimeout(playbackTimeout);
  loopStart = performance.now();
  if (isPlaying) schedulePlayback();
}

function animateLoopBar() {
  rafId = requestAnimationFrame(animateLoopBar);
  if (!isRecording && !isPlaying) { rafId = null; return; }
  const elapsed = (performance.now() - loopStart) % loopDuration;
  document.getElementById('loop-bar').style.width = (elapsed / loopDuration * 100) + '%';
}

function startCountInThenRecord() {
  stopMetronome();
  isCountingIn = true;
  countInDisplay = 0;
  let beat = -4;
  updateButtons();
  function tick() {
    if (beat === 0) {
      isCountingIn = false;
      isRecording = true;
      loopDuration = getLoopDuration();
      loopStart = performance.now();
      if (!rafId) animateLoopBar();
      updateButtons();
    }
    const accent = (beat < 0) || (beat % 4 === 0);
    playWoodblock(accent);
    if (beat < 0) { countInDisplay = -beat; updateButtons(); }
    beat++;
    if (isCountingIn || isRecording) {
      metronomeTimer = setTimeout(tick, getBeatMs());
    } else {
      metronomeTimer = null;
    }
  }
  tick();
}

function startMetronomeForOverdub() {
  stopMetronome();
  const beatMs = getBeatMs();
  const elapsed = performance.now() - loopStart;
  const sinceLastBeat = ((elapsed % beatMs) + beatMs) % beatMs;
  const timeToNextBeat = beatMs - sinceLastBeat;
  let beat = Math.floor(elapsed / beatMs) + 1;
  function tick() {
    if (!isRecording) { metronomeTimer = null; return; }
    playWoodblock(beat % 4 === 0);
    beat++;
    metronomeTimer = setTimeout(tick, getBeatMs());
  }
  metronomeTimer = setTimeout(tick, Math.max(8, timeToNextBeat));
}

function stopMetronome() {
  isCountingIn = false;
  if (metronomeTimer) { clearTimeout(metronomeTimer); metronomeTimer = null; }
}
