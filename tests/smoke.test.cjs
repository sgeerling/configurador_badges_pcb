const { openPage, loadOwl } = require('./harness.cjs');

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    const st = await page.evaluate(() => ({
      stack: typeof pcbStackup,
      zip: typeof JSZip,
      comps: S.comps.length,
    }));
    t.ok(['object', 'function'].includes(st.stack), 'pcbStackup cargado desde node_modules');
    t.ok(['object', 'function'].includes(st.zip), 'JSZip cargado desde node_modules');
    t.ok(st.comps > 0, 'el búho de ejemplo trae componentes');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
