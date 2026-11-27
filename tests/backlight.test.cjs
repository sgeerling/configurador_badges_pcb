const path = require('path');
const Ajv = require('ajv');
const { openPage, loadOwl, ROOT } = require('./harness.cjs');

module.exports = async function (t) {
  const schema = require(path.join(ROOT, 'docs/pedido_badge.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    // herramienta y opción de cara
    t.ok(await page.locator('#tools [data-v="win"]').count() === 1, 'backlight_tool: existe la herramienta Ventana translúcida');
    await page.click('#tools [data-v="led"]');
    t.ok(await page.locator('#toolOpts [data-k="side"]').count() > 0, 'backlight_side: el LED ofrece elegir la cara');

    // LED en el reverso: crea su ventana
    const r = await page.evaluate(() => { const n0 = S.comps.length; S.opt.side = 'B'; const p = { x: GEO.W * 0.5, y: GEO.H * 0.78 }; addComp('led', p, null); render();
      const led = D.comps.find((c) => c.kind === 'led' && c.side === 'B'); const wins = D.comps.filter((c) => c.kind === 'win');
      return { added: S.comps.length - n0, led: led && { x: led.x, y: led.y, ref: led.ref }, wins: wins.map((w) => ({ x: w.x, y: w.y, r: w.r })), warns: D.warns.map((w) => w.t) }; });
    t.ok(r.led, 'backlight_led: hay un LED en el reverso');
    t.eq(r.added, 2, 'backlight_autowin: poner un LED en el reverso agrega su ventana');
    t.ok(r.wins.some((w) => Math.hypot(w.x - r.led.x, w.y - r.led.y) < 0.01 && w.r >= 3), 'la ventana queda centrada en el LED');
    t.ok(!r.warns.some((w) => /no se verá/.test(w)), 'con ventana no hay aviso de luz tapada');

    // sin ventana → aviso
    const w2 = await page.evaluate(() => { S.comps = S.comps.filter((c) => c.kind !== 'win'); render(); return D.warns.filter((w) => /no se verá/.test(w.t)).map((w) => w.lv); });
    t.eq(w2, ['warn'], 'backlight_nowin: avisa que la luz no se verá');

    // ventana desde un elemento del dibujo (el vientre del búho)
    const belly = await page.evaluate(() => { const i = ART.els.findIndex((e) => /ellipse/i.test(e.node.tagName)); const b = elMM(ART.els[i]); S.tool = 'win'; addComp('win', { x: b.cx, y: b.cy }, i); render();
      const w = D.comps.find((c) => c.kind === 'win'); return { i, el: w.el, fill: ART.els[i].node.getAttribute('fill') }; });
    t.eq(belly.el, belly.i, 'backlight_el: la ventana toma la forma del dibujo');
    t.eq(belly.fill, await page.evaluate(() => FR4), 'en la vista del frente se ve la fibra (color FR4)');
    const nw = await page.evaluate(() => D.warns.filter((w) => /no se verá/.test(w.t)).length);
    t.eq(nw, 0, 'el LED queda bajo la ventana del vientre');
    const tw = await page.evaluate(() => ({ termo: D.comps.some((c) => c.kind === 'termo'), w: D.warns.some((w) => /zona termocrómica/.test(w.t) && /ventana/.test(w.t)) }));
    t.ok(!tw.termo || tw.w, 'backlight_termo: avisa si la ventana cae sobre la zona termocrómica');
    t.ok(await page.evaluate(() => { S.tool = 'win'; render(); return !/undefined/.test($('#hint').textContent); }), 'la pista de la herramienta está escrita');

    // panel de ventana
    await page.evaluate(() => { S.sel = S.comps.find((c) => c.kind === 'win').id; render(); });
    t.ok(await page.locator('#selPanel [data-k="mask"]').count() === 1, 'backlight_panel: opción de abrir la máscara');

    // pedido
    const ped = JSON.parse(await page.evaluate(() => makePedido()));
    t.ok(validate(ped), 'backlight_pedido: cumple el esquema — ' + JSON.stringify(validate.errors && validate.errors.slice(0, 2)));
    t.ok(Array.isArray(ped.ventanas) && ped.ventanas.length === 1 && ped.ventanas[0].poligono_mm.length > 8, 'pedido trae la ventana con su polígono');
    t.eq(ped.ventanas[0].sin_cobre, ['F.Cu', 'B.Cu'], 'sin cobre en ambas caras');
    const bl = ped.piezas_fijas.find((p) => p.ref === r.led.ref);
    t.ok(bl && bl.cara === 'B' && /inverso/i.test(bl.valor), 'el LED del reverso va en cara B como montaje inverso ' + JSON.stringify(bl));
    t.ok(!ped.piezas_fijas.some((p) => p.rol === 'win'), 'la ventana no es una pieza');

    // Gerber: la máscara del frente tiene la abertura y el cobre del reverso conserva los pads del LED
    const g = await page.evaluate(() => { const G = generateGerbers(); const f = (n) => G.files.find((x) => x.filename.includes(n)).gerber; return { fm: f('F_Mask'), bm: f('B_Mask'), bcu: f('B_Cu') }; });
    t.ok(/G36/.test(g.fm) && /G36/.test(g.bm), 'backlight_gerber: abre la máscara en ambas caras');
    t.ok(/%LPC\*%/.test(g.bcu), 'backlight_gerber: despeja cobre en el reverso');
    const kicad = await page.evaluate(() => makeKicad());
    t.ok(/keepout\(/.test(kicad), 'backlight_kicad: el script crea un área sin cobre');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
