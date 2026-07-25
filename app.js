// la diega — carrusel de video a pantalla completa

// Estado global
let DATA = null;
let allProjects = [];   // proyectos visibles con video, en el orden de data.json
let playlist = [];      // lista que alimenta el carrusel actual
let index = 0;
let mode = 'home';      // 'home' | 'category' | 'single' | 'gestoria'
let auto = true;        // avanzar solo al terminar cada video
let soundOn = true;     // intención: el usuario quiere sonido (el navegador lo bloquea hasta el primer gesto)
let audioUnlocked = false; // ¿ya hubo un gesto que permita audio? (política de autoplay del navegador)
let engaged = false;    // el usuario ha tocado este video → se ignora el bucle start/finish
let transitioning = false;
let seeking = false;

const isTouch = window.matchMedia('(pointer: coarse)').matches;

// dos slides que se alternan para el desplazamiento
let slides = [];        // [{root, video, bg, project}]
let cur = 0;

// Elementos
let stage, controls, playBtn, seekBar, autoBtn, soundBtn;
let menuBtn, brandBtn, ficha, menuOverlay, menuNav;
let gestoriaView, gestoriaPhoto, bigTitle, wipe;

async function init() {
    // no-store: que editar data.json se note sin pelearse con la cache
    const response = await fetch('data.json', { cache: 'no-store' });
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
    gestoriaView = document.getElementById('gestoriaView');
    gestoriaPhoto = document.getElementById('gestoriaPhoto');

    if (DATA.gestoria && DATA.gestoria.photo) gestoriaPhoto.src = DATA.gestoria.photo;

    setupSlides();
    buildMenu();
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
            syncSongChip();
            if (s.root.classList.contains('contain')) s.bg.play().catch(() => {});
        });
        s.video.addEventListener('pause', () => {
            updatePlayBtn();
            syncSongChip();
            s.bg.pause();
        });
        // mute/unmute venga de donde venga: el chip del about se entera
        s.video.addEventListener('volumechange', syncSongChip);
        return s;
    });
}

function curSlide() {
    return slides[cur];
}

// ¿debe sonar ahora mismo? sólo si el usuario quiere sonido Y ya hubo un gesto
function isAudible() { return soundOn && audioUnlocked; }

// refleja el estado real del sonido en los vídeos y en el botón (que así deja de mentir)
function applySound() {
    const on = isAudible();
    slides.forEach(s => { s.video.muted = !on; });
    if (soundBtn) soundBtn.classList.toggle('on', on);
}

// intenta reproducir; arranca en silencio hasta que un gesto desbloquea el audio
function tryPlay(s) {
    s.video.muted = !isAudible();
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
        seekBar.style.setProperty('--p', (seekBar.value / 10) + '%');
    }
    // bucle por defecto start→finish mientras nadie toca el video
    if (!engaged && p && p.finish && v.currentTime >= p.finish) {
        if (auto && mode !== 'single' && playlist.length > 1) next(true);
        else v.currentTime = p.start || 0;
    }
}

function onEnded(s) {
    if (s !== curSlide()) return;
    if (auto && mode !== 'single' && playlist.length > 1) {
        next(true);
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

// en el avance automatico, 1 de cada 4 veces el cambio va con barrido diagonal;
// con las flechas siempre desplazamiento lateral (la direccion es feedback)
function next(fromAuto) {
    if (transitioning || playlist.length < 2) return;
    index = (index + 1) % playlist.length; // al llegar al final vuelve al principio
    if (fromAuto && Math.random() < 0.25) {
        transitioning = true;
        playWipe();
        setTimeout(() => {
            transitioning = false;
            showVideo(playlist[index], 1, true);
        }, 250);
    } else {
        showVideo(playlist[index], 1);
    }
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
    hideControls();
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


/* ============================================================
   ABOUT: la ficha de la diega es un sintetizador de verdad.
   En reposo se ven los stats (musica / diseño sonoro / papeleo).
   Al pulsar "cambiar a oscilador" aparece el sinte: dos potes
   (tipo de onda y frecuencia) y cinco modulos que abren su propio
   modal (ADSR, chorus, flanger, reverb, arpegio), mas el volumen
   y el chip de la cancion del video.
   El overlay se inyecta desde aqui, no existe en index.html.
   ============================================================ */

const ABOUT_STATS = [
    { label: 'musica',        value: 10 },
    { label: 'diseño sonoro', value: 9  },
    { label: 'papeleo',       value: 2  }
];

const WAVES = [
    { type: 'sine',     label: 'seno' },
    { type: 'triangle', label: 'triangular' },
    { type: 'sawtooth', label: 'sierra' },
    { type: 'square',   label: 'cuadrada' }
];

// escala pentatonica: caiga donde caiga el pote, siempre suena afinado
const PENTA = [0, 3, 5, 7, 10];
function noteHz(step) {
    const s = Math.max(0, Math.min(10, Math.round(step)));
    return 110 * Math.pow(2, (PENTA[s % 5] + Math.floor(s / 5) * 12) / 12);
}
const NOTA_NOMBRE = ['la', 'do', 're', 'mi', 'sol'];
function noteLabel(step) {
    const s = Math.max(0, Math.min(10, Math.round(step)));
    return NOTA_NOMBRE[s % 5] + (2 + Math.floor(s / 5));
}

const ARP_PATRONES = [
    { label: 'subida', pasos: [0, 2, 4, 6] },
    { label: 'bajada', pasos: [6, 4, 2, 0] },
    { label: 'vaiven', pasos: [0, 2, 4, 2] },
    { label: 'salto',  pasos: [0, 4, 1, 5] }
];

// estado del sinte: lo editan los potes y los modales
const SYNTH = {
    wave: 0,
    note: 10,
    adsr:    { a: 0.01, d: 0.20, s: 0.55, r: 0.30 },
    chorus:  { rate: 1.2,  depth: 0.5, mix: 0 },
    flanger: { rate: 0.35, depth: 0.6, feedback: 0.45, mix: 0 },
    reverb:  { size: 1.8,  mix: 0 },
    arp:     { bpm: 300, patron: 0 }
};

// cada modulo edita su trozo de SYNTH desde un modal
const MODULES = {
    adsr: { label: 'ADSR', target: 'adsr', params: [
        { k: 'a', label: 'attack',  min: 0.001, max: 1.5, paso: 0.001, uds: 's' },
        { k: 'd', label: 'decay',   min: 0.01,  max: 1.5, paso: 0.01,  uds: 's' },
        { k: 's', label: 'sustain', min: 0,     max: 1,   paso: 0.01,  uds: '' },
        { k: 'r', label: 'release', min: 0.01,  max: 2,   paso: 0.01,  uds: 's' }
    ]},
    chorus: { label: 'chorus', target: 'chorus', params: [
        { k: 'rate',  label: 'velocidad',   min: 0.05, max: 6, paso: 0.05, uds: 'Hz' },
        { k: 'depth', label: 'profundidad', min: 0,    max: 1, paso: 0.01, uds: '' },
        { k: 'mix',   label: 'mezcla',      min: 0,    max: 1, paso: 0.01, uds: '' }
    ]},
    flanger: { label: 'flanger', target: 'flanger', params: [
        { k: 'rate',     label: 'velocidad',   min: 0.05, max: 4,   paso: 0.05, uds: 'Hz' },
        { k: 'depth',    label: 'profundidad', min: 0,    max: 1,   paso: 0.01, uds: '' },
        { k: 'feedback', label: 'realimenta',  min: 0,    max: 0.9, paso: 0.01, uds: '' },
        { k: 'mix',      label: 'mezcla',      min: 0,    max: 1,   paso: 0.01, uds: '' }
    ]},
    reverb: { label: 'reverb', target: 'reverb', params: [
        { k: 'size', label: 'tamaño', min: 0.2, max: 5, paso: 0.1,  uds: 's' },
        { k: 'mix',  label: 'mezcla', min: 0,   max: 1, paso: 0.01, uds: '' }
    ]},
    arpegio: { label: 'arpegio', target: 'arp', params: [
        { k: 'bpm',    label: 'velocidad', min: 60, max: 900, paso: 10, uds: 'bpm' },
        { k: 'patron', label: 'patrón',    min: 0,  max: 3,   paso: 1,  uds: '', lista: ARP_PATRONES }
    ]}
};

let oscOverlay = null;
let oscAudio = null;
let oscVol = 5;
let oscAnim = { on: false, raf: null, phase: 0 };
let oscArp = { on: false, timer: null, i: 0 };

/* ===== Audio ===== */

// impulso sintetico para el reverb: ruido que se apaga
function makeIR(ctx, segundos) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * segundos));
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    return buf;
}

/* cadena: osc → envolvente → seco + chorus + flanger + reverb → bus → master */
function oscAudioStart() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const ctx = audioCtx;

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        master.connect(analyser);          // el osciloscopio dibuja lo que suena de verdad

        const bus = ctx.createGain();
        bus.connect(master);

        const osc = ctx.createOscillator();
        osc.type = WAVES[SYNTH.wave].type;
        osc.frequency.value = noteHz(SYNTH.note);
        const env = ctx.createGain();
        const tone = ctx.createGain();
        tone.gain.value = 0.16;
        osc.connect(env); env.connect(tone);
        osc.start();

        tone.connect(bus);                 // seco

        const chDelay = ctx.createDelay(0.1);
        chDelay.delayTime.value = 0.026;
        const chLfo = ctx.createOscillator();
        chLfo.frequency.value = SYNTH.chorus.rate;
        const chDepth = ctx.createGain();
        chLfo.connect(chDepth); chDepth.connect(chDelay.delayTime); chLfo.start();
        const chWet = ctx.createGain();
        chWet.gain.value = 0;
        tone.connect(chDelay); chDelay.connect(chWet); chWet.connect(bus);

        const flDelay = ctx.createDelay(0.05);
        flDelay.delayTime.value = 0.004;
        const flLfo = ctx.createOscillator();
        flLfo.frequency.value = SYNTH.flanger.rate;
        const flDepth = ctx.createGain();
        flLfo.connect(flDepth); flDepth.connect(flDelay.delayTime); flLfo.start();
        const flFb = ctx.createGain();
        flFb.gain.value = 0;
        flDelay.connect(flFb); flFb.connect(flDelay);
        const flWet = ctx.createGain();
        flWet.gain.value = 0;
        tone.connect(flDelay); flDelay.connect(flWet); flWet.connect(bus);

        const conv = ctx.createConvolver();
        conv.buffer = makeIR(ctx, SYNTH.reverb.size);
        const rvWet = ctx.createGain();
        rvWet.gain.value = 0;
        tone.connect(conv); conv.connect(rvWet); rvWet.connect(bus);

        oscAudio = { ctx, osc, env, tone, master, bus, analyser,
                     chLfo, chDepth, chWet, flLfo, flDepth, flFb, flWet, conv, rvWet };
        oscAudioApply();
    } catch (e) { oscAudio = null; }
}

function oscAudioStop() {
    oscArpStop();
    if (!oscAudio) return;
    try {
        const t = oscAudio.ctx.currentTime;
        oscAudio.master.gain.cancelScheduledValues(t);
        oscAudio.master.gain.setTargetAtTime(0, t, 0.02);
        oscAudio.osc.stop(t + 0.2);
        oscAudio.chLfo.stop(t + 0.2);
        oscAudio.flLfo.stop(t + 0.2);
    } catch (e) { /* ya parado */ }
    oscAudio = null;
}

// vuelca SYNTH y el volumen a los nodos
function oscAudioApply() {
    if (!oscAudio) return;
    const a = oscAudio, t = a.ctx.currentTime, S = SYNTH;
    a.osc.type = WAVES[S.wave].type;
    if (!oscArp.on) a.osc.frequency.setTargetAtTime(noteHz(S.note), t, 0.02);
    a.chLfo.frequency.setTargetAtTime(S.chorus.rate, t, 0.05);
    a.chDepth.gain.setTargetAtTime(S.chorus.depth * 0.006, t, 0.05);
    a.chWet.gain.setTargetAtTime(S.chorus.mix, t, 0.05);
    a.flLfo.frequency.setTargetAtTime(S.flanger.rate, t, 0.05);
    a.flDepth.gain.setTargetAtTime(S.flanger.depth * 0.003, t, 0.05);
    a.flFb.gain.setTargetAtTime(S.flanger.feedback * 0.85, t, 0.05);
    a.flWet.gain.setTargetAtTime(S.flanger.mix, t, 0.05);
    a.rvWet.gain.setTargetAtTime(S.reverb.mix, t, 0.05);
    a.master.gain.setTargetAtTime((oscVol / 8) * 0.5, t, 0.03);
}

function oscReverbRebuild() {
    if (!oscAudio) return;
    try { oscAudio.conv.buffer = makeIR(oscAudio.ctx, SYNTH.reverb.size); } catch (e) { /* nada */ }
}

/* arpegiador: recorre el patron y cada nota pasa por la envolvente ADSR */
function oscArpStop() {
    if (oscArp.timer) clearTimeout(oscArp.timer);
    oscArp.timer = null;
    oscArp.on = false;
    if (oscAudio) {
        const t = oscAudio.ctx.currentTime;
        oscAudio.env.gain.cancelScheduledValues(t);
        oscAudio.env.gain.setTargetAtTime(1, t, 0.03);
    }
}

function oscArpStart() {
    oscArp.on = true;
    oscArp.i = 0;
    const paso = () => {
        if (!oscAudio) return;
        const pat = ARP_PATRONES[SYNTH.arp.patron] || ARP_PATRONES[0];
        const n = Math.max(0, Math.min(10, SYNTH.note - 4 + pat.pasos[oscArp.i % pat.pasos.length]));
        const t = oscAudio.ctx.currentTime;
        const e = SYNTH.adsr;
        const g = oscAudio.env.gain;
        oscAudio.osc.frequency.setValueAtTime(noteHz(n), t);
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.0015, t);
        g.exponentialRampToValueAtTime(1, t + e.a);
        g.exponentialRampToValueAtTime(Math.max(0.0015, e.s), t + e.a + e.d);
        g.exponentialRampToValueAtTime(0.0015, t + e.a + e.d + e.r);
        oscArp.i++;
        oscArp.timer = setTimeout(paso, Math.max(60, 60000 / SYNTH.arp.bpm));
    };
    paso();
}

/* ===== Osciloscopio ===== */

function oscAnimStop() {
    if (oscAnim.raf) cancelAnimationFrame(oscAnim.raf);
    oscAnim.raf = null;
    oscAnim.on = false;
    oscAudioStop();
}

function oscAnimStart(ov) {
    const cv = ov.querySelector('.oscab-scope');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const amarillo = (getComputedStyle(document.documentElement).getPropertyValue('--highlight') || '#ffe95c').trim();
    const datos = new Float32Array(2048);
    const draw = () => {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = amarillo;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (oscAudio && oscAudio.analyser) {
            oscAudio.analyser.getFloatTimeDomainData(datos);
            // enganchar en un cruce por cero para que la onda no baile
            let ini = 0;
            for (let i = 1; i < datos.length / 2; i++) {
                if (datos[i - 1] <= 0 && datos[i] > 0) { ini = i; break; }
            }
            const n = Math.floor(datos.length / 2);
            for (let x = 0; x <= W; x++) {
                const v = datos[ini + Math.floor((x / W) * n)] || 0;
                const y = H / 2 - Math.max(-1, Math.min(1, v * 6)) * (H / 2 - 6);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
        } else {
            oscAnim.phase += 0.08;
            for (let x = 0; x <= W; x += 2) {
                const y = H / 2 - Math.sin((x / W) * Math.PI * 6 + oscAnim.phase) * (H / 2 - 6);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        oscAnim.raf = requestAnimationFrame(draw);
    };
    draw();
}

/* ===== Render ===== */

function potAngulo(p) { return -135 + p * 270; }

function renderAbout(about) {
    let wave = '';
    for (let i = 0; i < 28; i++) wave += '<span class="oscab-bar" style="animation-delay:' + (i * 55) + 'ms"></span>';

    const stats = ABOUT_STATS.map(st => {
        const pct = (st.value * 10) + '%';
        return '<div class="oscab-fader">' +
            '<span class="oscab-track"><span class="oscab-fill" style="height:' + pct + '"></span>' +
            '<span class="oscab-knob" style="bottom:' + pct + '"></span></span>' +
            '<span class="oscab-flbl">' + st.label + '</span></div>';
    }).join('');

    const pot = (k, label) =>
        '<div class="oscab-pot" data-p="' + k + '">' +
            '<span class="oscab-dial"><span class="oscab-tick"></span></span>' +
            '<span class="oscab-plbl">' + label + '</span>' +
            '<span class="oscab-pval"></span>' +
        '</div>';

    const mods = Object.keys(MODULES).map(k =>
        '<button class="oscab-mod" data-m="' + k + '">' + MODULES[k].label + '</button>').join('');

    let vol = '';
    for (let i = 0; i < 8; i++) vol += '<span class="oscab-vseg"></span>';

    return '<div class="oscab">' +
        '<div class="oscab-wave">' + wave + '</div>' +
        '<canvas class="oscab-scope" width="640" height="140"></canvas>' +
        '<div class="oscab-head">' +
            '<div class="oscab-name">' + (about.name || 'la diega') + '</div>' +
            '<div class="oscab-role">' + (about.clase || '') + '</div>' +
        '</div>' +
        '<div class="oscab-desk">' + stats + '</div>' +
        '<div class="oscab-pots">' + pot('wave', 'tipo de onda') + pot('note', 'frecuencia') + '</div>' +
        '<div class="oscab-mods">' + mods + '</div>' +
        '<div class="oscab-vol">' +
            '<button class="oscab-vbtn" data-d="-1" aria-label="bajar volumen">−</button>' +
            '<span class="oscab-vmeter">' + vol + '</span>' +
            '<button class="oscab-vbtn" data-d="1" aria-label="subir volumen">+</button>' +
            '<button class="oscab-chip oscab-song">canción</button>' +
        '</div>' +
        '<button class="oscab-osc-btn">cambiar a oscilador</button>' +
    '</div>' +
    '<div class="oscab-modal hidden">' +
        '<div class="oscab-modal-box">' +
            '<div class="oscab-modal-head"><span class="oscab-modal-title"></span>' +
                '<button class="oscab-modal-close" aria-label="cerrar">×</button></div>' +
            '<div class="oscab-modal-body"></div>' +
        '</div>' +
    '</div>';
}

/* ===== Modales de los modulos ===== */

function fmtParam(p, v) {
    if (p.lista) return p.lista[Math.round(v)].label;
    if (p.uds === 'bpm') return Math.round(v) + ' bpm';
    if (p.uds === 's') return (v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s');
    if (p.uds === 'Hz') return v.toFixed(2) + ' Hz';
    return Math.round(v * 100) + '%';
}

// dibuja la envolvente y reparte las leyendas A D S R debajo, a escala
function pintaAdsr(ov) {
    const svg = ov.querySelector('.oscab-adsr-line');
    const leg = ov.querySelector('.oscab-adsr-leg');
    if (!svg || !leg) return;
    const e = SYNTH.adsr;
    const hold = 0.5;
    const total = e.a + e.d + hold + e.r;
    const W = 260, H = 80;
    const xa = (e.a / total) * W;
    const xd = (e.d / total) * W;
    const xs = (hold / total) * W;
    const ys = H - e.s * H;
    svg.setAttribute('points',
        '0,' + H + ' ' + xa.toFixed(1) + ',0 ' +
        (xa + xd).toFixed(1) + ',' + ys.toFixed(1) + ' ' +
        (xa + xd + xs).toFixed(1) + ',' + ys.toFixed(1) + ' ' + W + ',' + H);
    const anchos = [e.a, e.d, hold, e.r].map(v => (v / total * 100).toFixed(2) + '%');
    [...leg.children].forEach((c, i) => { c.style.width = anchos[i]; });
}

function moduleBody(key) {
    const m = MODULES[key];
    const st = SYNTH[m.target];
    let html = '';
    if (key === 'adsr') {
        html += '<svg class="oscab-adsr" viewBox="0 0 260 80" preserveAspectRatio="none">' +
                '<polyline class="oscab-adsr-line" points=""/></svg>' +
                '<div class="oscab-adsr-leg"><span>A</span><span>D</span><span>S</span><span>R</span></div>';
    }
    html += m.params.map(p =>
        '<label class="oscab-prow">' +
            '<span class="oscab-pname">' + p.label + '</span>' +
            '<input class="oscab-prange" type="range" data-k="' + p.k + '" min="' + p.min +
                '" max="' + p.max + '" step="' + p.paso + '" value="' + st[p.k] + '">' +
            '<span class="oscab-pnum">' + fmtParam(p, st[p.k]) + '</span>' +
        '</label>').join('');
    return html;
}

function openModule(ov, key) {
    const m = MODULES[key];
    const modal = ov.querySelector('.oscab-modal');
    modal.querySelector('.oscab-modal-title').textContent = m.label;
    modal.querySelector('.oscab-modal-body').innerHTML = moduleBody(key);
    modal.classList.remove('hidden');
    if (key === 'adsr') pintaAdsr(ov);
    playSfx('select');

    modal.querySelectorAll('.oscab-prange').forEach(inp => {
        inp.addEventListener('input', () => {
            const p = m.params.find(x => x.k === inp.dataset.k);
            const v = parseFloat(inp.value);
            SYNTH[m.target][p.k] = v;
            inp.parentElement.querySelector('.oscab-pnum').textContent = fmtParam(p, v);
            if (key === 'adsr') pintaAdsr(ov);
            if (key === 'reverb' && p.k === 'size') oscReverbRebuild();
            oscAudioApply();
        });
    });
}

function closeModule(ov) {
    const modal = ov.querySelector('.oscab-modal');
    if (modal) modal.classList.add('hidden');
}

/* ===== Cableado ===== */

function pintaPotes(ov) {
    const p = ov.querySelector('.oscab-pot[data-p="wave"]');
    const n = ov.querySelector('.oscab-pot[data-p="note"]');
    if (p) {
        p.querySelector('.oscab-dial').style.setProperty('--a', potAngulo(SYNTH.wave / (WAVES.length - 1)) + 'deg');
        p.querySelector('.oscab-pval').textContent = WAVES[SYNTH.wave].label;
    }
    if (n) {
        n.querySelector('.oscab-dial').style.setProperty('--a', potAngulo(SYNTH.note / 10) + 'deg');
        n.querySelector('.oscab-pval').textContent = noteLabel(SYNTH.note) + ' · ' + Math.round(noteHz(SYNTH.note)) + ' Hz';
    }
}

// el chip de la cancion siempre refleja lo que suena de verdad
function syncSongChip() {
    if (!oscOverlay || oscOverlay.classList.contains('hidden')) return;
    const chip = oscOverlay.querySelector('.oscab-song');
    if (chip) chip.classList.toggle('on', !!slides.length && !curSlide().video.muted && !curSlide().video.paused);
}

function wireAbout(ov) {
    const root = ov.querySelector('.oscab');
    const btn = ov.querySelector('.oscab-osc-btn');

    const setLabels = osc => {
        ov.querySelectorAll('.oscab-flbl').forEach((l, i) => {
            if (ABOUT_STATS[i]) l.textContent = ABOUT_STATS[i].label;
        });
        if (osc) pintaPotes(ov);
    };

    const paintVol = () => ov.querySelectorAll('.oscab-vseg').forEach((s, i) => s.classList.toggle('on', i < oscVol));
    paintVol();
    pintaPotes(ov);
    syncSongChip();

    btn.addEventListener('click', () => {
        playSfx('move');
        if (oscAnim.on) {
            oscAnimStop();
            root.classList.remove('oscillator');
            btn.textContent = 'cambiar a oscilador';
            closeModule(ov);
            ov.querySelectorAll('.oscab-mod.on').forEach(b => b.classList.remove('on'));
        } else {
            oscAnim.on = true;
            root.classList.add('oscillator');
            btn.textContent = 'volver a la onda';
            setLabels(true);
            oscAudioStart();
            oscAnimStart(ov);
            syncSongChip();
        }
    });

    // cada modulo abre su modal; el arpegio ademas arranca/para
    ov.querySelectorAll('.oscab-mod').forEach(b => {
        b.addEventListener('click', () => {
            const key = b.dataset.m;
            if (key === 'arpegio') {
                if (oscArp.on) oscArpStop();
                else if (oscAudio) oscArpStart();
                b.classList.toggle('on', oscArp.on);
            }
            openModule(ov, key);
        });
    });

    const modal = ov.querySelector('.oscab-modal');
    modal.querySelector('.oscab-modal-close').addEventListener('click', () => { playSfx('back'); closeModule(ov); });
    modal.addEventListener('click', e => { if (e.target === modal) { playSfx('back'); closeModule(ov); } });

    ov.querySelectorAll('.oscab-vbtn').forEach(b => {
        b.addEventListener('click', () => {
            oscVol = Math.max(0, Math.min(8, oscVol + (+b.dataset.d)));
            paintVol();
            oscAudioApply();
            playSfx('move');
        });
    });

    // mutear / recuperar la cancion del video que suena detras
    const songBtn = ov.querySelector('.oscab-song');
    songBtn.addEventListener('click', () => {
        const v = curSlide().video;
        const encender = v.muted || v.paused;
        // el chip manda: applySound() deja los videos y el boton del home coherentes
        audioUnlocked = true;
        soundOn = encender;
        applySound();
        if (encender && v.paused && mode !== 'gestoria') v.play().catch(() => {});
        syncSongChip();
        playSfx('move');
    });

    // potes: arrastrar arriba/abajo
    ov.querySelectorAll('.oscab-pot').forEach(p => {
        const key = p.dataset.p;
        const max = key === 'wave' ? WAVES.length - 1 : 10;
        let arrastra = false, y0 = 0, v0 = 0;
        const dial = p.querySelector('.oscab-dial');
        dial.addEventListener('pointerdown', e => {
            arrastra = true; y0 = e.clientY; v0 = SYNTH[key];
            try { dial.setPointerCapture(e.pointerId); } catch (_) {}
        });
        dial.addEventListener('pointermove', e => {
            if (!arrastra) return;
            const v = Math.max(0, Math.min(max, Math.round(v0 + (y0 - e.clientY) / 18)));
            if (v !== SYNTH[key]) { SYNTH[key] = v; pintaPotes(ov); oscAudioApply(); }
        });
        dial.addEventListener('pointerup', () => { arrastra = false; });
        dial.addEventListener('pointercancel', () => { arrastra = false; });
    });
}

/* ===== Overlay ===== */

function ensureOscOverlay() {
    if (oscOverlay) return oscOverlay;
    oscOverlay = document.createElement('div');
    oscOverlay.className = 'overlay osc-about hidden';
    oscOverlay.innerHTML =
        '<button class="overlay-close" aria-label="cerrar">×</button>' +
        '<div class="osc-inner"></div>';
    document.body.appendChild(oscOverlay);
    oscOverlay.addEventListener('click', e => {
        if (e.target === oscOverlay) { playSfx('back'); closeOscAbout(); }
    });
    oscOverlay.querySelector('.overlay-close')
        .addEventListener('click', () => { playSfx('back'); closeOscAbout(); });
    document.addEventListener('keydown', e => {
        if (!oscOverlay || oscOverlay.classList.contains('hidden')) return;
        if (e.key !== 'Escape') return;
        const modal = oscOverlay.querySelector('.oscab-modal');
        if (modal && !modal.classList.contains('hidden')) closeModule(oscOverlay);
        else closeOscAbout();
    });
    return oscOverlay;
}

function closeOscAbout() {
    if (!oscOverlay) return;
    oscAnimStop();
    oscOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

function openOscAbout() {
    const ov = ensureOscOverlay();
    if (menuOverlay) menuOverlay.classList.add('hidden');
    ov.className = 'overlay osc-about';
    ov.querySelector('.osc-inner').innerHTML = renderAbout(DATA.about || {});
    oscAnimStop();
    wireAbout(ov);
    document.body.classList.add('overlay-open');
    playSfx('select');
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
    // seleccion inicial estilo consola
    const first = menuNav.querySelector('.menu-item');
    if (first) first.focus({ preventScroll: true });
}

function openAbout() {
    openOscAbout();
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

function closeOverlays() {
    hideOverlay(menuOverlay);
    closeOscAbout();
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
    if (mode === 'gestoria') return;
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

function hideControls() {
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
    // las tres esquinas abren el menu (la ficha ya no es <button> para poder
    // llevar las flechitas del contador dentro; Enter la mantiene accesible)
    menuBtn.addEventListener('click', openMenu);
    brandBtn.addEventListener('click', openMenu);
    ficha.addEventListener('click', openMenu);
    ficha.addEventListener('keydown', e => { if (e.key === 'Enter') openMenu(); });

    // cerrar ventanas
    document.getElementById('menuClose').addEventListener('click', () => { playSfx('back'); closeOverlays(); });

    // flechas laterales del carrusel
    document.getElementById('arrowPrev').addEventListener('click', () => { playSfx('move'); buzz(); prev(); });
    document.getElementById('arrowNext').addEventListener('click', () => { playSfx('move'); buzz(); next(); });

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
        // primer gesto sobre el botón: desbloquea y enciende (no alterna, si no se apagaría al instante)
        if (!audioUnlocked) { audioUnlocked = true; soundOn = true; }
        else soundOn = !soundOn;
        applySound();
        playSfx('move');
        const v = curSlide().video;
        if (soundOn && v.paused && !engaged && mode !== 'gestoria') v.play().catch(() => {});
    });

    seekBar.addEventListener('input', () => {
        seeking = true;
        engaged = true;
        seekBar.style.setProperty('--p', (seekBar.value / 10) + '%');
        const v = curSlide().video;
        if (v.duration) v.currentTime = (seekBar.value / 1000) * v.duration;
    });
    seekBar.addEventListener('change', () => { seeking = false; });

    // la telita: hover en escritorio; en movil, tap-zones laterales para navegar
    // y el centro enseña/esconde los controles
    if (isTouch) {
        stage.addEventListener('click', e => {
            const w = window.innerWidth;
            const canNav = mode !== 'single' && playlist.length > 1;
            if (canNav && e.clientX < w * 0.3) { playSfx('move'); buzz(); prev(); }
            else if (canNav && e.clientX > w * 0.7) { playSfx('move'); buzz(); next(); }
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
        if (e.key === 'Escape') { closeOverlays(); return; }
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'BUTTON') return;
        const overlayOpen = !menuOverlay.classList.contains('hidden') ||
            (oscOverlay && !oscOverlay.classList.contains('hidden'));
        if (overlayOpen || mode === 'gestoria') return;
        if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
        else if (e.key.toLowerCase() === 'm') soundBtn.click();
    });

    window.addEventListener('resize', () => slides.forEach(fitSlide));

    // política de autoplay: el audio no puede sonar hasta el primer gesto del usuario.
    // el primer gesto EN CUALQUIER PARTE desbloquea y enciende el sonido; si el gesto es
    // sobre el botón de sonido, lo gestiona su propio handler (para no apagarlo al instante).
    const unlock = (e) => {
        if (audioUnlocked) return;
        if (e && e.target && e.target.closest && e.target.closest('#soundBtn')) return;
        audioUnlocked = true;
        applySound();
        const v = curSlide().video;
        if (v.paused && !engaged && mode !== 'gestoria') v.play().catch(() => {});
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    // el navegador pausa los videos al ocultar la pestaña: reanudar al volver
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resume();
    });
}

document.addEventListener('DOMContentLoaded', init);
