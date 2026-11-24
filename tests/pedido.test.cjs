const path = require('path');
const Ajv = require('ajv');
const { openPage, loadOwl, ROOT } = require('./harness.cjs');

module.exports = async function (t) {
  const schema = require(path.join(ROOT, 'docs/pedido_badge.schema.json'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    await page.evaluate(() => { S.battery = 'lipo180'; S.mcu = 'auto'; render(); });
    const txt = await page.evaluate(() => makePedido());
    const ped = JSON.parse(txt);
    const ok = validate(ped);
    t.ok(ok, 'pedido_valid: cumple el esquema — ' + JSON.stringify(validate.errors && validate.errors.slice(0, 3)));
    t.eq(ped.tipo, 'pedido_badge', 'tipo');
    t.ok(ped.arte.length > 0, 'pedido trae arte');
    const inside = await page.evaluate((fx) => fx.every((p) => insideBoard(p.x_mm, p.y_mm)), ped.piezas_fijas);
    t.ok(inside, 'pedido_fixed_inside: piezas fijas dentro de la placa');
    const req = await page.evaluate(() => D.pinsReq);
    t.eq(ped.senales.length, req, 'pedido_signals: una señal por pata requerida');
    t.eq(ped.control.patas_usadas, req, 'control.patas_usadas');
    t.ok(ped.piezas_libres.some((p) => p.rol === 'mcu' && p.lcsc), 'piezas_libres incluye el MCU con LCSC');
    t.ok(ped.piezas_libres.some((p) => p.rol === 'bateria'), 'piezas_libres incluye la energía');
    t.ok(ped.piezas_fijas.every((p) => p.rol !== 'termo' || (p.zona_mm && p.zona_mm.length > 2)), 'zona termocrómica con polígono');

    // pedido_outline: la silueta del búho, no un rectángulo
    await page.evaluate(() => { traceKey = ''; render(); });
    const pend = await page.evaluate(() => ({ poly: !!GEO.poly, bl: pedidoBlockers() }));
    t.ok(pend.poly || pend.bl.some((b) => /silueta/.test(b)), 'pedido_outline: mientras se calcula la silueta, el pedido espera');
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    const ped2 = JSON.parse(await page.evaluate(() => makePedido()));
    t.ok(ped2.contorno_mm.length > 20, 'pedido_outline: contorno con la silueta (' + ped2.contorno_mm.length + ' puntos)');
    t.eq(ped2.revisiones.filter((r) => r.nivel === 'crit').length, 0, 'sin bloqueos con la silueta lista');

    // pedido_blocked: aro + supercondensador
    await page.evaluate(() => { S.product = 'aro'; S.battery = 'sc1f'; render(); });
    const bl = await page.evaluate(() => pedidoBlockers());
    t.ok(bl.length > 0 && bl.some((b) => /aros/.test(b)), 'pedido_blocked: bloqueadores listados');
    await page.evaluate(() => { openModal(); curExp = 'pedido'; renderModal(); });
    const ui = await page.evaluate(() => ({ save: $('#mSave').hidden, copy: $('#mCopy').hidden, txt: $('#mExtra').textContent }));
    t.ok(ui.save && ui.copy, 'pedido_blocked: sin Guardar ni Copiar');
    t.ok(/aros/.test(ui.txt), 'pedido_blocked: el modal muestra el motivo');
    await page.evaluate(() => { S.product = 'badge'; S.battery = 'lipo180'; render(); });
    await page.waitForFunction(() => GEO.poly && GEO.poly.length > 20, null, { timeout: 10000 });
    await page.evaluate(() => renderModal());
    const ui2 = await page.evaluate(() => ({ copy: $('#mCopy').hidden, file: $('#mFile').textContent }));
    t.ok(!ui2.copy, 'sin bloqueos vuelve el botón Copiar');
    t.ok(/^pedido_[a-z0-9_]+\.json$/.test(ui2.file), 'nombre pedido_<slug>.json: ' + ui2.file);
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
