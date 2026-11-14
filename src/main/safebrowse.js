'use strict';
// Phishing warnings. Lumen downloads a public list of reported phishing domains and checks every page address
// against it on this computer. No address you visit is ever sent anywhere; the only request is the list download.
// Pure functions plus a small loader, so the logic can be tested without Electron.

// The list we use (MIT licence, community maintained): https://github.com/Phishing-Database/Phishing.Database
const SOURCE_URL = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';
const MAX_BYTES = 40 * 1024 * 1024;     // refuse anything larger than this
const MIN_ENTRIES = 1000;               // a real list is far bigger; a tiny one is an error page or a bad copy
const MAX_AGE_MS = 12 * 3600 * 1000;    // refresh at most twice a day

// Sites that must never be flagged, even if a list ever contains them by mistake.
const NEVER = new Set(['google.com', 'youtube.com', 'microsoft.com', 'live.com', 'office.com', 'apple.com', 'icloud.com', 'amazon.com',
  'facebook.com', 'instagram.com', 'whatsapp.com', 'twitter.com', 'x.com', 'linkedin.com', 'github.com', 'githubusercontent.com',
  'wikipedia.org', 'reddit.com', 'netflix.com', 'paypal.com', 'ebay.com', 'yahoo.com', 'bing.com', 'duckduckgo.com', 'mozilla.org',
  'cloudflare.com', 'dropbox.com', 'adobe.com', 'spotify.com', 'twitch.tv', 'discord.com', 'tiktok.com', 'zoom.us', 'slack.com',
  'steampowered.com', 'roblox.com', 'openai.com', 'anthropic.com', 'claude.ai', 'pages.dev', 'github.io', 'blogspot.com', 'wordpress.com']);

// A 53-bit string hash (cyrb53). The list is stored as numbers, which keeps half a million entries small in memory,
// and two different domains colliding is about one in a hundred billion.
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

// One domain per line. Also understands hosts-file lines ("0.0.0.0 domain") and comments.
function parseList(text) {
  const set = new Set();
  let total = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    let line = raw.trim().toLowerCase();
    if (!line || line[0] === '#' || line[0] === '!') continue;
    const parts = line.split(/\s+/);
    line = parts[parts.length - 1];
    if (line.startsWith('*.')) line = line.slice(2);
    line = line.replace(/\.$/, '');
    if (line.length > 253 || !DOMAIN.test(line) || /^[0-9.]+$/.test(line)) continue;
    total++;
    if (NEVER.has(line)) continue;
    set.add(hash53(line));
  }
  return { set, total };
}

function hostOfUrl(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch (e) { return ''; }
}

// True when the host, or a parent domain of it, is on the list. Never true for the NEVER sites or their subdomains.
function isListed(set, host) {
  if (!set || !set.size || !host || host.indexOf('.') < 0 || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return false;
  const parts = host.split('.');
  for (let i = 0; i <= parts.length - 2; i++) if (NEVER.has(parts.slice(i).join('.'))) return false;
  for (let i = 0; i <= parts.length - 2; i++) if (set.has(hash53(parts.slice(i).join('.')))) return true;
  return false;
}

// Is a downloaded list believable? Guards against error pages and truncated downloads replacing a good list.
function looksValid(parsed) {
  return !!parsed && parsed.total >= MIN_ENTRIES && parsed.set.size >= MIN_ENTRIES * 0.9;
}

module.exports = { SOURCE_URL, MAX_BYTES, MIN_ENTRIES, MAX_AGE_MS, NEVER, hash53, parseList, hostOfUrl, isListed, looksValid };
