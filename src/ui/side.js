'use strict';
// Vertical tabs. Talks to the main process through the same whitelisted bridge as the toolbar.
(function () {
  const L = window.lumen;
  const list = document.getElementById('list');
  const add = document.getElementById('add');
  add.querySelector('#addic').innerHTML = window.icon('plus', 16);
  add.addEventListener('click', () => L.send('cmd', 'newTab'));

  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const hue = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; };

  function el(tag, cls, props) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (props) for (const k of Object.keys(props)) { if (k === 'text') e.textContent = props[k]; else if (k === 'html') e.innerHTML = props[k]; else e.setAttribute(k, props[k]); }
    return e;
  }
  function fav(t) {
    if (t.loading) return el('span', 'vspin');
    const host = hostOf(t.url);
    const box = el('span', 'vf');
    const letter = () => { box.textContent = (host[0] || 'N').toUpperCase(); box.style.background = 'hsl(' + hue(host || 'new') + ' 50% 42%)'; };
    if (t.favicon) {
      const img = el('img', null, { src: t.favicon, alt: '', draggable: 'false' });
      img.addEventListener('error', () => { img.remove(); letter(); });
      box.append(img);
    } else letter();
    return box;
  }
  function row(t, active) {
    const r = el('div', 'vt' + (t.sleeping ? ' sleeping' : '') + (t.audible ? ' audible' : '') + (t.pinned ? ' pinned' : ''), { role: 'tab', tabindex: '0', 'aria-selected': String(t.id === active), title: t.title });
    r.dataset.id = String(t.id);
    r.append(fav(t), el('span', 'vtt', { text: t.title }), el('span', 'vi pin', { html: window.icon('star', 13) }), el('span', 'vi snd', { html: window.icon('sound', 14) }));
    const x = el('button', 'vx', { type: 'button', 'aria-label': 'Close tab', tabindex: '-1', html: window.icon('close', 14) });
    x.addEventListener('click', (e) => { e.stopPropagation(); L.send('tab:close', t.id); });
    r.append(x);
    r.addEventListener('click', () => L.send('tab:activate', t.id));
    r.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); L.send('tab:close', t.id); } });
    r.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); L.send('tab:activate', t.id); } });
    return r;
  }

  let lastKey = '';
  L.on('state', (s) => {
    if (s.isPrivate) document.documentElement.setAttribute('data-private', ''); else document.documentElement.removeAttribute('data-private');
    const key = JSON.stringify([s.activeId, s.tabs.map(t => [t.id, t.title, t.url, t.favicon, t.loading, t.sleeping, t.audible, t.pinned])]);
    if (key === lastKey) return;
    lastKey = key;
    const keepScroll = list.scrollTop;
    list.textContent = '';
    s.tabs.forEach((t) => list.append(row(t, s.activeId)));
    list.scrollTop = keepScroll;
    const a = list.querySelector('[aria-selected="true"]');
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  });
})();
