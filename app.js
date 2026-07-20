// la diega — carrusel de video a pantalla completa

// Estado global
let DATA = null;
let allProjects = [];   // proyectos visibles con video, en el orden de data.json
let playlist = [];      // lista que alimenta el carrusel actual
let index = 0;
let mode = 'home';      // 'home' | 'category' | 'single' | 'gestoria'
let auto = true;        // avanzar solo al terminar cada video
let soundOn = true;     // sonido encendido por defecto (si el navegador lo bloquea, arranca al primer gesto)
let engaged = false;    // el usuario ha tocado este video → se ignora el bucle start/finish
let transitioning = false;
let seeking = false;

const isTouch = window.matchMedia('(pointer: coarse)').matches;

// dos slides que se alternan para el desplazamiento
let slides = [];        // [{root, video, bg, project}]
let cur = 0;

// Elementos
let stage, controls, playBtn, seekBar, autoBtn, soundBtn;
let menuBtn, brandBtn, ficha, menuOverlay, menuNav, aboutOverlay, aboutBody;
let gestoriaView, gestoriaPhoto, bigTitle, wipe;

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
    playBtn = document.getElementById('playBtn');
    seekBar = document.getElementById('seekBar');
    bigTitle = document.getElementById('bigTitle');
    wipe = document.getElementById('wipe');
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

// intenta reproducir; si el navegador bloquea el autoplay con sonido,
// arranca en silencio y el primer gesto del usuario lo activa
function tryPlay(s) {
    s.video.muted = !soundOn;
    s.video.play().catch(() => {
        s.video.muted = true;
        s.video.play().catch(() => {
            const retry = () => { if (s === curSlide()) s.video.play().catch(() => {}); };
            s.video.addEventListener('canplay', retry, { once: true });
        });
    });
}

/* ===== SFX (recuperados del diseño anterior, ligados al toggle sound) ===== */

let audioCtx = null;

function playSfx(type) {
    if (!soundOn) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const def = {
            move:   { f0: 620, f1: 620,  dur: 0.045 },
            select: { f0: 740, f1: 1180, dur: 0.09 },
            back:   { f0: 520, f1: 260,  dur: 0.08 }
        }[type];
        if (!def) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(def.f0, t);
        osc.frequency.linearRampToValueAtTime(def.f1, t + def.dur);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + def.dur + 0.02);
    } catch (e) { /* sin audio, no pasa nada */ }
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

function playWipe() {
    wipe.classList.remove('run');
    void wipe.offsetWidth;
    wipe.classList.add('run');
    setTimeout(() => wipe.classList.remove('run'), 750);
}

/* ===== Vistas ===== */

function goHome(instant = false) {
    if (!instant) playWipe();
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
    playWipe();
    exitGestoria();
    mode = 'category';
    playlist = list;
    index = 0;
    updateModeUI();
    closeOverlays();
    showVideo(playlist[index], 1);
}

function goProject(project) {
    playWipe();
    exitGestoria();
    mode = 'single';
    playlist = [project];
    index = 0;
    updateModeUI();
    closeOverlays();
    showVideo(project, 1);
}

function goGestoria() {
    playWipe();
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

// iconos pixel dibujados a mano (heredan el color del texto)
const MENU_ICONS = {
    home: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v1h1v1h1v1h1v1h1v1h1v1h1v2h-2v6h-4v-4H7v4H3V9H1V7h1V6h1V5h1V4h1V3h1V2h1z"/></svg>',
    music: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v1h2v1h2v2h1v3h-2V6h-2V5H9v6h-1v2H7v1H4v-1H3v-2h1v-1h3z"/></svg>',
    brands: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 1h2v3h1v1h1v1h4v2h-1v1h-1v1h-1v4h-2v-1H9v-1H7v1H6v1H4V9H3V8H2V7H1V5h4V4h1V3h1z"/></svg>',
    about: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M7 0h2v4h1v1h1v1h4v2h-4v1h-1v1h-1v4H7v-4H6v-1H5V8H1V6h4V5h1V4h1z"/></svg>',
    gestoria: '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M6 2h4v2h4v3H9V6H7v1H2V4h4zM2 8h5v1h2V8h5v6H2z"/></svg>'
};

function buildMenu() {
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

    menuNav.appendChild(mkBtn('menu-item menu-link', 'home', () => goHome(), MENU_ICONS.home));

    DATA.categories.forEach(cat => {
        const list = allProjects.filter(p => p.category === cat.slug);
        if (!list.length) return;
        const group = document.createElement('div');
        group.className = 'menu-group';
        group.appendChild(mkBtn('menu-cat', cat.label, () => goCategory(cat.slug), MENU_ICONS[cat.slug]));
        list.forEach(p => group.appendChild(mkBtn('menu-item menu-proj', p.title, () => goProject(p))));
        menuNav.appendChild(group);
    });

    menuNav.appendChild(mkBtn('menu-item menu-link', (DATA.about && DATA.about.title) || 'about', openAbout, MENU_ICONS.about));
    if (DATA.gestoria) {
        menuNav.appendChild(mkBtn('menu-item menu-link', DATA.gestoria.label || 'gestoría', goGestoria, MENU_ICONS.gestoria));
    }
}

// about como ficha de personaje: retrato, clase y stats con barritas
function buildAbout() {
    aboutBody.innerHTML = '';
    const about = DATA.about || {};
    const card = document.createElement('div');
    card.className = 'stat-card';

    if (about.photo) {
        const img = document.createElement('img');
        img.className = 'stat-photo';
        img.src = about.photo;
        img.alt = about.name || 'la diega';
        card.appendChild(img);
    }

    const name = document.createElement('div');
    name.className = 'stat-name';
    name.textContent = about.name || 'la diega';
    card.appendChild(name);

    if (about.clase) {
        const cls = document.createElement('div');
        cls.className = 'stat-class';
        cls.textContent = about.clase;
        card.appendChild(cls);
    }

    if (about.stats && about.stats.length) {
        const rows = document.createElement('div');
        rows.className = 'stat-rows';
        about.stats.forEach((st, i) => {
            const row = document.createElement('div');
            row.className = 'stat-row';
            const label = document.createElement('span');
            label.className = 'stat-label';
            label.textContent = st.label;
            row.appendChild(label);
            const bar = document.createElement('span');
            bar.className = 'stat-bar';
            for (let c = 0; c < 10; c++) {
                const cell = document.createElement('span');
                cell.className = 'stat-cell' + (c < st.value ? ' filled' : '');
                if (c < st.value) cell.style.animationDelay = (i * 90 + c * 40) + 'ms';
                bar.appendChild(cell);
            }
            row.appendChild(bar);
            rows.appendChild(row);
        });
        card.appendChild(rows);
    }

    (about.text || []).forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        card.appendChild(p);
    });

    aboutBody.appendChild(card);
}

function openMenu() {
    menuOverlay.classList.remove('hidden');
    document.body.classList.add('overlay-open');
    playSfx('select');
    // relanzar la entrada escalonada de los items
    Array.from(menuNav.children).forEach((el, i) => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        el.style.animationDelay = (i * 45) + 'ms';
    });
    // seleccion inicial estilo consola
    const first = menuNav.querySelector('.menu-item');
    if (first) first.focus({ preventScroll: true });
}

function openAbout() {
    menuOverlay.classList.add('hidden');
    aboutOverlay.classList.remove('hidden');
    document.body.classList.add('overlay-open');
    // relanzar la animacion de las barritas
    aboutOverlay.querySelectorAll('.stat-cell.filled').forEach(c => {
        const d = c.style.animationDelay;
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = '';
        c.style.animationDelay = d;
    });
}

function closeOverlays() {
    menuOverlay.classList.add('hidden');
    aboutOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

/* ===== Controles ===== */

function updatePlayBtn() {
    playBtn.textContent = curSlide().video.paused ? 'play' : 'pause';
}

let hideTimer = null;

// sortea desde donde entra (prefijo 'i') o hacia donde se marcha (prefijo 'o') un control
function scatterVars(el, prefix) {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 180;
    el.style.setProperty('--' + prefix + 'x', Math.round(Math.cos(a) * d) + 'px');
    el.style.setProperty('--' + prefix + 'y', Math.round(Math.sin(a) * d) + 'px');
    el.style.setProperty('--' + prefix + 'r', Math.round(Math.random() * 30 - 15) + 'deg');
}

function showControls() {
    if (mode === 'gestoria') return;
    document.body.classList.add('booted');
    if (controls.classList.contains('faded')) {
        controls.querySelectorAll('.ctrl').forEach(el => scatterVars(el, 'i'));
        controls.classList.remove('faded');
    }
    if (!isTouch) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideControls, 2800);
    }
}

function hideControls() {
    if (controls.classList.contains('faded')) return;
    controls.querySelectorAll('.ctrl').forEach(el => scatterVars(el, 'o'));
    controls.classList.add('faded');
}

/* ===== Listeners ===== */

function bindUI() {
    // las tres esquinas abren el menu
    menuBtn.addEventListener('click', openMenu);
    brandBtn.addEventListener('click', openMenu);
    ficha.addEventListener('click', openMenu);

    // cerrar ventanas
    document.getElementById('menuClose').addEventListener('click', () => { playSfx('back'); closeOverlays(); });
    document.getElementById('aboutClose').addEventListener('click', () => { playSfx('back'); closeOverlays(); });

    // flechas laterales del carrusel
    document.getElementById('arrowPrev').addEventListener('click', () => { playSfx('move'); prev(); });
    document.getElementById('arrowNext').addEventListener('click', () => { playSfx('move'); next(); });

    // parallax de la ventana del menu siguiendo el raton
    if (!isTouch) {
        const menuWin = menuOverlay.querySelector('.game-window');
        menuOverlay.addEventListener('mousemove', e => {
            const r = menuWin.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            menuWin.style.transform =
                'perspective(900px) rotateX(' + (-dy * 4).toFixed(2) + 'deg)' +
                ' rotateY(' + (dx * 4).toFixed(2) + 'deg)';
        });
        menuOverlay.addEventListener('mouseleave', () => { menuWin.style.transform = ''; });
    }

    playBtn.addEventListener('click', () => {
        engaged = true;
        playSfx('select');
        const v = curSlide().video;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
    });

    autoBtn.addEventListener('click', () => {
        auto = !auto;
        playSfx('move');
        autoBtn.classList.toggle('on', auto);
    });

    soundBtn.addEventListener('click', () => {
        soundOn = !soundOn;
        playSfx('move');
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
        stage.addEventListener('click', () => {
            if (controls.classList.contains('faded')) showControls();
            else hideControls();
        });
    } else {
        window.addEventListener('pointermove', showControls);
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

    // si el navegador bloqueo el autoplay inicial (o el sonido), la primera interaccion lo arranca
    const resume = () => {
        const v = curSlide().video;
        if (soundOn) v.muted = false;
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
