const { openPage, loadOwl } = require('./harness.cjs');

// Deja el diseño con n LEDs del comportamiento dado y la energía/MCU pedidos.
const setup = (page, n, beh, battery, mcu, color) => page.evaluate(([n, beh, battery, mcu, color]) => {
  S.comps = []; S.battery = battery; S.mcu = mcu; S.opt.beh = beh; S.opt.color = color || 'rojo';
  for (let i = 0; i < n; i++) addComp('led', { x: GEO.W * (0.3 + 0.4 * (i % 5) / 4), y: GEO.H * (0.35 + 0.1 * Math.floor(i / 5)) });
  render();
  return { id: D.mcuId, req: D.pinsReq, warns: D.warns.filter((w) => w.lv === 'crit').map((w) => w.t) };
}, [n, beh, battery, mcu, color]);

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    let r = await setup(page, 1, 'fijo', 'auto', 'auto');
    t.eq(r.id, 'ninguno', 'auto_none: un LED fijo no necesita MCU');
    r = await setup(page, 2, 'parpadeo', 'auto', 'auto');
    t.eq(r.id, 'attiny10', 'auto_tiny10: 2 LEDs parpadeo → ATtiny10');
    r = await setup(page, 4, 'parpadeo', 'lipo70', 'auto');
    t.eq(r.id, 'attiny202', 'auto_step_up: 4 LEDs → ATtiny202');
    r = await setup(page, 6, 'parpadeo', 'lipo70', 'auto');
    t.eq(r.id, 'ch32v003f4', 'auto_step_up: 6 LEDs → CH32V003F4');
    r = await setup(page, 17, 'parpadeo', 'lipo70', 'auto');
    t.eq(r.id, 'attiny1616', 'auto_step_up: 17 LEDs → ATtiny1616');
    r = await setup(page, 4, 'parpadeo', 'cr2032', 'auto');
    t.ok(!/^ch32/.test(r.id), 'auto_voltage: con pila (baja a 2,0 V) no elige CH32V003 (mín 2,7 V)');
    r = await setup(page, 5, 'parpadeo', 'lipo70', 'attiny10');
    t.ok(r.warns.some((w) => /patas/.test(w)), 'manual_too_few_pins: aviso crítico de patas');
    r = await setup(page, 2, 'parpadeo', 'cr2032', 'esp32c3');
    t.ok(r.warns.some((w) => /LiPo/.test(w)), 'esp_needs_lipo: aviso crítico pide LiPo');
    await setup(page, 2, 'parpadeo', 'lipo70', 'attiny412');
    r = await page.evaluate(() => bomRows(D).map((x) => x.val + ' ' + (x.note || '')).join(' | '));
    t.ok(/ATtiny412/.test(r) && /C1337190/.test(r), 'bom_has_mcu: BOM con ATtiny412 y C1337190');
    r = await page.evaluate(() => [...document.querySelectorAll('#selMcu option')].map((o) => o.value));
    t.eq(r, ['auto', 'ninguno', 'attiny10', 'attiny202', 'attiny412', 'ch32v003j4', 'ch32v003f4', 'attiny1616', 'esp32c3', 'rp2040'], 'selector #selMcu con todas las opciones');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
