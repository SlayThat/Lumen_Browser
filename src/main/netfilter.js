'use strict';
// Request filtering: HTTPS-first upgrades and a conservative ad/tracker blocklist.
// Pure functions so they can be tested without Electron.

// Third-party ad and tracking networks. Matching covers the domain and all its subdomains.
// Deliberately conservative: nothing here is needed for a site to work, and video player
// libraries (such as the Google IMA SDK) are left alone so players do not hang.
const BLOCKED = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'google-analytics.com', 'analytics.google.com', 'pagead2.googlesyndication.com', '2mdn.net',
  'adnxs.com', 'adsrvr.org', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
  'scorecardresearch.com', 'quantserve.com', 'quantcount.com', 'hotjar.com', 'hotjar.io',
  'amazon-adsystem.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'casalemedia.com',
  'moatads.com', 'adsafeprotected.com', 'serving-sys.com', 'advertising.com', 'smartadserver.com',
  'bidswitch.net', 'rlcdn.com', 'demdex.net', 'bluekai.com', 'krxd.net', 'agkn.com', 'mathtag.com',
  'adform.net', 'adition.com', 'yieldmo.com', 'teads.tv', 'media.net', 'contextweb.com',
  'sharethrough.com', 'triplelift.com', 'indexww.com', 'lijit.com', 'sovrn.com', 'gumgum.com',
  '33across.com', 'spotxchange.com', 'springserve.com', 'tapad.com', 'liveramp.com',
  'bat.bing.com', 'ads.linkedin.com', 'px.ads.linkedin.com', 'ads-twitter.com', 'analytics.twitter.com',
  'analytics.tiktok.com', 'ads.tiktok.com', 'ads.yahoo.com', 'analytics.yahoo.com',
  'adsymptotic.com', 'bounceexchange.com', 'chartbeat.net', 'cdn.mouseflow.com', 'mouseflow.com',
  'fullstory.com', 'crazyegg.com', 'luckyorange.com', 'segment.io', 'mixpanel.com', 'branch.io',
  'adcolony.com', 'applovin.com', 'unityads.unity3d.com', 'ads.pubmatic.com', 'zedo.com',
  'revcontent.com', 'mgid.com', 'content.ad', 'adroll.com', 'perfectaudience.com', 'ib-ibi.com',
  'pippio.com', 'eyeota.net', 'exelator.com', 'turn.com', 'w55c.net', 'adgrx.com', 'betrad.com'
];

const BLOCK_SET = new Set(BLOCKED);

function hostOfUrl(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch (e) { return ''; }
}

// True when the host, or any parent domain of it, is on the list.
function isBlockedHost(host) {
  if (!host) return false;
  const parts = host.split('.');
  for (let i = 0; i <= parts.length - 2; i++) if (BLOCK_SET.has(parts.slice(i).join('.'))) return true;
  return false;
}

// Do two hosts belong to the same site? Cheap check: same host, or one is a subdomain of the other.
function sameSite(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith('.' + b) || b.endsWith('.' + a);
}

// Blocks third-party requests to listed hosts. Never blocks page navigations.
function shouldBlock(details, pageUrl) {
  if (details.resourceType === 'mainFrame') return false;
  const host = hostOfUrl(details.url);
  if (!isBlockedHost(host)) return false;
  const pageHost = hostOfUrl(pageUrl || details.referrer || '');
  return !sameSite(host, pageHost);
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// Decides whether to try https for a typed or clicked http:// address.
// Skips local and private addresses, single-word hosts (intranet names), explicit ports,
// and hosts that already failed over https in this session.
function upgradeUrl(url, httpAllow) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (u.protocol !== 'http:' || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!host || host.startsWith('[') || IPV4.test(host)) return null;
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.lan')) return null;
  if (httpAllow && httpAllow.has(host)) return null;
  u.protocol = 'https:';
  return u.href;
}

// Failures where trying plain http again makes sense for a host we upgraded.
const FALLBACK_CODES = new Set([-100, -101, -102, -107, -109, -113, -118, -310, -501]);
function shouldFallBack(code) {
  return FALLBACK_CODES.has(code) || (code <= -200 && code >= -299);
}

module.exports = { BLOCKED, isBlockedHost, shouldBlock, upgradeUrl, shouldFallBack, hostOfUrl, sameSite };
