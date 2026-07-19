// la diega — carrusel de video a pantalla completa

// Estado global
let DATA = null;
let allProjects = [];   // proyectos visibles con video, en el orden de data.json
let playlist = [];      // lista que alimenta el carrusel actual
let index = 0;
let mode = 'home';      // 'home' | 'category' | 'single' | 'gestoria'
let auto = true;        // avanzar solo al terminar cada video
let soundOn = false;    // los navegadores exigen empezar en silencio para el autoplay
let engaged = false;    // el usuario ha tocado este video → se ignora el bucle start/finish
let transitioning = false;
let seeking = false;

const isTouch = window.matchMedia('(pointer: coarse)').matches;

// dos slides que se alternan para el desplazamiento
let slides = [];        // [{root, video, bg, project}]
let cur = 0;

// Elementos
let stage, controls, prevBtn, playBtn, nextBtn, seekBar, autoBtn, soundBtn;
let menuBtn, brandBtn, ficha, menuOverlay, menuNav, aboutOverlay, aboutBody;
let gestoriaView, gestoriaPhoto;

async function init() {
    const response = await fetch('data.json');
    DATA = await response.json();

    DATA.categories.forEach(cat => {
        (cat.projects || []).forEach(p => {
            if (p.visible !== false && p.videoPath) {
                allProjects.push(Object.assign({ category: cat.slug }, p));
            }
        });
    });

    stage = document.getElementById('stage');
    controls = document.getElementById('controls');
    prevBtn = document.getElementById('prevBtn');
    playBtn = document.getElementById('playBtn');
    nextBtn = document.getElementById('nextBtn');
    seekBar = document.getElementById('seekBar');
    autoBtn = document.getElementById('autoBtn');
    soundBtn = document.getElementById('soundBtn');
    menuBtn = document.getElementById('menuBtn');
    brandBtn = document.getElementById('brandBtn');
    ficha = document.getElementById('ficha');
    menuOverlay = document.getElementById('menuOverlay');
    menuNav = document.getElementById('menuNav');
    aboutOverlay = document.getElementById('aboutOverlay');
    aboutBody = document.getElementById('aboutBody');
    gestoriaView = document.getElementById('gestoriaView');
    gestoriaPhoto = document.getElementById('gestoriaPhoto');

    if (DATA.gestoria && DATA.gestoria.photo) gestoriaPhoto.src = DATA.gestoria.photo;

    setupSlides();
    buildMenu();
    buildAbout();
    bindUI();
    goHome(true);
}

/* ===== Slides ===== */

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
            if (s.root.classList.contains('contain')) s.bg.play().catch(() => {});
        });
        s.video.addEventListener('pause', () => {
            updatePlayBtn();
            s.bg.pause();
        });
        return s;
    });
}

function curSlide() {
    return slides[cur];
}

// intenta reproducir; si el navegador lo bloquea o el video aun carga, reintenta
function tryPlay(s) {
    s.video.play().catch(() => {
        const retry = () => { if (s === curSlide()) s.video.play().catch(() => {}); };
        s.video.addEventListener('canplay', retry, { once: true });
    });
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
    }
    // bucle por defecto start→finish mientras nadie toca el video
    if (!engaged && p && p.finish && v.currentTime >= p.finish) {
        if (auto && mode !== 'single' && playlist.length > 1) next();
        else v.currentTime = p.start || 0;
    }
}

function onEnded(s) {
    if (s !== curSlide()) return;
    if (auto && mode !== 'single' && playlist.length > 1) {
        next();
        return;
    }
    s.video.currentTime = (!engaged && s.project && s.project.start) || 0;
    s.video.play().catch(() => {});
}

/* ===== Transicion del carrusel ===== */

function showVideo(project, dir = 1, instant = false) {
    const incoming = slides[1 - cur];
    const outgoing = slides[cur];
    transitioning = true;
    engaged = false;

    incoming.project = project;
    incoming.root.classList.remove('contain');
    incoming.bg.removeAttribute('src');
    incoming.bg.load();
    incoming.video.src = project.videoPath;
    incoming.video.muted = !soundOn;
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
        updateFicha();
        updatePlayBtn();
        setTimeout(() => {
            outgoing.video.pause();
            outgoing.root.classList.remove('notransition');
            incoming.root.classList.remove('notransition');
            transitioning = false;
        }, instant ? 30 : 700);
    };

    // esperar a que el video tenga imagen para que el desplazamiento no muestre negro
    if (instant || incoming.video.readyState >= 2) {
        begin();
    } else {
        let started = false;
        const go = () => { if (!started) { started = true; begin(); } };
        incoming.video.addEventListener('loadeddata', go, { once: true });
        setTimeout(go, 1400);
    }
}

function next() {
    if (transitioning || playlist.length < 2) return;
    index = (index + 1) % playlist.length; // al llegar al final vuelve al principio
    showVideo(playlist[index], 1);
}

function prev() {
    if (transitioning || playlist.length < 2) return;
    index = (index - 1 + playlist.length) % playlist.length;
    showVideo(playlist[index], -1);
}

/* ===== Vistas ===== */

function goHome(instant = false) {
    exitGestoria();
    mode = 'home';
    const highlights = allProjects.filter(p => p.highlight);
    playlist = highlights.length ? highlights : allProjects.slice();
    index = 0;
    updateModeUI();
    closeOverlays();
    showVideo(playlist[index], 1, instant);
}

function goCategory(slug) {
    const list = allProjects.filter(p => p.category === slug);
    if (!list.length) return;
    exitGestoria();
    mode = 'category';
    playlist = list;
    index = 0;
    updateModeUI();
    closeOverlays();
    showVideo(playlist[index], 1);
}

function goProject(project) {
    exitGestoria();
    mode = 'single';
    playlist = [project];
    index = 0;
    updateModeUI();
    closeOverlays();
    showVideo(project, 1);
}

function goGestoria() {
    mode = 'gestoria';
    slides.forEach(s => { s.video.pause(); s.bg.pause(); });
    gestoriaView.classList.remove('hidden');
    updateModeUI();
    updateFicha();
    closeOverlays();
}

function exitGestoria() {
    gestoriaView.classList.add('hidden');
}

function updateModeUI() {
    controls.classList.toggle('mode-single', mode === 'single');
    controls.classList.toggle('gone', mode === 'gestoria');
}

/* ===== Ficha tecnica ===== */

function updateFicha() {
    ficha.innerHTML = '';
    const addLine = (cls, text) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        ficha.appendChild(span);
    };
    if (mode === 'gestoria') {
        ((DATA.gestoria && DATA.gestoria.clients) || []).forEach(name => addLine('ficha-title', name));
        return;
    }
    const p = playlist[index];
    if (!p) return;
    addLine('ficha-title', p.title);
    if (p.role) addLine('ficha-line', p.role);
    if (p.studio) addLine('ficha-line', p.studio);
}

/* ===== Menu y about ===== */

function buildMenu() {
    menuNav.innerHTML = '';
    const mkBtn = (cls, text, fn) => {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = text;
        b.addEventListener('click', fn);
        return b;
    };

    menuNav.appendChild(mkBtn('menu-link', 'home', () => goHome()));

    DATA.categories.forEach(cat => {
        const list = allProjects.filter(p => p.category === cat.slug);
        if (!list.length) return;
        const group = document.createElement('div');
        group.className = 'menu-group';
        group.appendChild(mkBtn('menu-cat', cat.label, () => goCategory(cat.slug)));
        list.forEach(p => group.appendChild(mkBtn('menu-proj', p.title, () => goProject(p))));
        menuNav.appendChild(group);
    });

    menuNav.appendChild(mkBtn('menu-link', (DATA.about && DATA.about.title) || 'about', openAbout));
    if (DATA.gestoria) {
        menuNav.appendChild(mkBtn('menu-link', DATA.gestoria.label || 'gestoría', goGestoria));
    }
}

function buildAbout() {
    aboutBody.innerHTML = '';
    (((DATA.about) && DATA.about.text) || []).forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        aboutBody.appendChild(p);
    });
}

function openMenu() {
    menuOverlay.classList.remove('hidden');
}

function openAbout() {
    menuOverlay.classList.add('hidden');
    aboutOverlay.classList.remove('hidden');
}

function closeOverlays() {
    menuOverlay.classList.add('hidden');
    aboutOverlay.classList.add('hidden');
}

/* ===== Controles ===== */

function updatePlayBtn() {
    playBtn.textContent = curSlide().video.paused ? 'play' : 'pause';
}

let hideTimer = null;

function revealControls() {
    if (mode === 'gestoria') return;
    controls.classList.remove('faded');
    if (!isTouch) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => controls.classList.add('faded'), 2800);
    }
}

/* ===== Listeners ===== */

function bindUI() {
    // las tres esquinas abren el menu
    menuBtn.addEventListener('click', openMenu);
    brandBtn.addEventListener('click', openMenu);
    ficha.addEventListener('click', openMenu);

    prevBtn.addEventListener('click', prev);
    nextBtn.addEventListener('click', next);

    playBtn.addEventListener('click', () => {
        engaged = true;
        const v = curSlide().video;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
    });

    autoBtn.addEventListener('click', () => {
        auto = !auto;
        autoBtn.classList.toggle('on', auto);
    });

    soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        slides.forEach(s => { s.video.muted = !soundOn; });
        soundBtn.classList.toggle('on', soundOn);
    });

    seekBar.addEventListener('input', () => {
        seeking = true;
        engaged = true;
        const v = curSlide().video;
        if (v.duration) v.currentTime = (seekBar.value / 1000) * v.duration;
    });
    seekBar.addEventListener('change', () => { seeking = false; });

    // la telita: hover en escritorio, toque en movil
    if (isTouch) {
        stage.addEventListener('click', () => controls.classList.toggle('faded'));
    } else {
        window.addEventListener('pointermove', revealControls);
    }

    // cerrar overlays tocando el fondo
    menuOverlay.addEventListener('click', e => { if (e.target === menuOverlay) closeOverlays(); });
    aboutOverlay.addEventListener('click', e => { if (e.target === aboutOverlay) closeOverlays(); });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeOverlays(); return; }
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'BUTTON') return;
        const overlayOpen = !menuOverlay.classList.contains('hidden') ||
            !aboutOverlay.classList.contains('hidden');
        if (overlayOpen || mode === 'gestoria') return;
        if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key.toLowerCase() === 'm') soundBtn.click();
    });

    window.addEventListener('resize', () => slides.forEach(fitSlide));

    // si el navegador bloqueo el autoplay inicial, la primera interaccion lo arranca
    const resume = () => {
        const v = curSlide().video;
        if (v.paused && !engaged && mode !== 'gestoria') v.play().catch(() => {});
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });

    // el navegador pausa los videos al ocultar la pestaña: reanudar al volver
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resume();
    });
}

document.addEventListener('DOMContentLoaded', init);
