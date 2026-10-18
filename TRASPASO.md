# Traspaso: la versión nueva a la copia de la diega

La diega tiene su copia, `ladiegaog/web`, que publica `ladiega.com` con GitHub
Pages (*legacy*: sirve los ficheros de `main` tal cual), con Cloudflare delante
en Full. Los cambios los hemos hecho nosotros en las dos (podemos escribir en la
suya). Es la versión de antes: un `data.json` con todos los proyectos y los
vídeos en `data/projects/`.

**Su contenido y el nuestro eran iguales** el 2026-10-18 (`60f2f12` en la suya;
solo cambiaban `CNAME` y `robots.txt`, que ahora hace el build). Lo que haya
cambiado desde entonces hay que traerlo antes.

Las dos copias publican en GitHub Pages con la misma Action
(`.github/workflows/deploy.yml`) y el build decide por el dueño del repo: en
`meowrhino`, github.io sin indexar; en la suya, ladiega.com. No Cloudflare
Workers: no sirve los vídeos por partes y la barra de progreso no podría saltar.

Tiempo: unos 15 minutos. Para ella cambia cómo se añade un proyecto (una
carpeta con su `project.json` y su `video.webm`, en vez de un bloque en
`data.json`).

## Antes

- [ ] `main` de meowrhino al día y sin cambios a medias (`git status` limpio).
- [ ] ¿Ha cambiado algo en la suya desde `60f2f12`?
      `gh api repos/ladiegaog/web/commits --jq '.[0:3][] | .sha[0:7]+" "+.commit.message'`.
      Si sí, pasarlo aquí antes (un proyecto de `data.json` → `projects/<slug>/project.json` y su
      vídeo de `data/projects/<carpeta>/video.webm` → `projects/<slug>/video.webm`).

## 1. Su Pages, a Actions (necesita ser admin: ella)

- [ ] En `ladiegaog/web`: **Settings → Pages → Source: GitHub Actions**. El dominio
      (`ladiega.com`) se queda como está.

## 2. La versión nueva a su `main`

Su `main` y el nuestro han ido por separado (los mismos cambios con otros commits). Se guarda la
de antes en una rama y se sube la nueva encima:

- [ ] `git push https://github.com/ladiegaog/web.git <sha-de-su-main>:refs/heads/antes`
- [ ] `git push --force-with-lease=main:<sha-de-su-main> https://github.com/ladiegaog/web.git main`
- [ ] En su repo, pestaña **Actions**: la de `build & deploy` en verde.

## 3. Comprobar en ladiega.com

- [ ] El carrusel, el menú, una categoría, el about con el sinte y el sonido.
- [ ] La barra de progreso salta (las peticiones por rango siguen funcionando).
- [ ] `view-source:`: `canonical` con ladiega.com y **sin** `noindex`; la lista de proyectos en el
      `<noscript>`.
- [ ] `/robots.txt` dice `Allow` y `/sitemap.xml`.

## 4. Al acabar

- [ ] Fila de ladiega en `JAMstack/inventario.md` con las dos direcciones.
