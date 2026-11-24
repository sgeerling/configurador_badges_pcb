const { openPage } = require('./harness.cjs');

// Una L de 40×40 mm con brazos de 8 mm: su rectángulo envolvente admite un
// supercondensador de 12,5×25 mm, pero la silueta real no.
const L_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M0 0 H40 V8 H8 V40 H0 Z" fill="#222"/></svg>';

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await page.evaluate((svg) => { loadText(svg, 'ele.svg', false); S.size = 40; S.product = 'badge'; S.outline = 'silueta'; render(); }, L_SVG);
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 3, null, { timeout: 10000 });
    const r = await page.evaluate(() => {
      const out = {};
      for (const b of ['sc15f', 'sc1f', 'cr2032', 'cr1220']) {
        S.comps = []; S.battery = b; S.mcu = 'auto'; S.opt.beh = 'parpadeo';
        addComp('led', { x: 4, y: 4 }); render();
        out[b] = D.warns.filter((w) => w.lv === 'crit' && /no cabe/.test(w.t)).length > 0;
      }
      return out;
    });
    t.ok(r.sc15f, 'fit_silhouette: el supercondensador de 15 F no cabe en la L');
    t.ok(r.sc1f, 'fit_silhouette: el de 1 F (Ø19,5) no cabe en brazos de 8 mm');
    t.ok(r.cr2032, 'fit_silhouette: la CR2032 tampoco cabe');
    t.ok(r.cr1220, 'fit_silhouette: la CR1220 (Ø12,5+) no cabe en 8 mm');
    // Con el búho grande sí caben: no debe haber falsos bloqueos
    await page.click('#btnSample');
    await page.waitForFunction(() => S.artName === 'buho_ejemplo.svg' && GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    await page.evaluate(() => { S.size = 80; render(); });
    await page.waitForFunction(() => GEO.poly && GEO.H > 79, null, { timeout: 10000 });
    const ok = await page.evaluate(() => { S.battery = 'lipo180'; render(); return D.warns.filter((w) => w.lv === 'crit').map((w) => w.t); });
    t.eq(ok, [], 'sin falsos bloqueos en el búho con LiPo 180');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
