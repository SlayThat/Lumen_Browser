'use strict';
// Runs in every page tab, in an isolated world: the page's own scripts cannot see it or call it.
// It reports (1) that a login form is present and (2) a login the user just submitted, and it fills a login
// only when the main process sends one after the user chose it. Nothing here is exposed to the page.
const { ipcRenderer } = require('electron');

(function () {
  if (window.top !== window || !/^https?:$/.test(location.protocol)) return;

  const visible = (el) => !!el && !el.disabled && el.type !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
  const passwordFields = (root) => Array.prototype.filter.call((root || document).querySelectorAll('input[type=password]'), visible);
  const TEXTY = 'input:not([type]),input[type=text],input[type=email],input[type=tel],input[type=search]';

  // The username box: the closest visible text-like field that comes before the password field.
  function usernameFor(pw) {
    const scope = pw.form || document;
    const fields = Array.prototype.filter.call(scope.querySelectorAll(TEXTY), visible);
    let best = null;
    for (const f of fields) {
      if (f.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING) best = f;   // f comes before pw
    }
    return best;
  }

  // Which password in the form is the one to save? One field: that one. Sign-up with a confirm box: the first.
  // Change-password (old, new, new): the second. Anything else is skipped.
  function pickPassword(pws) {
    const filled = pws.filter(p => p.value);
    if (filled.length === 1) return filled[0];
    if (filled.length === 2 && filled[0].value === filled[1].value) return filled[0];
    if (filled.length === 3 && filled[1].value === filled[2].value) return filled[1];
    return null;
  }

  let lastSent = 0;
  function report(scope) {
    if (Date.now() - lastSent < 2500) return;
    const pws = passwordFields(scope);
    const pw = pickPassword(pws);
    if (!pw) return;
    const user = usernameFor(pw);
    const u = user ? user.value.trim() : '';
    if (!u) return;
    lastSent = Date.now();
    ipcRenderer.send('pw:captured', { u: u.slice(0, 300), p: pw.value.slice(0, 1100) });
  }

  // Real user actions only: a page script cannot make Lumen offer to save by faking an event.
  document.addEventListener('submit', (e) => { if (e.isTrusted) report(e.target && e.target.querySelectorAll ? e.target : document); }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !e.target || !e.target.closest) return;
    const b = e.target.closest('button,input[type=submit],input[type=button],[role=button]');
    if (b) setTimeout(() => report(b.form || b.closest('form') || document), 0);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.key !== 'Enter' || !e.target || e.target.type !== 'password') return;
    const t = e.target;
    setTimeout(() => report(t.form || document), 0);
  }, true);

  // Tell the main process whether a login form is on screen, so the toolbar can offer saved logins.
  let had = null, timer = null;
  function scan() {
    timer = null;
    const has = passwordFields().length > 0;
    if (has !== had) { had = has; ipcRenderer.send('pw:forms', has); }
  }
  const later = () => { if (!timer) timer = setTimeout(scan, 400); };
  document.addEventListener('DOMContentLoaded', later);
  window.addEventListener('load', later);
  try { new MutationObserver(later).observe(document, { childList: true, subtree: true }); } catch (e) { /* no DOM yet */ }

  // Fill: main sends a login the user picked. Set values the way typing does, so frameworks notice.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  function put(el, value) {
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  ipcRenderer.on('pw:fill', (e, d) => {
    if (!d || typeof d.u !== 'string' || typeof d.p !== 'string') return;
    const pw = passwordFields()[0];
    if (!pw) return;
    const user = usernameFor(pw);
    if (user) put(user, d.u);
    put(pw, d.p);
  });
})();
