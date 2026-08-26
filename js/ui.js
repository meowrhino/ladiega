// la diega — interfaz: menu a pantalla completa, controles desperdigados
// del video y todos los listeners globales (teclado, gestos, desbloqueo de audio).

import { playSfx, sound } from './audio.js';
import * as carousel from './carousel.js';
import { openOscAbout, closeOscAbout, aboutEscape } from './about.js';

const isTouch = window.matchMedia('(pointer: coarse)').matches;

let controls, playBtn, seekBar, autoBtn, soundBtn;
let menuBtn, brandBtn, ficha, menuOverlay, menuNav;

export function initUI(DATA, allProjects) {
    controls = document.getElementById('controls');
    playBtn = document.getElementById('playBtn');
    seekBar = document.getElementById('seekBar');
    autoBtn = document.getElementById('autoBtn');
    soundBtn = document.getElementById('soundBtn');
    menuBtn = document.getElementById('menuBtn');
    brandBtn = document.getElementById('brandBtn');
    ficha = document.getElementById('ficha');
    menuOverlay = document.getElementById('menuOverlay');
    menuNav = document.getElementById('menuNav');

    buildMenu(DATA, allProjects);
    bindUI();
}

/* ===== Menu ===== */

// iconos pixel dibujados a mano (heredan el color del texto)
const MENU_ICONS = {
    home: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v1h1v1h1v1h1v1h1v1h1v2h-2v6h-4v-4H7v4H3V9H1V7h1V6h1V5h1V4h1V3h1V2h1z"/></svg>',
    music: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v1h2v1h2v2h1v3h-2V6h-2V5H9v6h-1v2H7v1H4v-1H3v-2h1v-1h3z"/></svg>',
    brands: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v3h1v1h1v1h4v2h-1v1h-1v1h-1v4h-2v-1H9v-1H7v1H6v1H4V9H3V8H2V7H1V5h4V4h1V3h1z"/></svg>',
    about: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 0h2v4h1v1h1v1h4v2h-4v1h-1v1h-1v4H7v-4H6v-1H5V8H1V6h4V5h1V4h1z"/></svg>',
    gestoria: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M6 2h4v2h4v3H9V6H7v1H2V4h4zM2 8h5v1h2V8h5v6H2z"/></svg>'
};

function buildMenu(DATA, allProjects) {
    menuNav.innerHTML = '';
    const mkBtn = (cls, text, fn, icon) => {
        const b = document.createElement('button');
        b.className = cls;
        if (icon) {
            const i = document.createElement('span');
            i.className = 'icon';
            i.innerHTML = icon;
            b.appendChild(i);
        }
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = text;
        b.appendChild(label);
        if (cls.indexOf('menu-cat') !== -1) {
            // marquesina que aparece al pasar por encima
            const mq = document.createElement('span');
            mq.className = 'marquee';
            const half = (text + ' · ').repeat(4);
            mq.textContent = half + half;
            b.appendChild(mq);
        }
        b.addEventListener('click', () => { playSfx('select'); fn(); });
        b.addEventListener('mouseenter', () => playSfx('move'));
        return b;
    };

    // data-nav identifica cada destino para poder marcar donde estas
    const home = mkBtn('menu-item menu-link', 'home', () => carousel.goHome(), MENU_ICONS.home);
    home.dataset.nav = 'home';
    menuNav.appendChild(home);

    DATA.categories.forEach(cat => {
        const list = allProjects.filter(p => p.category === cat.slug);
        if (!list.length) return;
        const group = document.createElement('div');
        group.className = 'menu-group';
        const catBtn = mkBtn('menu-cat', cat.label, () => carousel.goCategory(cat.slug), MENU_ICONS[cat.slug]);
        catBtn.dataset.nav = 'cat:' + cat.slug;
        group.appendChild(catBtn);
        list.forEach(p => {
            const b = mkBtn('menu-item menu-proj', p.title, () => carousel.goProject(p));
            b.dataset.nav = 'proj:' + p.slug;
            group.appendChild(b);
        });
        menuNav.appendChild(group);
    });

    menuNav.appendChild(mkBtn('menu-item menu-link', (DATA.about && DATA.about.title) || 'about', openOscAbout, MENU_ICONS.about));

    if (DATA.gestoria) {
        const g = mkBtn('menu-item menu-link', DATA.gestoria.label || 'gestoría', carousel.goGestoria, MENU_ICONS.gestoria);
        g.dataset.nav = 'gestoria';
        menuNav.appendChild(g);
    }
}

// marca en el menu donde estas: el video que suena detras lleva la manita
// (.is-playing) y la seccion desde la que se llego va subrayada (.is-here).
// Devuelve el boton que se lleva el foco al abrir — antes era siempre "home".
function markCurrent() {
    const mode = carousel.getMode();
    const p = carousel.getCurrentProject();
    const seccion = mode === 'home' ? 'home'
        : mode === 'gestoria' ? 'gestoria'
        : mode === 'category' && p ? 'cat:' + p.category
        : p ? 'proj:' + p.slug : '';
    const enPantalla = p && mode !== 'gestoria' ? 'proj:' + p.slug : '';
    let foco = null;
    menuNav.querySelectorAll('[data-nav]').forEach(b => {
        const suena = !!enPantalla && b.dataset.nav === enPantalla;
        b.classList.toggle('is-playing', suena);
        b.classList.toggle('is-here', b.dataset.nav === seccion);
        if (suena) { b.setAttribute('aria-current', 'true'); foco = b; }
        else b.removeAttribute('aria-current');
    });
    return foco
        || (seccion && menuNav.querySelector('[data-nav="' + seccion + '"]'))
        || menuNav.querySelector('.menu-item');
}

function openMenu() {
    clearTimeout(menuOverlay._hideTimer);
    menuOverlay.classList.remove('hidden', 'closing');
    closeOscAbout();
    document.body.classList.add('overlay-open');
    playSfx('select');
    // cada boton entra desde un sitio aleatorio distinto
    menuOverlay.querySelectorAll('button').forEach((b, i) => {
        scatterVars(b, 'i');
        b.style.animation = 'none';
        void b.offsetWidth;
        b.style.animation = '';
        b.style.animationDelay = (i * 30) + 'ms';
    });
    // seleccion inicial estilo consola: cae sobre el video que hay detras
    const sel = markCurrent();
    if (sel) {
        sel.focus({ preventScroll: true });
        sel.scrollIntoView({ block: 'center' });
    }
}

// cierre animado siempre: los botones del menu vuelan hacia sitios aleatorios
// y el fondo se destapa (al navegar, el vuelo convive con el wipe)
function hideOverlay(ov) {
    if (ov.classList.contains('hidden') || ov.classList.contains('closing')) return;
    if (ov === menuOverlay) {
        menuOverlay.querySelectorAll('button').forEach((b, i) => {
            scatterVars(b, 'o');
            b.style.animationDelay = (i * 18) + 'ms';
        });
    }
    ov.classList.add('closing');
    ov._hideTimer = setTimeout(() => {
        ov.classList.add('hidden');
        ov.classList.remove('closing');
    }, 520);
}

export function closeOverlays() {
    hideOverlay(menuOverlay);
    closeOscAbout();
    document.body.classList.remove('overlay-open');
}

/* ===== Controles ===== */

let hideTimer = null;

// sortea desde donde entra (prefijo 'i') o hacia donde se marcha (prefijo 'o') un control
function scatterVars(el, prefix) {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 180;
    el.style.setProperty('--' + prefix + 'x', Math.round(Math.cos(a) * d) + 'px');
    el.style.setProperty('--' + prefix + 'y', Math.round(Math.sin(a) * d) + 'px');
    el.style.setProperty('--' + prefix + 'r', Math.round(Math.random() * 30 - 15) + 'deg');
}

// las flechas grandes siempre entran y salen por su propio lado (menos lio);
// el resto de controles, desde donde les toque en el sorteo
function setCtrlVars(prefix) {
    controls.querySelectorAll('.ctrl').forEach(el => {
        if (el.classList.contains('edge-arrow')) {
            const left = el.classList.contains('left');
            el.style.setProperty('--' + prefix + 'x', (left ? -140 : 140) + 'px');
            el.style.setProperty('--' + prefix + 'y', '0px');
            el.style.setProperty('--' + prefix + 'r', (left ? -10 : 10) + 'deg');
        } else {
            scatterVars(el, prefix);
        }
    });
}

function showControls() {
    // con un overlay abierto no pintamos controles detras del difuminado
    if (carousel.getMode() === 'gestoria' || document.body.classList.contains('overlay-open')) return;
    document.body.classList.add('booted');
    if (controls.classList.contains('faded')) {
        setCtrlVars('i');
        controls.classList.remove('faded');
        document.body.classList.add('controls-open');
    }
    if (!isTouch) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideControls, 2800);
    }
}

export function hideControls() {
    if (controls.classList.contains('faded')) return;
    setCtrlVars('o');
    controls.classList.add('faded');
    document.body.classList.remove('controls-open');
}

// vibracion cortita en movil al cambiar de video
function buzz() {
    if (navigator.vibrate) navigator.vibrate(12);
}

/* ===== Listeners ===== */

function bindUI() {
    // las tres esquinas abren el menu (la ficha no es <button> para poder
    // llevar las flechitas del contador dentro; Enter la mantiene accesible)
    menuBtn.addEventListener('click', openMenu);
    brandBtn.addEventListener('click', openMenu);
    ficha.addEventListener('click', openMenu);
    ficha.addEventListener('keydown', e => { if (e.key === 'Enter') openMenu(); });

    // cerrar ventanas
    document.getElementById('menuClose').addEventListener('click', () => { playSfx('back'); closeOverlays(); });

    // flechas laterales del carrusel
    document.getElementById('arrowPrev').addEventListener('click', () => { playSfx('move'); buzz(); carousel.prev(); });
    document.getElementById('arrowNext').addEventListener('click', () => { playSfx('move'); buzz(); carousel.next(); });

    // parallax del menu siguiendo el raton
    if (!isTouch) {
        menuOverlay.addEventListener('mousemove', e => {
            const r = menuNav.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            menuNav.style.transform =
                'perspective(900px) rotateX(' + (-dy * 3).toFixed(2) + 'deg)' +
                ' rotateY(' + (dx * 3).toFixed(2) + 'deg)';
        });
        menuOverlay.addEventListener('mouseleave', () => { menuNav.style.transform = ''; });
    }

    playBtn.addEventListener('click', () => {
        carousel.engage();
        playSfx('select');
        const v = carousel.curSlide().video;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
    });

    autoBtn.addEventListener('click', () => {
        autoBtn.classList.toggle('on');
        playSfx('move');
    });

    soundBtn.addEventListener('click', () => {
        // primer gesto sobre el boton: desbloquea y enciende (no alterna, si no se apagaria al instante)
        if (!sound.unlocked) { sound.unlocked = true; sound.on = true; }
        else sound.on = !sound.on;
        carousel.applySound();
        playSfx('move');
        const v = carousel.curSlide().video;
        if (sound.on && v.paused && !carousel.isEngaged() && carousel.getMode() !== 'gestoria') v.play().catch(() => {});
    });

    seekBar.addEventListener('input', () => {
        carousel.setSeeking(true);
        carousel.engage();
        seekBar.style.setProperty('--p', (seekBar.value / 10) + '%');
        const v = carousel.curSlide().video;
        if (v.duration) v.currentTime = (seekBar.value / 1000) * v.duration;
    });
    seekBar.addEventListener('change', () => carousel.setSeeking(false));

    // escritorio: mover el raton saca la interfaz.
    // movil: deslizar a los lados cambia de video; un toque suelto en los
    // tercios laterales tambien, y en el centro enseña/esconde los controles.
    // Todo en el mismo sitio para que un deslizamiento no cuente ademas como toque.
    const stage = document.getElementById('stage');
    if (isTouch) {
        const ARRASTRE = 55;   // px que hay que deslizar para que cuente
        const QUIETO = 12;     // px de margen para seguir considerandolo un toque
        let x0 = 0, y0 = 0, t0 = 0, siguiendo = false;

        stage.addEventListener('pointerdown', e => {
            x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp; siguiendo = true;
        });
        stage.addEventListener('pointercancel', () => { siguiendo = false; });
        stage.addEventListener('pointerup', e => {
            if (!siguiendo) return;
            siguiendo = false;
            const dx = e.clientX - x0;
            const dy = e.clientY - y0;
            const puedeNavegar = carousel.getMode() !== 'single' && carousel.getPlaylist().length > 1;

            // deslizamiento: largo, mas horizontal que vertical y sin dormirse
            if (puedeNavegar && Math.abs(dx) > ARRASTRE &&
                Math.abs(dx) > Math.abs(dy) * 1.4 && e.timeStamp - t0 < 700) {
                playSfx('move');
                buzz();
                if (dx < 0) carousel.next(); else carousel.prev();
                return;
            }

            if (Math.abs(dx) > QUIETO || Math.abs(dy) > QUIETO) return;  // ni toque ni deslizamiento
            const w = window.innerWidth;
            if (puedeNavegar && x0 < w * 0.3) { playSfx('move'); buzz(); carousel.prev(); }
            else if (puedeNavegar && x0 > w * 0.7) { playSfx('move'); buzz(); carousel.next(); }
            else if (controls.classList.contains('faded')) showControls();
            else hideControls();
        });
    } else {
        window.addEventListener('pointermove', showControls);
    }

    // cerrar overlays tocando el fondo
    menuOverlay.addEventListener('click', e => {
        if (e.target === menuOverlay || e.target === menuNav) closeOverlays();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            // el about gestiona su propio Escape (primero el modal, luego el)
            if (!aboutEscape()) closeOverlays();
            return;
        }
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'BUTTON') return;
        const overlayOpen = !menuOverlay.classList.contains('hidden') ||
            document.querySelector('.osc-about:not(.hidden)');
        if (overlayOpen || carousel.getMode() === 'gestoria') return;
        if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
        else if (e.key === 'ArrowRight') carousel.next();
        else if (e.key === 'ArrowLeft') carousel.prev();
        else if (e.key.toLowerCase() === 'm') soundBtn.click();
    });

    // politica de autoplay: el audio no puede sonar hasta el primer gesto del usuario.
    // el primer gesto EN CUALQUIER PARTE desbloquea y enciende el sonido; si el gesto es
    // sobre el boton de sonido, lo gestiona su propio handler (para no apagarlo al instante).
    const unlock = (e) => {
        if (sound.unlocked) return;
        if (e && e.target && e.target.closest && e.target.closest('#soundBtn')) return;
        sound.unlocked = true;
        carousel.applySound();
        const v = carousel.curSlide().video;
        if (v.paused && !carousel.isEngaged() && carousel.getMode() !== 'gestoria') v.play().catch(() => {});
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
}
