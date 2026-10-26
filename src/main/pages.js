'use strict';
// HTML for internal pages (new tab, error, proceed). Served through lumen:// with a strict CSP.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { APP_NAME } = require('./config');

let LOGO = '';
try { LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png')).toString('base64'); } catch (e) { /* page works without it */ }

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nonce() { return crypto.randomBytes(16).toString('base64'); }
function csp(n) {
  return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'; img-src data:; base-uri 'none'; form-action 'none'`;
}
function hue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }

const BASE_CSS = `
:root{color-scheme:light dark;--bg:#f2f4f8;--fg:#0c121a;--fg2:rgba(12,18,26,.62);--card:rgba(255,255,255,.62);--line:rgba(12,18,26,.12);--accent:#0a62d6;
--b1:#7fd4c4;--b2:#f2a65a;--b3:#8aa7ff}
@media (prefers-color-scheme:dark){:root{--bg:#10141b;--fg:#eef2f7;--fg2:rgba(238,242,247,.64);--card:rgba(255,255,255,.07);--line:rgba(255,255,255,.14);--accent:#6cb2ff;--b1:#1f7a70;--b2:#9a5a1e;--b3:#3b4fb8}}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:var(--bg);color:var(--fg);font:15px/1.5 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
`;

function renderNewTab({ engineUrl, engineName, sites }) {
  const n = nonce();
  const tiles = sites.map(s => {
    let host = s.origin; try { host = new URL(s.origin).hostname.replace(/^www\./, ''); } catch (e) {}
    const letter = (host[0] || '?').toUpperCase();
    return `<a class="tile" href="${esc(s.origin)}"><span class="ic" style="--h:${hue(host)}">${esc(letter)}</span><span class="nm">${esc(s.title || host)}</span><span class="ho">${esc(host)}</span></a>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>New Tab</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}">
<style>${BASE_CSS}
body{background:
 radial-gradient(60vmax 40vmax at 12% -6%,var(--b1),transparent 60%),
 radial-gradient(55vmax 38vmax at 92% 4%,var(--b2),transparent 58%),
 radial-gradient(70vmax 50vmax at 50% 110%,var(--b3),transparent 60%),var(--bg);background-attachment:fixed}
main{max-width:760px;margin:0 auto;padding:clamp(40px,12vh,120px) 24px 64px}
h1{display:flex;align-items:center;gap:12px;font-weight:600;font-size:13px;line-height:1;letter-spacing:.14em;text-transform:uppercase;color:var(--fg2);margin:0 0 22px}
h1 img{width:44px;height:44px;border-radius:11px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
form{display:flex}
input{flex:1;font:inherit;font-size:18px;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:15px 24px;outline:none;backdrop-filter:blur(10px)}
input:focus-visible{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 30%,transparent)}
input::placeholder{color:var(--fg2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;margin-top:44px}
.tile{display:flex;flex-direction:column;gap:2px;padding:14px;border-radius:18px;background:var(--card);border:1px solid var(--line);text-decoration:none;color:inherit;min-width:0}
.tile:hover{border-color:var(--accent)}.tile:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ic{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-weight:700;color:#fff;background:hsl(var(--h) 55% 46%);margin-bottom:8px}
.nm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ho{font-size:12.5px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty{margin-top:44px;color:var(--fg2)}
</style></head><body><main>
<h1>${LOGO ? `<img src="${LOGO}" alt="" width="44" height="44">` : ''}${esc(APP_NAME)}</h1>
<form id="f"><input id="q" type="text" placeholder="Search ${esc(engineName)} or type an address" autocomplete="off" spellcheck="false" autofocus aria-label="Search or enter address"></form>
${sites.length ? `<nav class="grid" aria-label="Frequently visited">${tiles}</nav>` : `<p class="empty">Sites you visit often will appear here.</p>`}
</main>
<script nonce="${n}">
var ENGINE=${JSON.stringify(engineUrl)};
document.getElementById('f').addEventListener('submit',function(e){
 e.preventDefault();var s=document.getElementById('q').value.trim();if(!s)return;
 var url;
 if(/^https?:\\/\\//i.test(s)){url=s}
 else if(!/\\s/.test(s)&&/^([\\w-]+\\.)+[a-z]{2,}(:\\d+)?([\\/?#]\\S*)?$/i.test(s)){url='https://'+s}
 else{url=ENGINE.replace('%s',encodeURIComponent(s))}
 location.href=url;
});
</script></body></html>`;
}

const ERRORS = {
  ERR_INTERNET_DISCONNECTED: ["You're offline", 'Check your network connection, then try again.'],
  ERR_NETWORK_CHANGED: ['The network changed', 'Your connection changed while the page was loading. Try again.'],
  ERR_NAME_NOT_RESOLVED: ["Can't find this site", 'The address may be misspelled, or the site may not exist.'],
  ERR_CONNECTION_REFUSED: ['The site refused the connection', 'The server is not accepting connections right now.'],
  ERR_CONNECTION_TIMED_OUT: ['The site took too long to respond', 'The server did not answer in time.'],
  ERR_TIMED_OUT: ['The site took too long to respond', 'The server did not answer in time.'],
  ERR_CONNECTION_RESET: ['The connection was reset', 'Something interrupted the connection. Try again.'],
  ERR_CONNECTION_CLOSED: ['The connection was closed', 'The server closed the connection without answering.'],
  ERR_ADDRESS_UNREACHABLE: ["Can't reach this address", 'The address cannot be reached from this network.'],
  ERR_TOO_MANY_REDIRECTS: ['Too many redirects', 'This page keeps redirecting. Clearing cookies for the site may help.'],
  ERR_BLOCKED_BY_CLIENT: ['The page was blocked', 'This address is blocked.'],
  PAGE_CRASHED: ['This page crashed', 'The page stopped working. Reloading may fix it.']
};

function renderError({ desc, url, code, token }) {
  const n = nonce();
  const isCert = /^ERR_CERT_/.test(desc);
  const [title, body] = isCert
    ? ["This connection isn't private", "Lumen could not verify this site's security certificate. Someone on the network could be pretending to be the site."]
    : (ERRORS[desc] || ['This page can’t be loaded', 'Something went wrong while loading the page.']);
  let host = ''; try { host = new URL(url).hostname; } catch (e) {}
  const proceed = isCert && host
    ? `<p class="small"><a id="proceed" href="lumen://proceed?host=${encodeURIComponent(host)}&amp;token=${encodeURIComponent(token)}&amp;url=${encodeURIComponent(url)}">Proceed to ${esc(host)} (unsafe)</a></p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}">
<style>${BASE_CSS}
main{max-width:560px;margin:0 auto;padding:clamp(60px,18vh,170px) 24px}
.code{font:600 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:var(--fg2);margin-bottom:16px}
h1{font-weight:650;font-size:30px;line-height:1.15;margin:0 0 10px;letter-spacing:-.01em}
p{color:var(--fg2);margin:0 0 22px}
.url{font:13px/1.4 ui-monospace,Consolas,monospace;word-break:break-all;color:var(--fg2);margin-bottom:26px}
button{font:inherit;font-weight:600;color:#fff;background:var(--accent);border:0;border-radius:999px;padding:11px 24px;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.small{font-size:13px;margin-top:28px}.small a{color:var(--fg2)}
</style></head><body><main>
<div class="code">${esc(desc || 'ERROR')} (${esc(code)})</div>
<h1>${esc(title)}</h1><p>${esc(body)}</p>
<div class="url">${esc(url)}</div>
<button id="retry" type="button">Try again</button>
${proceed}
</main><script nonce="${n}">
document.getElementById('retry').addEventListener('click',function(){location.href=${JSON.stringify(url)}});
</script></body></html>`;
}

function renderProceed(url) {
  const n = nonce();
  return `<!doctype html><html><head><meta charset="utf-8"><title>Continuing</title>
<meta http-equiv="Content-Security-Policy" content="${csp(n)}"></head><body>
<script nonce="${n}">location.replace(${JSON.stringify(url)})</script></body></html>`;
}

module.exports = { renderNewTab, renderError, renderProceed };
