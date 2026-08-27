# la diega

portfolio audiovisual: un carrusel de videos a pantalla completa con una telita encima.

## cómo funciona

- **home**: reproduce en cadena solo los videos con `"highlight": true`, cada uno de su `start` a su `finish`; al terminar pasa al siguiente con un desplazamiento lateral, y al llegar al final vuelve al principio sin que se note.
- **esquinas**: "menú" (arriba-izquierda), "la diega" (arriba-derecha) y la ficha técnica (abajo-izquierda) abren el menú.
- **navegación del video**: interfaz desperdigada que aparece al mover el ratón (escritorio) o tocar el centro (móvil), con cada elemento entrando desde un sitio aleatorio: play/pause gigante en el centro, flechas pixel a los lados, barra de vida segmentada abajo, y auto · sound como pegatinas a la derecha. La ficha técnica lleva un contador (3/12) con flechitas al hacer hover. En móvil, **deslizar** a un lado o al otro cambia de video (con vibración); tocar los tercios laterales también, y el centro enseña/esconde la interfaz. Si tocas un video, se ignora su bucle start/finish y se reproduce entero.
- **menú**: a pantalla completa sobre el video difuminado, con los items entrando y saliendo volados: home, categorías (un carrusel solo de esa categoría), proyectos sueltos (solo ese video, sin carrusel) y about (ficha de personaje con stats). Al abrirlo marca dónde estás: el video que suena detrás va en amarillo con la manita, y la sección de la que vienes, subrayada. (La gestoría está apagada: su bloque en `data.json` se llama `_gestoria_apagada`; renombrarlo a `gestoria` la devuelve al menú.)
- **about-sintetizador**: la ficha esconde un sinte de verdad ("encender el sinte"), repartido en bloques con rótulo para que se entienda el orden:
  - **toca** — pads con las 11 notas de la pentatónica (dedo, ratón o teclado A–Ñ) y **◀ Z / X ▶ para subir y bajar la escala una octava** (la1–la5 en total). Arriba, el osciloscopio cruza la pantalla y se arrastra como un theremin.
  - **suena a** — presets (nave · campana · coro · goma · chunda): un clic y cambian onda, filtro, voces, efectos, drone y arpegio de golpe.
  - **retoca** — tres potes: onda / nota / filtro.
  - **efectos** — el nombre del módulo enciende y apaga el efecto, los "···" abren sus ajustes (en cristiano, con el nombre técnico debajo). Voces no es un efecto: su chip dice cuántas hay y abre sus ajustes.
  - **sonido** — volumen, chip "drone" (siempre sonando ↔ solo al tocar) y chip "canción", que mutea/recupera el video de fondo.
- **detallitos**: cursor de manita pixel, sfx estilo consola ligados al toggle sound, título gigante letra a letra al cambiar de video, y barrido diagonal (siempre al navegar desde el menú; 1 de cada 4 en el avance automático). El barrido va en dos tiempos: tapa la pantalla, el video cambia debajo —esperando a que tenga imagen, para que nunca se vea negro— y se retira.
- **encaje**: video vertical en pantalla horizontal → centrado con el mismo video borroso detrás; video horizontal en móvil → recorte central.

## estructura

- `index.html` / `styles.css` / `about.css` — maqueta y estilos (el about-sintetizador tiene su propia hoja)
- `js/` — el código en módulos: `main.js` (arranque), `audio.js` (AudioContext compartido + sfx + intención de sonido), `carousel.js` (slides, transiciones, vistas y ficha), `ui.js` (menú, controles y listeners globales), `synth.js` (motor de audio del sinte) y `about.js` (interfaz del about-sintetizador)
- `data.json` — proyectos: `title`, `role`, `studio`, `videoPath`, `start`, `finish` (segundos del bucle por defecto; `null` = hasta el final), `highlight`, `visible`
- `data/projects/<slug>/video.webm` — los videos

## uso local

```bash
python3 -m http.server 8080
```

luego abrir `http://localhost:8080` en el navegador.
