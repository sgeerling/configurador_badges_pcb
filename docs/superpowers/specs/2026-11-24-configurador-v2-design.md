# Configurador v2: deshacer, microcontroladores, supercondensadores y pedido a KiCad

Fecha: 2026-11-24 · Proyecto: Negocio Kits Soldadura · Archivo: `index.html` (página única)

## Intención

El configurador de badges, pins y aros debe dejar experimentar sin miedo y entregar un diseño que
termine como un PCB de KiCad verificado y listo para pedir. La persona decide lo que se ve
(luces, zonas termocrómicas, toque, botón) sobre su propio dibujo; la parte técnica (energía y control)
la decide Copper (MCP de KiCad) con criterio de ingeniería.

Quién lo usa ahora: el dueño del negocio y el FabLab. El cliente final en línea queda para una etapa posterior.

## Objetivos

1. **Deshacer / rehacer** cualquier cambio (piezas, opciones, forma, color, máscara, sujeción, dibujo cargado).
2. **Elegir microcontrolador** (o "Automático" / "Ninguno") de una lista verificada en stock JLC.
3. **Elegir energía** entre pilas, LiPo y **supercondensadores**, con cálculo de autonomía y avisos.
4. **Separar piezas estéticas (fijas) de piezas técnicas (libres)**: las estéticas las ubica la persona
   sobre el SVG y quedan bloqueadas; las técnicas las ubica Copper.
5. **Exportar un pedido** (`pedido_badge.json`) que Claude convierte en esquemático + PCB con Copper,
   guiado por una skill.

## No objetivos

- Que la página web llame a Copper directamente (no hay servicio; camino A acordado).
- Pedidos automáticos de clientes en línea (camino B, etapa posterior).
- Escribir firmware.

## Anti-objetivos

- Romper lo que ya funciona: carga de SVG/capas/Gerber, simulación, visor Gerber, exportación para Makera Z1.
- Pedidos que Copper no pueda construir sin preguntar: el pedido debe traer todo lo necesario
  o el configurador debe bloquear la exportación con un aviso claro.
- Avisos falsos de "listo": las combinaciones imposibles (pocas patas, voltaje, consumo) bloquean.

## Restricciones

- Página única `index.html` sin build; librerías por CDN como ya está (tracespace, JSZip).
- Coordenadas en mm, origen arriba-izquierda, Y hacia abajo (como KiCad), igual que el JSON actual.
- Piezas con stock JLC verificado el 2026-11-24 (tabla abajo).
- Copper 10 / KiCad 10 en el PC del FabLab.

## Enfoques considerados

**Deshacer**
- (Elegido) *Instantáneas*: después de cada cambio se guarda una copia del estado `S` (JSON) en una pila,
  máximo 100. El dibujo SVG cargado se guarda una sola vez en un caché y la instantánea lo referencia por id.
  Arrastres y deslizadores registran un solo paso al soltar. Simple y cubre todo.
- *Comandos con su inverso*: más fino, pero cada cambio nuevo necesita su inverso; frágil en una página
  que ya muta `S` en muchos sitios.

**Integración con KiCad**
- (Elegido, camino A) *Pedido + skill*: la página descarga `pedido_badge.json`; en el chat Claude lo construye
  con Copper siguiendo la skill `pedido-badge-kicad`.
- *Servicio local / nube* (camino B): automático para clientes; requiere servidor con KiCad. Etapa posterior.

**Qué describe el pedido**
- (Elegido) *Intención + geometría fija*: el pedido dice qué piezas hay, cuáles están fijas y dónde,
  qué hace cada una (p. ej. "LED D1 parpadea, se controla desde el MCU") y la energía/MCU elegidos.
  Claude asigna patas concretas y arma el circuito con los bloques estándar de la skill
  (verificados con Copper), como se hizo con el búho.
- *Netlist completo con nombres de pata desde la página*: obliga a mantener en JavaScript los nombres
  exactos de pata de cada símbolo Copper; un error ahí produce un esquema mal conectado sin aviso.

## Diseño

### 1. Historial

- `HIST = {past:[], future:[], cache:Map}`. `commit(label)` se llama tras cada cambio que hoy llama `render()`
  por acción del usuario; los arrastres llaman `commit` en `pointerup`, los deslizadores en `change`.
- Instantánea = `JSON.stringify(S)` + id del arte (`ART` se guarda en `cache` por id al cargarse).
- Botones ↶ ↷ en la barra superior, deshabilitados cuando no hay pasos; atajos Ctrl+Z, Ctrl+Y y Ctrl+Shift+Z
  (no actúan si el foco está en un campo de texto). Un aviso corto dice qué se deshizo ("Deshecho: mover LED D2").
- Cargar un proyecto o "Empezar de nuevo" vacía el historial.

### 2. Microcontroladores

Selector "Control" con estas opciones (Automático por defecto):

| id | Pieza | LCSC | Paquete | Patas útiles | V mín–máx | Extras que agrega | Programación |
|---|---|---|---|---|---|---|---|
| ninguno | — | — | — | 0 | — | — | — |
| attiny10 | ATtiny10 | C128438 | SOT-23-6 | 3 | 1,8–5,5 | — | TPI (3 pads) |
| attiny202 | ATtiny202 | C2052951 | SOIC-8 | 5 | 1,8–5,5 | — | UPDI (1 pad) |
| attiny412 | ATtiny412 | C1337190 | SOIC-8 | 5 | 1,8–5,5 | — | UPDI |
| ch32v003j4 | CH32V003J4M6 | C5346354 | SOP-8 | 5 | 2,7–5,5 | — | SWIO (1 pad) |
| ch32v003f4 | CH32V003F4P6 | C5187096 | TSSOP-20 | 16 | 2,7–5,5 | — | SWIO |
| attiny1616 | ATtiny1616 | C507118 | QFN-20 | 17 | 1,8–5,5 | — | UPDI |
| esp32c3 | ESP32-C3-MINI-1-N4 | C2838502 | módulo 13,2×16,6 | 13 | 3,0–3,6 | regulador 3,3 V | USB |
| rp2040 | RP2040 | C2040 | QFN-56 | 26 | 3,3 | regulador 3,3 V, flash 2 MB, cristal 12 MHz | USB |

- Patas necesarias: 1 por cada LED cuyo comportamiento no sea "fijo", 1 por cadena RGB, 1 por sensor de toque,
  1 por botón, 1 por zona termocrómica. Los LED "fijos" van sin MCU (resistencia a la batería).
- "Automático" elige el de menor costo que cumple patas y voltaje (orden: ninguno, attiny10, attiny202,
  ch32v003j4, attiny412, ch32v003f4, attiny1616). ESP32-C3 y RP2040 solo si se eligen a mano.
- Aviso que bloquea: patas insuficientes; voltaje de la fuente fuera del rango del MCU;
  ESP32-C3 o RP2040 sin LiPo.

### 3. Energía

A las opciones actuales (CR2032, CR1220, LiPo 70 / 180 mAh) se suman:

| id | Pieza | LCSC | Tamaño | Carga | Notas |
|---|---|---|---|---|---|
| sc1f | Supercondensador 1 F 5,5 V (KNSCHA 151HC0033) | C7461329 | Ø19,5 × 4,5 mm, THT | USB-C → diodo Schottky + resistencia limitadora (~200 mA) | Badge / pin grande |
| sc15f | Supercondensador 15 F 2,7 V (GODETEK GDC02R7K156LD1225) | C24833990 | Ø12,5 × 25 mm, THT | USB-C → regulador 2,5 V | Solo MCU de 1,8 V o sin MCU; solo LED rojo/ámbar |

- Autonomía de supercondensador: `t = C · (V_carga − V_corte) / I_media`, con `V_corte` = el mayor entre
  el mínimo del MCU y el Vf más alto de los LEDs + 0,3 V. Se muestra en minutos.
- Avisos: autonomía < 10 min (revisar); LED azul/blanco/verde con sc15f (bloquea); MCU de 2,7 V con sc15f (bloquea);
  sc15f no cabe en la placa (bloquea; caja 12,5 × 25 mm en el reverso); los aros no admiten supercondensadores (bloquea, por peso).

### 4. Piezas fijas y libres

- **Fijas (las ubica la persona):** LED, RGB, zona termocrómica, sensor de toque, botón. Se colocan sobre
  el SVG como hoy. En el pedido van con `fija: true`, posición, rotación y cara.
- **Libres (las ubica Copper):** MCU, energía, cargador, USB-C, interruptor, resistencias, condensadores,
  MOSFET del calefactor, pads de programación.
- En la mesa, las libres se siguen dibujando con la ubicación automática actual, pero en gris punteado con
  la etiqueta "provisional: la ubica KiCad", y no se pueden seleccionar. Así el visor Gerber y la
  exportación para Makera siguen funcionando como borrador.

### 5. Pedido para KiCad

Botón **"Pedido para KiCad"** en la sección de exportar. Descarga `pedido_<nombre>.json` y copia al
portapapeles el texto *"Genera en KiCad el pedido adjunto (pedido_<nombre>.json)"*.

Esquema (versión 2):

```json
{
  "tipo": "pedido_badge", "version": 2, "generado": "ISO-8601",
  "pieza": {"tipo": "badge|pin|aro", "cantidad": 1, "ancho_mm": 0, "alto_mm": 0, "grosor_mm": 1.6,
            "sujecion": "…", "nombre": "…"},
  "fabricacion": {"metodo": "pcb_fabrica|fresado_makera_z1", "mascara": "negra", "acabado": "ENIG"},
  "contorno_mm": [[x, y], …],
  "agujeros": [{"x_mm": 0, "y_mm": 0, "diametro_mm": 3.2, "uso": "argolla"}],
  "arte": [{"capa": "F.SilkS|F.Mask|F.Cu|B.SilkS", "poligonos_mm": [[[x, y], …], …]}],
  "control": {"mcu": "ch32v003j4", "lcsc": "C5346354", "elegido": "auto|manual"},
  "energia": {"tipo": "cr2032|cr1220|lipo70|lipo180|sc1f|sc15f", "lcsc": "…", "usb_c": true,
              "interruptor": true},
  "piezas_fijas": [{"ref": "D1", "rol": "led", "lcsc": "C2827254", "valor": "LED rojo 1206",
                    "x_mm": 0, "y_mm": 0, "rot_deg": 0, "cara": "F",
                    "funcion": {"control": "mcu|fijo", "comportamiento": "parpadeo", "color": "rojo",
                                "corriente_ma": 2}}],
  "piezas_libres": [{"rol": "mcu|bateria|cargador|usb_c|interruptor|calefactor|programacion",
                     "lcsc": "…", "valor": "…", "nota": "…"}],
  "senales": [{"nombre": "EYE_L", "desde": "MCU", "hacia": "D1", "tipo": "salida|entrada_tactil|boton|pwm_calefactor|datos_rgb"}],
  "reglas": {"fab": "jlcpcb", "pista_min_mm": 0.2, "separacion_mm": 0.2},
  "revisiones": [{"nivel": "ok|info|warn|crit", "texto": "…"}]
}
```

- No se exporta si hay avisos que bloquean (se listan).
- El arte va en mm como polígonos (los mismos que hoy alimentan el escritor de Gerber), para que Claude
  los escriba directo en el `.kicad_pcb`, como se hizo con el búho.

### 6. Skill `pedido-badge-kicad`

Skill para Claude (se propone al usuario con el flujo de skills; copia en `docs/skill-pedido-badge-kicad/SKILL.md`).
Pasos:
1. Leer y validar el pedido (versión 2; piezas fijas dentro del contorno; sin avisos `crit`).
2. `project_create` en la carpeta del proyecto con el nombre del pedido.
3. Esquemático por bloques con `sch_apply`: energía (según `energia.tipo`), MCU (según `control.mcu`,
   con su tabla de patas y conexión de programación), y un bloque por señal. Patas asignadas por Claude.
   Sin PWR_FLAG en redes que van a EasyEDA (lección del búho).
4. PCB: contorno y agujeros escritos en Edge.Cuts; piezas fijas en su posición y bloqueadas; luego ubicación
   automática de las libres en el reverso; ruteo; planos GND; arte escrito en las capas pedidas.
5. ERC/DRC a cero; `fab_export` para JLCPCB; resumen con costo.
6. Bloques de circuito de referencia por MCU y por fuente de energía (patas, desacople, programación,
   carga) en `references/` de la skill.

## Qué queda a criterio del constructor

- Distribución visual exacta de los nuevos controles y su texto.
- Detalles de los bloques de circuito de la skill (valores de desacople, diodo y resistencia de carga),
  siempre verificados con Copper (`parts_search`/`parts_get`) y la hoja de datos.
- Cómo Copper bloquea las piezas fijas: se confirma con `copper_help` al escribir la skill.

## Verificación

- Pruebas en navegador sin interfaz (Chromium): cargar SVG de ejemplo, colocar piezas, mover, cambiar opciones,
  deshacer/rehacer hasta el inicio y volver; el estado final coincide con el original.
- Matriz de avisos: cada combinación que bloquea produce su aviso y desactiva el pedido.
- Pedido de ejemplo (búho con CH32V003J4 + LiPo 180) validado contra el esquema y construido con Copper
  en el PC del FabLab; ERC/DRC a cero.
