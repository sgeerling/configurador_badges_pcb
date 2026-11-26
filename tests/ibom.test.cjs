const path = require('path');
const { openPage } = require('./harness.cjs');

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await page.click('#appTabs [data-app="ibom"]');
    t.ok(await page.isVisible('#viewIbom'), 'la pestaña BOM interactivo muestra su vista');
    t.ok(await page.isHidden('#viewConfig'), 'oculta el configurador');
    const items = await page.$$eval('#ibList [data-ib]', (b) => b.map((x) => x.textContent));
    t.ok(items.some((s) => /Chihuahua/.test(s)), 'la galería incluye el chihuahua: ' + items.join(','));
    const src = await page.getAttribute('#ibFrame', 'src');
    t.eq(src, 'boms/chihuahua.html', 'abre el primer BOM en el visor');
    t.eq(await page.getAttribute('#ibOpen', 'href'), 'boms/chihuahua.html', 'enlace para abrir en pestaña nueva');
    t.ok(page.url().endsWith('#bom'), 'la URL queda en #bom');
    await page.setInputFiles('#ibFile', path.join(__dirname, '..', 'boms', 'chihuahua.html'));
    await page.waitForFunction(() => document.querySelector('#ibFrame').hasAttribute('srcdoc'));
    t.ok(/LZString/.test(await page.getAttribute('#ibFrame', 'srcdoc')), 'un ibom.html subido se muestra en el visor');
    await page.click('#appTabs [data-app="config"]');
    t.ok(await page.isVisible('#viewConfig'), 'vuelve al configurador');
    t.ok(await page.isHidden('#viewIbom'), 'oculta el BOM');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
