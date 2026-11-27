const { openPage } = require('./harness.cjs');

// SVG guardado con Inkscape: trae elementos y atributos sodipodi:/inkscape: (sus prefijos no se declaran al copiarlo)
const INKSCAPE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg version="1.1" width="200" height="200" viewBox="0 0 200 200"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg" sodipodi:docname="estrella.svg">
  <sodipodi:namedview id="nv" pagecolor="#ffffff" inkscape:pageopacity="0.0"><inkscape:page x="0" y="0" width="200" height="200"/></sodipodi:namedview>
  <g inkscape:groupmode="layer" inkscape:label="Capa 1">
    <path inkscape:label="estrella" d="M100 10 L125 75 L195 80 L140 122 L160 190 L100 150 L40 190 L60 122 L5 80 L75 75 Z" fill="#ffffff" stroke="none"/>
    <circle cx="100" cy="100" r="22" fill="#111111"/>
  </g>
</svg>`;

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await page.evaluate((txt) => { loadText(txt, 'estrella.svg', false); S.outline = 'silueta'; render(); }, INKSCAPE);
    const ok = await page.waitForFunction(() => (GEO.poly && GEO.poly.length > 10) || GEO.polyNote, null, { timeout: 8000 }).then(() => true, () => false);
    const st = await page.evaluate(() => ({ poly: GEO.poly ? GEO.poly.length : 0, note: GEO.polyNote }));
    t.ok(ok && st.poly > 10, 'outline_inkscape: la silueta se traza en un SVG de Inkscape — ' + JSON.stringify(st));
    t.eq(st.note, '', 'outline_inkscape: sin aviso de «exportaré el rectángulo»');
    const edge = await page.evaluate(() => generateGerbers().files.find((f) => /Edge_Cuts/.test(f.filename)).gerber.split('\n').filter((l) => /^X/.test(l)).length);
    t.ok(edge > 10, 'outline_gerber: el borde del Gerber sigue la estrella (' + edge + ' puntos)');
    const kicad = await page.evaluate(() => makeKicad());
    const outl = (kicad.match(/outline\(\[(.*)\]\)/) || [, ''])[1].split('), (').length;
    t.ok(outl > 10, 'outline_kicad: el script de KiCad usa la silueta (' + outl + ' puntos)');
    // carrera: abrir el visor Gerber y exportar justo después de cambiar el margen (la silueta tarda en recalcularse)
    await page.evaluate(() => { S.margin = 3; render(); });
    await page.click('#appTabs [data-app="gerber"]');
    await page.waitForFunction(() => (GV.files || []).some((f) => /Edge_Cuts/.test(f.filename)) && !GEO.poly === false, null, { timeout: 10000 });
    await page.waitForTimeout(400);
    const gvEdge = await page.evaluate(() => GV.files.find((f) => /Edge_Cuts/.test(f.filename)).gerber.split('\n').filter((l) => /^X/.test(l)).length);
    t.ok(gvEdge > 10, 'outline_viewer_race: el visor Gerber espera la silueta (' + gvEdge + ' puntos)');
    await page.click('#appTabs [data-app="config"]');
    await page.evaluate(() => { S.margin = 2; render(); curExp = 'dxf'; openModal(); });
    await page.waitForFunction(() => !$('#mText').hidden && /POLYLINE|LWPOLYLINE|VERTEX/.test($('#mText').value), null, { timeout: 10000 }).catch(() => {});
    const dxfPts = await page.evaluate(() => ($('#mText').value.match(/\n10\n/g) || []).length);
    t.ok(dxfPts > 10, 'outline_export_race: el DXF exportado de inmediato sigue la silueta (' + dxfPts + ' vértices)');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
