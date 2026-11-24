const fs = require('fs');
const path = require('path');

async function main() {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.cjs'))
    .filter((f) => !only.length || only.some((o) => f.includes(o)))
    .sort();
  let failed = 0;
  let passed = 0;
  for (const f of files) {
    const fails = [];
    const t = {
      ok(v, msg) { if (!v) fails.push(msg || 'ok() falló'); },
      eq(a, b, msg) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          fails.push(`${msg || 'eq() falló'} — obtuve ${JSON.stringify(a)}, esperaba ${JSON.stringify(b)}`);
        }
      },
    };
    try {
      await require(path.join(__dirname, f))(t);
    } catch (e) {
      fails.push('excepción: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e));
    }
    if (fails.length) {
      failed++;
      console.log(`FAIL ${f}`);
      fails.forEach((m) => console.log('   - ' + m));
    } else {
      passed++;
      console.log(`PASS ${f}`);
    }
  }
  console.log(`\n${passed} PASS, ${failed} FAIL`);
  process.exit(failed ? 1 : 0);
}

main();
