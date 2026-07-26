// la diega — ABOUT: la ficha de la diega es un sintetizador de verdad.
// En reposo se ven los stats (musica / diseño sonoro / papeleo). Al pulsar
// "cambiar a oscilador" aparece el sinte: tres potes (onda, frecuencia,
// filtro), cinco modulos con su modal (ADSR con boton de tocar; chorus,
// flanger, reverb y arpegio con su ON/OFF), el volumen y el chip de la
// cancion del video. Se toca con las teclas A–L, arrastrando la onda
// (theremin) o manteniendo la barra espaciadora.
// El overlay se inyecta desde aqui, no existe en index.html.
// El motor de audio vive en synth.js.

import { playSfx, sound } from './audio.js';
import * as synth from './synth.js';
import { curSlide, getMode, applySound } from './carousel.js';
import { SYNTH, WAVES, ARP_PATRONES } from './synth.js';

const ABOUT_STATS = [
    { label: 'musica',        value: 10 },
    { label: 'diseño sonoro', value: 9  },
    { label: 'papeleo',       value: 2  }
];

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

let aboutData = {};
let oscOverlay = null;
const oscAnim = { on: false, raf: null, phase: 0 };

export function setAboutData(d) { aboutData = d || {}; }

/* ===== Osciloscopio ===== */

function oscAnimStop() {
    if (oscAnim.raf) cancelAnimationFrame(oscAnim.raf);
    oscAnim.raf = null;
    oscAnim.on = false;
    synth.stopEngine();
}

function oscAnimStart(ov) {
    const cv = ov.querySelector('.oscab-scope');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const amarillo = (getComputedStyle(document.documentElement).getPropertyValue('--highlight') || '#ffe95c').trim();
    const datos = new Float32Array(2048);
    const draw = () => {
        // resolucion nativa: el canvas ocupa todo el ancho de la pantalla
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(cv.clientWidth * dpr);
        const h = Math.round(cv.clientHeight * dpr);
        if (w && cv.width !== w) cv.width = w;
        if (h && cv.height !== h) cv.height = h;
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = amarillo;
        ctx.lineWidth = 3 * dpr;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const an = synth.getAnalyser();
        if (an) {
            an.getFloatTimeDomainData(datos);
            // enganchar en un cruce por cero para que la onda no baile
            let ini = 0;
            for (let i = 1; i < datos.length / 2; i++) {
                if (datos[i - 1] <= 0 && datos[i] > 0) { ini = i; break; }
            }
            const n = Math.floor(datos.length / 2);
            for (let x = 0; x <= W; x++) {
                const v = datos[ini + Math.floor((x / W) * n)] || 0;
                const y = H / 2 - Math.max(-1, Math.min(1, v * 6)) * (H / 2 - 6 * dpr);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
        } else {
            oscAnim.phase += 0.08;
            for (let x = 0; x <= W; x += 2) {
                const y = H / 2 - Math.sin((x / W) * Math.PI * 6 + oscAnim.phase) * (H / 2 - 6 * dpr);
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
    // la onda decorativa cruza toda la pantalla: barras segun el ancho
    const nBars = Math.max(28, Math.ceil(window.innerWidth / 22));
    let wave = '';
    for (let i = 0; i < nBars; i++) wave += '<span class="oscab-bar" style="animation-delay:' + (i * 55) + 'ms"></span>';

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
        '<div class="oscab-hint">teclas A–L · arrastra la onda · espacio mantiene la nota</div>' +
        '<div class="oscab-head">' +
            '<div class="oscab-name">' + (about.name || 'la diega') + '</div>' +
            '<div class="oscab-role">' + (about.clase || '') + '</div>' +
        '</div>' +
        '<div class="oscab-desk">' + stats + '</div>' +
        '<div class="oscab-pots">' + pot('wave', 'tipo de onda') + pot('note', 'frecuencia') + pot('filter', 'filtro') + '</div>' +
        '<div class="oscab-mods">' + mods + '</div>' +
        '<div class="oscab-vol">' +
            '<button class="oscab-vbtn" data-d="-1" aria-label="bajar volumen">−</button>' +
            '<span class="oscab-vmeter">' + vol + '</span>' +
            '<button class="oscab-vbtn" data-d="1" aria-label="subir volumen">+</button>' +
            '<button class="oscab-chip oscab-drone">drone</button>' +
            '<button class="oscab-chip oscab-song">canción</button>' +
        '</div>' +
        '<button class="oscab-osc-btn">cambiar a oscilador</button>' +
    '</div>' +
    '<div class="oscab-modal hidden">' +
        '<div class="oscab-modal-box">' +
            '<div class="oscab-modal-head"><span class="oscab-modal-title"></span>' +
                '<button class="oscab-modal-onoff hidden">off</button>' +
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
    // boton para disparar la envolvente: mantener pulsado = mantener la nota
    if (key === 'adsr') html += '<button class="oscab-touch">tocar</button>';
    return html;
}

// los botones de la parrilla se encienden con su efecto (el ADSR nunca: no se apaga)
function refreshMods(ov) {
    ov.querySelectorAll('.oscab-mod').forEach(b => {
        const k = b.dataset.m;
        const on = oscAnim.on && (k === 'arpegio' ? synth.isArpOn()
                 : k === 'adsr' ? false : !!SYNTH[MODULES[k].target].on);
        b.classList.toggle('on', on);
    });
}

function openModule(ov, key) {
    const m = MODULES[key];
    const modal = ov.querySelector('.oscab-modal');
    modal.querySelector('.oscab-modal-title').textContent = m.label;
    modal.querySelector('.oscab-modal-body').innerHTML = moduleBody(key);

    // ON/OFF en la cabecera: asi se sabe si el efecto se esta aplicando
    const tgl = modal.querySelector('.oscab-modal-onoff');
    if (key === 'adsr') {
        tgl.classList.add('hidden');
    } else {
        const pintaTgl = () => {
            const on = key === 'arpegio' ? synth.isArpOn() : !!SYNTH[m.target].on;
            tgl.textContent = on ? 'on' : 'off';
            tgl.classList.toggle('on', on);
        };
        tgl.classList.remove('hidden');
        pintaTgl();
        tgl.onclick = () => {
            playSfx('move');
            if (key === 'arpegio') synth.isArpOn() ? synth.arpStop() : synth.arpStart();
            else {
                SYNTH[m.target].on = !SYNTH[m.target].on;
                synth.applyParams();
            }
            pintaTgl();
            refreshMods(ov);
        };
    }

    modal.classList.remove('hidden');
    if (key === 'adsr') {
        pintaAdsr(ov);
        const tocar = modal.querySelector('.oscab-touch');
        let pulsado = false;
        tocar.addEventListener('pointerdown', () => { pulsado = true; synth.envTrigger(); });
        const suelta = () => { if (pulsado) { pulsado = false; synth.envRelease(); } };
        tocar.addEventListener('pointerup', suelta);
        tocar.addEventListener('pointercancel', suelta);
        tocar.addEventListener('pointerleave', suelta);
    }
    playSfx('select');

    modal.querySelectorAll('.oscab-prange').forEach(inp => {
        inp.addEventListener('input', () => {
            const p = m.params.find(x => x.k === inp.dataset.k);
            const v = parseFloat(inp.value);
            SYNTH[m.target][p.k] = v;
            inp.parentElement.querySelector('.oscab-pnum').textContent = fmtParam(p, v);
            if (key === 'adsr') pintaAdsr(ov);
            if (key === 'reverb' && p.k === 'size') synth.rebuildReverb();
            synth.applyParams();
        });
    });
}

function closeModule(ov) {
    const modal = ov.querySelector('.oscab-modal');
    if (modal) modal.classList.add('hidden');
}

function modalAbierto() {
    const modal = oscOverlay && oscOverlay.querySelector('.oscab-modal');
    return modal && !modal.classList.contains('hidden');
}

/* ===== Cableado ===== */

function pintaPotes(ov) {
    const w = ov.querySelector('.oscab-pot[data-p="wave"]');
    const n = ov.querySelector('.oscab-pot[data-p="note"]');
    const f = ov.querySelector('.oscab-pot[data-p="filter"]');
    if (w) {
        w.querySelector('.oscab-dial').style.setProperty('--a', potAngulo(SYNTH.wave / (WAVES.length - 1)) + 'deg');
        w.querySelector('.oscab-pval').textContent = WAVES[SYNTH.wave].label;
    }
    if (n) {
        n.querySelector('.oscab-dial').style.setProperty('--a', potAngulo(SYNTH.note / 10) + 'deg');
        n.querySelector('.oscab-pval').textContent = synth.noteLabel(SYNTH.note) + ' · ' + Math.round(synth.noteHz(SYNTH.note)) + ' Hz';
    }
    if (f) {
        f.querySelector('.oscab-dial').style.setProperty('--a', potAngulo(SYNTH.filter / 10) + 'deg');
        const hz = synth.filterHz(SYNTH.filter);
        f.querySelector('.oscab-pval').textContent = hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : hz + ' Hz';
    }
}

// el chip de la cancion siempre refleja lo que suena de verdad
function syncSongChip() {
    if (!oscOverlay || oscOverlay.classList.contains('hidden')) return;
    const chip = oscOverlay.querySelector('.oscab-song');
    if (chip) chip.classList.toggle('on', !curSlide().video.muted && !curSlide().video.paused);
}

// mover un pote: la frecuencia toca una nota (se oye lo que ajustas),
// el cambio de onda tambien suena, el filtro solo se aplica
function setPot(ov, key, v) {
    const max = key === 'wave' ? WAVES.length - 1 : 10;
    v = Math.max(0, Math.min(max, Math.round(v)));
    if (v === SYNTH[key]) return;
    if (key === 'note') {
        synth.playNote(v);
    } else {
        SYNTH[key] = v;
        synth.applyParams();
        if (key === 'wave') synth.playNote(SYNTH.note);
    }
    pintaPotes(ov);
}

function wireAbout(ov) {
    const root = ov.querySelector('.oscab');
    const btn = ov.querySelector('.oscab-osc-btn');

    const paintVol = () => ov.querySelectorAll('.oscab-vseg').forEach((s, i) => s.classList.toggle('on', i < synth.getVolume()));
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
        } else {
            oscAnim.on = true;
            root.classList.add('oscillator');
            btn.textContent = 'volver a la onda';
            pintaPotes(ov);
            synth.startEngine();
            oscAnimStart(ov);
        }
        refreshMods(ov);
    });

    // cada modulo abre su modal; el ON/OFF vive dentro del modal
    ov.querySelectorAll('.oscab-mod').forEach(b => {
        b.addEventListener('click', () => openModule(ov, b.dataset.m));
    });

    const modal = ov.querySelector('.oscab-modal');
    modal.querySelector('.oscab-modal-close').addEventListener('click', () => { playSfx('back'); closeModule(ov); });
    modal.addEventListener('click', e => { if (e.target === modal) { playSfx('back'); closeModule(ov); } });

    ov.querySelectorAll('.oscab-vbtn').forEach(b => {
        b.addEventListener('click', () => {
            synth.setVolume(synth.getVolume() + (+b.dataset.d));
            paintVol();
            playSfx('move');
        });
    });

    // drone: alterna entre "siempre sonando" y "solo al tocar"
    const droneBtn = ov.querySelector('.oscab-drone');
    const paintDrone = () => droneBtn.classList.toggle('on', SYNTH.drone);
    paintDrone();
    droneBtn.addEventListener('click', () => {
        synth.setDrone(!SYNTH.drone);
        paintDrone();
        playSfx('move');
    });

    // mutear / recuperar la cancion del video que suena detras
    const songBtn = ov.querySelector('.oscab-song');
    songBtn.addEventListener('click', () => {
        const v = curSlide().video;
        const encender = v.muted || v.paused;
        // el chip manda: applySound() deja los videos y el boton del home coherentes
        sound.unlocked = true;
        sound.on = encender;
        applySound();
        if (encender && v.paused && getMode() !== 'gestoria') v.play().catch(() => {});
        syncSongChip();
        playSfx('move');
    });

    // potes: arrastrar arriba/abajo o rueda del raton
    ov.querySelectorAll('.oscab-pot').forEach(p => {
        const key = p.dataset.p;
        let arrastra = false, y0 = 0, v0 = 0;
        const dial = p.querySelector('.oscab-dial');
        dial.addEventListener('pointerdown', e => {
            arrastra = true; y0 = e.clientY; v0 = SYNTH[key];
            try { dial.setPointerCapture(e.pointerId); } catch (_) {}
        });
        dial.addEventListener('pointermove', e => {
            if (!arrastra) return;
            setPot(ov, key, v0 + (y0 - e.clientY) / 18);
        });
        dial.addEventListener('pointerup', () => { arrastra = false; });
        dial.addEventListener('pointercancel', () => { arrastra = false; });
        dial.addEventListener('wheel', e => {
            e.preventDefault();
            setPot(ov, key, SYNTH[key] + (e.deltaY < 0 ? 1 : -1));
        }, { passive: false });
    });

    // theremin: arrastrar por el osciloscopio toca la escala de lado a lado
    const cv = ov.querySelector('.oscab-scope');
    let toca = false;
    const stepAt = e => (e.clientX / window.innerWidth) * 10;
    cv.addEventListener('pointerdown', e => {
        if (!synth.engineOn()) return;
        toca = true;
        try { cv.setPointerCapture(e.pointerId); } catch (_) {}
        synth.noteOn(stepAt(e));
        pintaPotes(ov);
    });
    cv.addEventListener('pointermove', e => {
        if (!toca) return;
        synth.noteGlide(stepAt(e));
        pintaPotes(ov);
    });
    const sueltaCv = () => { if (toca) { toca = false; synth.noteOff(); } };
    cv.addEventListener('pointerup', sueltaCv);
    cv.addEventListener('pointercancel', sueltaCv);
}

/* ===== Teclado: A–L tocan la pentatonica, espacio mantiene la nota ===== */

const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'];
const teclas = new Set();

function bindTeclado() {
    document.addEventListener('keydown', e => {
        if (!oscOverlay || oscOverlay.classList.contains('hidden') || !synth.engineOn()) return;
        if (e.key === ' ') {
            e.preventDefault();
            if (!e.repeat) synth.noteOn(SYNTH.note);
            return;
        }
        const i = KEYS.indexOf(e.key.toLowerCase());
        if (i < 0 || e.repeat) return;
        teclas.add(e.key.toLowerCase());
        synth.noteOn(i);
        pintaPotes(oscOverlay);
    });
    document.addEventListener('keyup', e => {
        if (!oscOverlay || oscOverlay.classList.contains('hidden') || !synth.engineOn()) { teclas.clear(); return; }
        if (e.key === ' ') { synth.noteOff(); return; }
        if (!teclas.delete(e.key.toLowerCase())) return;
        if (!teclas.size) synth.noteOff();
        else {
            // legato: al soltar una tecla vuelve la ultima que siga pulsada
            synth.noteOn(KEYS.indexOf([...teclas][teclas.size - 1]));
            pintaPotes(oscOverlay);
        }
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
    document.addEventListener('ladiega:videostate', syncSongChip);
    bindTeclado();
    return oscOverlay;
}

// Escape con el about abierto: primero cierra el modal, luego el about.
// Lo llama el listener global de ui.js; devuelve true si lo ha gestionado.
export function aboutEscape() {
    if (!oscOverlay || oscOverlay.classList.contains('hidden')) return false;
    playSfx('back');
    if (modalAbierto()) closeModule(oscOverlay);
    else closeOscAbout();
    return true;
}

export function closeOscAbout() {
    if (!oscOverlay) return;
    oscAnimStop();
    oscOverlay.classList.add('hidden');
    document.body.classList.remove('overlay-open');
}

export function openOscAbout() {
    const ov = ensureOscOverlay();
    const menuOverlay = document.getElementById('menuOverlay');
    if (menuOverlay) menuOverlay.classList.add('hidden');
    ov.className = 'overlay osc-about';
    ov.querySelector('.osc-inner').innerHTML = renderAbout(aboutData);
    oscAnimStop();
    wireAbout(ov);
    document.body.classList.add('overlay-open');
    playSfx('select');
}
