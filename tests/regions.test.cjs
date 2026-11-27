const { openPage } = require('./harness.cjs');

// Como el FABi: un fondo negro y encima una sola forma blanca con huecos; los huecos dejan ver superficies negras
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M0 0H100V100H0Z" fill="#000000"/>
  <path fill="#ffffff" fill-rule="evenodd" d="M10 10H90V90H10Z M25 25H45V45H25Z M55 25H75V45H55Z M25 60H75V75H25Z"/>
</svg>`;

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await page.evaluate((txt) => { loadText(txt, 'huecos.svg', false); S.size = 60; render(); }, SVG);
    await page.waitForFunction(() => Array.isArray(ART.regions), null, { timeout: 10000 });
    const r = await page.evaluate(() => { const C = winCandidates(); const s = GEO.s; return { n: C.length, areas: C.map((c) => +(c.area / (s * s)).toFixed(0)).sort((a, b) => a - b) }; });
    // 3 huecos (20×20, 20×20, 50×15) + el marco negro exterior (100² − 80²)
    t.eq(r.n, 4, 'regions_holes: cada hueco negro de una forma blanca es su propia superficie ' + JSON.stringify(r));
    const near = (a, b) => Math.abs(a - b) / b < 0.06;
    t.ok(near(r.areas[0], 400) && near(r.areas[1], 400) && near(r.areas[2], 750) && near(r.areas[3], 3600), 'regions_area: las áreas coinciden con el dibujo ' + JSON.stringify(r.areas));
    const w = await page.evaluate(() => { const s = GEO.s, P = (x, y) => ({ x: GEO.ox + (x - ART.vb.x) * s, y: GEO.oy + (y - ART.vb.y) * s }); S.tool = 'win'; const c = addComp('win', P(35, 35), null); render(); const W = winPolys(D)[0]; return { ok: !!c, pts: W && W.polys[0].length, area: W && Math.abs(polyArea(W.polys[0])) / (s * s) }; });
    t.ok(w.ok && near(w.area, 400), 'regions_pick: tocar un hueco crea la ventana de ese hueco, no de todo el dibujo ' + JSON.stringify(w));
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
