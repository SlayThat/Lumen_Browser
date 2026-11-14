'use strict';
const assert = require('assert');
const { Vault, originOf } = require('../src/main/vault');

// A fake cipher: reversible, but the stored text must not contain the secrets in plain form.
const cipher = {
  available: async () => true,
  encrypt: async (s) => Buffer.from(Buffer.from(s).toString('hex').split('').reverse().join('')),
  decrypt: async (b) => Buffer.from(b.toString().split('').reverse().join(''), 'hex').toString()
};
const mem = () => ({ data: { items: [], never: [] }, saves: 0, save() { this.saves++; } });

(async () => {
  assert.strictEqual(originOf('https://Example.com/login?x=1'), 'https://example.com');
  assert.strictEqual(originOf('http://example.com/'), '');
  assert.strictEqual(originOf('http://localhost:3000/a'), 'http://localhost:3000');
  assert.strictEqual(originOf('lumen://newtab'), '');
  assert.strictEqual(originOf('javascript:alert(1)'), '');
  assert.strictEqual(originOf('garbage'), '');

  const store = mem();
  const v = new Vault(store, cipher);
  const o = 'https://example.com';
  assert.deepStrictEqual((await v.check(o, 'ann', 'pw1')).kind, 'new');
  assert.deepStrictEqual((await v.save(o, 'ann', 'pw1')).kind, 'new');
  assert.ok(!JSON.stringify(store.data).includes('pw1') && !JSON.stringify(store.data).includes('ann'), 'nothing readable on disk');
  assert.strictEqual((await v.check(o, 'ann', 'pw1')).kind, 'same');
  assert.strictEqual((await v.check(o, 'ann', 'pw2')).kind, 'update');
  assert.strictEqual((await v.save(o, 'ann', 'pw2')).kind, 'update');
  assert.strictEqual(v.items.length, 1);
  await v.save(o, 'bob', 'x1');
  await v.save('https://other.org', 'ann', 'y');

  // lookups never mix origins and never reveal passwords
  const mine = await v.forOrigin(o);
  assert.deepStrictEqual(mine.map(x => x.user).sort(), ['ann', 'bob']);
  assert.ok(mine.every(x => !('p' in x) && !('pass' in x)));
  assert.deepStrictEqual(await v.forOrigin('https://evil.com'), []);
  const ann = mine.find(x => x.user === 'ann');
  assert.strictEqual((await v.secret(ann.id, o)).p, 'pw2');
  assert.strictEqual(await v.secret(ann.id, 'https://evil.com'), null, 'a login only opens for its own site');

  // limits and refusals
  assert.strictEqual((await v.check(o, '', 'x')).kind, 'skip');
  assert.strictEqual((await v.check(o, 'u', '')).kind, 'skip');
  assert.strictEqual((await v.check(o, 'u'.repeat(300), 'p')).kind, 'skip');
  assert.strictEqual((await v.check(o, 'u', 'p'.repeat(2000))).kind, 'skip');
  assert.strictEqual((await v.check('', 'u', 'p')).kind, 'skip');

  // never save
  v.setNever('https://bank.test');
  assert.strictEqual((await v.check('https://bank.test', 'u', 'p')).kind, 'skip');
  v.setNever('https://bank.test');
  assert.strictEqual(store.data.never.length, 1);

  // unreadable data is reported, not thrown
  v.items.push({ id: 'zz', origin: o, blob: 'AAAA', t: 1 });
  assert.ok((await v.list()).some(x => x.user === '(unreadable)'));
  assert.strictEqual((await v.forOrigin(o)).length, 2);

  // remove and clear
  assert.ok(v.remove(ann.id) && !v.remove(ann.id));
  v.clear();
  assert.strictEqual((await v.list()).length, 0);
  console.log('vault tests passed');
})().catch(e => { console.error(e); process.exit(1); });
