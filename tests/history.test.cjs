const { openPage, loadOwl } = require('./harness.cjs');

module.exports = async function (t) {
  const { page, browser, errors } = await openPage();
  try {
    await loadOwl(page);

    // undo_move
    let r = await page.evaluate(() => {
      histReset();
      const u0 = S.comps[0].u;
      S.comps[0].u += 0.1; render();
      const ok1 = histUndo(); const uU = S.comps[0].u;
      const ok2 = histRedo(); const uR = S.comps[0].u;
      return { u0, uU, uR, ok1, ok2 };
    });
    t.ok(r.ok1 && r.ok2, 'undo_move: undo/redo devuelven true');
    t.eq(r.uU, r.u0, 'undo_move: deshacer restaura la posición');
    t.eq(Math.round((r.uR - r.u0) * 1000), 100, 'undo_move: rehacer vuelve a mover');

    // no_ui_steps
    r = await page.evaluate(() => {
      histReset();
      S.view = 'back'; render(); S.tool = 'led'; render(); S.sel = S.comps[0].id; render(); S.view = 'front'; S.tool = 'select'; render();
      return HIST.past.length;
    });
    t.eq(r, 0, 'no_ui_steps: vista/herramienta/selección no crean pasos');

    // undo_art_load
    r = await page.evaluate(() => {
      histReset();
      const name0 = S.artName, n0 = S.comps.length;
      loadText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', 'c.svg', false);
      const nameMid = S.artName, nMid = S.comps.length;
      histUndo();
      return { name0, n0, nameMid, nMid, name1: S.artName, n1: S.comps.length, els: ART.els.length };
    });
    t.eq(r.nameMid, 'c.svg', 'undo_art_load: se cargó el dibujo nuevo');
    t.eq(r.nMid, 0, 'undo_art_load: el dibujo nuevo empieza sin componentes');
    t.eq(r.name1, r.name0, 'undo_art_load: deshacer devuelve el búho');
    t.eq(r.n1, r.n0, 'undo_art_load: con sus componentes');
    t.ok(r.els > 1, 'undo_art_load: el arte del búho está cargado');
    r = await page.evaluate(() => { histRedo(); return { name: S.artName, n: S.comps.length }; });
    t.eq(r.name, 'c.svg', 'undo_art_load: rehacer vuelve al círculo');
    await page.evaluate(() => histUndo());

    // cap_100
    r = await page.evaluate(() => {
      histReset();
      for (let i = 0; i < 120; i++) { S.margin = 1 + (i % 2) * 0.5 + i * 0.001; render(); }
      return HIST.past.length;
    });
    t.eq(r, 100, 'cap_100: máximo 100 pasos');

    // keys_in_field
    await page.evaluate(() => { histReset(); S.margin = 3.3; render(); document.activeElement && document.activeElement.blur(); });
    await page.focus('#selBatt');
    await page.keyboard.press('Control+z');
    r = await page.evaluate(() => ({ past: HIST.past.length, m: S.margin }));
    t.eq(r, { past: 1, m: 3.3 }, 'keys_in_field: Ctrl+Z en un select no deshace');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Control+z');
    r = await page.evaluate(() => S.margin);
    t.ok(r !== 3.3, 'keys_in_field: Ctrl+Z fuera de campos deshace');
    await page.keyboard.press('Control+y');
    r = await page.evaluate(() => S.margin);
    t.eq(r, 3.3, 'keys_in_field: Ctrl+Y rehace');

    // drag_one_step
    await page.evaluate(() => { histReset(); S.tool = 'select'; render(); });
    const box = await page.locator('[data-comp]').first().boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(x + i * 6, y + i * 3);
    await page.mouse.up();
    r = await page.evaluate(() => HIST.past.length);
    t.eq(r, 1, 'drag_one_step: un arrastre = un paso');

    // botones
    r = await page.evaluate(() => ({ u: !!document.querySelector('#btnUndo'), r: !!document.querySelector('#btnRedo'), rd: document.querySelector('#btnRedo') && document.querySelector('#btnRedo').disabled }));
    t.eq(r, { u: true, r: true, rd: true }, 'botones ↶ ↷ presentes; rehacer deshabilitado sin futuro');

    t.eq(errors.length, 0, 'sin errores de página: ' + errors.join(' | '));
  } finally {
    await browser.close();
  }
};
