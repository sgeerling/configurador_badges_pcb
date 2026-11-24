const { openPage, loadOwl } = require('./harness.cjs');

const setup = (page, o) => page.evaluate((o) => {
  S.product = o.product || 'badge'; if (o.size) S.size = o.size;
  S.comps = []; S.battery = o.battery; S.mcu = o.mcu || 'auto'; S.opt.beh = o.beh || 'parpadeo'; S.opt.color = o.color || 'rojo';
  computeGeo();
  for (let i = 0; i < (o.leds || 0); i++) addComp('led', { x: GEO.W * (0.35 + 0.3 * i), y: GEO.H * 0.4 });
  if (o.termo) addComp('termo', { x: GEO.W * 0.5, y: GEO.H * 0.6 });
  render();
  return {
    min: D.minutes,
    crit: D.warns.filter((w) => w.lv === 'crit').map((w) => w.t),
    warn: D.warns.filter((w) => w.lv === 'warn').map((w) => w.t),
    kpi: document.querySelector('#kpis .kpi b').textContent,
    auto: D.bk,
  };
}, o);

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    let r = await setup(page, { battery: 'sc1f', leds: 2 });
    t.ok(r.min > 1 && r.min < 600, `sc1f_minutes: autonomía en minutos razonable (${r.min})`);
    t.ok(/min$/.test(r.kpi), `sc1f_minutes: KPI termina en "min" (${r.kpi})`);
    r = await setup(page, { battery: 'sc15f', leds: 1, color: 'azul', mcu: 'attiny202' });
    t.ok(r.crit.some((w) => /azul/.test(w)), 'sc15f_blue_blocks: LED azul con 15 F bloquea');
    r = await setup(page, { battery: 'sc15f', leds: 2, mcu: 'ch32v003j4' });
    t.ok(r.crit.some((w) => /CH32V003J4/.test(w)), 'sc15f_mcu_27: MCU de 2,7 V con 15 F bloquea');
    r = await setup(page, { battery: 'sc15f', leds: 4 });
    t.ok(r.crit.length === 0 || !r.crit.some((w) => /funciona entre/.test(w)), 'auto_voltage: con 15 F el automático elige un MCU de 1,8 V');
    r = await setup(page, { product: 'aro', battery: 'sc1f', leds: 1 });
    t.ok(r.crit.some((w) => /aros/.test(w)), 'sc_aro_blocks: supercondensador en aro bloquea');
    r = await setup(page, { battery: 'sc15f', leds: 1, size: 20, mcu: 'attiny202' });
    t.ok(r.crit.some((w) => /no cabe/.test(w)), 'sc15f_fit: 15 F no cabe en 20 mm');
    r = await setup(page, { battery: 'sc1f', leds: 0, termo: true, size: 80 });
    t.ok(r.min < 10 ? r.warn.some((w) => /10 min/.test(w)) : true, `sc_low_runtime: aviso de autonomía corta (${r.min} min)`);
    r = await setup(page, { battery: 'auto', leds: 2, size: 80 });
    t.ok(!/^sc/.test(r.auto), 'auto nunca elige supercondensador');
    r = await page.evaluate(() => [...document.querySelectorAll('#selBatt option')].map((o) => o.value));
    t.ok(r.includes('sc1f') && r.includes('sc15f'), 'selector de energía ofrece sc1f y sc15f');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
