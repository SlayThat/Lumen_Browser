'use strict';
// Saved logins. Usernames and passwords are encrypted with the operating system's key storage before they touch the disk.
// Only the site address is stored in the clear (it is needed to find a login). The cipher is passed in, so the logic
// can be tested without Electron.
const crypto = require('crypto');

const MAX_ITEMS = 2000;
const MAX_USER = 256;
const MAX_PASS = 1024;

// Logins are only for https sites, and for localhost during development.
function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return u.origin;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return u.origin;
  } catch (e) { /* not a web address */ }
  return '';
}

class Vault {
  // store: { data: { items: [], never: [] }, save() }   cipher: { available(), encrypt(str), decrypt(buf) } (all async)
  constructor(store, cipher) {
    this.store = store;
    this.cipher = cipher;
    if (!Array.isArray(store.data.items)) store.data.items = [];
    if (!Array.isArray(store.data.never)) store.data.never = [];
  }
  get items() { return this.store.data.items; }
  available() { return this.cipher.available(); }

  async seal(user, pass) { return (await this.cipher.encrypt(JSON.stringify({ u: user, p: pass }))).toString('base64'); }
  async open(item) {
    try { return JSON.parse(await this.cipher.decrypt(Buffer.from(item.blob, 'base64'))); }
    catch (e) { return null; }   // wrong key, damaged data: treat the login as unreadable
  }

  isNever(origin) { return this.store.data.never.includes(origin); }
  setNever(origin) {
    if (origin && !this.isNever(origin) && this.store.data.never.length < 500) { this.store.data.never.push(origin); this.store.save(); }
  }

  // What would saving this do? 'new', 'update' (same login, different password) or 'same' (nothing to do).
  async check(origin, user, pass) {
    if (!origin || !user || !pass || user.length > MAX_USER || pass.length > MAX_PASS) return { kind: 'skip' };
    if (this.isNever(origin)) return { kind: 'skip' };
    for (const it of this.items) {
      if (it.origin !== origin) continue;
      const s = await this.open(it);
      if (s && s.u === user) return s.p === pass ? { kind: 'same', id: it.id } : { kind: 'update', id: it.id };
    }
    return this.items.length >= MAX_ITEMS ? { kind: 'skip' } : { kind: 'new' };
  }

  async save(origin, user, pass) {
    const c = await this.check(origin, user, pass);
    if (c.kind === 'new') {
      const id = crypto.randomBytes(8).toString('hex');
      this.items.push({ id, origin, blob: await this.seal(user, pass), t: Date.now() });
      this.store.save();
      return { kind: 'new', id };
    }
    if (c.kind === 'update') {
      const it = this.items.find(x => x.id === c.id);
      it.blob = await this.seal(user, pass); it.t = Date.now();
      this.store.save();
    }
    return c;
  }

  // Logins for one site: ids and usernames only. Passwords never leave the main process except to fill or copy.
  async forOrigin(origin) {
    const out = [];
    if (!origin) return out;
    for (const it of this.items) {
      if (it.origin !== origin) continue;
      const s = await this.open(it);
      if (s) out.push({ id: it.id, user: s.u });
    }
    return out;
  }
  async list() {
    const out = [];
    for (const it of this.items) {
      const s = await this.open(it);
      out.push({ id: it.id, origin: it.origin, user: s ? s.u : '(unreadable)', t: it.t });
    }
    return out.sort((a, b) => a.origin.localeCompare(b.origin) || a.user.localeCompare(b.user));
  }
  async secret(id, origin) {
    const it = this.items.find(x => x.id === id);
    if (!it || (origin && it.origin !== origin)) return null;
    return this.open(it);
  }
  remove(id) {
    const i = this.items.findIndex(x => x.id === id);
    if (i >= 0) { this.items.splice(i, 1); this.store.save(); return true; }
    return false;
  }
  clear() { this.store.data.items = []; this.store.save(); }
}

module.exports = { Vault, originOf, MAX_USER, MAX_PASS, MAX_ITEMS };
