// la diega — arranque: carga data.json y conecta los modulos
// (carousel = slides y vistas · ui = menu y controles · about/synth = el sinte)

import { initCarousel, setHooks, goHome } from './carousel.js';
import { initUI, closeOverlays, hideControls } from './ui.js';
import { setAboutData, setContactoData } from './about.js';

// si data.json no carga (una coma de mas al editarlo, por ejemplo) el sitio
// se quedaba en negro sin decir nada. Mejor contarlo, en pantalla y en consola
function avisaDelFallo(e) {
    console.error('la diega — no se ha podido cargar data.json:', e);
    const aviso = document.createElement('div');
    aviso.className = 'fallo';
    aviso.innerHTML = '<p>no se ha podido cargar <b>data.json</b></p>' +
        '<p class="fallo-pista">suele ser una coma de más o unas comillas sin cerrar. ' +
        'El detalle exacto está en la consola del navegador.</p>';
    document.body.appendChild(aviso);
}

async function init() {
    // no-store: que editar data.json se note sin pelearse con la cache
    const response = await fetch('data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('data.json → HTTP ' + response.status);
    const DATA = await response.json();

    const allProjects = [];
    DATA.categories.forEach(cat => {
        (cat.projects || []).forEach(p => {
            if (p.visible !== false && p.videoPath) {
                allProjects.push(Object.assign({ category: cat.slug }, p));
            }
        });
    });

    initCarousel(DATA, allProjects);
    setAboutData(DATA.about);
    setContactoData(DATA.contacto);
    initUI(DATA, allProjects);
    setHooks({ closeOverlays, hideControls });
    goHome(true);
}

init().catch(avisaDelFallo);
