const rows = [];
let panel, built = false, visible = false;

export function registerTweakable(label, get, set, min, max, step = 0.001) {
  rows.push({ label, get, set, min, max, step });
}

export function applySettings(saved) {
  rows.forEach(r => {
    if (Object.prototype.hasOwnProperty.call(saved, r.label)) {
      const v = parseFloat(saved[r.label]);
      if (!isNaN(v)) r.set(v);
    }
  });
  // Refresh sliders if the panel is already built
  if (built) rebuildSliders();
}

export function initDebug() {
  panel = document.createElement('div');
  panel.id = 'debug-panel';
  document.body.appendChild(panel);

  window.addEventListener('keydown', e => {
    if ((e.key === 'd' || e.key === 'D') && document.activeElement?.tagName !== 'INPUT') {
      toggle();
    }
  });
}

function fmt(v) { return parseFloat(v.toPrecision(3)).toString(); }

function toggle() {
  visible = !visible;
  if (visible && !built) buildPanel();
  panel.style.display = visible ? 'block' : 'none';
}

function saveSettings() {
  const data = {};
  rows.forEach(r => { data[r.label] = r.get(); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'settings.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

let sliderEls = [];

function rebuildSliders() {
  sliderEls.forEach(({ slider, val, get }) => {
    slider.value = get();
    val.textContent = fmt(get());
  });
}

function buildPanel() {
  built = true;
  sliderEls = [];

  const title = document.createElement('div');
  title.className = 'debug-title';
  title.textContent = 'debug';
  panel.appendChild(title);

  rows.forEach(({ label, get, set, min, max, step }) => {
    const row = document.createElement('div');
    row.className = 'debug-row';

    const lbl = document.createElement('span');
    lbl.className = 'debug-label';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className = 'debug-value';
    val.textContent = fmt(get());

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = get();
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      set(v);
      val.textContent = fmt(v);
    });

    sliderEls.push({ slider, val, get });
    row.appendChild(lbl);
    row.appendChild(slider);
    row.appendChild(val);
    panel.appendChild(row);
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'debug-save-btn';
  saveBtn.textContent = 'save settings.json';
  saveBtn.addEventListener('click', saveSettings);
  panel.appendChild(saveBtn);
}
