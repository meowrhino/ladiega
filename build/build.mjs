/* ============================================================
   build.mjs — data/site.json + projects/ + index.html → dist/, la web tal
   cual se publica.        node build/build.mjs

   La web es una sola página (el carrusel lo pinta el JS). El build revisa
   los JSON y que cada vídeo esté, escribe en el HTML la lista de proyectos
   (lo que leen los buscadores y las vistas previas de los enlaces, antes a
   mano) y pone las direcciones del sitio donde se publica.

   Si algo está mal (una coma, un campo mal escrito, un vídeo que no está)
   para y dice qué, y no se publica nada: la web se queda como estaba.
   ============================================================ */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugsOf } from '../js/house.js';
import { leerJSON, validar } from '../js/validar.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(ROOT, 'dist');
const at = (...p) => join(ROOT, ...p);
const fail = (msg) => { console.error(`\n✗ ${msg}\n\nNo se ha publicado nada: la web sigue como estaba.\n`); process.exit(1); };

/* ---------- leer y revisar ---------- */

const read = (rel) => {
  if (!existsSync(at(rel))) fail(`no encuentro ${rel}`);
  try { return leerJSON(readFileSync(at(rel), 'utf8'), rel); } catch (e) { fail(e.message); }
};
const schema = (t) => JSON.parse(readFileSync(at('schema', `${t}.json`), 'utf8'));
const site = read('data/site.json');
const errors = validar(site, schema('site'), 'data/site.json');
const projects = {};
for (const slug of errors.length ? [] : slugsOf(site)) {
  const rel = `projects/${slug}/project.json`;
  if (projects[slug]) { errors.push(`data/site.json: "${slug}" está dos veces en "lists"`); continue; }
  if (!existsSync(at(rel))) { errors.push(`data/site.json: "lists" dice "${slug}", y no hay ningún ${rel}`); continue; }
  projects[slug] = read(rel);
  errors.push(...validar(projects[slug], schema('project'), rel));
  if (!existsSync(at('projects', slug, 'video.webm'))) errors.push(`${rel}: falta projects/${slug}/video.webm`);
}
for (const c of errors.length ? [] : Object.keys(site.lists)) if (!site.categories[c]) errors.push(`data/site.json: la categoría "${c}" de "lists" no tiene nombre en "categories"`);
if (errors.length) fail(errors.join('\n✗ '));
for (const d of readdirSync(at('projects'))) {
  if (existsSync(at('projects', d, 'project.json')) && !projects[d]) console.warn(`⚠ projects/${d} no está en data/site.json → lists: no se publica`);
}

/* Dónde se publica (las dos copias en GitHub Pages: Cloudflare Workers no
   sirve los vídeos por partes y la barra de progreso no podría saltar). En
   nuestra copia (meowrhino), meowrhino.github.io/<repo>/ y sin indexar; en la
   de la diega, o en local, la raíz con el dominio de site.json → "url", y se
   indexa si lo hay. */
const ours = process.env.GITHUB_REPOSITORY_OWNER === 'meowrhino';
const repo = (process.env.GITHUB_REPOSITORY || '/').split('/')[1];
const SITE = ours ? `https://meowrhino.github.io/${repo}` : String(site.url || '').replace(/\/+$/, '');
const INDEX = !ours && !!site.url;

/* ---------- la página ---------- */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function swap(html, find, replace) {
  if (!find.test(html)) fail(`no encuentro ${find} en index.html: el build lo necesita para escribir la página.`);
  return html.replace(find, replace);
}
const visible = slugsOf(site).filter((s) => projects[s].visible !== false);

let html = readFileSync(at('index.html'), 'utf8');
html = swap(html, /<html lang="es">/, '<html lang="es" data-built>');
html = html.replaceAll('https://ladiega.com', SITE);
html = swap(html, /(<meta name="viewport"[^>]*>)/, `$1\n    <meta name="robots" content="${INDEX ? 'index,follow' : 'noindex'}">`);
// lo que leen quien no ejecuta JS: los proyectos y el contacto, de los JSON
html = swap(html, /(<noscript>)[\s\S]*?(<\/noscript>)/, `$1
        <h1>${esc(site.about.name)}</h1>
        <p>${esc(site.about.class || '')}</p>
        <ul>
${visible.map((s) => `            <li>${esc(projects[s].title)}${projects[s].role ? ` — ${esc(projects[s].role)}` : ''}</li>`).join('\n')}
        </ul>
        <p>Contacto: <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></p>
    $2`);

/* ---------- escribir dist/ ---------- */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of ['styles.css', 'about.css', 'js', 'fonts', 'data', 'projects']) cpSync(at(f), join(OUT, f), { recursive: true, filter: (x) => !x.endsWith('.DS_Store') });
writeFileSync(join(OUT, 'index.html'), html);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), INDEX ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
writeFileSync(join(OUT, '.nojekyll'), '');

console.log(`✓ dist/: la web con ${visible.length} proyectos${INDEX ? ` · se indexa (${SITE})` : ' · sin indexar'}`);
