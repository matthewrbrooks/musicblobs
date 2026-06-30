const rows = [];
let panel, built = false, visible = false;

export function registerTweakable(label, get, set, min, max, step = 0.001) {
  rows.push({ label, get, set, min, max, step });
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

function buildPanel() {
  built = true;

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

    row.appendChild(lbl);
    row.appendChild(slider);
    row.appendChild(val);
    panel.appendChild(row);
  });
}
