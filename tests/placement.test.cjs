const { openPage, loadOwl } = require('./harness.cjs');

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);
    await page.evaluate(() => { S.view = 'back'; S.tool = 'select'; S.sel = null; render(); });
    let r = await page.evaluate(() => ({
      parts: D.parts.length,
      allFree: D.parts.every((p) => p.free === true),
      groups: document.querySelectorAll('#backLayer .free').length,
      tag: !!document.querySelector('#backLayer [data-free-label]'),
    }));
    t.ok(r.parts > 0, 'el búho tiene piezas técnicas');
    t.ok(r.allFree, 'free_flag: todas las piezas de derive() llevan free:true');
    t.eq(r.groups, r.parts, 'free_class: un grupo .free por pieza libre');
    t.ok(r.tag, 'free_label: etiqueta "provisional · la ubica KiCad" en el reverso');

    // free_not_selectable: clic sobre el MCU en el reverso no selecciona nada
    const mcu = page.locator('#backLayer .free[data-free="U1"]');
    const box = await mcu.boundingBox();
    t.ok(!!box, 'el MCU provisional se dibuja');
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      r = await page.evaluate(() => S.sel);
      t.eq(r, null, 'free_not_selectable: el MCU no se puede seleccionar');
      r = await page.evaluate(() => getComputedStyle(document.querySelector('#backLayer .free')).pointerEvents);
      t.eq(r, 'none', 'free_not_selectable: pointer-events none');
    }

    // fixed_still_drag: un LED se sigue arrastrando en el frente
    await page.evaluate(() => { S.view = 'front'; render(); });
    const led = page.locator('#compLayer [data-comp]').first();
    const lb = await led.boundingBox();
    const before = await page.evaluate(() => S.comps[0].u);
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await page.mouse.down();
    await page.mouse.move(lb.x + lb.width / 2 + 30, lb.y + lb.height / 2, { steps: 4 }); await page.mouse.up();
    const after = await page.evaluate(() => S.comps.map((c) => c.u));
    t.ok(after.some((u, i) => i === 0 ? u !== before : false) || after[0] !== before, 'fixed_still_drag: el LED se movió');
    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
