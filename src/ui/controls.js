import { setTempo, setWonkiness, setQuantizeGrid, recBtnClick, playBtnClick, clearLoop } from '../loop.js';
import { setMoveMode } from '../physics/physics.js';

export function initControls() {
  document.getElementById('tempo-slider').addEventListener('input', e => setTempo(+e.target.value));
  document.getElementById('wonk-slider').addEventListener('input', e => setWonkiness(+e.target.value / 100));

  document.querySelectorAll('.grid-picker button[data-grid]').forEach(btn => {
    btn.addEventListener('click', () => setQuantizeGrid(+btn.dataset.grid));
  });

  document.querySelectorAll('#move-picker button').forEach(btn => {
    btn.addEventListener('click', () => setMoveMode(btn.dataset.move));
  });

  document.getElementById('rec-btn').addEventListener('click', recBtnClick);
  document.getElementById('play-btn').addEventListener('click', playBtnClick);
  document.getElementById('clear-btn').addEventListener('click', clearLoop);
}
