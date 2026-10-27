'use strict';
// Lumen glass UI: tabs, toolbar, omnibox, menus, sheets. Page titles and URLs are always
// written with textContent, never as HTML.
(function () {
  const L = window.lumen;
  const $ = (id) => document.getElementById(id);
  const STRIP = 92;
  const doc = document.documentElement;

  let S = { tabs: [], activeId: 0, nav: { url: '' }, isPrivate: false, caption: 'native', captionW: 144, size: [1200, 800], maximized: false };
  let settings = null;
  let downloads = [];
  let sheetKind = '';
  let editing = false;
  let dragging = false;

  // ---------- helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // trusted icon markup only
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  function hue(str) { let x = 0; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 360; return x; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function isDark() { return !!S.isPrivate || window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function fmtBytes(n) {
    if (!(n > 0)) return '';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
  }
  function setIcon(el, name, size) { el.innerHTML = window.icon(name, size); }
  function letterTile(host, cls) {
    return h('span', { class: cls, text: (host[0] || '?').toUpperCase() });
  }
  function tileColor(el, host) { el.style.background = 'hsl(' + hue(host) + ' 50% 42%)'; }

  // ---------- glass renderer ----------
  const canvas = $('glass');
  const G = new window.GlassRenderer(canvas);
  let needDraw = true, animUntil = 0, lastDraw = 0, dtSum = 0, dtN = 0, perfWarned = false, wasAnimating = false;

  function poke(ms) { needDraw = true; animUntil = Math.max(animUntil, performance.now() + (ms || 380)); }
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (G.ok) G.setView(window.innerWidth, window.innerHeight, dpr);
    poke();
  }
  function readTint() {
    const v = getComputedStyle(doc).getPropertyValue('--tint').trim().replace('#', '');
    const n = parseInt(v.length === 3 ? v.replace(/(.)/g, '$1$1') : v, 16) || 0xf6f8fb;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function applyGlassParams() {
    if (!settings) return;
    const g = settings.glass, mode = settings.glassMode;
    G.setParams({
      blur: g.blur, refr: mode === 'glass' ? g.refraction : 0, disp: mode === 'glass' ? 0.16 : 0,
      sat: g.saturation, tint: g.tint, dark: isDark() ? 1 : 0, rim: mode === 'glass' ? 1 : 0.55, tintCol: readTint()
    });
    poke();
  }
  function effectiveMode() { return (G.ok && settings) ? settings.glassMode : 'off'; }
  function applySettings() {
    if (!settings) return;
    doc.dataset.mode = effectiveMode();
    applyGlassParams();
  }
  function collect() {
    const out = [];
    const els = document.querySelectorAll('[data-glass]');
    for (const el of els) {
      if (out.length >= 16) break;
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      const op = parseFloat(cs.opacity);
      if (!(op > 0.01)) continue;
      const sc = el.offsetWidth ? r.width / el.offsetWidth : 1;
      let rad = (parseFloat(cs.borderTopLeftRadius) || 0) * sc;
      rad = Math.min(rad, r.width / 2, r.height / 2);
      out.push([r.left + r.width / 2, r.top + r.height / 2, r.width / 2, r.height / 2, rad, parseFloat(el.dataset.glass) || 0.7, Math.min(1, op)]);
    }
    return out;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!G.ok || doc.dataset.mode === 'off') return;
    const animating = now < animUntil;
    if (wasAnimating && !animating) needDraw = true; // one last draw in the settled state
    wasAnimating = animating;
    if (!needDraw && !animating) { lastDraw = 0; return; }
    G.setShapes(collect());
    G.draw();
    needDraw = false;
    if (animating && lastDraw) {
      dtSum += now - lastDraw; dtN++;
      if (dtN >= 45) {
        const avg = dtSum / dtN; dtSum = 0; dtN = 0;
        if (avg > 50 && !perfWarned && effectiveMode() === 'glass') { perfWarned = true; showPop($('perf')); }
      }
    }
    lastDraw = now;
  }
  G.onLost = () => { doc.dataset.mode = 'off'; toast('The graphics context was lost. Using the solid theme.'); };

  new MutationObserver(() => poke()).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-glass', 'style'] });
  document.addEventListener('transitionrun', () => poke(), true);
  document.addEventListener('transitionend', () => poke(60), true);
  window.addEventListener('resize', resizeCanvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyGlassParams);

  // ---------- popovers (glass that materializes) ----------
  function showPop(el) {
    clearTimeout(el._t);
    if (!el.hidden && el.classList.contains('in')) return;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('in');
    poke(); requestLayout();
  }
  function hidePop(el) {
    if (el.hidden) return;
    el.classList.remove('in');
    poke();
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (!el.classList.contains('in')) { el.hidden = true; poke(); requestLayout(); } }, 190);
  }
  let lastLayout = '';
  function requestLayout() {
    requestAnimationFrame(() => {
      const modal = ['menu', 'ctx', 'navmenu', 'sheet'].some(id => !$(id).hidden);
      let mode = 'strip', extra = 0;
      if (modal) mode = 'full';
      else {
        let bottom = STRIP;
        for (const id of ['findbar', 'suggest', 'perm', 'perf', 'toast']) {
          const e = $(id);
          if (!e.hidden) bottom = Math.max(bottom, e.offsetTop + e.offsetHeight + 18);
        }
        extra = Math.ceil(bottom - STRIP);
        if (extra > 0) mode = 'extra';
      }
      $('scrim').hidden = $('sheet').hidden;
      const key = mode + ':' + extra;
      if (key !== lastLayout) { lastLayout = key; L.send('layout', { mode, extra }); }
    });
  }

  // ---------- toast ----------
  let toastT = null;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    showPop(el);
    clearTimeout(toastT);
    toastT = setTimeout(() => hidePop(el), 2600);
  }

  // ---------- tabs ----------
  const tabsEl = $('tabs');

  function favNode(t) {
    if (t.loading) return h('span', { class: 'tspin' });
    const host = hostOf(t.url);
    const box = h('span', { class: 'tfav' });
    if (t.favicon) {
      const img = h('img', { src: t.favicon, alt: '', draggable: 'false' });
      img.addEventListener('error', () => { box.textContent = (host[0] || 'N').toUpperCase(); tileColor(box, host || 'new'); img.remove(); });
      box.append(img);
    } else {
      box.textContent = host ? host[0].toUpperCase() : '';
      if (host) tileColor(box, host);
      else box.append(h('span', { html: window.icon('search', 14) }));
    }
    return box;
  }
  function makeTab(t) {
    const el = h('div', { class: 'tab', role: 'tab', tabindex: '-1' });
    el.dataset.id = String(t.id);
    el.append(h('span', { class: 'tfavslot' }), h('span', { class: 'ttitle' }), h('span', { class: 'tsound', html: window.icon('sound', 14), hidden: true }),
      h('button', { class: 'tclose', type: 'button', tabindex: '-1', 'aria-label': 'Close tab', html: window.icon('close', 14), onclick: (e) => { e.stopPropagation(); L.send('tab:close', t.id); } }));
    el.addEventListener('click', () => { if (el._dragged) { el._dragged = false; return; } L.send('tab:activate', t.id); });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); L.send('tab:close', t.id); } });
    el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openMenu($('ctx'), [
        { label: 'Reload tab', run: () => L.send('tab:reload', t.id) },
        { label: 'Duplicate tab', run: () => L.send('tab:duplicate', t.id) },
        { sep: true },
        { label: 'Close tab', run: () => L.send('tab:close', t.id) },
        { label: 'Close other tabs', enabled: S.tabs.length > 1, run: () => L.send('tab:closeOthers', t.id) }
      ], e.clientX, e.clientY);
    });
    el.addEventListener('keydown', (e) => {
      const i = S.tabs.findIndex(x => x.id === t.id);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); L.send('tab:activate', t.id); }
      else if (e.key === 'Delete') { e.preventDefault(); L.send('tab:close', t.id); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = tabsEl.children[(i + (e.key === 'ArrowRight' ? 1 : -1) + S.tabs.length) % S.tabs.length];
        if (n) n.focus();
      }
    });
    attachDrag(el, t.id);
    return el;
  }
  function updateTab(el, t) {
    const sel = t.id === S.activeId;
    el.setAttribute('aria-selected', sel ? 'true' : 'false');
    el.tabIndex = sel ? 0 : -1;
    el.classList.toggle('sleeping', !!t.sleeping);
    if (sel) el.dataset.glass = '0.45'; else delete el.dataset.glass;
    el.title = (t.sleeping ? 'Sleeping: ' : '') + t.title;
    el.querySelector('.ttitle').textContent = t.title;
    el.querySelector('.tsound').hidden = !t.audible;
    const key = (t.loading ? 'L' : (t.favicon || ('F' + hostOf(t.url))));
    if (el._fav !== key) {
      el._fav = key;
      el.querySelector('.tfavslot').replaceWith(Object.assign(favNode(t), {}));
      const n = el.children[0]; n.classList.add('tfavslot');
    }
  }
  function renderTabs() {
    if (dragging) return;
    const existing = new Map();
    for (const el of tabsEl.children) existing.set(Number(el.dataset.id), el);
    S.tabs.forEach((t, i) => {
      let el = existing.get(t.id);
      if (!el) { el = makeTab(t); } else existing.delete(t.id);
      updateTab(el, t);
      const ref = tabsEl.children[i];
      if (ref !== el) tabsEl.insertBefore(el, ref || null);
    });
    existing.forEach(el => el.remove());
    requestAnimationFrame(() => {
      for (const el of tabsEl.children) el.toggleAttribute('data-narrow', el.offsetWidth < 74);
      const a = tabsEl.querySelector('[aria-selected="true"]');
      if (a) a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      poke();
    });
  }

  // drag to reorder
  // The dragged tab only moves with a transform while the pointer is down; the DOM order and the
  // saved order change once, on drop. Listeners live on window, so losing pointer capture (which
  // happens whenever a node is re-parented) can no longer leave a drag stuck.
  let endDrag = null;
  function attachDrag(el, id) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.tclose')) return;
      if (endDrag) endDrag(false);
      const sibs = Array.from(tabsEl.children);
      const rects = sibs.map(n => ({ left: n.offsetLeft, w: n.offsetWidth }));
      const from = sibs.indexOf(el);
      if (from < 0) return;
      const gap = rects.length > 1 ? Math.max(0, rects[1].left - (rects[0].left + rects[0].w)) : 0;
      const step = rects[from].w + gap;
      const d = { startX: e.clientX, active: false, to: from };

      const place = (dx) => {
        const minDx = rects[0].left - rects[from].left;
        const last = rects[rects.length - 1];
        const maxDx = last.left + last.w - rects[from].w - rects[from].left;
        dx = Math.max(minDx, Math.min(maxDx, dx));
        el.style.transform = 'translateX(' + dx + 'px)';
        const center = rects[from].left + dx + rects[from].w / 2;
        let to = 0;
        rects.forEach((r, i) => { if (i !== from && r.left + r.w / 2 < center) to++; });
        d.to = to;
        sibs.forEach((n, i) => {
          if (n === el) return;
          let shift = 0;
          if (from < to && i > from && i <= to) shift = -step;
          else if (from > to && i >= to && i < from) shift = step;
          n.style.transform = shift ? 'translateX(' + shift + 'px)' : '';
        });
        poke();
      };
      const onMove = (ev) => {
        if (ev.buttons === 0) { finish(true); return; }   // button was released somewhere we never heard about
        const dx = ev.clientX - d.startX;
        if (!d.active) {
          if (Math.abs(dx) < 5) return;
          d.active = true; dragging = true;
          el.classList.add('dragging');
          sibs.forEach(n => { if (n !== el) n.classList.add('shifting'); });
        }
        place(dx);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };
      function finish(commit) {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('blur', onCancel);
        window.removeEventListener('keydown', onKey, true);
        endDrag = null;
        const was = d.active;
        sibs.forEach(n => { n.style.transform = ''; n.classList.remove('shifting'); });
        el.classList.remove('dragging');
        dragging = false;
        if (was) {
          el._dragged = true;
          setTimeout(() => { el._dragged = false; }, 80);
          if (commit && d.to !== from) {
            const ref = sibs.filter(n => n !== el)[d.to];
            tabsEl.insertBefore(el, ref || null);
            const si = S.tabs.findIndex(t => t.id === id);
            if (si >= 0) { const [mt] = S.tabs.splice(si, 1); S.tabs.splice(d.to, 0, mt); }
            L.send('tab:move', { id, index: d.to });
          }
        }
        renderTabs();
        poke();
      }
      endDrag = finish;
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('blur', onCancel);
      window.addEventListener('keydown', onKey, true);
    });
  }

  // ---------- toolbar / address ----------
  const addr = $('addr'), addrwrap = $('addrwrap'), addrview = $('addrview');
  const looksLikeUrl = (s) => /^https?:\/\//i.test(s) || (!/\s/.test(s) && /^([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(s)) || /^localhost(:\d+)?([/?#]\S*)?$/i.test(s);

  function renderAddress() {
    if (editing) return;
    const url = S.nav.url || '';
    addrview.textContent = '';
    if (!url) { addrview.append(h('span', { class: 'ph', text: 'Search or enter address' })); return; }
    let u = null;
    try { u = new URL(url); } catch (e) { /* show raw */ }
    if (u && /^https?:$/.test(u.protocol)) {
      if (u.protocol === 'http:') addrview.append(h('span', { class: 'warnlabel', text: 'Not secure' }));
      const rest = (u.pathname + u.search + u.hash).replace(/^\/$/, '');
      addrview.append(h('span', { class: 'host', text: u.host.replace(/^www\./, '') }), h('span', { class: 'dim', text: rest }));
    } else addrview.append(h('span', { text: url }));
  }
  function renderNav() {
    const n = S.nav;
    $('back').disabled = !n.canBack;
    $('forward').disabled = !n.canFwd;
    setIcon($('reload'), n.loading ? 'stop' : 'reload');
    $('reload').setAttribute('aria-label', n.loading ? 'Stop loading' : 'Reload');
    $('star').disabled = !n.bookmarkable;
    $('star').classList.toggle('on', !!n.bookmarked);
    $('star').setAttribute('aria-pressed', n.bookmarked ? 'true' : 'false');
    $('loadbar').hidden = !n.loading;
    const z = $('zoomchip');
    z.hidden = !n.zoom || Math.abs(n.zoom - 1) < 0.01;
    if (!z.hidden) z.textContent = Math.round(n.zoom * 100) + '%';
    const lock = $('lock');
    lock.className = '';
    if (!n.url) lock.innerHTML = window.icon('search', 16);
    else if (n.secure) lock.innerHTML = window.icon('lock', 15);
    else { lock.innerHTML = window.icon('warn', 16); lock.classList.add('warn'); }
    renderAddress();
  }

  addr.addEventListener('focus', () => {
    editing = true; addrwrap.classList.add('editing');
    addr.value = S.nav.url || '';
    addr.select();
    requestAnimationFrame(() => addr.select());
  });
  addr.addEventListener('blur', () => {
    editing = false; addrwrap.classList.remove('editing');
    setTimeout(() => { if (!editing) closeSuggest(); }, 120);
    renderAddress();
  });
  addrwrap.addEventListener('pointerdown', (e) => { if (e.target !== addr) { e.preventDefault(); addr.focus(); } });

  // suggestions
  let sugItems = [], sugSel = 0, sugTimer = null, sugSeq = 0;
  const sugEl = $('suggest');
  function closeSuggest() { sugItems = []; addr.setAttribute('aria-expanded', 'false'); hidePop(sugEl); }
  function renderSuggest() {
    sugEl.textContent = '';
    sugItems.forEach((s, i) => {
      const row = h('div', { class: 'sug', role: 'option', id: 'sug' + i, 'aria-selected': i === sugSel ? 'true' : 'false' });
      row.append(h('span', { class: 'si', html: window.icon(s.kind === 'bookmark' ? 'star' : s.kind === 'history' ? 'clock' : 'search', 16) }));
      row.append(h('span', { class: 'st', text: s.title || s.url }));
      if (s.kind !== 'text' && s.title) row.append(h('span', { class: 'su', text: hostOf(s.url) }));
      row.addEventListener('pointerdown', (e) => { e.preventDefault(); commit(s.url || s.text); });
      sugEl.append(row);
    });
    if (!sugItems.length) { closeSuggest(); return; }
    const r = addrwrap.getBoundingClientRect();
    sugEl.style.left = Math.max(8, r.left) + 'px';
    sugEl.style.width = Math.min(r.width, window.innerWidth - 16) + 'px';
    addr.setAttribute('aria-expanded', 'true');
    addr.setAttribute('aria-activedescendant', 'sug' + sugSel);
    showPop(sugEl);
  }
  async function updateSuggest() {
    const q = addr.value.trim();
    const seq = ++sugSeq;
    if (!q) { closeSuggest(); return; }
    const found = (await L.invoke('suggest', q)) || [];
    if (seq !== sugSeq || !editing) return;
    const first = looksLikeUrl(q)
      ? { kind: 'text', text: q, url: q, title: 'Go to ' + q }
      : { kind: 'text', text: q, url: '', title: 'Search for “' + q + '”' };
    sugItems = [first].concat(found);
    sugSel = 0;
    renderSuggest();
  }
  function commit(text) {
    closeSuggest();
    if (text && text.trim()) L.send('navTo', text.trim());
    addr.blur();
  }
  addr.addEventListener('input', () => { clearTimeout(sugTimer); sugTimer = setTimeout(updateSuggest, 40); });
  addr.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!sugItems.length) return;
      e.preventDefault();
      sugSel = (sugSel + (e.key === 'ArrowDown' ? 1 : -1) + sugItems.length) % sugItems.length;
      renderSuggest();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = sugItems[sugSel];
      commit(s && s.kind !== 'text' ? s.url : addr.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!sugEl.hidden) closeSuggest(); else { addr.blur(); L.send('focusPage'); }
    }
  });

  // buttons
  [['newtab', 'plus', 18], ['back', 'back'], ['forward', 'forward'], ['reload', 'reload'], ['home', 'home'], ['star', 'star'], ['menubtn', 'menu'],
    ['findprev', 'chevUp', 16], ['findnext', 'chevDown', 16], ['findclose', 'close', 16], ['sheetclose', 'close']].forEach(([id, name, size]) => setIcon($(id), name, size));
  $('newtab').addEventListener('click', () => L.send('cmd', 'newTab'));
  $('reload').addEventListener('click', () => L.send('cmd', S.nav.loading ? 'stop' : 'reload'));
  $('home').addEventListener('click', () => L.send('cmd', 'home'));
  $('star').addEventListener('click', () => L.send('cmd', 'bookmark'));
  $('menubtn').addEventListener('click', () => {
    if (!$('menu').hidden) { hidePop($('menu')); return; }
    const r = $('menubtn').getBoundingClientRect();
    openMenu($('menu'), mainMenuItems(), r.right, r.bottom + 8, true);
  });

  function attachHistoryButton(btn, dir) {
    let timer = null, long = false;
    const show = async () => {
      const r = await L.invoke('nav:history');
      if (!r || !r.entries) return;
      const list = dir === 'back'
        ? r.entries.map((e, i) => ({ e, i })).slice(0, r.index).reverse()
        : r.entries.map((e, i) => ({ e, i })).slice(r.index + 1);
      if (!list.length) return;
      const b = btn.getBoundingClientRect();
      openMenu($('navmenu'), list.slice(0, 14).map(({ e, i }) => ({ label: e.title || e.url, run: () => L.send('nav:goto', i) })), b.left, b.bottom + 8);
    };
    btn.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; long = false; timer = setTimeout(() => { long = true; show(); }, 450); });
    const cancel = () => clearTimeout(timer);
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('click', (e) => { if (long) { e.preventDefault(); long = false; return; } L.send('cmd', dir); });
    btn.addEventListener('contextmenu', (e) => { e.preventDefault(); show(); });
  }
  attachHistoryButton($('back'), 'back');
  attachHistoryButton($('forward'), 'forward');

  // ---------- menus ----------
  function mainMenuItems() {
    return [
      { label: 'New tab', key: 'Ctrl+T', run: () => L.send('cmd', 'newTab') },
      { label: 'New window', key: 'Ctrl+N', run: () => L.send('cmd', 'newWindow') },
      { label: 'New private window', key: 'Ctrl+Shift+N', run: () => L.send('cmd', 'newPrivateWindow') },
      { sep: true },
      { label: 'Bookmarks', run: () => openSheet('bookmarks') },
      { label: 'History', key: 'Ctrl+H', run: () => openSheet('history') },
      { label: 'Downloads', key: 'Ctrl+J', run: () => openSheet('downloads') },
      { sep: true },
      { label: 'Find in page', key: 'Ctrl+F', run: () => openFind() },
      { zoom: true },
      { label: 'Print…', key: 'Ctrl+P', run: () => L.send('cmd', 'print') },
      { label: 'Developer tools', key: 'F12', run: () => L.send('cmd', 'devtools') },
      { sep: true },
      { label: 'Settings', key: 'Ctrl+,', run: () => openSheet('settings') }
    ];
  }
  function closeMenus() { ['menu', 'ctx', 'navmenu'].forEach(id => hidePop($(id))); }
  function openMenu(el, items, x, y, alignRight) {
    closeMenus();
    el.textContent = '';
    for (const it of items) {
      if (it.sep) { el.append(h('div', { class: 'msep', role: 'separator' })); continue; }
      if (it.zoom) {
        const val = h('span', { class: 'zv', text: Math.round((S.nav.zoom || 1) * 100) + '%' });
        const z = (dir) => () => { L.send('cmd', 'zoom', dir); setTimeout(() => { val.textContent = Math.round((S.nav.zoom || 1) * 100) + '%'; }, 120); };
        el.append(h('div', { class: 'mzoom' }, h('span', { class: 'ml', text: 'Zoom' }),
          h('button', { class: 'ib sm', type: 'button', 'aria-label': 'Zoom out', text: '−', onclick: z('out') }), val,
          h('button', { class: 'ib sm', type: 'button', 'aria-label': 'Zoom in', text: '+', onclick: z('in') }),
          h('button', { class: 'ib sm', type: 'button', 'aria-label': 'Reset zoom', text: '1:1', onclick: z('reset') })));
        continue;
      }
      el.append(h('button', {
        class: 'mi', type: 'button', role: 'menuitem', disabled: it.enabled === false,
        onclick: () => { hidePop(el); if (el.id === 'ctx') { if (it.id) L.send('ctx:run', it.id); } if (it.run) it.run(); }
      }, h('span', { class: 'ml', text: it.label }), it.key ? h('span', { class: 'mk', text: it.key }) : null));
    }
    el.hidden = false;
    const w = el.offsetWidth, hh = el.offsetHeight;
    const [W, H] = S.size || [window.innerWidth, window.innerHeight];
    let left = alignRight ? x - w : x;
    left = Math.max(8, Math.min(left, W - w - 8));
    const top = Math.max(8, Math.min(y, H - hh - 8));
    el.style.left = left + 'px'; el.style.top = top + 'px';
    el.style.setProperty('--ox', (x - left) + 'px'); el.style.setProperty('--oy', (y - top) + 'px');
    showPop(el);
    const first = el.querySelector('.mi:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  }
  for (const id of ['menu', 'ctx', 'navmenu']) {
    $(id).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.from($(id).querySelectorAll('.mi:not(:disabled)'));
      const i = items.indexOf(document.activeElement);
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      if (n) n.focus();
    });
  }
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  document.addEventListener('pointerdown', (e) => {
    for (const id of ['menu', 'ctx', 'navmenu']) {
      const el = $(id);
      if (!el.hidden && !el.contains(e.target) && !(id === 'menu' && e.target.closest('#menubtn'))) {
        hidePop(el);
        if (id === 'ctx') L.send('ctx:close');
      }
    }
    const sh = $('sheet');
    if (!sh.hidden && !sh.contains(e.target) && !e.target.closest('#top')) closeSheet();
  }, true);

  // ---------- find ----------
  let findCase = false;
  function openFind() {
    showPop($('findbar'));
    const i = $('findinput'); i.focus(); i.select();
  }
  function closeFind() {
    if ($('findbar').hidden) return;
    hidePop($('findbar'));
    $('findcount').textContent = '';
    L.send('find:stop');
    L.send('focusPage');
  }
  function doFind(next, forward) {
    const text = $('findinput').value;
    L.send('find', { text, findNext: next, forward, matchCase: findCase });
    if (!text) $('findcount').textContent = '';
  }
  $('findinput').addEventListener('input', () => doFind(false, true));
  $('findinput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doFind(true, !e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  $('findnext').addEventListener('click', () => doFind(true, true));
  $('findprev').addEventListener('click', () => doFind(true, false));
  $('findclose').addEventListener('click', closeFind);
  $('findcase').addEventListener('click', () => { findCase = !findCase; $('findcase').setAttribute('aria-pressed', String(findCase)); doFind(false, true); });

  // ---------- permission prompts ----------
  const permQueue = [];
  let permCur = null;
  function nextPerm() {
    if (permCur || !permQueue.length) return;
    permCur = permQueue.shift();
    const t = $('permtext'); t.textContent = '';
    t.append(h('b', { text: permCur.origin.replace(/^https?:\/\//, '') }), document.createTextNode(' wants to ' + permCur.label + '.'));
    $('permremwrap').hidden = !!S.isPrivate;
    showPop($('perm'));
    $('permallow').focus();
  }
  function answerPerm(allow) {
    if (!permCur) return;
    L.send('perm:answer', { id: permCur.id, allow, remember: !S.isPrivate && $('permrem').checked });
    permCur = null;
    hidePop($('perm'));
    setTimeout(nextPerm, 220);
  }
  $('permallow').addEventListener('click', () => answerPerm(true));
  $('permblock').addEventListener('click', () => answerPerm(false));
  $('perfswitch').addEventListener('click', () => { L.send('settings:set', { key: 'glassMode', value: 'frosted' }); hidePop($('perf')); toast('Switched to Frosted'); });
  $('perfdismiss').addEventListener('click', () => hidePop($('perf')));

  // ---------- sheets ----------
  const sheet = $('sheet');
  function closeSheet() {
    if (sheet.hidden) return;
    sheetKind = '';
    hidePop(sheet);
    L.send('focusPage');
  }
  $('sheetclose').addEventListener('click', closeSheet);

  function dayLabel(t) {
    const d = new Date(t), now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function siteRow(url, title, extra, onOpen, buttons) {
    const host = hostOf(url);
    const ic = letterTile(host, 'ricon'); tileColor(ic, host || 'x');
    const row = h('div', { class: 'row' }, ic,
      h('button', { class: 'rl', type: 'button', onclick: onOpen }, h('span', { class: 'rt', text: title || url }), h('span', { class: 'ru', text: url })),
      extra || null, h('div', { class: 'rbtns' }, buttons || []));
    return row;
  }
  function iconBtn(name, label, fn) {
    return h('button', { class: 'ib sm', type: 'button', 'aria-label': label, title: label, html: window.icon(name, 16), onclick: fn });
  }

  async function renderHistory(q) {
    const body = $('sheetbody'); body.textContent = '';
    const items = (await L.invoke('history:list', q || '')) || [];
    if (sheetKind !== 'history') return;
    if (!items.length) { body.append(h('div', { class: 'empty', text: q ? 'No matching history.' : 'Pages you visit will appear here.' })); return; }
    let day = '';
    for (const it of items) {
      const dl = dayLabel(it.time);
      if (dl !== day) { day = dl; body.append(h('div', { class: 'dayh', text: dl })); }
      const row = siteRow(it.url, it.title, h('span', { class: 'rtime', text: new Date(it.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
        () => { L.send('navTo', it.url); closeSheet(); },
        [iconBtn('close', 'Remove from history', () => { L.send('history:remove', it.url); row.remove(); })]);
      body.append(row);
    }
  }
  async function renderBookmarks() {
    const body = $('sheetbody'); body.textContent = '';
    const items = (await L.invoke('bookmarks:list')) || [];
    if (sheetKind !== 'bookmarks') return;
    if (!items.length) { body.append(h('div', { class: 'empty', text: 'Press Ctrl+D on a page to bookmark it.' })); return; }
    for (const b of items) {
      const row = siteRow(b.url, b.title, null, () => { L.send('navTo', b.url); closeSheet(); },
        [iconBtn('trash', 'Remove bookmark', () => { L.send('bookmarks:remove', b.id); row.remove(); })]);
      body.append(row);
    }
  }
  function renderDownloads() {
    if (sheetKind !== 'downloads') return;
    const body = $('sheetbody'); body.textContent = '';
    if (!downloads.length) { body.append(h('div', { class: 'empty', text: 'Files you download will appear here.' })); return; }
    for (const d of downloads) {
      const pct = d.total > 0 ? Math.min(100, Math.round(d.received / d.total * 100)) : 0;
      const state = d.state === 'completed' ? fmtBytes(d.total || d.received)
        : d.state === 'cancelled' ? 'Cancelled' : d.state === 'interrupted' ? 'Failed'
          : (fmtBytes(d.received) + (d.total ? ' of ' + fmtBytes(d.total) : ''));
      const btns = [];
      if (d.state === 'completed') { btns.push(iconBtn('external', 'Open file', () => L.send('download:act', { id: d.id, action: 'open' }))); }
      btns.push(iconBtn('folder', 'Show in folder', () => L.send('download:act', { id: d.id, action: 'show' })));
      if (d.state === 'progressing') btns.push(iconBtn('close', 'Cancel download', () => L.send('download:act', { id: d.id, action: 'cancel' })));
      else btns.push(iconBtn('trash', 'Remove from list', () => L.send('download:act', { id: d.id, action: 'remove' })));
      const info = h('div', { class: 'rl' }, h('span', { class: 'rt', text: d.name }), h('span', { class: 'ru', text: state }));
      if (d.state === 'progressing') info.append(h('div', { class: 'bar' }, (() => { const i = document.createElement('i'); i.style.width = pct + '%'; return i; })()));
      body.append(h('div', { class: 'row' }, h('span', { class: 'ricon', html: window.icon('down', 14) }), info, h('div', { class: 'rbtns' }, btns)));
    }
  }

  function seg(key, options, cur, onChange) {
    const box = h('div', { class: 'seg', role: 'group' });
    options.forEach(([val, label]) => {
      const b = h('button', { type: 'button', text: label, 'aria-pressed': String(cur === val) });
      b.addEventListener('click', () => {
        Array.from(box.children).forEach(c => c.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        if (onChange) onChange(val); else L.send('settings:set', { key, value: val });
      });
      box.append(b);
    });
    return box;
  }
  function toggle(label, hint, cur, key) {
    const t = h('button', { class: 'tog', type: 'button', role: 'switch', 'aria-checked': String(!!cur), 'aria-label': label });
    t.addEventListener('click', () => { const v = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(v)); L.send('settings:set', { key, value: v }); });
    return h('div', { class: 'srow' }, h('div', { class: 'sl' }, label, hint ? h('small', { text: hint }) : null), t);
  }
  function slider(label, key, min, max, step, cur, fmt, local) {
    const out = h('span', { class: 'sv', text: fmt(cur) });
    const inp = h('input', { type: 'range', min, max, step, value: cur, 'aria-label': label });
    inp.addEventListener('input', () => {
      const v = Number(inp.value);
      out.textContent = fmt(v);
      local(v);
      applyGlassParams();
      L.send('settings:set', { key, value: v });
    });
    return h('div', { class: 'srow' }, h('div', { class: 'sl', text: label }), inp, out);
  }
  function confirmButton(label, what) {
    const b = h('button', { class: 'btn danger', type: 'button', text: label });
    let armed = false, t = null;
    b.addEventListener('click', () => {
      if (!armed) { armed = true; b.textContent = 'Click again to confirm'; t = setTimeout(() => { armed = false; b.textContent = label; }, 3000); return; }
      clearTimeout(t); armed = false; b.textContent = label;
      L.send('data:clear', what);
    });
    return b;
  }
  function actionButton(label, fn) {
    const b = h('button', { class: 'btn', type: 'button', text: label });
    b.addEventListener('click', fn);
    return b;
  }
  function renderSettings() {
    const body = $('sheetbody'); body.textContent = '';
    if (!settings) return;
    const s = settings, g = s.glass;
    const group = (title, ...rows) => h('div', { class: 'sgroup' }, h('h3', { text: title }), rows);
    const homeInput = h('input', { class: 'sinput', type: 'text', value: s.homePage, spellcheck: 'false', 'aria-label': 'Home page' });
    homeInput.addEventListener('change', () => L.send('settings:set', { key: 'homePage', value: homeInput.value.trim() }));
    body.append(
      group('Glass',
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Material', h('small', { text: 'Glass bends the page behind it. Frosted only blurs, which is lighter on the GPU. Off uses solid surfaces.' })),
          seg('glassMode', [['glass', 'Glass'], ['frosted', 'Frosted'], ['off', 'Off']], s.glassMode)),
        slider('Blur', 'glass.blur', 0, 24, 1, g.blur, v => v + ' px', v => { settings.glass.blur = v; }),
        slider('Refraction', 'glass.refraction', 0, 60, 1, g.refraction, v => v + ' px', v => { settings.glass.refraction = v; }),
        slider('Saturation', 'glass.saturation', 0.8, 1.8, 0.02, g.saturation, v => Math.round(v * 100) + '%', v => { settings.glass.saturation = v; }),
        slider('Tint', 'glass.tint', 0, 0.6, 0.01, g.tint, v => Math.round(v * 100) + '%', v => { settings.glass.tint = v; }),
        toggle('Let pages scroll under the toolbar (experimental)', 'Sites with fixed headers, like YouTube, hide their top bar behind the toolbar. Off by default.', s.underlay, 'underlay')),
      group('General',
        h('div', { class: 'srow' }, h('div', { class: 'sl', text: 'Search engine' }),
          seg('searchEngine', [['duckduckgo', 'DuckDuckGo'], ['google', 'Google'], ['bing', 'Bing']], s.searchEngine)),
        h('div', { class: 'srow' }, h('div', { class: 'sl', text: 'Home page' }), homeInput),
        h('div', { class: 'srow' }, h('div', { class: 'sl', text: 'Theme' }), seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], s.theme)),
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Default browser', h('small', { text: 'Opens Windows Settings, where you choose Lumen for web links.' })),
          actionButton('Make default', () => L.send('app:defaultBrowser'))),
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Updates', h('small', { text: 'Lumen checks on its own at startup. Installed copies only.' })),
          actionButton('Check now', () => L.send('app:checkUpdate'))),
        toggle('Restore tabs on launch', null, s.restoreSession, 'restoreSession'),
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Put background tabs to sleep after', h('small', { text: 'Sleeping tabs free their memory and reload when you open them.' })),
          seg('sleepMinutes', [[0, 'Never'], [10, '10 min'], [20, '20 min'], [60, '1 hour']], s.sleepMinutes))),
      group('Browsing data',
        h('div', { class: 'srow' }, h('div', { class: 'sl', text: 'History' }), confirmButton('Clear history', 'history')),
        h('div', { class: 'srow' }, h('div', { class: 'sl', text: 'Cache' }), confirmButton('Clear cache', 'cache')),
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Cookies and site data', h('small', { text: 'Signs you out of websites.' })), confirmButton('Clear cookies', 'cookies')),
        h('div', { class: 'srow' }, h('div', { class: 'sl' }, 'Everything', h('small', { text: 'History, cache, cookies and saved site permissions.' })), confirmButton('Clear everything', 'all'))));
  }

  function openSheet(kind) {
    closeMenus();
    sheetKind = kind;
    const tools = $('sheettools'); tools.textContent = '';
    const titles = { history: 'History', bookmarks: 'Bookmarks', downloads: 'Downloads', settings: 'Settings' };
    $('sheettitle').textContent = titles[kind] || '';
    $('sheetbody').textContent = '';
    if (kind === 'history') {
      const inp = h('input', { class: 'sinput', type: 'search', placeholder: 'Search history', 'aria-label': 'Search history', spellcheck: 'false' });
      let t = null;
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => renderHistory(inp.value), 80); });
      tools.append(inp, h('button', { class: 'btn danger sm', type: 'button', text: 'Clear all', onclick: () => { L.send('history:clear'); renderHistory(''); } }));
      renderHistory('');
      showPop(sheet); inp.focus();
    } else if (kind === 'bookmarks') { renderBookmarks(); showPop(sheet); $('sheetclose').focus(); }
    else if (kind === 'downloads') {
      tools.append(h('button', { class: 'btn sm', type: 'button', text: 'Clear finished', onclick: () => L.send('downloads:clear') }));
      L.invoke('downloads:list').then(d => { if (d) downloads = d; renderDownloads(); });
      showPop(sheet); $('sheetclose').focus();
    } else if (kind === 'settings') { renderSettings(); showPop(sheet); $('sheetclose').focus(); }
  }

  // ---------- window dots (only when the OS caption buttons are off) ----------
  const DOT_GLYPH = {
    close: '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M1.8 1.8l4.4 4.4M6.2 1.8 1.8 6.2"/></svg>',
    min: '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M1.5 4h5"/></svg>',
    max: '<svg viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M1.6 1.6h3.3L1.6 4.9zM6.4 6.4H3.1l3.3-3.3z"/></svg>'
  };
  (function buildDots() {
    const box = $('dots');
    const mk = (cls, label, act, glyph) => h('button', { class: 'dot ' + cls, type: 'button', 'aria-label': label, title: label, html: DOT_GLYPH[glyph], onclick: () => L.send('window', act) });
    box.append(mk('r', 'Close window', 'close', 'close'), mk('y', 'Minimize', 'minimize', 'min'), mk('g', 'Maximize', 'maximize', 'max'));
  })();
  function renderCaption() {
    const custom = S.caption === 'custom';
    $('dots').hidden = !custom;
    $('capspace').hidden = custom;
    doc.style.setProperty('--capw', (custom ? 0 : S.captionW) + 'px');
    const g = $('dots').querySelector('.g');
    if (g) { const l = S.maximized ? 'Restore' : 'Maximize'; g.setAttribute('aria-label', l); g.title = l; }
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) { e.preventDefault(); closeSheet(); return; }
    let any = false;
    for (const id of ['menu', 'ctx', 'navmenu']) if (!$(id).hidden) { hidePop($(id)); any = true; if (id === 'ctx') L.send('ctx:close'); }
    if (any) { e.preventDefault(); L.send('focusPage'); return; }
    if (!$('findbar').hidden) { e.preventDefault(); closeFind(); }
  });

  // ---------- messages from the main process ----------
  let lastActive = 0;
  L.on('state', (s) => {
    const prevPrivate = S.isPrivate;
    S = s;
    if (!!s.isPrivate !== !!prevPrivate || !doc.hasAttribute('data-private') && s.isPrivate) {
      if (s.isPrivate) doc.setAttribute('data-private', ''); else doc.removeAttribute('data-private');
      applyGlassParams();
    }
    if (lastActive && lastActive !== s.activeId && !$('findbar').hidden) { hidePop($('findbar')); $('findcount').textContent = ''; }
    lastActive = s.activeId;
    renderCaption();
    renderTabs();
    renderNav();
  });
  L.on('frame', (f) => { G.setFrame(f); applyGlassParams(); poke(); });
  L.on('settings', (s) => { settings = s; applySettings(); if (sheetKind === 'settings' && !sheet.contains(document.activeElement)) renderSettings(); });
  L.on('downloads', (d) => { downloads = d; renderDownloads(); });
  L.on('toast', (t) => toast(t.text));
  L.on('find:result', (r) => {
    const text = $('findinput').value;
    $('findcount').textContent = !text ? '' : (r.matches ? r.active + ' of ' + r.matches : 'No matches');
  });
  L.on('perm:ask', (p) => { permQueue.push(p); nextPerm(); });
  L.on('ctx:show', (c) => openMenu($('ctx'), c.items, c.x, c.y));
  L.on('cmd', (c) => {
    if (c.name === 'focusAddress') addr.focus();
    else if (c.name === 'find') openFind();
    else if (c.name === 'panel' && ['history', 'bookmarks', 'downloads', 'settings'].includes(c.arg)) openSheet(c.arg);
  });

  // ---------- start ----------
  if (!G.ok) {
    doc.dataset.mode = 'off';
    setTimeout(() => toast('Glass needs WebGL2, which is not available here. Using the solid theme.'), 800);
  }
  resizeCanvas();
  requestAnimationFrame(loop);
  L.invoke('settings:get').then((s) => { if (s && !settings) { settings = s; applySettings(); } });
  window.__lumenReady = true;
})();
