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
