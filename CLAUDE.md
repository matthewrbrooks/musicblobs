# MusicBlobs

A browser-based musical toy: four psychedelic 3D blob creatures in a shared scene, each playing a different instrument. Built for both kids and adults — playful, glowy, hands-on. Vite + ES modules; deployed to Netlify.

## Stack

- Three.js `v0.165.0` via npm
- Web Audio API for all sound (no audio libraries)
- Vite 5 build system
- Deployed to Netlify; password-gated in production via `VITE_APP_PASSWORD` env var

## Running locally

```bash
npm run dev
# then open http://localhost:5173
```

**Microphone access requires `localhost` or `https://`** — `file://` URLs and the Claude Desktop preview iframe both block `getUserMedia`. Facey's sample recording will silently fail outside a secure origin.

## The four creatures

Each lives in a Three.js `Group`, has a `tick(t)` method called every frame, and exposes a `pulse(idx)` method for visual feedback on hits. All four share one scene, one canvas, one set of lights.

### Drumbo (drum machine)

- Spiky `IcosahedronGeometry(1.3, 4)` with blobify scale `0.22`
- 4 drum pads in a tight 2×2 grid on the face
- Sounds: kick, snare, hihat, clap (synthesized via Web Audio)
- Decorative red eyes above the top two pads (positions derived from pad tweakables — adjust pad layout and eyes follow)

### Keebo (keyboard)

- Smoothed `SphereGeometry(1.35, 64, 64)` with blobify scale `0.08`
- 8 keys in C major across the front, sit at `z=1.6` so the breathing body never occludes them
- Two antennae on top (tagged as `body` so they participate in dragging)
- Supports glissando — drag across keys and each one triggers on entry, no retrigger until the cursor leaves and re-enters
- Click-through-gaps prevention: hits on the body within the key strip's local rectangle are treated as `key-strip` events, not drag starts

### Facey (vocal sampler)

- Elongated head with several interactive face parts
- **Vocal parts** (eyes, forehead, cheeks) — synthesized "ooh / aah / wow / weird" sounds, indexed by `VOCAL_INDICES = [0,1,4,5,6]`
- **Nose** — plays back a recorded sample at the current mouth-stretch pitch
- **Mouth** — vertical stretchy pill; drag-down stretches the mouth and lowers playback pitch (2-octave range, rest = `2.0×`, fully stretched = `0.5×`, exponential)
- **Left ear (yellow)** — toggles lock/random mode for sample playback; shows a glowing halo ring when locked
- **Right ear (pink)** — records a fresh 2-second sample (3-2-1 countdown via `MediaRecorder`)
- Up to 100 sample slots, FIFO when full; a new recording auto-locks to its slot

### Bassipede (bass synthesizer)

- Worm-like creature: a head, a cylindrical body, and a tail, plus a guitar pick that floats near the body
- **Playing**: drag a pointer across the body axis to pluck — a per-pointer crossing tracker fires `triggerBassPluck` on each side-change
- **Pitch**: set by stretching the body (drag the tail). Longer = lower; range is E1–E2 (one octave). `stretchToFreq` maps body length to frequency
- **Pitch modes** (internal constant `BASS_PITCH_MODE`): `'free'` (exponential, default), `'semitone'` (quantized to 12 steps), `'scale'` (same as free currently — unimplemented)
- Body range: `BASS_MIN_LENGTH = 1.1`, `BASS_MAX_LENGTH = 2.5`, initial `1.8`
- Tail can be dragged independently; dragging the head body moves both head and tail together

## Architecture

### Module structure

```
src/
  main.js                   — entry point; wires loop fire-event callback; runs animate loop
  scene.js                  — Three.js scene, camera, renderer, lights, blob registry (blobReg)
  loop.js                   — loop engine, BPM, wonk, quantize, record/play state
  gate.js                   — password gate (prod only, VITE_APP_PASSWORD)
  audio/
    context.js              — AudioContext singleton (ensureAudio), reverb node, Safari warm-up
    drums.js                — DRUM_FNS, DRUM_COLORS, DRUM_LABELS
    keys.js                 — NOTE_FREQS, NOTE_COLORS, NOTE_NAMES, playNote
    vocals.js               — FACE_COLORS, FACE_ZONES, VOCAL_INDICES, playVocal
    sampler.js              — MediaRecorder, sampleSlots, playSample, toggleLock
    bass.js                 — stretchToFreq, playBass, BASS_COLOR
    metronome.js            — playWoodblock (count-in + overdub click)
  blobs/
    drumbo.js               — buildDrumbo()
    keebo.js                — buildKeebo()
    facey.js                — buildFacey()
    bassipede.js            — buildBassipede(), BASS_MIN/MAX_LENGTH
    shared.js               — blobPulse (shared emissive flash)
  interaction/
    dispatch.js             — all pointer/touch event listeners, raycast, gesture state
    triggers.js             — triggerDrum, triggerKey, triggerFaceVocal, triggerFaceNose,
                              triggerBassPluck, triggerRandomClick
  physics/
    physics.js              — updatePhysics, setMoveMode, collidingPairs, draggedBlob
  ui/
    controls.js             — wires topbar DOM controls to loop/physics functions
    effects.js              — spawnRipple, showLabel, showBassLabel, flashHit
    feedback.js             — video feedback effect (canvas2D over the stage)
    feedbackBus.js          — markFeedbackActive / consumeFeedbackActive decoupling
    debug.js                — debug panel (D key), registerTweakable, applySettings
```

### Hit dispatch via `userData`

Every interactive mesh has `userData = { kind, ... }`. `dispatch.js` raycasts on `mousedown`/`touchstart`, reads `hits[0].object.userData.kind`, then switches:

```
'drum-pad'    → triggerDrum(index, cx, cy)
'key-pad'     → triggerKey(index, cx, cy)   [also handled via key-strip body-hit check]
'face-vocal'  → triggerFaceVocal(partIdx, cx, cy)
'face-mouth'  → start mouth pitch drag
'face-ear'    → if partIdx===7 toggleLock() else startSampleRecord()
'face-nose'   → triggerFaceNose(cx, cy)
'bass-tail'   → start tail drag (sets body length/direction)
'bass-body'   → pluck crossing tracked on every pointermove (no action on down)
'body'        → start blob drag
```

### Factored trigger functions (`src/interaction/triggers.js`)

`triggerDrum`, `triggerKey`, `triggerFaceVocal`, `triggerFaceNose`, `triggerBassPluck` are standalone so *both* real clicks and collision-fired clicks share the exact same code path. This means loop recording, ripples, labels, pulses, and flash effects all happen identically whether triggered by user or physics. **If you add new musical surfaces, factor them this way.**

### Loop engine (`src/loop.js`)

- Default 90 BPM, 2 bars (8 beats)
- `loopEvents[]` of `{t, type, index}` where `type ∈ ['drum','key','face','sample','bass']`
- Independent REC and PLAY buttons
- 4-beat count-in when starting a fresh recording (REC counts down 4→1, then "STOP")
- Overdub mode when REC is pressed during playback (no count-in, aligned to existing phase)
- Gentle woodblock metronome during count-in and recording, silent during pure playback
- `getBeatPulse()` returns a 0–1 pulse from `loopStart` phase; blob bodies' `emissiveIntensity` is modulated by it
- `snapToGrid` (Snap button in topbar) — quantizes recorded events to the current grid on capture

### Wonk + quantize

- `wonkiness ∈ [-1, +1]`: negative quantizes toward the grid, positive pushes events off-grid *and* offsets pitch
- `ps` (pitchScale) is computed per-event at playback schedule time and passed through the fire-event callback; direct user clicks always receive `ps = 1`
- Wonk changes apply on the *next* loop cycle, never mid-cycle (prevents glitching)
- Quantize grid: 1/16, 1/8, 1/4

### Physics (`src/physics/physics.js`)

Two `moveMode` values, switchable via the UI. **Bounce is the default.**

- **Bounce**: elastic blob-on-blob collisions, air drag, walls have 0.7 restitution. Dragged blobs have effectively infinite mass and impart velocity to anything they hit.
- **Avoid**: blobs spring back to their home positions, with repulsion from the dragged blob and from each other.

**Bounce mode triggers musical events on new collisions.** `collidingPairs` (a `Set`) tracks which pairs are currently touching, so `triggerRandomClick` fires only on the first frame of contact.

### Video feedback effect (`src/ui/feedback.js`)

Activates when `|wonkiness| > 0.5`; intensity scales with effect strength above that threshold.

- A second `WebGLRenderer` (`inRenderer`) renders only the sounding blobs per frame into an offscreen canvas — pixel-accurate shapes with correct lighting, no canvas readback hacks
- `feedbackBus.js` decouples activation: audio triggers call `markFeedbackActive(blobName)`, the feedback render loop calls `consumeFeedbackActive()` to get which blobs to stamp
- All parameters registered as tweakables (see debug panel)

### Debug panel (`src/ui/debug.js`)

- Toggle with `D` key
- `registerTweakable(label, get, set, min, max, step)` — called during `init*` functions by any module that wants a slider (currently only `feedback.js`)
- **Save button**: downloads current values as `settings.json`
- **Auto-load on startup**: `main.js` fetches `/settings.json` and calls `applySettings()` after all inits — drop a saved file into `public/settings.json` to persist across sessions

### Visual effects

- Ripples: 3 concentric rings staggered 80ms apart, ease-out curve, colour matches the tapped element
- Body illumination on the beat (via `getBeatPulse()`)
- Floating tap labels above each interaction point
- Floating creature name labels track each blob's screen position
- Hit flash overlay tints the screen briefly on each event
- **Use `mousedown`, not `click`** — musical immediacy matters more than conventional click semantics

## Tweakable constants

### Drumbo (`src/blobs/drumbo.js`)
```js
DRUMBO_PAD_RADIUS  = 0.42   // disc radius
DRUMBO_PAD_HEIGHT  = 0.08   // disc thickness
DRUMBO_PAD_SPACING = 0.48   // half-distance between adjacent pads
DRUMBO_PAD_Z       = 1.50   // depth — must clear body bumps (max ≈ 1.52)
```

### Bassipede (`src/blobs/bassipede.js` / `src/audio/bass.js`)
```js
BASS_MIN_LENGTH      = 1.1     // world units (highest pitch)
BASS_MAX_LENGTH      = 2.5     // world units (lowest pitch)
BASS_INITIAL_LENGTH  = 1.8
BASS_MIN_FREQ        = 41.20   // E1
BASS_MAX_FREQ        = 82.41   // E2
BASS_LONGER_IS_LOWER = true    // invert to flip pitch direction
BASS_PITCH_MODE      = 'free'  // 'free' | 'semitone' | 'scale'
```

### Feedback (`src/ui/feedback.js` — all exposed in debug panel)
```js
FB_SCALE_PER_FRAME = 0.008   // echo expands this fraction per frame at max wonk
FB_TWIST_PER_FRAME = 0.003   // radians of rotation added per frame at max wonk
FB_ECHO_ALPHA      = 0.92    // fraction of echo surviving each frame at max wonk
FB_STAMP_ALPHA     = 0.75    // opacity of fresh-frame stamp onto the feedback
FB_FADE_ALPHA      = 0.07    // alpha eaten per frame so echoes vanish fully
FB_MAX_HUE_DEG     = 25      // max CSS hue-rotate at full wonk
FB_MAX_SATURATE    = 2.8     // max CSS saturate at full wonk
FB_MAX_BLUR_PX     = 1.2     // max CSS blur at full wonk
```

### Facey (`src/audio/sampler.js`)
```js
MAX_SAMPLES      = 100    // FIFO cap
faceyMonophonic  = true   // INTERNAL — true: new sample cuts existing; false: polyphonic
```

Other notable globals: `NOTE_FREQS` / `NOTE_COLORS` (Keebo), `DRUM_COLORS` / `DRUM_LABELS` (Drumbo), `FACE_ZONES` / `FACE_COLORS` / `VOCAL_INDICES` (Facey).

## Conventions

- **Single source of truth for click handling.** All musical triggers go through their factored functions in `triggers.js`. Don't inline duplicate dispatch logic.
- **Tweakable constants near the build/audio function.** Don't bury layout numbers in animation code.
- **`registerTweakable` for dev/aesthetic parameters** rather than exposing a UI control. The debug panel handles the slider automatically.
- **Visual feedback is shared overlay-driven.** Don't create per-creature ripples/labels — call the shared `spawnRipple`, `showLabel`, `flashHit` from `effects.js`.
- **No raw `click` events for sound triggers** — use `mousedown` / `touchstart` for immediacy.
- **`ensureAudio()` before any Web Audio call** — creates and resumes the AudioContext, including the Safari warm-up buffer.

## Common gotchas

- **Body bumps occluding interactive surfaces.** The blobify noise can push body geometry well in front of interactive elements. Push the surface forward in `z` (Keebo's keys at `z=1.6`, Drumbo's pads at `z=1.5`) rather than reducing blobify.
- **Mic in iframe.** Claude Desktop's preview iframe doesn't delegate microphone permission, and `file://` can't grant secure-origin permission. Use the dev server for testing Facey's recording.
- **Worldspace ≠ local space when checking hits.** `worldToLocal(hit.point.clone())` — always `.clone()`, `worldToLocal` mutates.
- **Sample indices on FIFO eviction.** When the slot array shifts, `lockedSlot` and `lastPlayedSlot` indices need adjusting. There's a helper — `storeSampleBuffer`.
- **Wonk pitch is per-event, not global.** `ps` is computed at schedule time and passed into `fireEvent`. Direct user triggers always pass `ps = 1`. Don't store it as a global or subsequent direct clicks inherit it.
- **Feedback inRenderer visibility.** `feedback.js` temporarily hides non-active blobs for the in-buffer render pass, then restores all to `visible = true`. Don't add rendering side-effects inside `tick()` that assume all blobs are always visible.
- **Password gate blocks `main.js`.** In production, `await gate()` at the top of `main.js` blocks all imports until the correct password is entered. Auth state is stored in `localStorage` under key `mb_auth`. Set `VITE_APP_PASSWORD` in Netlify env vars.
- **settings.json load timing.** `applySettings` is called after `initFeedback()` (which synchronously registers all tweakables), so the async fetch is safe. If you add new tweakables, register them inside an `init*` call, not lazily.

## Open work

- [ ] Bassipede pluck detection has known issues (mid-implementation per commit history)
- [ ] Consider velocity-mapped volume on blob-on-blob collision triggers (faster impact = louder)
- [ ] Decide whether to expose `faceyMonophonic` to UI or leave internal
- [ ] Wonk pitch range currently ±7 semitones at max — possibly too aggressive
- [ ] Bass `'scale'` pitch mode is unimplemented (falls through to `'free'`)

## Useful files

```
index.html              — HTML shell; blob name labels, topbar controls
src/main.js             — entry point; wires everything together
src/scene.js            — Three.js setup, blobReg, worldToScreen, updateNameLabels
src/loop.js             — loop engine, BPM, wonk, snapToGrid, REC/PLAY state
src/interaction/        — dispatch.js (pointer handling), triggers.js (musical actions)
src/ui/feedback.js      — video feedback effect and all its tweakables
src/ui/debug.js         — debug panel, registerTweakable, save/load settings.json
public/settings.json    — persisted debug panel values, loaded on startup
musicblobs.html         — legacy monolithic prototype (reference only)
CLAUDE.md               — this file
```
