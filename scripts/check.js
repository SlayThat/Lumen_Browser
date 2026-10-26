'use strict';
// Syntax-checks every script. Run with: npm run check
const fs = require('fs'), path = require('path'), cp = require('child_process');
let bad = 0;
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); }
    else if (p.endsWith('.js')) {
      const r = cp.spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
      if (r.status) { bad++; console.error(p + '\n' + r.stderr); }
    }
  }
})(path.join(__dirname, '..', 'src'));
console.log(bad ? bad + ' file(s) failed' : 'All scripts parse.');
process.exit(bad ? 1 : 0);
