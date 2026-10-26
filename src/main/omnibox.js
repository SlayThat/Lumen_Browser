'use strict';
const { ENGINES } = require('./config');

const ALLOWED_SCHEMES = /^(https?|file|lumen|view-source):/i;

// Decide whether typed text is a URL or a search.
function classify(input, engineKey) {
  const s = String(input || '').trim();
  if (!s) return { type: 'empty', url: '' };
  const tpl = (ENGINES[engineKey] || ENGINES.duckduckgo).url;
  const search = () => ({ type: 'search', url: tpl.replace('%s', encodeURIComponent(s)) });

  if (/\s/.test(s)) return search();
  if (/^about:blank$/i.test(s)) return { type: 'url', url: 'about:blank' };
  if (ALLOWED_SCHEMES.test(s)) {
    try { new URL(s.replace(/^view-source:/i, '')); return { type: 'url', url: s }; } catch (e) { return search(); }
  }
  // host:port, localhost, IPv4, [IPv6]
  if (/^(localhost|(\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])(:\d{1,5})?([/?#]\S*)?$/i.test(s)) {
    return { type: 'url', url: 'http://' + s };
  }
  // anything else with a scheme (javascript:, data:, mailto:...) is treated as text
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return search();
  if (/^([\p{L}\p{N}-]+\.)+[\p{L}]{2,}(:\d{1,5})?([/?#]\S*)?$/iu.test(s)) {
    return { type: 'url', url: 'https://' + s };
  }
  return search();
}

function isSecureUrl(u) {
  return /^(https|lumen|file|about):/i.test(u || '');
}

function hostOf(u) {
  try { return new URL(u).hostname; } catch (e) { return ''; }
}

module.exports = { classify, isSecureUrl, hostOf };
