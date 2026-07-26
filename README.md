# la diega

portfolio audiovisual: un carrusel de videos a pantalla completa con una telita encima.

## cómo funciona

- **home**: reproduce en cadena solo los videos con `"highlight": true`, cada uno de su `start` a su `finish`; al terminar pasa al siguiente con un desplazamiento lateral, y al llegar al final vuelve al principio sin que se note.
- **esquinas**: "menú" (arriba-izquierda), "la diega" (arriba-derecha) y la ficha técnica (abajo-izquierda) abren el menú.
- **navegación del video**: interfaz desperdigada que aparece al mover el ratón (escritorio) o tocar el centro (móvil), con cada elemento entrando desde un sitio aleatorio: play/pause gigante en el centro, flechas pixel a los lados, barra de vida segmentada abajo, y auto · sound como pegatinas a la derecha. La ficha técnica lleva un contador (3/12) con flechitas al hacer hover. En móvil, tocar los tercios laterales cambia de video (con vibración). Si tocas un video, se ignora su bucle start/finish y se reproduce entero.
- **menú**: a pantalla completa sobre el video difuminado, con los items entrando y saliendo volados: home, categorías (un carrusel solo de esa categoría), proyectos sueltos (solo ese video, sin carrusel), about (ficha de personaje con stats) y gestoría (foto de fondo + nombres de clientes).
- **about-sintetizador**: la ficha esconde un sinte de verdad ("cambiar a oscilador"): osciloscopio a pantalla completa que se toca como un theremin, teclas A–L con la pentatónica, tres potes (onda / frecuencia / filtro), ADSR con botón de tocar, chorus · flanger · reverb · arpegio con su ON/OFF, volumen y el chip "canción" que mutea/recupera el video de fondo.
- **detallitos**: cursor de manita pixel, sfx estilo consola ligados al toggle sound, título gigante letra a letra al cambiar de video, y barrido diagonal aleatorio (1 de cada 4) en el avance automático.
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
