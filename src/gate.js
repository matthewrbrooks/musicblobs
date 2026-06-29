const PASSWORD = import.meta.env.VITE_APP_PASSWORD;
const AUTH_KEY = 'mb_auth';

export function gate() {
  if (!import.meta.env.PROD || !PASSWORD || localStorage.getItem(AUTH_KEY)) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const style = document.createElement('style');
    style.textContent = `
      #mb-gate {
        position:fixed;inset:0;z-index:9999;
        background:#08050f;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
        font-family:'Courier New',monospace;
      }
      #mb-gate-title {
        font-size:1.6rem;letter-spacing:0.22em;
        background:linear-gradient(90deg,#b070ff,#70c0ff,#ff70b0);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      }
      #mb-gate-form { display:flex;flex-direction:column;align-items:center;gap:12px; }
      #mb-gate-input {
        padding:8px 14px;width:220px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(180,140,255,0.4);border-radius:4px;
        color:#e0d8ff;font-family:'Courier New',monospace;font-size:0.9rem;
        letter-spacing:0.1em;outline:none;text-align:center;
      }
      #mb-gate-input:focus { border-color:#b070ff;box-shadow:0 0 8px #b070ff44; }
      #mb-gate-input.wrong {
        border-color:#ff4444;box-shadow:0 0 8px #ff444444;
        animation:mb-shake 0.35s ease;
      }
      @keyframes mb-shake {
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-7px)}60%{transform:translateX(7px)}80%{transform:translateX(-4px)}
      }
      #mb-gate-btn {
        padding:7px 22px;border-radius:20px;cursor:pointer;
        font-family:'Courier New',monospace;font-size:0.75rem;letter-spacing:0.12em;
        text-transform:uppercase;
        border:1px solid rgba(180,140,255,0.4);background:rgba(180,140,255,0.1);color:#c0a8ff;
        transition:all 0.15s;
      }
      #mb-gate-btn:hover { background:rgba(180,140,255,0.22);border-color:#b070ff; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'mb-gate';
    overlay.innerHTML = `
      <div id="mb-gate-title">MusicBlobs</div>
      <form id="mb-gate-form">
        <input id="mb-gate-input" type="password" placeholder="password" autocomplete="current-password">
        <button id="mb-gate-btn" type="submit">Enter</button>
      </form>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#mb-gate-input');
    input.focus();

    overlay.querySelector('#mb-gate-form').addEventListener('submit', e => {
      e.preventDefault();
      if (input.value === PASSWORD) {
        localStorage.setItem(AUTH_KEY, '1');
        overlay.remove();
        style.remove();
        resolve();
      } else {
        input.value = '';
        input.classList.remove('wrong');
        void input.offsetWidth;
        input.classList.add('wrong');
        input.addEventListener('animationend', () => input.classList.remove('wrong'), { once: true });
      }
    });
  });
}
