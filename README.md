# Configurador de badges, pins y aros PCB

Herramienta web para diseñar badges, pins y aros electrónicos fabricados en PCB o fresados en una CNC Makera Z1. Todo corre en el navegador, en un solo archivo: `index.html`.

## Qué hace

**Configurador**
- Carga un dibujo SVG, las capas SVG de una placa de hasta 2 caras, o sus Gerber (sueltos o en ZIP).
- Agrega interacciones sobre el dibujo: LEDs de patitas o SMD, LEDs RGB WS2812B, zonas termocrómicas con calefactor, sensor de toque y botón. Detecta formas que parecen ojos para centrar LEDs en ellas.
- Calcula resistencias, consumo, autonomía, peso y batería, y avisa de problemas antes de fabricar.
- Dos acabados: PCB de fábrica (máscara de color + ENIG) o cobre fresado en la Makera Z1.

**Exportación**
- Gerber RS-274X (mm) y taladrado Excellon.
- Script de Python para KiCad 8/9 (contorno, huellas, vías y pistas).
- Contorno en DXF y SVG, arte por capa, ficha JSON y lista de materiales CSV.
- ZIP de fabricación con todo lo anterior.

**Visor Gerber**
- Muestra frente, reverso y capa por capa con [tracespace](https://github.com/tracespace/tracespace) (pcb-stackup 4.2.8, licencia MIT).
- Acepta el diseño del configurador, Gerber sueltos, ZIP o SVG por capa (los convierte a Gerber).

## Uso

Abre `index.html` en un navegador moderno. Las librerías se cargan desde CDN:

- `pcb-stackup@4.2.8` y `gerber-to-svg@4.2.8` (tracespace) desde jsDelivr
- `jszip@3.10.1` desde cdnjs

El botón de descarga directa funciona dentro de claude.ai. Fuera de ahí, usa los botones de copiar o adapta la función `saveZip` para descargar con un enlace normal.

### Abrir el script en KiCad

1. Abre el editor de PCB de un proyecto nuevo.
2. Ve a **Herramientas › Consola de scripting**.
3. Ejecuta: `exec(open(r'RUTA/badge_kicad.py', encoding='utf-8').read())`

Si faltan huellas, edita la línea `FP_DIR = ...` con la carpeta de huellas de tu instalación.

## Ejemplos

- `ejemplos/gerber-buho/`: Gerber del búho de ejemplo, generados por el configurador.
- `ejemplos/capas-svg/`: SVG por capa de una placa de prueba de 2 caras (incluye una capa interna para probar que se descarta).

## Limitaciones conocidas

- Las huellas de los componentes son aproximadas: sirven para prototipos en la Z1 y para visualizar. Para pedir a fábrica, termina la placa en KiCad y exporta los Gerber desde ahí.
- Los textos de los SVG no pasan a Gerber: conviértelos a trazados.
- En Gerber importados, las zonas con polaridad de borrado se dibujan rellenas en la vista previa.
- No se revisan colisiones entre los componentes agregados y los de una placa importada.
