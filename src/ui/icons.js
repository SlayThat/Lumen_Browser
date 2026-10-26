'use strict';
// Icons drawn on one 24px grid, 1.75 stroke, round caps.
(function () {
  const p = (d) => `<path d="${d}"/>`;
  const ICONS = {
    back: p('M14.5 5.5 8 12l6.5 6.5'),
    forward: p('M9.5 5.5 16 12l-6.5 6.5'),
    reload: p('M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2'),
    stop: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
    home: p('M4.5 11 12 4.5l7.5 6.5M6.5 9.5V19h11V9.5'),
    plus: p('M12 5.5v13M5.5 12h13'),
    close: p('M7 7l10 10M17 7 7 17'),
    star: p('m12 4.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z'),
    menu: p('M5 7h14M5 12h14M5 17h14'),
    lock: p('M7 11V8.5a5 5 0 0 1 10 0V11M6 11h12v8.5H6z'),
    warn: p('M12 4.5 20 18.5H4zM12 10v4M12 16.4v.1'),
    search: p('M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5 20 20'),
    down: p('M12 4.5v11M7.5 11 12 15.5 16.5 11M5.5 19.5h13'),
    clock: p('M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 7.5V12l3 2'),
    gear: p('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.5a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z'),
    chevUp: p('M6 14.5 12 8.5l6 6'),
    chevDown: p('M6 9.5l6 6 6-6'),
    sound: p('M5 10v4h3.5L13 18V6L8.5 10zM16 9.5a4 4 0 0 1 0 5'),
    moon: p('M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z'),
    min: p('M6 12h12'),
    max: p('M6.5 6.5h11v11h-11z'),
    restore: p('M9 9V6.5h8.5V15H15M6.5 9H15v8.5H6.5z'),
    check: p('M5.5 12.5l4.5 4.5 8.5-9.5'),
    zzz: p('M6 7h5l-5 5h5M13 12h5l-5 5h5'),
    trash: p('M5.5 7h13M9.5 7V5h5v2M7.5 7l.8 12h7.4l.8-12'),
    external: p('M13 5.5h5.5V11M18.5 5.5 11 13M16 14v5H5V8h5'),
    folder: p('M4 7.5h6l2 2h8v9H4z'),
    private: p('M6 11c.5-3.5 2.5-5.5 6-5.5s5.5 2 6 5.5M4 11h16M8.5 17.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM15.5 17.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z')
  };
  window.icon = function (name, size) {
    const s = size || 20;
    return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  };
})();
