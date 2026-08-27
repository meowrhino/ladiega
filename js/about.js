// la diega — las dos fichas del menu, las dos sobre el video difuminado:
//
//   about      → la ficha de personaje (nombre, clase y stats) que esconde
//                un sintetizador de verdad. La interfaz del sinte vive en
//                synth-ui.js y su motor de audio en synth.js.
//   contáctame → la misma ficha, sin sinte: los enlaces para escribirle y,
//                debajo, la gestoría. Se edita en data.json.
//
// Los overlays se inyectan desde aqui, no existen en index.html.

import { playSfx, sound } from './audio.js';
import { curSlide, applySound, duckSound } from './carousel.js';
import * as sui from './synth-ui.js';

const ABOUT_STATS = [
    { label: 'musica',        value: 10 },
    { label: 'diseño sonoro', value: 9  },
    { label: 'papeleo',       value: 2  }
];

let aboutData = {};
let contactoData = {};
let oscOverlay = null;       // la ficha-sintetizador
let contactoOverlay = null;  // la ficha de contacto

export function setAboutData(d) { aboutData = d || {}; }
export function setContactoData(d) { contactoData = d || {}; }
export function hayContacto() { return !!(contactoData && contactoData.label); }

/* ===== La ficha ===== */

// cabecera comun a las dos fichas: nombre gigante y una linea debajo
function renderCabecera(nombre, linea) {
    return '<div class="oscab-head">' +
        '<div class="oscab-name">' + nombre + '</div>' +
        '<div class="oscab-role">' + (linea || '') + '</div>' +
    '</div>';
}

// la onda decorativa cruza toda la pantalla: barras segun el ancho
function renderOnda() {
    const nBars = Math.max(28, Math.ceil(window.innerWidth / 22));
    let wave = '';
    for (let i = 0; i < nBars; i++) {
        wave += '<span class="oscab-bar" style="animation-delay:' + (i * 55) + 'ms"></span>';
    }
    return '<div class="oscab-wave">' + wave + '</div>';
}

function renderAbout(about) {
    const stats = ABOUT_STATS.map(st => {
        const pct = (st.value * 10) + '%';
        return '<div class="oscab-fader">' +
            '<span class="oscab-track"><span class="oscab-fill" style="height:' + pct + '"></span>' +
            '<span class="oscab-knob" style="bottom:' + pct + '"></span></span>' +
            '<span class="oscab-flbl">' + st.label + '</span></div>';
    }).join('');

    return '<div class="oscab">' +
        renderOnda() +
        sui.renderScope() +
        renderCabecera(about.name || 'la diega', about.clase) +
        '<div class="oscab-desk">' + stats + '</div>' +
        sui.renderSynth() +
        // quien ha hecho la web, al final del todo
        '<div class="oscab-firma">web: ' +
            '<a href="https://meowrhino.studio" target="_blank" rel="noopener">meowrhino.studio</a>' +
        '</div>' +
    '</div>' +
    sui.renderSynthModal();
}

/* ===== Contacto ===== */

// escapar lo que venga de data.json antes de meterlo en el HTML
function esc(t) {
    return String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// el texto lleva una palabra entre llaves — {contáctame} — que se convierte
// en el enlace que abre el correo. Asi se cambia todo desde data.json
function renderContacto(c) {
    const email = c.email || '';
    const texto = c.texto || '';
    const partido = texto.match(/^([\s\S]*?)\{([^}]+)\}([\s\S]*)$/);
    const enlace = email
        ? '<a class="oscab-mail" href="mailto:' + esc(email) + '">' +
              esc(partido ? partido[2] : 'contáctame') + '</a>'
        : '';

    let cuerpo = '';
    if (partido) {
        cuerpo = esc(partido[1]) + enlace + esc(partido[3]);
    } else if (texto) {
        cuerpo = esc(texto) + (enlace ? ' ' + enlace : '');
    } else {
        cuerpo = enlace;
    }

    return '<div class="oscab">' +
        renderOnda() +
        renderCabecera(esc(c.name || 'contáctame'), esc(c.clase)) +
        (cuerpo ? '<p class="oscab-texto">' + cuerpo + '</p>' : '') +
    '</div>';
}

/* ===== El chip de la cancion (lo unico del sinte que toca el carrusel) ===== */

function syncSongChip() {
    if (!oscOverlay || oscOverlay.classList.contains('hidden')) return;
    const chip = oscOverlay.querySelector('.oscab-song');
    if (chip) chip.classList.toggle('on', !curSlide().video.muted && !curSlide().video.paused);
}

function wireSongChip(ov) {
    const songBtn = ov.querySelector('.oscab-song');
    if (!songBtn) return;
    songBtn.addEventListener('click', () => {
        const v = curSlide().video;
        const encender = v.muted || v.paused;
        // el chip manda: applySound() deja los videos y el boton del home coherentes
        sound.unlocked = true;
        sound.on = encender;
        applySound();
        if (encender && v.paused) v.play().catch(() => {});
        syncSongChip();
        playSfx('move');
    });
    syncSongChip();
}

/* ===== Overlays ===== */

// las dos fichas comparten envoltorio: fondo difuminado, × de cerrar y
// cerrar al tocar fuera
function creaFicha(clase, alCerrar) {
    const ov = document.createElement('div');
    ov.className = 'overlay osc-about hidden ' + clase;
    ov.innerHTML =
        '<button class="overlay-close" aria-label="cerrar">×</button>' +
        '<div class="osc-inner"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
        if (e.target === ov) { playSfx('back'); alCerrar(); }
    });
    ov.querySelector('.overlay-close')
        .addEventListener('click', () => { playSfx('back'); alCerrar(); });
    return ov;
}

function abreFicha(ov, html) {
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) menuOverlay.classList.add('hidden');
    ov.classList.remove('hidden');
    ov.querySelector('.osc-inner').innerHTML = html;
    document.body.classList.add('overlay-open');
    playSfx('select');
}

/* --- about --- */

export function openOscAbout() {
    closeContacto();
    if (!oscOverlay) {
        oscOverlay = creaFicha('', closeOscAbout);
        document.addEventListener('ladiega:videostate', syncSongChip);
    }
    abreFicha(oscOverlay, renderAbout(aboutData));
    sui.stopSynth();
    sui.wireSynth(oscOverlay);
    wireSongChip(oscOverlay);
    duckSound(true);   // la cancion de fondo se aparta para poder tocar encima
}

export function closeOscAbout() {
    if (!oscOverlay || oscOverlay.classList.contains('hidden')) return;
    duckSound(false);
    sui.stopSynth();
    sui.olvidaFicha();
    oscOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

/* --- contacto --- */

export function openContacto() {
    closeOscAbout();
    if (!contactoOverlay) contactoOverlay = creaFicha('osc-contacto', closeContacto);
    abreFicha(contactoOverlay, renderContacto(contactoData));
}

export function closeContacto() {
    if (!contactoOverlay || contactoOverlay.classList.contains('hidden')) return;
    contactoOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

/* --- cierre comun --- */

export function closeFichas() {
    closeOscAbout();
    closeContacto();
}

// Escape con una ficha abierta: primero cierra el modal del sinte, luego la
// ficha. Lo llama el listener global de ui.js; true = ya me he encargado yo.
export function aboutEscape() {
    const abierta = [oscOverlay, contactoOverlay].find(o => o && !o.classList.contains('hidden'));
    if (!abierta) return false;
    playSfx('back');
    if (abierta === oscOverlay && sui.modalAbierto(oscOverlay)) sui.cierraModal(oscOverlay);
    else closeFichas();
    return true;
}
