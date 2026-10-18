// la diega — arranque: carga los datos (js/carga.js) y conecta los modulos
// (carousel = slides y vistas · ui = menu y controles · about/synth = el sinte)

import { initCarousel, setHooks, goHome } from './carousel.js';
import { initUI, closeOverlays, hideControls } from './ui.js';
import { setAboutData, setContactoData } from './about.js';
import { loadData } from './carga.js';

// si los datos no cargan (una coma de mas al editarlos, por ejemplo) el sitio
// se quedaba en negro sin decir nada. Mejor contarlo, en pantalla y en consola
// (en la vista previa, js/carga.js ya lo cuenta en pantalla con el detalle)
function avisaDelFallo(e) {
    console.error('la diega — no se han podido cargar los datos:', e);
    if (document.getElementById('errores-vista-previa')) return;
    const aviso = document.createElement('div');
    aviso.className = 'fallo';
    aviso.innerHTML = '<p>no se han podido cargar los datos</p>' +
        '<p class="fallo-pista">suele ser una coma de más o unas comillas sin cerrar. ' +
        'El detalle exacto está en la consola del navegador.</p>';
    document.body.appendChild(aviso);
}

async function init() {
    const DATA = await loadData();

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
