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
    t.ok(await page.locator('#tools [data-v="win"]').count() === 1, 'backlight_tool: existe la herramienta Ventana translúcida');
    await page.click('#tools [data-v="led"]');
    t.ok(await page.locator('#toolOpts [data-k="side"]').count() > 0, 'backlight_side: el LED ofrece elegir la cara');

    // LEDs manuales: se quedan donde se tocan, aunque sea sobre un ojo
    const man = await page.evaluate(() => { const b = elMM(ART.els[5]); const p = { x: b.cx + 2, y: b.cy - 1.5 }; S.opt.side = 'F'; const c = addComp('led', p, 5); render(); const d = D.comps.find((x) => x.id === c.id); return { p, x: d.x, y: d.y, el: c.el }; });
    t.ok(man.el == null && Math.abs(man.x - man.p.x) < 1e-6 && Math.abs(man.y - man.p.y) < 1e-6, 'led_manual: el LED queda en el punto tocado, no se centra en el ojo ' + JSON.stringify(man));
    t.eq(await page.locator('#sgEyes').count(), 0, 'led_manual: no se ofrece «Poner un LED en cada ojo»');
    t.eq(await page.evaluate(() => typeof eyeCandidates), 'undefined', 'led_manual: ya no hay detección automática de ojos');

    // LED en el reverso: no crea ventanas por su cuenta
    const r = await page.evaluate(() => { const n0 = S.comps.length; S.opt.side = 'B'; const b = elMM(ART.els[6]); addComp('led', { x: b.cx, y: b.cy }, null); render();
      const led = D.comps.find((c) => c.kind === 'led' && c.side === 'B'); return { added: S.comps.length - n0, led: led && { x: led.x, y: led.y, ref: led.ref }, wins: D.comps.filter((c) => c.kind === 'win').length, warns: D.warns.filter((w) => /no se verá/.test(w.t)).map((w) => w.lv) }; });
    t.ok(r.led, 'backlight_led: hay un LED en el reverso');
    t.eq([r.added, r.wins], [1, 0], 'backlight_noauto: poner un LED en el reverso no inventa una ventana');
    t.eq(r.warns, ['warn'], 'backlight_nowin: avisa que la luz no se verá');

    // ventanas: solo formas negras y cerradas del SVG
    const cand = await page.evaluate(() => { S.tool = 'win'; render(); return { list: winCandidates().map((e) => e.i).sort((a, b) => a - b), marks: document.querySelectorAll('#hintLayer [data-wincand]').length }; });
    t.eq(cand.list, [0, 5, 6], 'win_candidates: solo el cuerpo y las pupilas (negros y cerrados)');
    t.eq(cand.marks, 3, 'win_candidates: se marcan en la mesa');
    const rej = await page.evaluate(() => { const n0 = S.comps.length; const a = addComp('win', { x: 30, y: 52 }, 1); const b = addComp('win', { x: 30, y: 75 }, 8); const c = addComp('win', { x: 2, y: 2 }, null); return { added: S.comps.length - n0, ret: [a, b, c].map((x) => x == null) }; });
    t.eq(rej.added, 0, 'win_reject: no acepta formas claras, abiertas ni puntos vacíos');
    t.eq(rej.ret, [true, true, true], 'win_reject: addComp devuelve null');
    t.eq(await page.evaluate(() => typeof WIN_R), 'undefined', 'win_nocircle: no hay ventanas circulares genéricas');
    const ok = await page.evaluate(() => { const w = addComp('win', { x: 40.8, y: 29.3 }, 6); render(); return { el: w && w.el, fill: ART.els[6].node.getAttribute('fill'), lit: D.warns.filter((x) => /no se verá/.test(x.t)).length }; });
    t.eq(ok.el, 6, 'win_el: la pupila negra se vuelve ventana');
    t.eq(ok.fill, await page.evaluate(() => FR4), 'en la vista del frente se ve la fibra (color FR4)');
    t.eq(ok.lit, 0, 'el LED del reverso queda bajo la ventana');

    await page.evaluate(() => { S.sel = S.comps.find((c) => c.kind === 'win').id; render(); });
    t.ok(await page.locator('#selPanel [data-k="mask"]').count() === 1, 'backlight_panel: opción de abrir la máscara');
    t.eq(await page.locator('#selPanel [data-k="r"]').count(), 0, 'backlight_panel: sin tamaño de círculo');

    const ped = JSON.parse(await page.evaluate(() => makePedido()));
    t.ok(validate(ped), 'backlight_pedido: cumple el esquema — ' + JSON.stringify(validate.errors && validate.errors.slice(0, 2)));
    t.ok(Array.isArray(ped.ventanas) && ped.ventanas.length === 1 && ped.ventanas[0].poligono_mm.length > 8, 'pedido trae la ventana con el polígono de la pupila');
    t.eq(ped.ventanas[0].sin_cobre, ['F.Cu', 'B.Cu'], 'sin cobre en ambas caras');
    const bl = ped.piezas_fijas.find((p) => p.ref === r.led.ref);
    t.ok(bl && bl.cara === 'B' && /inverso/i.test(bl.valor), 'el LED del reverso va en cara B como montaje inverso ' + JSON.stringify(bl));

    const g = await page.evaluate(() => { const G = generateGerbers(); const f = (n) => G.files.find((x) => x.filename.includes(n)).gerber; return { fm: f('F_Mask'), bm: f('B_Mask'), bcu: f('B_Cu') }; });
    t.ok(/G36/.test(g.fm) && /G36/.test(g.bm), 'backlight_gerber: abre la máscara en ambas caras');
    t.ok(/%LPC\*%/.test(g.bcu), 'backlight_gerber: despeja cobre en el reverso');
    t.ok(/keepout\(/.test(await page.evaluate(() => makeKicad())), 'backlight_kicad: el script crea un área sin cobre');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
