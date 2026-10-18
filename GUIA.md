# Guía de la web

> **Regla de oro: solo se tocan `data/site.json` y `projects/`.** Lo demás es el código.

## Qué hay

```
data/site.json             las categorías, qué proyectos van en cada una y en qué orden,
                           el about y la gestoría
projects/<nombre>/         un proyecto, una carpeta:
  project.json               su título, su ficha técnica y su bucle
  video.webm                 el vídeo
data/og.jpg                la imagen que sale al compartir el enlace (1200×630)
```

## La primera vez: preparar VS Code

Solo se hace una vez.

1. En VS Code: **Archivo → Nueva ventana** y, en la bienvenida, **Clonar repositorio Git…** →
   **Clonar desde GitHub**. Entra con tu cuenta, elige tu repositorio y una carpeta.
2. Al abrirla, VS Code propone instalar **Live Server** (abajo a la derecha): **Instalar**.
3. Abajo a la derecha sale **Go Live**: es la vista previa.

**VS Code te ayuda con los campos**: si pasas el ratón por encima de uno (`"title"`, `"start"`…)
te dice qué es, y si escribes uno mal o pones algo que no toca, lo subraya en rojo. Lo sabe por
la primera línea de cada JSON (`"$schema": …`): **no la borres**.

## Añadir un proyecto, paso a paso

1. **Copia una carpeta** de `projects/` y ponle el nombre nuevo: `projects/nike/` →
   `projects/nuevo/` (minúsculas, sin acentos, con guiones).
2. **El vídeo**: en `.webm` (con [videoToWeb](https://meowrhino.github.io/videoToWeb/)), y que se
   llame `video.webm`.
3. **Los textos**: abre `project.json` y cambia lo que toque (los campos, abajo).
4. **En el menú**: en `data/site.json`, en `lists`, añade `"nuevo"` en su categoría (`music`,
   `brands`), en el sitio donde quieras que salga.
5. **Go Live** para verlo, y después **Subir los cambios**.

## Los campos de un proyecto (`project.json`)

| campo | qué hace |
|---|---|
| `title` | el título: sale gigante al cambiar de vídeo |
| `role` | qué hiciste: en la ficha técnica, abajo a la izquierda |
| `studio` | *opcional*: el estudio o la marca, en la ficha técnica |
| `start` / `finish` | *opcional*: el bucle que se ve cuando nadie toca el vídeo, en segundos. Sin ellos, el vídeo entero |
| `highlight` | *opcional*: `false` y no sale en el carrusel de la home (sí en su categoría) |
| `visible` | *opcional*: `false` y no sale en ningún sitio (para dejarlo preparado) |

## El about y la gestoría (`data/site.json`)

- **`about`**: el nombre y lo de debajo (`class`) de la ficha del sintetizador.
- **`contact`**: la gestoría. En `text`, la palabra entre llaves, `{contáctame}`, es el enlace
  que abre el correo de `email`.

## Verlo antes de subirlo

**Go Live** abajo a la derecha de VS Code. Se abre la web en el navegador y se refresca sola cada
vez que guardas. Si hay algo que no se publicaría (una coma, un campo mal escrito), sale en
pantalla, y dice dónde.

## Subir los cambios

1. Pestaña **Control de código fuente** (las tres bolitas unidas, a la izquierda).
2. Escribe qué has hecho (`proyecto nuevo: nuevo`) y **Confirmar** (*Commit*). Si pregunta si
   quieres añadir todos los cambios: **Sí**.
3. **Sincronizar cambios** (*Sync*).
4. En un par de minutos está en la web. En GitHub, al lado del último cambio sale una bolita:
   amarilla es que se está publicando, verde que ya está, roja que algo no cuadra.

**Antes de empezar a tocar**, dale también a **Sincronizar**, para bajar lo que haya cambiado.

## Si sale en rojo

La web no se rompe: se queda como estaba hasta que se arregla. Pincha la bolita roja, luego
**Details**, y lee el último mensaje, que dice el fichero y qué pasa:

- **"no es un JSON válido, línea 12"** → casi siempre **una coma**: que falta entre dos cosas, o
  que sobra después de la última. O unas comillas sin cerrar.
- **"\"titulo\" no es un campo de aquí (¿mal escrito?). Los que hay: title, role…"** → un campo
  mal escrito: cópialo de la lista que sale en el mensaje.
- **"falta projects/nuevo/video.webm"** → el vídeo no se llama así o no se ha subido.
- **"\"lists\" dice \"nuevo\", y no hay ningún projects/nuevo/project.json"** → el nombre de la
  lista y el de la carpeta no son iguales.
