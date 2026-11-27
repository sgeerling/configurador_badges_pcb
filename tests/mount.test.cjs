const path = require('path');
const Ajv = require('ajv');
const { openPage, loadOwl, ROOT } = require('./harness.cjs');

async function dragMount(page, i, toMM) {
  const from = await page.evaluate((i) => { const r = document.querySelector(`[data-mount="${i}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
  const to = await page.evaluate((p) => { const pt = stage.createSVGPoint(); pt.x = p.x; pt.y = p.y; const q = pt.matrixTransform(world.getScreenCTM()); return { x: q.x, y: q.y }; }, toMM);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2); await page.mouse.move(to.x, to.y); await page.mouse.up();
}

module.exports = async function (t) {
  const schema = require(path.join(ROOT, 'docs/pedido_badge.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    await page.evaluate(() => { S.product = 'badge'; S.mount = 0; S.view = 'front'; render(); });
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    await page.evaluate(() => render());
    const m0 = await page.evaluate(() => D.mounts.map((m) => ({ x: m.x, y: m.y, manual: m.manual })));
    t.eq(m0.length, 2, 'cordón: dos sujeciones movibles');
    t.ok(m0.every((m) => !m.manual), 'al inicio están en posición automática');
    t.eq(await page.locator('[data-mount]').count(), 2, 'cada sujeción tiene su manija en la mesa');

    // arrastrar el primer agujero
    const target = await page.evaluate(() => ({ x: D.mounts[0].x - 4, y: D.mounts[0].y + 6 }));
    await dragMount(page, 0, target);
    const m1 = await page.evaluate(() => ({ h: D.holes.map((h) => ({ x: h.x, y: h.y })), m: D.mounts.map((m) => m.manual), sel: S.sel }));
    t.ok(Math.abs(m1.h[0].x - target.x) < 0.6 && Math.abs(m1.h[0].y - target.y) < 0.6, 'mount_drag: el agujero sigue al arrastre ' + JSON.stringify([m1.h[0], target]));
    t.ok(Math.abs(m1.h[1].x - m0[1].x) < 0.01 && Math.abs(m1.h[1].y - m0[1].y) < 0.01, 'el otro agujero no se mueve');
    t.eq(m1.m, [true, false], 'solo el arrastrado queda manual');
    t.eq(m1.sel, 'm0', 'queda seleccionado');

    // panel con X/Y
    t.ok(await page.isVisible('#selPanel [data-mk="x"]'), 'mount_panel: el panel muestra X');
    await page.fill('#selPanel [data-mk="x"]', String(Math.round(target.x + 2)));
    await page.dispatchEvent('#selPanel [data-mk="x"]', 'change');
    const x2 = await page.evaluate(() => D.holes[0].x);
    t.ok(Math.abs(x2 - Math.round(target.x + 2)) < 0.05, 'mount_panel: escribir X mueve el agujero (' + x2 + ')');

    // deshacer
    await page.evaluate(() => histUndo());
    const xu = await page.evaluate(() => D.holes[0].x);
    t.ok(Math.abs(xu - target.x) < 0.6, 'mount_undo: deshacer vuelve a la posición arrastrada');

    // cada pieza guarda la suya
    await page.evaluate(() => { S.product = 'pin'; S.mount = 0; render(); });
    const pin = await page.evaluate(() => D.mounts.map((m) => m.manual));
    t.eq(pin, [false], 'mount_per_product: el pin tiene su propia sujeción, automática');
    await page.evaluate(() => { S.product = 'badge'; S.mount = 0; render(); });
    const back = await page.evaluate(() => D.mounts[0].manual);
    t.ok(back, 'mount_per_product: al volver al badge conserva la posición manual');

    // fuera de la placa → bloquea
    await page.evaluate(() => { setMountPos(0, -5, -5); render(); });
    const w = await page.evaluate(() => D.warns.filter((x) => x.lv === 'crit').map((x) => x.t).join(' | '));
    t.ok(/sujeci/i.test(w), 'mount_outside: avisa que la sujeción queda fuera — ' + w);

    // volver a automático
    await page.evaluate(() => { S.sel = 'm0'; render(); });
    await page.click('#mountAuto');
    const m3 = await page.evaluate(() => D.mounts.map((m) => ({ x: m.x, manual: m.manual })));
    t.ok(m3.every((m) => !m.manual) && Math.abs(m3[0].x - m0[0].x) < 0.01, 'mount_reset: «Posición automática» la devuelve');

    // pin con broche movido → pedido con posición fija
    await page.evaluate(() => { S.product = 'pin'; S.size = 40; S.mount = 0; S.battery = 'cr2032'; render(); });
    const pm = await page.evaluate(() => ({ x: D.mounts[0].x, y: D.mounts[0].y }));
    await page.evaluate((p) => { setMountPos(0, p.x - 3, p.y); render(); }, pm);
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    const ped = JSON.parse(await page.evaluate(() => makePedido()));
    t.ok(validate(ped), 'mount_pedido: cumple el esquema — ' + JSON.stringify(validate.errors && validate.errors.slice(0, 2)));
    const post = ped.piezas_libres.find((p) => p.rol === 'poste_broche');
    t.ok(post && post.posicion_mm && Math.abs(post.posicion_mm.x_mm - (pm.x - 3)) < 0.01, 'mount_pedido: el poste lleva su posición fija ' + JSON.stringify(post));
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
