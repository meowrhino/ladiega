# proceso de desarrollo - ladiega

## 17 feb 2026 - 11:40 - inicio del proyecto

### sinopsis
creación de una web minimalista para ladiega con vídeos de fondo, navegación por proyectos y controles de volumen interactivos.

### fase inicial - contenido preexistente

**materiales disponibles:**
- 9 proyectos con vídeos en formato `.webm`:
  - adolfoDominguez
  - massimoDutti
  - menudasPiezas
  - nike
  - pacsun
  - pullAndBear
  - purple1
  - purple2
  - timberland
- navicon.png (icono azul tipo diamante)
- mockups visuales de home y project page

**especificaciones del usuario:**

**home (index.html):**
- logo placeholder (temporal, no existe aún)
- menú con proyectos visibles
- vídeo de fondo random al cargar
- velo negro con 80% opacidad sobre el vídeo
- autoplay de vídeos en secuencia random cuando termina uno
- botón de volumen abajo-derecha (mute por defecto, slider al click)
- click en proyecto → navega a project.html

**project page (project.html):**
- vídeo de fondo con velo negro 80%
- marquee arriba con título del proyecto
- descripción centrada
- botón "back" con mix-blend-mode: difference (para verse siempre)
- botón volumen abajo-derecha
- click en cualquier parte → oculta velo, marquee y descripción

**estructura de datos:**
cada proyecto tiene:
- slug
- title
- visible (true/false)
- description
- videoPath (ruta al archivo .webm)

### proceso de implementación

**paso 1: estructura base**
- creación de carpeta `manus` con `proceso.md`
- creación de `data.json` con todos los proyectos
- copia de assets del usuario al proyecto

---

## 17 feb 2026 - 12:10 - finalización del proyecto

### sinopsis
implementación completa de la web minimalista para ladiega con todas las funcionalidades solicitadas.

### archivos creados

**estructura del proyecto:**
```
ladiega/
├── index.html          # página principal con menú y vídeo random
├── project.html        # página de proyecto individual
├── styles.css          # estilos para index.html
├── project-styles.css  # estilos para project.html
├── app.js             # lógica para index.html
├── project.js         # lógica para project.html
├── data.json          # datos de todos los proyectos
├── data/
│   ├── navicon.png    # icono de volumen
│   └── projects/      # carpeta con vídeos .webm
└── manus/
    ├── proceso.md     # documentación del proceso
    └── test-notes.md  # notas de pruebas
```

### funcionalidades implementadas

**index.html:**
- logo placeholder centrado arriba
- menú vertical con 8 proyectos visibles (purple 2 oculto por visible:false)
- vídeo de fondo random al cargar
- velo negro con 80% de opacidad sobre vídeo
- autoplay de vídeos en secuencia random cuando termina uno
- indicador visual (👉) del proyecto actualmente reproduciéndose
- "now playing" mostrando título del vídeo actual
- botón de volumen abajo-derecha (mute por defecto)
- slider de volumen que aparece al hacer click en el botón
- navegación a project.html al hacer click en un proyecto

**project.html:**
- carga de proyecto desde data.json mediante slug en URL
- vídeo de fondo en loop con velo negro 80%
- marquee animado arriba con título del proyecto
- descripción centrada en la página
- botón "back" abajo-izquierda con mix-blend-mode: difference
- botón volumen abajo-derecha (igual que home)
- click en cualquier parte de la página oculta velo, marquee y descripción
- título de página dinámico

### características técnicas

el código está estructurado de forma modular con separación clara de responsabilidades. cada archivo javascript tiene funciones específicas y comentadas. los estilos están organizados por secciones. se usa javascript vanilla sin frameworks externos. la web es responsive y funciona en dispositivos móviles.

el sistema de navegación usa URL parameters para cargar proyectos específicos. el control de volumen está sincronizado entre ambas páginas. los vídeos se cargan de forma eficiente y el cambio entre ellos es fluido.

### próximos pasos

el usuario puede ahora probar la web localmente y solicitar ajustes si es necesario. cuando esté listo, se puede hacer commit y push al repositorio de github.

---

## 17 feb 2026 - 12:20 - añadir logo y favicon

### sinopsis
generación de logo minimalista gráfico y configuración de favicon para la web.

### cambios realizados

**logo generado:**
- diseño minimalista con las letras "LD" en forma geométrica
- estilo moderno y profesional
- formato PNG con fondo transparente
- guardado en `data/logo.png`

**integración en la web:**
- reemplazado placeholder de texto por imagen del logo
- añadido favicon (navicon.png) en ambas páginas (index.html y project.html)
- estilos actualizados para mostrar el logo con tamaño responsive
- filtro invert(1) aplicado para que el logo blanco se vea bien sobre el velo oscuro

**archivos modificados:**
- `index.html` - favicon y logo
- `project.html` - favicon
- `styles.css` - estilos del logo

---

## 17 feb 2026 - 12:30 - mejoras de interfaz y experiencia

### sinopsis
mejoras solicitadas por el usuario para pulir la interfaz y la experiencia visual de la web.

### cambios realizados

**eliminación de "now playing":**
se ha eliminado completamente el indicador "now playing" del index.html, incluyendo el HTML, los estilos CSS y la función JavaScript correspondiente. el menú ahora es más limpio y minimalista.

**icono de volumen mejorado:**
se ha reemplazado el navicon.png por un icono SVG de volumen profesional. el nuevo icono es vectorial, escalable y se integra mejor con el diseño. se ha aplicado en ambas páginas (index.html y project.html).

**ajuste de vídeos para rellenar viewer:**
se han añadido propiedades CSS adicionales para asegurar que tanto vídeos horizontales como verticales rellenen completamente el viewer sin dejar espacios en blanco:
- `object-position: center` para centrar el contenido
- `min-width: 100%` y `min-height: 100%` para garantizar cobertura total

**mejora del marquee para títulos cortos:**
el marquee ahora tiene 6 repeticiones del título en lugar de 2, lo que hace que títulos cortos como "nike" o "pacsun" se vean mucho mejor y más fluidos. la animación se ha ajustado para que el loop sea seamless con las 6 repeticiones (translateX de -16.666% en lugar de -50%).

### archivos modificados

- `index.html` - eliminado now playing, añadido SVG de volumen
- `project.html` - añadido SVG de volumen, 6 spans para marquee
- `styles.css` - eliminados estilos de now playing, estilos SVG, mejoras de vídeo
- `project-styles.css` - estilos SVG, mejoras de vídeo, animación marquee ajustada
- `app.js` - eliminada función updateNowPlaying
- `project.js` - refactorizado para manejar 6 spans del marquee

---

## 17 feb 2026 - 13:00 - mejoras de diseño y UX

### sinopsis
implementación de mejoras importantes de diseño, experiencia de usuario y funcionalidades interactivas solicitadas por el usuario.

### cambios realizados

**centrado del menú:**
el menú ahora está centrado tanto horizontal como verticalmente en la pantalla usando flexbox. se ha cambiado de `position: absolute` a `position: fixed` con `display: flex`, `align-items: center` y `justify-content: center`. el contenedor tiene `pointer-events: none` y solo el `#projectList` tiene `pointer-events: auto` para mantener la interactividad.

**responsive mejorado:**
ajustado el logo para que no tape el menú en móviles. el logo ahora tiene `top: 20px` en mobile y un tamaño reducido de 120px.

**control de volumen rediseñado:**
- slider ahora es vertical en lugar de horizontal
- aparece arriba del botón (usando `order: -1`)
- slider más bonito con `border-radius: 10px`, fondo semi-transparente
- thumb más grande (16px) con sombra y efecto hover (scale 1.2)
- posicionado en esquina abajo-derecha (20px, 20px)

**purple 2 añadido:**
cambiado `visible: false` a `visible: true` en data.json para que purple 2 aparezca en el menú.

**botón back mejorado:**
- ahora en negrita (`font-weight: bold`)
- sin borde (`border: none`, `padding: 0`)
- más pegado a la esquina (20px en desktop, 15px en mobile)
- mantiene `mix-blend-mode: difference` para verse siempre

**botón random con animación de ruleta:**
- nuevo botón "random" abajo-izquierda en la home
- al hacer click, la manita (emoji 👉) se mueve como una ruleta
- cicla por todos los proyectos con velocidad decreciente (15-25 iteraciones)
- delay progresivo para efecto de desaceleración
- al final selecciona uno aleatorio y navega a él
- botón deshabilitado durante la animación

**transiciones fluidas:**
- añadido fade out (opacity 0.5s) al navegar entre páginas
- aplicado tanto en home → proyecto como proyecto → home
- clase `.fade-out` en body con transición CSS
- delay de 500ms antes de cambiar de página para que se vea la animación

### archivos modificados

- `index.html` - añadido botón random
- `project.html` - sin cambios estructurales
- `styles.css` - centrado menú, slider vertical, botón random, transiciones
- `project-styles.css` - botón back mejorado, slider vertical, transiciones
- `app.js` - función randomProject con animación de ruleta, fade out en navegación
- `project.js` - fade out en botón back
- `data.json` - purple 2 visible

---
