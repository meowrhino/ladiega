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
   ABOUT: ficha de la diega que se convierte en un sintetizador.
   En reposo son stats (musica / diseño sonoro / papeleo); al pulsar
   "cambiar a oscilador" los mismos faders pasan a ser los controles
   reales del sonido (nota / timbre / eco) y la onda se puede tocar.
   El overlay se inyecta desde aquí, no existe en index.html.
   ============================================================ */
let oscOverlay = null;

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
        if (e.key === 'Escape') { closeOscAbout(); return; }
        // teclado: 7 teclas repartidas por la pentatónica
        if (!oscAnim.on) return;
        const i = 'zxcvbnm'.indexOf(e.key.toLowerCase());
        if (i === -1) return;
        e.preventDefault();
        oscSetFader(oscOverlay, 'freq', (i * 10) / 6);
        oscAudioApply(oscOverlay);
    });
    return oscOverlay;
}

function closeOscAbout() {
    if (!oscOverlay) return;
    oscAnimStop();
    oscOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

// parámetros: en reposo son la "ficha", en modo oscilador son los controles reales
const OSC_PARAMS = [
    { label: 'musica',        oscLabel: 'nota',  value: 10, osc: 'freq'  },
    { label: 'diseño sonoro', oscLabel: 'timbre', value: 9, osc: 'shape' },
    { label: 'papeleo',       oscLabel: 'eco',   value: 2,  osc: 'echo'  }
];

// oscilador en vivo: la onda de arriba se dibuja a partir de los 3 faders
let oscAnim = { on: false, raf: null, phase: 0 };
let oscAudio = null;   // nodos de Web Audio mientras suena
let oscVol = 5;        // 0..8, volumen del oscilador

// misma curva que dibuja el canvas: tanh(sin) → de seno redondeado a casi cuadrada
function oscTanhCurve(drive) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh((-1 + (2 * i) / (n - 1)) * drive);
    return c;
}

// escala pentatónica: caiga donde caiga el fader, siempre suena afinado.
// convierte el cacharro en algo que se puede tocar en vez de una sirena.
const OSC_PENTA = [0, 3, 5, 7, 10];
function oscNoteHz(step) {
    const s = Math.max(0, Math.min(10, Math.round(step)));
    const semi = OSC_PENTA[s % 5] + Math.floor(s / 5) * 12;
    return 110 * Math.pow(2, semi / 12);   // de La2 hacia arriba, ~2 octavas
}

// mueve un fader por código (lo usan el arrastre y la onda tocable)
function oscSetFader(ov, role, val) {
    const f = ov.querySelector('.oscab-fader[data-osc="' + role + '"]');
    if (!f) return;
    const v = Math.max(0, Math.min(10, Math.round(val)));
    f.dataset.val = v;
    const pct = (v * 10) + '%';
    const fill = f.querySelector('.oscab-fill');
    fill.style.animation = 'none';
    fill.style.height = pct;
    f.querySelector('.oscab-knob').style.bottom = pct;
}

/* cadena: 2 osciladores (uno desafinado = más gordo) → tanh → filtro → amp
   → seco + eco realimentado → master. El eco es lo que aporta "papeleo". */
function oscAudioStart() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const ctx = audioCtx;

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc.type = osc2.type = 'sine';
        osc2.detune.value = 9;            // coro sutil, quita el pitido plano

        const shaper = ctx.createWaveShaper();
        shaper.curve = oscTanhCurve(1);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 6;               // resonancia: el "wah" clásico

        const amp = ctx.createGain();
        amp.gain.value = 1;               // el arpegiador lo usa de envolvente

        const tone = ctx.createGain();
        tone.gain.value = 0.16;

        osc.connect(shaper); osc2.connect(shaper);
        shaper.connect(filter); filter.connect(amp); amp.connect(tone);
        tone.connect(master);
        osc.start(); osc2.start();

        // eco con realimentación
        const delay = ctx.createDelay(1.5);
        delay.delayTime.value = 0.26;
        const feedback = ctx.createGain();
        feedback.gain.value = 0;
        const wet = ctx.createGain();
        wet.gain.value = 0;
        tone.connect(delay);
        delay.connect(feedback); feedback.connect(delay);
        delay.connect(wet); wet.connect(master);

        oscAudio = { ctx, osc, osc2, shaper, filter, amp, master, delay, feedback, wet };
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
        oscAudio.osc2.stop(t + 0.2);
    } catch (e) { /* ya parado */ }
    oscAudio = null;
}

function oscGetP(ov, role) {
    const f = ov.querySelector('.oscab-fader[data-osc="' + role + '"]');
    return f ? (+f.dataset.val) / 10 : 0.5;
}

// vuelca los faders (y el volumen) a los nodos de audio
function oscAudioApply(ov) {
    if (!oscAudio) return;
    const t = oscAudio.ctx.currentTime;
    const shape = oscGetP(ov, 'shape');
    const echo = oscGetP(ov, 'echo');

    if (!oscArp.on) {
        const hz = oscNoteHz(oscGetP(ov, 'freq') * 10);
        oscAudio.osc.frequency.setTargetAtTime(hz, t, 0.02);
        oscAudio.osc2.frequency.setTargetAtTime(hz, t, 0.02);
    }
    // timbre = forma de onda + brillo del filtro, los dos a la vez
    oscAudio.shaper.curve = oscTanhCurve(1 + shape * 3);
    oscAudio.filter.frequency.setTargetAtTime(250 * Math.pow(16, shape), t, 0.03);
    oscAudio.feedback.gain.setTargetAtTime(echo * 0.62, t, 0.03);
    oscAudio.wet.gain.setTargetAtTime(echo * 0.85, t, 0.03);
    oscAudio.master.gain.setTargetAtTime((oscVol / 8) * 0.5, t, 0.03);
}

/* arpegiador: recorre la pentatónica sola y marca el ritmo con la envolvente */
let oscArp = { on: false, timer: null, i: 0 };

function oscArpStop() {
    if (oscArp.timer) clearInterval(oscArp.timer);
    oscArp.timer = null;
    oscArp.on = false;
    if (oscAudio) {
        const t = oscAudio.ctx.currentTime;
        oscAudio.amp.gain.cancelScheduledValues(t);
        oscAudio.amp.gain.setTargetAtTime(1, t, 0.03);
    }
}

function oscArpStart(ov) {
    oscArp.on = true;
    oscArp.i = 0;
    const patron = [0, 2, 4, 2, 5, 2];
    const paso = () => {
        if (!oscAudio) return;
        const base = +ov.querySelector('.oscab-fader[data-osc="freq"]').dataset.val;
        const n = Math.max(0, Math.min(10, base - 4 + patron[oscArp.i % patron.length]));
        const t = oscAudio.ctx.currentTime;
        const hz = oscNoteHz(n);
        oscAudio.osc.frequency.setValueAtTime(hz, t);
        oscAudio.osc2.frequency.setValueAtTime(hz, t);
        oscAudio.amp.gain.cancelScheduledValues(t);
        oscAudio.amp.gain.setValueAtTime(0.001, t);
        oscAudio.amp.gain.exponentialRampToValueAtTime(1, t + 0.012);
        oscAudio.amp.gain.exponentialRampToValueAtTime(0.02, t + 0.17);
        oscArp.i++;
    };
    paso();
    oscArp.timer = setInterval(paso, 190);
}

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
    const yellow = (getComputedStyle(document.documentElement).getPropertyValue('--highlight') || '#ffe95c').trim();
    // una pasada de la onda; el eco se pinta como repeticiones desvaídas detrás
    const traza = (freq, shape, desfase, alpha, ancho) => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
            const theta = (x / W) * freq * Math.PI * 2 + oscAnim.phase - desfase;
            const v = Math.tanh(Math.sin(theta) * (1 + shape * 3));
            const y = H / 2 - v * (H / 2 - 6);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineWidth = ancho;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
    const draw = () => {
        const nota = oscGetP(ov, 'freq');
        const shape = oscGetP(ov, 'shape');
        const echo = oscGetP(ov, 'echo');
        const freq = 1 + nota * 3;          // nº de ciclos visibles
        oscAnim.phase += 0.05 + nota * 0.06;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = yellow;
        ctx.lineJoin = 'round';
        for (let e = 3; e >= 1; e--) {      // las colas del eco, de atrás a delante
            const a = echo * Math.pow(0.55, e);
            if (a > 0.02) traza(freq, shape, e * 0.9, a, 2);
        }
        traza(freq, shape, 0, 1, 3);
        oscAnim.raf = requestAnimationFrame(draw);
    };
    draw();
}
function wireOscAbout(ov) {
    const btn = ov.querySelector('.oscab-osc-btn');
    const root = ov.querySelector('.oscab');
    const songBtn = ov.querySelector('.oscab-song');

    // en modo oscilador los faders enseñan lo que hacen de verdad
    const setLabels = osc => {
        ov.querySelectorAll('.oscab-fader').forEach((f, i) => {
            const p = OSC_PARAMS[i];
            if (p) f.querySelector('.oscab-flbl').textContent = osc ? p.oscLabel : p.label;
        });
    };

    const paintVol = () => {
        ov.querySelectorAll('.oscab-vseg').forEach((s, i) => s.classList.toggle('on', i < oscVol));
    };
    paintVol();

    const syncSong = () => {
        if (songBtn) songBtn.classList.toggle('on', !curSlide().video.muted);
    };
    syncSong();

    if (btn && root) btn.addEventListener('click', () => {
        playSfx('move');
        if (oscAnim.on) {
            oscAnimStop();
            root.classList.remove('oscillator');
            btn.textContent = 'cambiar a oscilador';
            setLabels(false);
            const a = ov.querySelector('.oscab-arp');
            if (a) a.classList.remove('on');
        } else {
            oscAnim.on = true;
            root.classList.add('oscillator');
            btn.textContent = 'volver a la onda';
            setLabels(true);
            oscAnimStart(ov);
            oscAudioStart();
            oscAudioApply(ov);
            syncSong();   // el piloto enseña si la canción suena o no, sin tocarla
        }
    });

    // arpegiador: toca solo un patrón de la pentatónica
    const arpBtn = ov.querySelector('.oscab-arp');
    if (arpBtn) arpBtn.addEventListener('click', () => {
        playSfx('move');
        if (oscArp.on) oscArpStop();
        else if (oscAudio) oscArpStart(ov);
        arpBtn.classList.toggle('on', oscArp.on);
    });

    // volumen del oscilador
    ov.querySelectorAll('.oscab-vbtn').forEach(b => {
        b.addEventListener('click', () => {
            oscVol = Math.max(0, Math.min(8, oscVol + (+b.dataset.d)));
            paintVol();
            oscAudioApply(ov);
            playSfx('move');
        });
    });

    // mutear / recuperar la canción del vídeo que suena detrás
    if (songBtn) songBtn.addEventListener('click', () => {
        const v = curSlide().video;
        const turnOn = v.muted;
        if (turnOn) { audioUnlocked = true; soundOn = true; }
        v.muted = !turnOn;
        if (turnOn && v.paused && !engaged && mode !== 'gestoria') v.play().catch(() => {});
        syncSong();
        playSfx('move');
    });

    // faders arrastrables: mueven los parámetros del oscilador en vivo
    ov.querySelectorAll('.oscab-fader').forEach(f => {
        const track = f.querySelector('.oscab-track');
        const role = f.dataset.osc;
        const setFromY = clientY => {
            const r = track.getBoundingClientRect();
            const p = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
            oscSetFader(ov, role, p * 10);
            oscAudioApply(ov);
        };
        let drag = false;
        track.addEventListener('pointerdown', e => { drag = true; try { track.setPointerCapture(e.pointerId); } catch (_) {} setFromY(e.clientY); });
        track.addEventListener('pointermove', e => { if (drag) setFromY(e.clientY); });
        track.addEventListener('pointerup', () => { drag = false; });
        track.addEventListener('pointercancel', () => { drag = false; });
    });

    // la onda se toca: arrastrar por encima cambia nota (x) y forma (y)
    const scope = ov.querySelector('.oscab-scope');
    if (scope) {
        const playAt = (cx, cy) => {
            const r = scope.getBoundingClientRect();
            const px = Math.max(0, Math.min(1, (cx - r.left) / r.width));
            const py = Math.max(0, Math.min(1, 1 - (cy - r.top) / r.height));
            oscSetFader(ov, 'freq', px * 10);
            oscSetFader(ov, 'shape', py * 10);
            oscAudioApply(ov);
        };
        let playing = false;
        scope.addEventListener('pointerdown', e => {
            playing = true;
            try { scope.setPointerCapture(e.pointerId); } catch (_) {}
            playAt(e.clientX, e.clientY);
        });
        scope.addEventListener('pointermove', e => { if (playing) playAt(e.clientX, e.clientY); });
        scope.addEventListener('pointerup', () => { playing = false; });
        scope.addEventListener('pointercancel', () => { playing = false; });
    }
}

// mesa de mezclas: onda arriba (barras en reposo, osciloscopio en vivo) + faders
function renderOscAbout(about) {
        let wave = '';
        for (let i = 0; i < 28; i++) wave += '<span class="oscab-bar" style="animation-delay:' + (i * 55) + 'ms"></span>';
        const faders = OSC_PARAMS.map(st => {
            const pct = (st.value * 10) + '%';
            return '<div class="oscab-fader" data-osc="' + st.osc + '" data-val="' + st.value + '">' +
                '<span class="oscab-track"><span class="oscab-fill" style="height:' + pct + '"></span>' +
                '<span class="oscab-knob" style="bottom:' + pct + '"></span></span>' +
                '<span class="oscab-flbl">' + st.label + '</span>' +
            '</div>';
        }).join('');
        let vol = '';
        for (let i = 0; i < 8; i++) vol += '<span class="oscab-vseg"></span>';
        return '<div class="oscab">' +
            '<div class="oscab-wave">' + wave + '</div>' +
            '<canvas class="oscab-scope" width="640" height="140"></canvas>' +
            '<div class="oscab-head">' +
                '<div class="oscab-name">' + (about.name || 'la diega') + '</div>' +
                '<div class="oscab-role">' + (about.clase || '') + '</div>' +
            '</div>' +
            '<div class="oscab-desk">' + faders + '</div>' +
            // volumen, arpegiador y chip para mutear la canción del vídeo
            '<div class="oscab-vol">' +
                '<button class="oscab-vbtn" data-d="-1" aria-label="bajar volumen">−</button>' +
                '<span class="oscab-vmeter">' + vol + '</span>' +
                '<button class="oscab-vbtn" data-d="1" aria-label="subir volumen">+</button>' +
                '<button class="oscab-chip oscab-arp">arpegio</button>' +
                '<button class="oscab-chip oscab-song">canción</button>' +
            '</div>' +
            '<p class="oscab-hint">arrastra la onda o toca con las teclas Z X C V B N M</p>' +
            '<button class="oscab-osc-btn">cambiar a oscilador</button>' +
        '</div>';
}

function openOscAbout() {
    const ov = ensureOscOverlay();
    if (menuOverlay) menuOverlay.classList.add('hidden');
    ov.className = 'overlay osc-about';
    ov.querySelector('.osc-inner').innerHTML = renderOscAbout(DATA.about || {});
    oscAnimStop();
    wireOscAbout(ov);
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
