# la diega

portfolio audiovisual: un carrusel de videos a pantalla completa con una telita encima.

## cómo funciona

- **home**: reproduce en cadena solo los videos con `"highlight": true`, cada uno de su `start` a su `finish`; al terminar pasa al siguiente con un desplazamiento lateral, y al llegar al final vuelve al principio sin que se note.
- **esquinas**: "menú" (arriba-izquierda), "la diega" (arriba-derecha) y la ficha técnica (abajo-izquierda) abren el menú.
- **navegación del video**: aparece al mover el ratón (escritorio) o tocar la pantalla (móvil): prev · play/pause · next · barra de reproducción · auto (avance automático, encendido por defecto) · sound. Si tocas un video, se ignora su bucle start/finish y se reproduce entero.
- **menú**: home, categorías (un carrusel solo de esa categoría), proyectos sueltos (solo ese video, sin carrusel), about (velado con texto) y gestoría (foto de fondo + nombres de clientes).
- **encaje**: video vertical en pantalla horizontal → centrado con el mismo video borroso detrás; video horizontal en móvil → recorte central.

## estructura

- `index.html` / `styles.css` / `app.js` — la web entera
- `data.json` — proyectos: `title`, `role`, `studio`, `videoPath`, `start`, `finish` (segundos del bucle por defecto; `null` = hasta el final), `highlight`, `visible`
- `data/projects/<slug>/video.webm` — los videos

## uso local

```bash
python3 -m http.server 8080
```

luego abrir `http://localhost:8080` en el navegador.
