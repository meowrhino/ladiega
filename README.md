# la diega

portfolio audiovisual: un carrusel de videos a pantalla completa con una telita encima.

## cómo funciona

- **home**: reproduce en cadena solo los videos con `"highlight": true`, cada uno de su `start` a su `finish`; al terminar pasa al siguiente con un desplazamiento lateral, y al llegar al final vuelve al principio sin que se note.
- **esquinas**: "menú" (arriba-izquierda), "la diega" (arriba-derecha) y la ficha técnica (abajo-izquierda) abren el menú.
- **navegación del video**: interfaz desperdigada que aparece al mover el ratón (escritorio) o tocar el centro (móvil), con cada elemento entrando desde un sitio aleatorio: play/pause gigante en el centro, flechas pixel a los lados, barra de vida segmentada abajo, y auto · sound como pegatinas a la derecha. La ficha técnica lleva un contador (3/12) con flechitas al hacer hover. En móvil, **deslizar** a un lado o al otro cambia de video (con vibración); tocar los tercios laterales también, y el centro enseña/esconde la interfaz. Si tocas un video, se ignora su bucle start/finish y se reproduce entero.
- **menú**: a pantalla completa sobre el video difuminado, con los items entrando y saliendo volados: home, categorías (un carrusel solo de esa categoría), proyectos sueltos (solo ese video, sin carrusel) y about (ficha de personaje con stats). Al abrirlo marca dónde estás: el video que suena detrás va en amarillo con la manita, y la sección de la que vienes, subrayada.
- **about-sintetizador**: la ficha esconde un sinte de verdad ("encender el sinte"), de arriba abajo:
  - dos potes: **tipo de onda** y **filtro** (arrastrar arriba y abajo, o rueda del ratón).
  - **presets / efectos** en pestañas, se ve una u otra. Presets: drone · nave · campana · coro · goma · chunda — un clic y cambian onda, filtro, voces, efectos, drone y arpegio de golpe. Efectos: el nombre del módulo lo enciende y los "···" abren sus ajustes (en cristiano, con el nombre técnico debajo).
  - **teclado** de una octava de do a do, con sus negras. Se toca con el dedo, el ratón (arrastrando hace glissando) o el teclado del ordenador: blancas en `A S D F G H J K`, negras en `W E · T Y U`. **◀ Z / X ▶** cambian de octava (do2 a do6).
  - **volumen** y el chip **"canción"**, que mutea/recupera el video de fondo. Al abrir el sinte, la canción baja sola de volumen para poder tocar encima.
  - arriba del todo, el osciloscopio cruza la pantalla y se arrastra como un theremin. Solo aparece con el sinte encendido: en reposo no hay ninguna onda, porque la que había antes era decorativa y no respondía a nada.
- **gestoría**: debajo del about en el menú (en `data/site.json`, la clave `contact`), con la misma pinta pero sin sinte: un texto y el enlace que abre el correo. La palabra que pongas entre llaves —`{contáctame}`— es la que se convierte en el `mailto:` del `email`.
- **detallitos**: cursor de manita pixel, sfx estilo consola ligados al toggle sound, título gigante letra a letra al cambiar de video, y barrido diagonal (siempre al navegar desde el menú; 1 de cada 4 en el avance automático). El barrido va en dos tiempos: tapa la pantalla, el video cambia debajo —esperando a que tenga imagen, para que nunca se vea negro— y se retira.
- **encaje**: video vertical en pantalla horizontal → centrado con el mismo video borroso detrás; video horizontal en móvil → recorte central.

## estructura

Sigue la receta del estudio ([meowrhino/JAMstack](https://github.com/meowrhino/JAMstack)). Para la
diega: [GUIA.md](GUIA.md). Traspaso: [TRASPASO.md](TRASPASO.md). Si el build falla: [CLAUDE.md](CLAUDE.md).

- `index.html` / `styles.css` / `about.css` — maqueta y estilos (el about-sintetizador tiene su propia hoja)
- `data/site.json` — las categorías y, en `lists`, qué proyectos van en cada una y en qué orden; el
  about y la gestoría (`contact`)
- `projects/<slug>/` — un proyecto: `project.json` (`title`, `role`, `studio`, `start`, `finish`,
  `highlight`, `visible`) y su `video.webm`
- `schema/` — qué campos lleva cada JSON (VS Code, el build y la vista previa)
- `build/build.mjs` — → `dist/`: revisa los JSON y los vídeos, escribe la lista de proyectos en el
  HTML (para quien no ejecuta JS) y las direcciones del sitio donde se publica. Sin dependencias.
- `js/` — el código en módulos:
  - `main.js` — arranque: carga los datos (`carga.js`, y avisa en pantalla si falla) y conecta el resto
  - `carga.js` / `house.js` — leen los JSON (y los revisan en la vista previa) y los pasan a la forma
    del `data.json` de antes, que es la que leen los demás
  - `validar.js` — el JSON Schema sin dependencias (de JAMstack)
  - `audio.js` — AudioContext compartido, sfx e intención de sonido
  - `carousel.js` — slides, transiciones, vistas y ficha técnica
  - `ui.js` — menú, controles del video y listeners globales
  - `about.js` — las dos fichas del menú: el about y la gestoría
  - `synth-ui.js` — la interfaz del sinte (potes, presets, efectos, teclado)
  - `synth.js` — el motor de audio del sinte
- `fonts/` — Jersey 10 en woff2 (sin Google Fonts)

## uso local

Live Server sobre la carpeta (o `python3 -m http.server 8080`). Es la vista previa: si un JSON está
mal, lo dice en pantalla.

## SEO y los dos repos

El sitio bueno es **https://ladiega.com**. Hay dos repos con el mismo código: el de la clienta
(`ladiegaog/web`, con el dominio) y nuestra copia (`meowrhino/ladiega`). Los dos publican en
**GitHub Pages** con la misma Action, y el build decide por el dueño del repo: en el de la clienta,
`canonical`, `robots.txt` (`Allow`) y `sitemap.xml` con ladiega.com; en la copia,
meowrhino.github.io/ladiega/ con `noindex` y `Disallow`. Ya no hay que tocar nada a mano entre uno y
otro.

- **`data/og.jpg`** (1200×630) es la imagen que sale al compartir el enlace por WhatsApp, Instagram o
  Twitter: un fotograma del video de Samantha Hudson con el nombre encima. Para cambiarla, sustituye
  el archivo respetando el tamaño.
- Cloudflare va delante del dominio en **Full**. Se descartó Cloudflare Workers porque no sirve
  peticiones por rango y sin ellas la barra de progreso del video no puede saltar.
