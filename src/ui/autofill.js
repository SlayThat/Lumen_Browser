'use strict';
// The login dropdown. Rows only show usernames. Picking happens on mousedown so it wins the race with the page box losing focus.
(function () {
  const L = window.lumen;
  const box = document.getElementById('box');
  let items = [], sel = -1;
  function draw() {
    box.textContent = '';
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'afi';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === sel));
      const ic = document.createElement('span');
      ic.style.flex = 'none'; ic.innerHTML = window.icon('key', 16);
      const t = document.createElement('span');
      t.textContent = it.user;
      row.append(ic, t);
      row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; Array.from(box.children).forEach((c, j) => c.setAttribute('aria-selected', String(j === i))); } });
      row.addEventListener('mousedown', (e) => { e.preventDefault(); L.send('af:pick', it.id); });
      box.append(row);
    });
  }
  L.on('af:items', (d) => {
    items = d.items || []; sel = typeof d.sel === 'number' ? d.sel : -1;
    if (d.isPrivate) document.documentElement.setAttribute('data-private', ''); else document.documentElement.removeAttribute('data-private');
    draw();
  });
})();
