// la diega — carrusel de video a pantalla completa: slides, transiciones,
// vistas (home / categoria / proyecto / gestoria) y ficha tecnica.

import { playSfx, sound, isAudible } from './audio.js';

let DATA = null;
let allProjects = [];   // proyectos visibles con video, en el orden de data.json
let playlist = [];      // lista que alimenta el carrusel actual
let index = 0;
let mode = 'home';      // 'home' | 'category' | 'single' | 'gestoria'
let engaged = false;    // el usuario ha tocado este video → se ignora el bucle start/finish
let transitioning = false;
let seeking = false;

// dos slides que se alternan para el desplazamiento
let slides = [];        // [{root, video, bg, project}]
let cur = 0;

let stage, seekBar, playBtn, soundBtn, controls, ficha, gestoriaView, bigTitle, wipe;

// lo que el carrusel necesita de otros modulos se inyecta desde main.js (sin ciclos)
let hooks = { closeOverlays: () => {}, hideControls: () => {} };

export function setHooks(h) { Object.assign(hooks, h); }

export function curSlide() { return slides[cur]; }
export function getMode() { return mode; }
export function getPlaylist() { return playlist; }
export function getCurrentProject() { return playlist[index] || null; }
export function isEngaged() { return engaged; }
export function engage() { engaged = true; }
export function setSeeking(v) { seeking = v; }
export function getProjects() { return allProjects; }

export function initCarousel(data, projects) {
    DATA = data;
    allProjects = projects;

    stage = document.getElementById('stage');
    controls = document.getElementById('controls');
    playBtn = document.getElementById('playBtn');
    seekBar = document.getElementById('seekBar');
    soundBtn = document.getElementById('soundBtn');
    ficha = document.getElementById('ficha');
    gestoriaView = document.getElementById('gestoriaView');
    bigTitle = document.getElementById('bigTitle');
    wipe = document.getElementById('wipe');

    const photo = document.getElementById('gestoriaPhoto');
    if (DATA.gestoria && DATA.gestoria.photo) photo.src = DATA.gestoria.photo;

    setupSlides();
    window.addEventListener('resize', () => slides.forEach(fitSlide));

    // el navegador pausa los videos al ocultar la pestaña: reanudar al volver
    // (solo si estaba sonando; una pausa manual del usuario se respeta)
    let sonaba = false;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            sonaba = !curSlide().video.paused;
        } else if (sonaba && mode !== 'gestoria') {
            curSlide().video.play().catch(() => {});
        }
    });
}

/* ===== Slides ===== */

// el chip "cancion" del about escucha este evento para reflejar lo que suena
function avisaEstado() {
    document.dispatchEvent(new CustomEvent('ladiega:videostate'));
}

function setupSlides() {
    slides = Array.from(document.querySelectorAll('.slide')).map(root => {
        const s = {
            root,
            video: root.querySelector('.main-video'),
            bg: root.querySelector('.bg-video'),
            project: null
        };
        s.video.addEventListener('loadedmetadata', () => {
            if (s.project && (s.project.start || 0) > 0) s.video.currentTime = s.project.start;
            fitSlide(s);
        });
        s.video.addEventListener('timeupdate', () => onTimeUpdate(s));
        s.video.addEventListener('ended', () => onEnded(s));
        s.video.addEventListener('play', () => {
            updatePlayBtn();
            avisaEstado();
            if (s.root.classList.contains('contain')) s.bg.play().catch(() => {});
        });
        s.video.addEventListener('pause', () => {
            updatePlayBtn();
            avisaEstado();
            s.bg.pause();
        });
        s.video.addEventListener('volumechange', avisaEstado);
        return s;
    });
}

// con el sinte abierto la cancion del video se aparta a un segundo plano,
// para poder tocar encima sin que se peleen (el chip "cancion" sigue mandando)
export function duckSound(bajito) {
    slides.forEach(s => { s.video.volume = bajito ? 0.18 : 1; });
}

// refleja el estado real del sonido en los videos y en el boton (que asi no miente)
export function applySound() {
    const on = isAudible();
    slides.forEach(s => { s.video.muted = !on; });
    if (soundBtn) soundBtn.classList.toggle('on', sound.on);
}

// intenta reproducir; primero CON sonido (si el navegador lo permite, queda
// desbloqueado desde el principio) y si no, en silencio hasta el primer gesto
function tryPlay(s) {
    const retry = () => { if (s === curSlide()) s.video.play().catch(() => {}); };
    const enSilencio = () => {
        s.video.muted = true;
        s.video.play().catch(() => s.video.addEventListener('canplay', retry, { once: true }));
    };
    if (isAudible()) {
        s.video.muted = false;
        s.video.play().catch(enSilencio);
    } else if (sound.on && !sound.unlocked) {
        s.video.muted = false;
        s.video.play().then(() => { sound.unlocked = true; applySound(); }).catch(enSilencio);
    } else {
        enSilencio();
    }
}

// video vertical en pantalla horizontal → contain + mismo video borroso detras;
// en cualquier otro caso (p. ej. horizontal en movil) → cover, corte central
function fitSlide(s) {
    const v = s.video;
    if (!v.videoWidth || !s.project) return;
    const needsBg = v.videoHeight > v.videoWidth && window.innerWidth > window.innerHeight;
    s.root.classList.toggle('contain', needsBg);
    if (needsBg) {
        if (s.bg.getAttribute('src') !== s.project.videoPath) s.bg.src = s.project.videoPath;
        if (!v.paused) s.bg.play().catch(() => {});
    } else {
        s.bg.pause();
    }
}

function onTimeUpdate(s) {
    if (s !== curSlide()) return;
    const v = s.video;
    const p = s.project;
    // mantener el fondo borroso en sincronia sin provocar saltos
    if (s.root.classList.contains('contain') && s.bg.readyState >= 1 &&
        Math.abs(s.bg.currentTime - v.currentTime) > 0.35) {
        s.bg.currentTime = v.currentTime;
    }
    if (!seeking && v.duration) {
        seekBar.value = Math.round((v.currentTime / v.duration) * 1000);
        seekBar.style.setProperty('--p', (seekBar.value / 10) + '%');
    }
    // bucle por defecto start→finish mientras nadie toca el video
    if (!engaged && p && p.finish && v.currentTime >= p.finish) {
        if (autoOn() && mode !== 'single' && playlist.length > 1) next(true);
        else v.currentTime = p.start || 0;
    }
}

function onEnded(s) {
    if (s !== curSlide()) return;
    if (autoOn() && mode !== 'single' && playlist.length > 1) {
        next(true);
        return;
    }
    s.video.currentTime = (!engaged && s.project && s.project.start) || 0;
    s.video.play().catch(() => {});
}

// el toggle "auto" vive en el DOM; su clase es la unica fuente de verdad
function autoOn() {
    const b = document.getElementById('autoBtn');
    return b && b.classList.contains('on');
}

export function updatePlayBtn() {
    playBtn.textContent = curSlide().video.paused ? 'play' : 'pause';
}

/* ===== Transicion del carrusel ===== */

// espera a que el video entrante tenga imagen (o se rinde a los 1400 ms)
// para que ningun cambio enseñe un fotograma negro
function whenReady(v, fn) {
    if (v.readyState >= 2) { fn(); return; }
    let hecho = false;
    const go = () => { if (hecho) return; hecho = true; fn(); };
    v.addEventListener('loadeddata', go, { once: true });
    setTimeout(go, 1400);
}

// how: 'slide' desplazamiento lateral (flechas) · 'wipe' el barrido tapa la
// pantalla y el cambio se hace debajo (menu) · 'instant' sin nada (arranque)
function showVideo(project, dir = 1, how = 'slide') {
    const incoming = slides[1 - cur];
    const outgoing = slides[cur];
    const instant = how !== 'slide';
    transitioning = true;
    engaged = false;

    incoming.project = project;
    incoming.root.classList.remove('contain');
    incoming.bg.removeAttribute('src');
    incoming.bg.load();
    incoming.video.src = project.videoPath;
    incoming.video.muted = !isAudible();
    incoming.video.load();

    const begin = () => {
        // colocar el entrante fuera de pantalla sin animar
        incoming.root.classList.add('notransition');
        incoming.root.classList.remove('offleft', 'offright');
        incoming.root.classList.add(dir >= 0 ? 'offright' : 'offleft');
        void incoming.root.offsetWidth; // forzar reflow
        if (!instant) incoming.root.classList.remove('notransition');
        else outgoing.root.classList.add('notransition');
        // desplazamiento: el entrante entra y el saliente se va hacia el otro lado
        incoming.root.classList.remove('offright', 'offleft');
        outgoing.root.classList.remove('offleft', 'offright');
        outgoing.root.classList.add(dir >= 0 ? 'offleft' : 'offright');
        cur = slides.indexOf(incoming);
        tryPlay(incoming);
        seekBar.value = 0;
        seekBar.style.setProperty('--p', '0%');
        updateFicha();
        updatePlayBtn();
        // micro-glitch y titulo gigante de entrada
        stage.classList.remove('glitch');
        void stage.offsetWidth;
        stage.classList.add('glitch');
        showBigTitle(project.title);
        setTimeout(() => {
            outgoing.video.pause();
            outgoing.root.classList.remove('notransition');
            incoming.root.classList.remove('notransition');
            transitioning = false;
        }, instant ? 30 : 850);
    };

    if (how === 'instant') { begin(); return; }

    // el barrido no se retira hasta que el video nuevo esta puesto: nunca se
    // ve el cambio ni un fotograma en negro
    if (how === 'wipe') {
        playWipe(destapar => whenReady(incoming.video, () => {
            begin();
            setTimeout(destapar, 80);
        }));
        return;
    }

    whenReady(incoming.video, begin);
}

// en el avance automatico, 1 de cada 4 veces el cambio va con barrido diagonal;
// con las flechas siempre desplazamiento lateral (la direccion es feedback)
export function next(fromAuto) {
    if (transitioning || playlist.length < 2) return;
    index = (index + 1) % playlist.length; // al llegar al final vuelve al principio
    showVideo(playlist[index], 1, fromAuto && Math.random() < 0.25 ? 'wipe' : 'slide');
}

export function prev() {
    if (transitioning || playlist.length < 2) return;
    index = (index - 1 + playlist.length) % playlist.length;
    showVideo(playlist[index], -1);
}

/* ===== Titulo gigante ===== */

let bigTitleTimerA = null;
let bigTitleTimerB = null;

function showBigTitle(text) {
    clearTimeout(bigTitleTimerA);
    clearTimeout(bigTitleTimerB);
    // cada letra cae desde su propia altura con su propia rotacion
    bigTitle.innerHTML = '';
    const step = Math.min(26, 500 / Math.max(text.length, 1));
    let li = 0;
    text.split(' ').forEach((word, wi) => {
        if (wi) bigTitle.appendChild(document.createTextNode(' '));
        const w = document.createElement('span');
        w.className = 'bt-word';
        Array.from(word).forEach(ch => {
            const s = document.createElement('span');
            s.className = 'bt-letter';
            s.textContent = ch;
            s.style.setProperty('--lr', (Math.random() * 9 - 4.5).toFixed(1) + 'deg');
            s.style.setProperty('--ly', Math.round(Math.random() * 44 - 22) + 'px');
            s.style.animationDelay = Math.round(li++ * step) + 'ms';
            w.appendChild(s);
        });
        bigTitle.appendChild(w);
    });
    bigTitle.classList.remove('to-corner');
    bigTitle.classList.add('hidden');
    void bigTitle.offsetWidth;
    bigTitle.classList.remove('hidden');
    document.body.classList.add('title-flight');
    bigTitleTimerA = setTimeout(() => bigTitle.classList.add('to-corner'), 1000);
    bigTitleTimerB = setTimeout(() => {
        bigTitle.classList.add('hidden');
        bigTitle.classList.remove('to-corner');
        document.body.classList.remove('title-flight');
    }, 1500);
}

/* ===== Barrido diagonal ===== */

// dos tiempos: entra (el amarillo pasa de largo, el oscuro se queda tapando),
// avisa a quien lo llamo para que cambie el video debajo, y se retira cuando
// ese le devuelve el aviso. Asi el cambio dura lo que tiene que durar.
const WIPE_COVER = 720;   // ms hasta que la pantalla queda tapada del todo
const WIPE_OUT = 620;     // ms que tarda en marcharse

let wipeInTimer = null;
let wipeOutTimer = null;

export function playWipe(alTapar) {
    clearTimeout(wipeInTimer);
    clearTimeout(wipeOutTimer);
    wipe.classList.remove('run', 'away');
    void wipe.offsetWidth;
    wipe.classList.add('run');
    let destapado = false;
    const destapar = () => {
        if (destapado) return;
        destapado = true;
        wipe.classList.add('away');
        wipeOutTimer = setTimeout(() => wipe.classList.remove('run', 'away'), WIPE_OUT);
    };
    wipeInTimer = setTimeout(() => {
        if (alTapar) alTapar(destapar);
        else destapar();
    }, WIPE_COVER);
}

/* ===== Vistas ===== */

export function goHome(instant = false) {
    exitGestoria();
    mode = 'home';
    const highlights = allProjects.filter(p => p.highlight);
    playlist = highlights.length ? highlights : allProjects.slice();
    index = 0;
    updateModeUI();
    hooks.closeOverlays();
    showVideo(playlist[index], 1, instant ? 'instant' : 'wipe');
}

export function goCategory(slug) {
    const list = allProjects.filter(p => p.category === slug);
    if (!list.length) return;
    exitGestoria();
    mode = 'category';
    playlist = list;
    index = 0;
    updateModeUI();
    hooks.closeOverlays();
    showVideo(playlist[index], 1, 'wipe');
}

export function goProject(project) {
    exitGestoria();
    mode = 'single';
    playlist = [project];
    index = 0;
    updateModeUI();
    hooks.closeOverlays();
    showVideo(project, 1, 'wipe');
}

export function goGestoria() {
    playWipe();
    hooks.hideControls();
    mode = 'gestoria';
    slides.forEach(s => { s.video.pause(); s.bg.pause(); });
    gestoriaView.classList.remove('hidden');
    updateModeUI();
    updateFicha();
    hooks.closeOverlays();
}

function exitGestoria() {
    gestoriaView.classList.add('hidden');
}

function updateModeUI() {
    controls.classList.toggle('mode-single', mode === 'single');
    controls.classList.toggle('gone', mode === 'gestoria');
    document.body.dataset.mode = mode;
}

/* ===== Ficha tecnica ===== */

function updateFicha() {
    ficha.innerHTML = '';
    const addLine = (cls, text) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        ficha.appendChild(span);
        return span;
    };
    if (mode === 'gestoria') {
        ((DATA.gestoria && DATA.gestoria.clients) || []).forEach(name => addLine('ficha-title', name));
        return;
    }
    const p = playlist[index];
    if (!p) return;
    // contador de nivel: por que video del carrusel vas;
    // al pasar por encima asoman flechitas para navegar
    if (mode !== 'single' && playlist.length > 1) {
        const row = document.createElement('span');
        row.className = 'ficha-level-row';
        const mkArrow = (cls, label, fn) => {
            const a = document.createElement('span');
            a.className = 'level-arrow ' + cls;
            a.setAttribute('role', 'button');
            a.setAttribute('aria-label', label);
            a.addEventListener('click', e => {
                e.stopPropagation();
                playSfx('move');
                fn();
            });
            return a;
        };
        row.appendChild(mkArrow('prev', 'video anterior', prev));
        const chip = document.createElement('span');
        chip.className = 'ficha-level';
        chip.textContent = (index + 1) + '/' + playlist.length;
        row.appendChild(chip);
        row.appendChild(mkArrow('next', 'video siguiente', () => next()));
        ficha.appendChild(row);
    }
    const t = addLine('ficha-title', p.title);
    if (p.role) addLine('ficha-line', p.role);
    if (p.studio) addLine('ficha-line', p.studio);
    // titulo mas ancho que su hueco → marquesina dentro de la linea
    if (t.scrollWidth > t.clientWidth + 1) {
        const inner = document.createElement('span');
        inner.className = 'ficha-scroll';
        inner.textContent = p.title + ' · ' + p.title + ' · ';
        t.textContent = '';
        t.appendChild(inner);
    }
}
