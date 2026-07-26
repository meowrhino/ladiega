// la diega — arranque: carga data.json y conecta los modulos
// (carousel = slides y vistas · ui = menu y controles · about/synth = el sinte)

import { initCarousel, setHooks, goHome } from './carousel.js';
import { initUI, closeOverlays, hideControls } from './ui.js';
import { setAboutData } from './about.js';

async function init() {
    // no-store: que editar data.json se note sin pelearse con la cache
    const response = await fetch('data.json', { cache: 'no-store' });
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
    initUI(DATA, allProjects);
    setHooks({ closeOverlays, hideControls });
    goHome(true);
}

init();
