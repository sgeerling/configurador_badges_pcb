# Configurador v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al configurador deshacer/rehacer, selección de microcontrolador, supercondensadores, separación piezas fijas/libres y exportación de un pedido que Claude construye en KiCad con Copper.

**Architecture:** Todo vive en `index.html` (página única, sin build). Se agregan tablas de datos (`MCUS`, entradas nuevas en `BATT`), un módulo de historial que observa `render()`, cambios en `derive()` y `renderSummary()`, y un exportador nuevo en `EXPORTS`. Las pruebas son scripts Playwright (Chromium del sistema) que cargan la página con las librerías CDN servidas desde `node_modules` local. La skill `pedido-badge-kicad` se escribe en `docs/skill-pedido-badge-kicad/` y se propone al usuario.

**Tech Stack:** HTML/JS vanilla, SVG; Playwright 1.x (`/opt/npm-tools/node_modules/playwright`) con `/usr/bin/google-chrome`; Copper MCP (KiCad 10) en el PC del FabLab.

**Spec:** `docs/superpowers/specs/2026-11-24-configurador-v2-design.md`

## Global Constraints

- Coordenadas en mm, origen arriba-izquierda, Y hacia abajo.
- Historial máximo **100** pasos; atajos **Ctrl+Z**, **Ctrl+Y**, **Ctrl+Shift+Z**; no actúan con foco en INPUT/SELECT/TEXTAREA.
- Tabla de MCU y supercondensadores con los códigos LCSC exactos del spec (sección 2 y 3).
- Orden de "Automático": `ninguno, attiny10, attiny202, ch32v003j4, attiny412, ch32v003f4, attiny1616`; `esp32c3` y `rp2040` solo manuales.
- Pedido: `tipo:"pedido_badge"`, `version:2`; nombre de archivo `pedido_<slug>.json`; no se exporta con avisos `crit`.
- Textos de interfaz en español de Chile, como el resto de la página.
- No romper: carga SVG/capas/Gerber, simulación, visor Gerber, exportaciones existentes.

## Review Focus

1. Cargar un SVG nuevo y luego deshacer: debe volver el dibujo anterior **con sus componentes**, no un dibujo vacío.
2. Cambiar vista (frente/reverso/capas), herramienta, selección o simulación **no** debe crear pasos de historial.
3. Ctrl+Z dentro del selector de energía o un campo numérico no debe deshacer el diseño.
4. Agregar LEDs con "Automático" hasta exceder las patas de un MCU debe saltar al siguiente de la lista (no bloquear).
5. Exportar el pedido con un aviso `crit` vigente (p. ej. supercondensador en un aro) debe estar bloqueado y listar el motivo.

---

### Task 1: Arnés de pruebas Playwright

**Files:**
- Create: `tests/harness.cjs`
- Create: `tests/smoke.test.cjs`
- Create: `package.json` (solo `devDependencies`: `pcb-stackup@4.2.8`, `gerber-to-svg@4.2.8`, `jszip@3.10.1`; script `"test": "node tests/run-all.cjs"`)
- Create: `tests/run-all.cjs`

**Interfaces:**
- Produces: `openPage(): Promise<{page, browser, errors:string[]}>` en `tests/harness.cjs`. Lanza Chrome con `executablePath:'/usr/bin/google-chrome'`, intercepta con `page.route` las URL de jsdelivr/cdnjs y responde con los archivos `dist/*.min.js` de `node_modules`; aborta fuentes de Google. Carga `file://…/index.html` y espera `window.render`.
- Produces: `loadOwl(page)`: hace clic en `#btnSample` y espera a que `S.comps.length>0`.
- Produces: `run-all.cjs` ejecuta cada `tests/*.test.cjs` en serie; código de salida ≠0 si alguno falla. Cada test exporta `async function(t)` con `t.eq(a,b,msg)` y `t.ok(v,msg)`.

- [ ] **Step 1:** Escribir `smoke.test.cjs`: abre la página, `loadOwl`, asserts `errors.length===0`, `typeof pcbStackup==='object'||'function'`, `S.comps.length>0`.
- [ ] **Step 2:** `npm install` y `npm test` → PASS.
- [ ] **Step 3:** Agregar `node_modules/` a `.gitignore`. Commit `test: arnés Playwright`.

### Task 2: Historial deshacer / rehacer

**Files:**
- Modify: `index.html` (estado `S`, `render()`, carga de arte, `pointerup` de la mesa, cabecera `.top-right`, `keydown`)
- Test: `tests/history.test.cjs`

**Interfaces:**
- Produces (globales en `index.html`):
  - `HIST = {past: string[], future: string[], last: string|null, restoring: boolean, srcs: Map<number, ArtSource>}`.
  - `ArtSource = {mode:'single', name:string, text:string} | {mode:'layers', files: LayerFile[]}` (copia profunda de `S.layerFiles`).
  - `histKey(): string` → `JSON.stringify` de `S` **sin** `view, tool, sel, sim, layerFiles` más `{art: ART.srcId}`.
  - `histCommit(): void` → si `HIST.restoring` o `drag` activo, no hace nada; si `histKey()!==HIST.last`, empuja `HIST.last` a `past` (tope 100, descarta el más viejo), vacía `future`, actualiza `last`.
  - `histUndo(): boolean`, `histRedo(): boolean` → restauran `S` (manteniendo `view, tool, sim`; `sel=null`), y si `art` cambió, recargan el arte desde `HIST.srcs` sin borrar componentes ni mostrar avisos; luego `render()`. Devuelven `false` si no hay paso.
  - `histReset(): void` → vacía pilas y fija `last=histKey()`.
- `ART.srcId: number` nuevo, incrementado al cargar arte; `HIST.srcs.set(ART.srcId, src)`.
- Botones `#btnUndo` (↶, `aria-label="Deshacer"`) y `#btnRedo` (↷, `aria-label="Rehacer"`) en `.top-right`, deshabilitados según pilas.

- [ ] **Step 1: Tests que fallan** en `history.test.cjs`:
  - `undo_move`: tras `loadOwl` y `histReset`, mover `S.comps[0].u+=0.1` + `render()`; `histUndo()` → `u` original; `histRedo()` → `u` movido.
  - `no_ui_steps`: cambiar `S.view='back'`, `S.tool='led'`, `S.sel=…`, `render()` → `HIST.past.length===0`.
  - `undo_art_load`: tras `loadOwl` (con componentes), `loadText('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>','c.svg',false)`; `histUndo()` → `S.artName` vuelve al del búho y `S.comps.length` igual al de antes; `ART.els.length>0`.
  - `cap_100`: 120 cambios de `S.margin` con `render()` → `HIST.past.length===100`.
  - `keys_in_field`: foco en `#selBatt`, enviar Ctrl+Z → `HIST.past.length` sin cambio y diseño intacto. Foco en `body`, Ctrl+Z → deshace.
  - `drag_one_step`: simular `pointerdown` sobre un componente, 5 `pointermove`, `pointerup` → exactamente 1 paso nuevo.
- [ ] **Step 2:** `npm test` → FAIL (`HIST is not defined`).
- [ ] **Step 3: Implementar.** Llamar `histCommit()` al final de `render()`; en `pointerup` de la mesa poner `drag=null` y luego `histCommit()`; en `#inSize`/`#inMargin` seguir con `input` para dibujar, pero el commit ocurre igual porque `render()` lo llama (aceptado: cada valor intermedio no genera paso si se aplica el siguiente debounce): envolver `histCommit` con un debounce de 350 ms cuando el origen es `input` de un `range` (`HIST.pending` timer). Guardar `ArtSource` en `sanitizeAndLoad` (single) y `loadLayerSet` (layers). En `histUndo/Redo` recargar arte con una ruta silenciosa: extraer de `loadText`/`loadLayerSet` una función `applyArtSource(src, {keepComps:true})` que no llame `demoComps`, `toast` ni cambie `S.tool`, y que restaure `S.comps` después de `finishArt` (que hoy los vacía en la línea `S.comps=[]`). `loadText` y `ingestFiles` llaman `histCommit()` al terminar. "Empezar de nuevo"/carga de proyecto llaman `histReset()`. Atajos en el `keydown` existente.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: deshacer y rehacer`.

### Task 3: Selector de microcontrolador

**Files:**
- Modify: `index.html` (constantes junto a `BATT`, `S`, panel de energía línea ~260, `derive()`, `renderPanels()`, `renderSummary()`, `bomRows()`, `makeJSON()`)
- Test: `tests/mcu.test.cjs`

**Interfaces:**
- Produces: `MCUS: Record<McuId, {label, short, lcsc, pkg, pins:number, vmin:number, vmax:number, extras:string[], prog:'TPI'|'UPDI'|'SWIO'|'USB', w:number, h:number, fp:string, mA:number, manualOnly?:boolean}>` con los ids y valores de la tabla del spec. `w,h` en mm del encapsulado (SOT-23-6 3×3; SOIC-8 4,9×3,9; TSSOP-20 6,5×4,4; QFN-20 3×3; ESP32-C3-MINI 13,2×16,6; QFN-56 7×7). `mA` consumo activo típico: attiny 1, ch32 2, esp32c3 25 (avg sin radio continua), rp2040 20.
- Produces: `S.mcu: 'auto'|McuId` (por defecto `'auto'`).
- Produces: `pinsNeeded(comps): number` (1 por LED no fijo, 1 si hay ≥1 RGB, 1 por touch, 1 por botón, 1 por zona termo).
- Produces: en el resultado de `derive()`: `mcuId: McuId`, `mcuAuto: boolean`, `pinsReq: number`. `needMCU` pasa a ser `mcuId!=='ninguno'`.
- `<select id="selMcu">` con etiqueta "Control", debajo de `#selBatt`; opción `auto` muestra "Automático (ahora: <short>)".

- [ ] **Step 1: Tests que fallan** (`mcu.test.cjs`):
  - `auto_none`: un LED `beh:'fijo'` → `D.mcuId==='ninguno'`.
  - `auto_tiny10`: 2 LEDs parpadeo → `'attiny10'`.
  - `auto_step_up`: 4 LEDs parpadeo → `'attiny202'`; 6 → `'ch32v003f4'`; 17 → `'attiny1616'`.
  - `auto_voltage`: con `S.battery='sc15f'` y 4 LEDs → no elige `ch32v003*` (vmin 2,7 > 2,5).
  - `manual_too_few_pins`: `S.mcu='attiny10'` y 5 LEDs parpadeo → existe aviso `crit` que contiene "patas".
  - `esp_needs_lipo`: `S.mcu='esp32c3'`, `S.battery='cr2032'` → aviso `crit` que contiene "LiPo".
  - `bom_has_mcu`: con `S.mcu='attiny412'` la BOM contiene "ATtiny412" y "C1337190".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementar.** Selección automática: primer id del orden del spec con `pins>=pinsReq` y `vmin<=V_min_fuente` (`V_min_fuente`: pila 2,0; LiPo 3,0; sc1f 2,7; sc15f 1,8) y `vmax>=V_max_fuente` (pila 3,0; LiPo 4,2; sc1f 5,0; sc15f 2,5); si `extras` incluye regulador 3,3 V, comparar contra 3,3. El dibujo provisional del MCU usa `w,h,fp,val` de la tabla en vez del CH32V003J4 fijo. `makeJSON` usa `MCUS[mcuId].label`. `bomRows` agrega código LCSC en la columna nota.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: selector de microcontrolador`.

### Task 4: Supercondensadores

**Files:**
- Modify: `index.html` (`BATT`, `derive()` autonomía y avisos, `renderSummary()` formato de autonomía)
- Test: `tests/energy.test.cjs`

**Interfaces:**
- Consumes: `MCUS`, `D.mcuId` (Task 3).
- Produces: entradas `BATT.sc1f` y `BATT.sc15f` con `{label, short, lcsc, F, vCharge, vMax, d? , w?, h?, fp, g, maxmA, usb:true, supercap:true}`:
  - `sc1f`: `label:'Supercondensador 1 F 5,5 V + USB-C'`, `lcsc:'C7461329'`, `F:1`, `vCharge:5.0`, `vMax:5.5`, `d:19.5`, `g:2.5`, `maxmA:300`.
  - `sc15f`: `label:'Supercondensador 15 F 2,7 V + USB-C'`, `lcsc:'C24833990'`, `F:15`, `vCharge:2.5`, `vMax:2.7`, `w:12.5`, `h:25`, `g:7`, `maxmA:500`.
- Produces: `D.minutes: number|null` (solo supercondensadores) = `F·(vCharge−vCut)/(avg/1000)/60`, con `vCut = max(MCUS[mcuId].vmin||0, maxVf+0.3)`.
- "Automático" de energía nunca elige supercondensadores.

- [ ] **Step 1: Tests que fallan:**
  - `sc1f_minutes`: 2 LEDs parpadeo, `S.battery='sc1f'` → `D.minutes` entre 1 y 600, y el KPI de autonomía termina en "min".
  - `sc15f_blue_blocks`: `sc15f` + LED azul → aviso `crit` que contiene "azul".
  - `sc_aro_blocks`: `S.product='aro'` + `sc1f` → aviso `crit` que contiene "aros".
  - `sc15f_fit`: placa de 20 mm + `sc15f` → aviso `crit` "no cabe".
  - `sc_low_runtime`: `sc1f` + 1 zona termo → aviso `warn` que contiene "10 min" si `D.minutes<10`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (las comprobaciones de tamaño reutilizan las existentes de `B.d`/`B.w,B.h`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: supercondensadores`.

### Task 5: Piezas fijas y libres en la mesa

**Files:**
- Modify: `index.html` (`drawBack()`, hint de vista reverso, leyenda)
- Test: `tests/placement.test.cjs`

**Interfaces:**
- Produces: `FIXED_KINDS = new Set(['led','rgb','termo','touch','button'])`. Toda `part` de `derive()` lleva `free:true`.
- `drawBack()` dibuja las piezas libres con clase `.free` (trazo gris punteado, `pointer-events:none`) y una etiqueta única "provisional · la ubica KiCad" en la vista reverso.

- [ ] **Step 1: Tests:** `free_not_selectable`: clic sobre la posición de `D.parts` MCU en vista reverso no cambia `S.sel`; `free_class`: existe `#backLayer .free` por cada pieza libre; `fixed_still_drag`: un LED sigue arrastrable.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (y `npm test` completo sigue verde).
- [ ] **Step 5:** Commit `feat: piezas libres provisionales`.

### Task 6: Exportar "Pedido para KiCad"

**Files:**
- Modify: `index.html` (`EXPORTS`, nueva `makePedido()`, `renderModal()` para bloquear)
- Create: `docs/pedido_badge.schema.json` (JSON Schema draft-07 del formato del spec, sección 5)
- Test: `tests/pedido.test.cjs`

**Interfaces:**
- Consumes: `D`, `MCUS`, `BATT`, `artGeometry()`, `outlinePts()`, `paintArt` capas como hoy en `generateGerbers()`.
- Produces: `makePedido(): string` (JSON con 2 espacios) y `pedidoBlockers(): string[]` (textos de avisos `crit`).
- `EXPORTS.pedido = {label:'Pedido para KiCad', file:'pedido_<slug>.json', make:makePedido, guide:'…'}`; si `pedidoBlockers().length`, el modal muestra la lista y oculta Guardar/Copiar. Al guardar o copiar, se copia también al portapapeles `Genera en KiCad el pedido adjunto (pedido_<slug>.json)`.
- Contenido: `piezas_fijas` desde `D.comps` (LCSC: LED 1206 rojo `C2827254`, otros colores/encapsulados quedan con `lcsc:null` y `valor` descriptivo — la skill los resuelve con `parts_search`), `piezas_libres` desde `D.parts` + MCU + energía, `senales` una por pata requerida, con nombres `<ref>_CTRL` (LED), `RGB_DIN`, `TOUCH_<ref>`, `BTN_<ref>`, `HEAT_<ref>`, `arte` = polígonos por capa de destino (`F.SilkS`, `F.Mask`, `F.Cu`) con los mismos grupos de tono que `generateGerbers()`.

- [ ] **Step 1: Tests:** `pedido_valid`: con el búho, `JSON.parse(makePedido())` valida contra `docs/pedido_badge.schema.json` (usar `ajv` como devDependency); `pedido_fixed_inside`: cada pieza fija cumple `insideBoard(x,y)`; `pedido_blocked`: aro + `sc1f` → `pedidoBlockers().length>0` y el botón Guardar del modal está oculto; `pedido_signals`: nº de `senales` = `D.pinsReq`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: pedido para KiCad`.

### Task 7: Skill `pedido-badge-kicad`

**Files:**
- Create: `docs/skill-pedido-badge-kicad/SKILL.md`
- Create: `docs/skill-pedido-badge-kicad/references/mcu.md` (por MCU: LCSC, patas de alimentación, patas libres en orden de preferencia, programación y su pad, desacople)
- Create: `docs/skill-pedido-badge-kicad/references/energia.md` (por fuente: bloque de carga/protección y piezas LCSC verificadas)
- Create: `docs/skill-pedido-badge-kicad/references/lecciones.md` (búho: sin PWR_FLAG para EasyEDA, formato KiCad 10, escribir Edge.Cuts y arte directo en el `.kicad_pcb` con KiCad cerrado, GND con vías junto a pads aislados)

**Interfaces:**
- Consumes: el formato de `docs/pedido_badge.schema.json`.
- Produces: frontmatter `name: pedido-badge-kicad`, `description` en tercera persona con disparadores "genera en KiCad el pedido", "pedido_*.json", "pedido para KiCad".

- [ ] **Step 1:** Con Copper (`copper_help`, `parts_get`), confirmar para cada MCU de la tabla los nombres de pata del símbolo importado y el mecanismo para bloquear piezas en `pcb_place` (auto respeta bloqueadas o se colocan las fijas después). Anotar en `references/`.
- [ ] **Step 2:** Escribir `SKILL.md` con los 6 pasos del spec, sección 6, apuntando a `references/`.
- [ ] **Step 3:** Proponer la skill al usuario con `propose_skills`.
- [ ] **Step 4:** Commit `docs: skill pedido-badge-kicad`.

### Task 8: Prueba de punta a punta y entrega

**Files:**
- Modify: `README.md` (sección "Novedades v2" y flujo pedido → KiCad)
- Copy: `index.html` → carpeta del proyecto en el PC como `configurador.html`

- [ ] **Step 1:** Generar con Playwright `pedido_buho.json` (búho, CH32V003J4 automático, LiPo 180) y guardarlo en `ejemplos/`.
- [ ] **Step 2:** Siguiendo la skill, construir el pedido con Copper en `badge-buho-v2/` dentro de la carpeta del proyecto. Esperado: ERC 0 errores, DRC 0 errores, piezas fijas en su posición (±0,05 mm), `fab_export` con BOM 100 % con LCSC.
- [ ] **Step 3:** `npm test` completo → PASS.
- [ ] **Step 4:** Copiar `index.html` a la carpeta del proyecto, actualizar README, commit `docs: v2`. Preguntar al usuario antes de `git push`.
