---
name: pedido-badge-kicad
description: Builds a KiCad schematic and PCB with Copper from a pedido_*.json exported by the badge/pin/earring configurator. Use when the user says "genera en KiCad el pedido", attaches a pedido_*.json, or asks to turn a configurator order into a board.
---

# Pedido del configurador → KiCad con Copper

El configurador de badges exporta `pedido_<nombre>.json` (esquema `docs/pedido_badge.schema.json`, `tipo: "pedido_badge"`, `version: 2`).
Las piezas **fijas** (lo que se ve) ya tienen posición; las **libres** (energía y control) las decide Copper.
Coordenadas del pedido: mm, origen arriba-izquierda, Y hacia abajo. En KiCad se suman **100 mm** a X e Y (origen de Copper).

Lee también la skill `copper:kicad-design` (flujo general de Copper) antes de empezar.

## 1. Leer y validar

1. Abrir el JSON. Rechazar si `tipo`/`version` no coinciden o si `revisiones` tiene algún `nivel: "crit"` (decir cuál).
2. Comprobar que cada pieza fija está dentro de `contorno_mm` (punto en polígono). Si alguna queda fuera, avisar y detenerse.
3. Resumir al usuario en 3–4 líneas: pieza, MCU, energía, nº de piezas fijas y señales.

## 2. Proyecto

`project_create(name=<slug>)` dentro de la carpeta conectada del proyecto (p. ej. `Negocio Kits Soldadura/<slug>/`), perfil JLCPCB.

## 3. Esquemático (`sch_apply` por bloques, una llamada por bloque)

Orden: energía → MCU → un bloque por señal → piezas fijas sin MCU (LED `fijo`, botón `onoff`).
Usar los bloques de las secciones *Energía* y *Microcontroladores*. Asignar patas en el orden de preferencia de la tabla.
Nombrar las redes como `senales[].nombre`; alimentación `+BATT` (o `+3V3` si hay regulador), `VBUS`, `VSYS`, `GND`.

- LED `control: "mcu"`: pata → resistencia (`funcion.resistencia_ohm`, 0603) → ánodo; cátodo a GND.
- LED `control: "fijo"`: `+BATT`/`VSYS` → resistencia → LED → GND.
- `datos_rgb`: pata → DIN del primer WS2812B-2020; encadenar DOUT→DIN; 100 nF por LED.
- `entrada_tactil`: pata → 1 kΩ → pad de toque (huella `TestPoint_Pad_D4.0mm`); en CH32V003 usar una pata con ADC/TOUCHKEY.
- `boton`: pata con pull-up interno → pulsador → GND.
- `pwm_calefactor`: pata → 100 Ω → compuerta de N-MOSFET (AO3400A C20917); 100 kΩ compuerta-GND; resistencias de calor
  (`funcion.n_resistencias` × `funcion.resistencia_ohm`, 1206) entre `+BATT` y el drenador; source a GND.
- **No usar PWR_FLAG** si el diseño podría ir a EasyEDA: allí se convierten en una red real y unen todas las alimentaciones.
  Si ERC pide "power input not driven", preferir conectar la fuente real; si no queda otra, PWR_FLAG y avisar al usuario.

Corregir todo ERC antes de seguir.

## 4. PCB

1. Contorno: `pcb_setup(polygon=[[x+100, y+100] …], rules='fab')` con `contorno_mm`. Agujeros de `agujeros` como orificios
   NPTH (`pcb_edit` o escritura directa en `Edge.Cuts`/footprint `MountingHole`), diámetro `diametro_mm`.
2. Piezas libres con `posicion_mm` (sujeciones fijadas a mano en el configurador: poste de broche, imán, conector SAO): colocarlas en esa posición (+100 mm), en la cara `cara`, y bloquearlas igual que las fijas.
3. `board_build(moves=[…])` con una entrada por pieza fija: `{"ref", "x": x_mm+100, "y": y_mm+100, "rot": rot_deg,
   "side": "top"|"bottom" según cara, "lock": true}`. Las resistencias de calor van centradas en `zona_mm`, en la cara B,
   también bloqueadas. Si queda `pending`, volver a llamar `board_build()`.
4. Zona termocrómica: polígono `zona_mm` como apertura en `F.Mask` y cobre en `F.Cu` (gr_poly), conectado a GND o sin red.
5. Arte: recorrer `arte` por `orden` ascendente. `F.SilkS` → gr_poly en F.SilkS; `F.Cu+F.Mask` → gr_poly en F.Cu y F.Mask;
   `borra` → nada (la máscara negra lo cubre), pero elimina lo que una pieza anterior dejó debajo si se superpone por completo;
   capas explícitas (`F.Cu`, `F.Mask`, …) tal cual. `huecos_mm` se restan (gr_poly con huecos o polígonos separados);
   `trazos_mm` como gr_line/gr_poly sin relleno con `ancho_mm`. Escribir el `.kicad_pcb` directo con KiCad cerrado
   (o `while_open='revert'` y pedir Archivo › Revertir).
6. `board_build(steps=['route','pour','verify'])`. Pads de GND sin conexión: vía de GND junto al pad con pista corta.
7. ERC y DRC en cero. Revisar `render(target='pcb3d')`.

## 5. Fabricación

`fab_export` perfil JLCPCB. Informar: costo, piezas Extended, archivo ZIP, BOM y CPL. Piezas fijas con `lcsc: null`
(colores de LED, WS2812, pulsador): resolver con `parts_search` (stock JLC, Basic primero) antes de exportar.

## Energía (`energia.tipo`)

| tipo | Bloque |
|---|---|
| cr2032 / cr1220 | Portapilas (Keystone 3034 / 3001) → `+BATT`. Interruptor deslizante si `interruptor`. Sin cargador. |
| lipo70 / lipo180 | USB-C 6P (C456012) con 5,1 kΩ en CC1 y CC2 a GND → `VBUS`; TP4054 (SOT-23-5) con 4,7 µF en VBUS y BAT; PROG 20 kΩ (lipo70, ~50 mA) o 10 kΩ (lipo180, ~100 mA); LED CHRG + 1 kΩ a VBUS; JST-SH 2P (C160402) pin 1 = `+BATT`; interruptor MSK12C02 (C431540) `+BATT`→`VSYS`; MCU y LEDs desde `VSYS`. |
| sc1f | Supercondensador 1 F 5,5 V KNSCHA 151HC0033 (C7461329, THT, paso 5 mm). USB-C 6P + CC 5,1 kΩ → Schottky (SOD-123) → resistencia limitadora 47 Ω **2512 (≥1 W)** → `+BATT` (el condensador). Nunca usar TP4054. Interruptor `+BATT`→`VSYS`. |
| sc15f | Supercondensador 15 F 2,7 V GODETEK GDC02R7K156LD1225 (C24833990, cilindro Ø12,5×25 acostado en cara B). USB-C → regulador LDO 2,5 V (≥300 mA, SOT-23-5) → 4,7 Ω 2512 → `+BATT`. Solo MCU de 1,8 V; solo LED rojo/ámbar. |

Verificar cada pieza con `parts_get` (stock JLC y clase) antes de colocarla; si no hay stock, `parts_alternatives`.

## Microcontroladores (`control.mcu`)

Patas por número del encapsulado. Tras `place`, confirmar nombres con `sch_read` (los símbolos importados de EasyEDA usan nombres tipo `PA1`, los de KiCad `PA1/…`).

| mcu | LCSC | Alimentación | Patas libres (orden de preferencia) | Programación | Notas |
|---|---|---|---|---|---|
| attiny10 | C128438 | 5 VCC, 2 GND; 100 nF | 4 PB2, 1 PB0, 3 PB1 | TPI: pads PB0 (DATA), PB1 (CLK), 6 RESET, VCC, GND | PB0/PB1 compartidas con TPI: LED con ≥1 kΩ. RESET no se usa como E/S. |
| attiny202 / attiny412 | C2052951 / C1337190 | 1 VDD, 8 GND; 100 nF | 2 PA6, 3 PA7, 4 PA1, 5 PA2, 7 PA3 | UPDI: pad en 6 PA0 + VDD + GND | |
| ch32v003j4 | C5346354 | 4 VDD, 2 VSS; 100 nF + 1 µF | 5 PC1, 7 PC4, 3 PA2, 1 PD6/PA1, 6 PC2 | SWIO: pad en 8 PD1 + VDD + GND | Mín. 2,7 V. |
| ch32v003f4 | C5187096 | 9 VDD, 7 VSS; 100 nF + 1 µF | 10–17 PC0–PC7, 1 PD4, 2 PD5, 3 PD6, 19 PD2, 20 PD3, 5 PA1, 6 PA2, 8 PD0 | SWIO: 18 PD1 | 4 PD7/NRST libre como reset. Mín. 2,7 V. |
| attiny1616 | C507118 | VDD, GND + EP a GND; 100 nF | PA1–PA7, PB0–PB5, PC0–PC3 (según `sch_read`) | UPDI: PA0 | |
| esp32c3 | C2838502 | 3V3 desde LDO 3,3 V (ME6211C33, C82942) con 10 µF; GND | IO0, IO1, IO3, IO4, IO5, IO6, IO7, IO10, IO20, IO21 | USB nativo: IO18 (D−), IO19 (D+) al USB-C | EN: 10 kΩ a 3V3 + 1 µF; IO9 con botón BOOT a GND y 10 kΩ pull-up; IO8 pull-up 10 kΩ; antena en el borde, sin cobre debajo. |
| rp2040 | C2040 | IOVDD/USB_VDD/ADC_AVDD/VREG_VIN a 3,3 V (LDO), VREG_VOUT→DVDD con 1 µF; 100 nF por pata | GPIO0–GPIO25 | USB: D+/D− con 27 Ω al USB-C; BOOTSEL en QSPI_SS a GND con botón | Flash W25Q16JVUXIQ (QSPI), cristal 12 MHz + 2×15 pF + 1 kΩ; RUN 10 kΩ a 3V3. |

## Lecciones del búho (2026-11-24)

- KiCad 10 escribe formato 20260206: KiCad 9 no lo abre.
- Editar el `.kicad_pcb` con KiCad abierto obliga a Archivo › Revertir; preferir `while_open='revert'` y avisar.
- Vías dentro de una apertura de máscara (vientre termocrómico) causan errores de puente de máscara: sacarlas y rutear `+BATT` por la otra cara.
- Al llevar el diseño a EasyEDA: sin PWR_FLAG; el importador de KiCad 10 pierde redes y pistas; las reglas de vías quedan cruzadas
  (aplicar "JLCPCB Capability (Two Layers Board)" en Reglas de diseño).
