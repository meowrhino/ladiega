# la diega

portfolio audiovisual: un carrusel de videos a pantalla completa con una telita encima.

## cómo funciona

- **home**: reproduce en cadena solo los videos con `"highlight": true`, cada uno de su `start` a su `finish`; al terminar pasa al siguiente con un desplazamiento lateral, y al llegar al final vuelve al principio sin que se note.
- **esquinas**: "menú" (arriba-izquierda), "la diega" (arriba-derecha) y la ficha técnica (abajo-izquierda) abren el menú.
- **navegación del video**: interfaz desperdigada que aparece al mover el ratón (escritorio) o tocar el centro (móvil), con cada elemento entrando desde un sitio aleatorio: play/pause gigante en el centro, flechas pixel a los lados, barra de vida segmentada abajo, y auto · sound como pegatinas a la derecha. La ficha técnica lleva un contador (3/12) con flechitas al hacer hover. En móvil, **deslizar** a un lado o al otro cambia de video (con vibración); tocar los tercios laterales también, y el centro enseña/esconde la interfaz. Si tocas un video, se ignora su bucle start/finish y se reproduce entero.
- **menú**: a pantalla completa sobre el video difuminado, con los items entrando y saliendo volados: home, categorías (un carrusel solo de esa categoría), proyectos sueltos (solo ese video, sin carrusel) y about (ficha de personaje con stats). Al abrirlo marca dónde estás: el video que suena detrás va en amarillo con la manita, y la sección de la que vienes, subrayada. (La gestoría está apagada: su bloque en `data.json` se llama `_gestoria_apagada`; renombrarlo a `gestoria` la devuelve al menú.)
- **about-sintetizador**: la ficha esconde un sinte de verdad ("encender el sinte"), de arriba abajo:
  - dos potes: **tipo de onda** y **filtro** (arrastrar arriba y abajo, o rueda del ratón).
  - **presets / efectos** en pestañas, se ve una u otra. Presets: drone · nave · campana · coro · goma · chunda — un clic y cambian onda, filtro, voces, efectos, drone y arpegio de golpe. Efectos: el nombre del módulo lo enciende y los "···" abren sus ajustes (en cristiano, con el nombre técnico debajo).
  - **teclado** de una octava de do a do, con sus negras. Se toca con el dedo, el ratón (arrastrando hace glissando) o el teclado del ordenador: blancas en `A S D F G H J K`, negras en `W E · T Y U`. **◀ Z / X ▶** cambian de octava (do2 a do6).
  - **volumen** y el chip **"canción"**, que mutea/recupera el video de fondo. Al abrir el sinte, la canción baja sola de volumen para poder tocar encima.
  - arriba del todo, el osciloscopio cruza la pantalla y se arrastra como un theremin. Solo aparece con el sinte encendido: en reposo no hay ninguna onda, porque la que había antes era decorativa y no respondía a nada.
- **gestoría**: debajo del about en el menú (así se llama ahora ahí; en `data.json` sigue siendo la clave `contacto`), con la misma pinta pero sin sinte: un texto y el enlace que abre el correo. La palabra que pongas entre llaves —`{contáctame}`— es la que se convierte en el `mailto:` del `email`.
- **detallitos**: cursor de manita pixel, sfx estilo consola ligados al toggle sound, título gigante letra a letra al cambiar de video, y barrido diagonal (siempre al navegar desde el menú; 1 de cada 4 en el avance automático). El barrido va en dos tiempos: tapa la pantalla, el video cambia debajo —esperando a que tenga imagen, para que nunca se vea negro— y se retira.
- **encaje**: video vertical en pantalla horizontal → centrado con el mismo video borroso detrás; video horizontal en móvil → recorte central.

## estructura

- `index.html` / `styles.css` / `about.css` — maqueta y estilos (el about-sintetizador tiene su propia hoja)
- `js/` — el código en módulos:
  - `main.js` — arranque: carga `data.json` (y avisa en pantalla si falla) y conecta el resto
  - `audio.js` — AudioContext compartido, sfx e intención de sonido
  - `carousel.js` — slides, transiciones, vistas y ficha técnica
  - `ui.js` — menú, controles del video y listeners globales
  - `about.js` — las dos fichas del menú: el about y la gestoría
  - `synth-ui.js` — la interfaz del sinte (potes, presets, efectos, teclado)
  - `synth.js` — el motor de audio del sinte
- `data.json` — proyectos: `title`, `role`, `studio`, `videoPath`, `start`, `finish` (segundos del bucle por defecto; `null` = hasta el final), `highlight`, `visible`
- `data/projects/<slug>/video.webm` — los videos

## uso local

```bash
python3 -m http.server 8080
```

luego abrir `http://localhost:8080` en el navegador.

## SEO y los dos repos

El sitio bueno es **https://ladiega.com**. Habrá dos repos con el mismo código: el de la clienta (el de verdad, con el dominio) y una copia. Para que la copia no compita en Google:

- **`<link rel="canonical">` en `index.html`** apunta siempre a `https://ladiega.com/`. Va idéntico en los dos repos: le dice a Google que, mire donde mire, el original es ese. Es la red de seguridad.
- **`robots.txt` es el único archivo que cambia entre los dos.** En el repo de verdad va `Allow: /`; en la copia hay que ponerle `Disallow: /`. Está explicado dentro del propio archivo.
- **`sitemap.xml`** solo tiene sentido en el repo de verdad.
- **`data/og.jpg`** (1200×630) es la imagen que sale al compartir el enlace por WhatsApp, Instagram o Twitter: un fotograma del video de Samantha Hudson con el nombre encima. Para cambiarla, sustituye el archivo respetando el tamaño.
- El sitio se sirve desde **GitHub Pages** (el archivo `CNAME` reclama el dominio) con Cloudflare delante en **Full**. Se descartó Cloudflare Workers porque no sirve peticiones por rango y sin ellas la barra de progreso del video no puede saltar.
