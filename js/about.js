// la diega — ABOUT: la ficha de la diega es un sintetizador de verdad.
// En reposo se ven los stats (musica / diseño sonoro / papeleo). Al pulsar
// "encender el sinte" aparece: los pads de la pentatonica (se tocan con el
// dedo, el raton o el teclado A–Ñ), los presets, tres potes (onda, nota,
// filtro), cinco modulos —el nombre enciende el efecto, los "···" abren sus
// ajustes—, el volumen, el chip "drone" y el de la cancion del video.
// La onda tambien se arrastra como un theremin y el espacio mantiene la nota.
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

// cada modulo edita su trozo de SYNTH desde un modal.
// label = en cristiano (lo que hace) · tec = como se llama en un sinte de verdad
const MODULES = {
    voces: { label: 'voces', target: 'voices', params: [
        { k: 'n',      label: 'cuántas',          tec: 'voices', min: 1, max: 5,  paso: 1, uds: 'n'  },
        { k: 'detune', label: 'cuánto desafinan', tec: 'detune', min: 0, max: 50, paso: 1, uds: 'ct' }
    ]},
    chorus: { label: 'chorus', target: 'chorus', params: [
        { k: 'rate',  label: 'velocidad',       tec: 'rate',    min: 0.05, max: 6, paso: 0.05, uds: 'Hz' },
        { k: 'depth', label: 'cuánto se mueve', tec: 'depth',   min: 0,    max: 1, paso: 0.01, uds: '' },
        { k: 'mix',   label: 'cuánto se nota',  tec: 'dry/wet', min: 0,    max: 1, paso: 0.01, uds: '' }
    ]},
    flanger: { label: 'flanger', target: 'flanger', params: [
        { k: 'rate',     label: 'velocidad',       tec: 'rate',     min: 0.05, max: 4,   paso: 0.05, uds: 'Hz' },
        { k: 'depth',    label: 'cuánto se mueve', tec: 'depth',    min: 0,    max: 1,   paso: 0.01, uds: '' },
        { k: 'feedback', label: 'cuánto rebota',   tec: 'feedback', min: 0,    max: 0.9, paso: 0.01, uds: '' },
        { k: 'mix',      label: 'cuánto se nota',  tec: 'dry/wet',  min: 0,    max: 1,   paso: 0.01, uds: '' }
    ]},
    reverb: { label: 'reverb', target: 'reverb', params: [
        { k: 'time',     label: 'cuánto dura',   tec: 'time',      min: 0.2, max: 5,   paso: 0.1,  uds: 's' },
        { k: 'predelay', label: 'cuánto tarda',  tec: 'pre-delay', min: 0,   max: 200, paso: 5,    uds: 'ms' },
        { k: 'mix',      label: 'cuánto se moja', tec: 'dry/wet',  min: 0,   max: 1,   paso: 0.01, uds: '' }
    ]},
    arpegio: { label: 'arpegio', target: 'arp', params: [
        { k: 'bpm',    label: 'velocidad',      tec: 'bpm',    min: 60,    max: 900, paso: 10,    uds: 'bpm' },
        { k: 'patron', label: 'por dónde sube', tec: 'patrón', min: 0,     max: 3,   paso: 1,     uds: '', lista: ARP_PATRONES },
        { k: 'attack', label: 'golpe ↔ suave',  tec: 'attack', min: 0.001, max: 0.5, paso: 0.001, uds: 's' }
    ]}
};

// modulos que no son efectos: sin interruptor ON/OFF en su modal
const SIN_TOGGLE = { voces: true };

// teclas del teclado para los diez primeros pads (el once solo se toca)
const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'];

// presets: un clic y cambia todo de golpe. Es la puerta de entrada — nadie
// descubre un sinte moviendo potes de uno en uno.
const PRESETS = [
    { label: 'nave', arp: false, s: {
        wave: 2, filter: 6, drone: true,
        voices:  { n: 3, detune: 18 },
        chorus:  { on: true, rate: 0.8, depth: 0.6, mix: 0.45 },
        flanger: { on: false },
        reverb:  { on: true, time: 3.4, predelay: 40, mix: 0.4 }
    }},
    { label: 'campana', arp: false, s: {
        wave: 0, filter: 10, drone: false,
        voices:  { n: 2, detune: 5 },
        chorus:  { on: false },
        flanger: { on: false },
        reverb:  { on: true, time: 3.6, predelay: 60, mix: 0.45 },
        arp:     { attack: 0.003 }
    }},
    { label: 'coro', arp: false, s: {
        wave: 1, filter: 8, drone: true,
        voices:  { n: 5, detune: 28 },
        chorus:  { on: true, rate: 0.5, depth: 0.75, mix: 0.55 },
        flanger: { on: false },
        reverb:  { on: true, time: 2.2, predelay: 20, mix: 0.3 }
    }},
    { label: 'goma', arp: false, s: {
        wave: 3, filter: 4, drone: false,
        voices:  { n: 1, detune: 0 },
        chorus:  { on: false },
        flanger: { on: true, rate: 0.6, depth: 0.85, feedback: 0.65, mix: 0.5 },
        reverb:  { on: true, time: 1, predelay: 0, mix: 0.15 },
        arp:     { attack: 0.02 }
    }},
    { label: 'chunda', arp: true, s: {
        wave: 2, filter: 7, drone: false,
        voices:  { n: 2, detune: 12 },
        chorus:  { on: false },
        flanger: { on: false },
        reverb:  { on: true, time: 1.4, predelay: 10, mix: 0.22 },
        arp:     { bpm: 420, patron: 0, attack: 0.004 }
    }}
];

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

    // el nombre del modulo enciende y apaga el efecto; los "···" abren sus ajustes
    const mods = Object.keys(MODULES).map(k =>
        '<span class="oscab-modwrap">' +
            '<button class="oscab-mod" data-m="' + k + '">' + MODULES[k].label + '</button>' +
            (SIN_TOGGLE[k] ? '' :
                '<button class="oscab-modset" data-m="' + k + '" aria-label="ajustes de ' + MODULES[k].label + '">···</button>') +
        '</span>').join('');

    const presets = PRESETS.map((p, i) =>
        '<button class="oscab-preset" data-preset="' + i + '">' + p.label + '</button>').join('');

    // pads: las 11 notas de la pentatonica, para tocar con el dedo o el raton
    // (los diez primeros llevan ademas su tecla del teclado)
    let pads = '';
    for (let i = 0; i <= 10; i++) {
        pads += '<button class="oscab-pad" data-i="' + i + '">' +
            '<span class="oscab-pad-n">' + synth.noteLabel(i) + '</span>' +
            '<span class="oscab-pad-k">' + (KEYS[i] || '·') + '</span>' +
        '</button>';
    }

    let vol = '';
    for (let i = 0; i < 8; i++) vol += '<span class="oscab-vseg"></span>';

    // cada trozo del sinte va en su bloque, con un rotulo que dice para que
    // sirve: sin eso era una pila de botones sueltos sin orden aparente
    const bloque = (rotulo, pista, dentro) =>
        '<div class="oscab-block">' +
            '<span class="oscab-sec">' + rotulo +
                (pista ? '<em>' + pista + '</em>' : '') + '</span>' +
            dentro +
        '</div>';

    return '<div class="oscab">' +
        '<div class="oscab-wave">' + wave + '</div>' +
        '<canvas class="oscab-scope" width="640" height="140"></canvas>' +
        '<div class="oscab-hint">arrastra la onda de lado a lado, como un theremin</div>' +
        '<div class="oscab-head">' +
            '<div class="oscab-name">' + (about.name || 'la diega') + '</div>' +
            '<div class="oscab-role">' + (about.clase || '') + '</div>' +
        '</div>' +
        '<div class="oscab-desk">' + stats + '</div>' +
        bloque('toca', 'con el dedo, el ratón o el teclado A–Ñ',
            '<div class="oscab-pads">' + pads + '</div>' +
            '<div class="oscab-oct">' +
                '<button class="oscab-octbtn" data-d="-1" aria-label="bajar una octava">◀ Z</button>' +
                '<span class="oscab-octlbl">octava <b class="oscab-octn"></b></span>' +
                '<button class="oscab-octbtn" data-d="1" aria-label="subir una octava">X ▶</button>' +
            '</div>') +
        bloque('suena a', 'un clic y cambia todo',
            '<div class="oscab-presets">' + presets + '</div>') +
        bloque('retoca', 'arrastra arriba y abajo',
            '<div class="oscab-pots">' + pot('wave', 'tipo de onda') + pot('note', 'nota') + pot('filter', 'filtro') + '</div>') +
        bloque('efectos', 'el nombre lo enciende · los ··· lo ajustan',
            '<div class="oscab-mods">' + mods + '</div>') +
        bloque('sonido', '',
            '<div class="oscab-vol">' +
                '<button class="oscab-vbtn" data-d="-1" aria-label="bajar volumen">−</button>' +
                '<span class="oscab-vmeter">' + vol + '</span>' +
                '<button class="oscab-vbtn" data-d="1" aria-label="subir volumen">+</button>' +
                '<button class="oscab-chip oscab-drone" title="siempre sonando ↔ solo al tocar">drone</button>' +
                '<button class="oscab-chip oscab-song" title="la canción del video de detrás">canción</button>' +
            '</div>') +
        '<button class="oscab-osc-btn">encender el sinte</button>' +
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
    if (p.uds === 'n') return String(Math.round(v));
    if (p.uds === 'ct') return Math.round(v) + ' ct';
    if (p.uds === 'ms') return Math.round(v) + ' ms';
    if (p.uds === 's') return (v < 1 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s');
    if (p.uds === 'Hz') return v.toFixed(2) + ' Hz';
    return Math.round(v * 100) + '%';
}

function moduleBody(key) {
    const m = MODULES[key];
    const st = SYNTH[m.target];
    return m.params.map(p =>
        '<label class="oscab-prow">' +
            '<span class="oscab-pname">' + p.label +
                (p.tec ? '<em>' + p.tec + '</em>' : '') + '</span>' +
            '<input class="oscab-prange" type="range" data-k="' + p.k + '" min="' + p.min +
                '" max="' + p.max + '" step="' + p.paso + '" value="' + st[p.k] + '">' +
            '<span class="oscab-pnum">' + fmtParam(p, st[p.k]) + '</span>' +
        '</label>').join('');
}

// los botones de la parrilla se encienden con su efecto
// (las voces cuentan como "puestas" en cuanto hay mas de una)
function refreshMods(ov) {
    ov.querySelectorAll('.oscab-mod').forEach(b => {
        const k = b.dataset.m;
        // las voces no se encienden ni se apagan: el chip dice cuantas hay
        if (k === 'voces') {
            b.textContent = 'voces ×' + Math.round(SYNTH.voices.n);
            return;
        }
        const on = oscAnim.on && (k === 'arpegio' ? synth.isArpOn() : !!SYNTH[MODULES[k].target].on);
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
    modal._pinta = null;
    if (SIN_TOGGLE[key]) {
        tgl.classList.add('hidden');
    } else {
        const pintaTgl = () => {
            const on = key === 'arpegio' ? synth.isArpOn() : !!SYNTH[m.target].on;
            tgl.textContent = on ? 'on' : 'off';
            tgl.classList.toggle('on', on);
        };
        modal._pinta = pintaTgl;   // el chip de fuera tambien lo enciende
        tgl.classList.remove('hidden');
        pintaTgl();
        tgl.onclick = () => toggleModule(ov, key);
    }

    modal.classList.remove('hidden');
    playSfx('select');

    modal.querySelectorAll('.oscab-prange').forEach(inp => {
        inp.addEventListener('input', () => {
            const p = m.params.find(x => x.k === inp.dataset.k);
            const v = parseFloat(inp.value);
            SYNTH[m.target][p.k] = v;
            inp.parentElement.querySelector('.oscab-pnum').textContent = fmtParam(p, v);
            if (key === 'reverb' && p.k === 'time') synth.rebuildReverb();
            if (key === 'voces') refreshMods(ov);
            synth.applyParams();
        });
    });
}

// enciende/apaga un efecto. Lo llaman el chip de la parrilla y el ON/OFF
// del modal, para que digan siempre lo mismo
function toggleModule(ov, key) {
    playSfx('move');
    if (key === 'arpegio') {
        synth.isArpOn() ? synth.arpStop() : synth.arpStart();
    } else {
        const t = MODULES[key].target;
        SYNTH[t].on = !SYNTH[t].on;
        synth.applyParams();
    }
    const modal = ov.querySelector('.oscab-modal');
    if (modal && modal._pinta) modal._pinta();
    marcaPreset(ov, -1);
    refreshMods(ov);
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

// el pad encendido es el de la nota que esta sonando; en drone se queda fijo,
// tocando manda la nota que se esta pulsando
function pintaPads(ov, tocando) {
    const activo = (tocando === undefined || tocando < 0)
        ? (synth.engineOn() && SYNTH.drone ? SYNTH.note : -1)
        : tocando;
    ov.querySelectorAll('.oscab-pad').forEach(p => p.classList.toggle('on', +p.dataset.i === activo));
}

// la escala entera sube o baja: hay que reetiquetar los pads, el rotulo de
// octava y el pote de nota, porque todos dicen en que nota estan
function pintaOctava(ov) {
    ov.querySelectorAll('.oscab-pad').forEach(p => {
        const n = p.querySelector('.oscab-pad-n');
        if (n) n.textContent = synth.noteLabel(+p.dataset.i);
    });
    const lbl = ov.querySelector('.oscab-octn');
    if (lbl) lbl.textContent = synth.noteLabel(0) + '–' + synth.noteLabel(10);
    ov.querySelectorAll('.oscab-octbtn').forEach(b => {
        const d = +b.dataset.d;
        b.disabled = d < 0 ? SYNTH.oct <= synth.OCT_MIN : SYNTH.oct >= synth.OCT_MAX;
    });
}

function cambiaOctava(ov, d) {
    if (!synth.shiftOctave(d)) return;
    playSfx('move');
    pintaOctava(ov);
    pintaPotes(ov);
    pintaPads(ov);
    if (!SYNTH.drone && !synth.isArpOn()) synth.playNote(SYNTH.note, 450);
}

// -1 = ninguno (se ha tocado algo a mano y ya no es tal cual el preset)
function marcaPreset(ov, i) {
    ov.querySelectorAll('.oscab-preset').forEach(b => b.classList.toggle('on', +b.dataset.preset === i));
}

// vuelca un preset entero sobre SYNTH y lo deja sonando
function aplicaPreset(ov, i) {
    const p = PRESETS[i];
    if (!p) return;
    playSfx('select');
    Object.keys(p.s).forEach(k => {
        const v = p.s[k];
        if (v && typeof v === 'object' && SYNTH[k]) Object.assign(SYNTH[k], v);
        else SYNTH[k] = v;
    });
    synth.rebuildReverb();
    if (p.arp) { if (!synth.isArpOn()) synth.arpStart(); }
    else if (synth.isArpOn()) synth.arpStop();
    synth.setDrone(SYNTH.drone);
    synth.applyParams();
    // que se oiga al momento: si no hay drone ni arpegio, una nota de muestra
    if (!SYNTH.drone && !p.arp) synth.playNote(SYNTH.note, 700);
    pintaPotes(ov);
    pintaPads(ov);
    refreshMods(ov);
    marcaPreset(ov, i);
    const dr = ov.querySelector('.oscab-drone');
    if (dr) dr.classList.toggle('on', SYNTH.drone);
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
    pintaPads(ov);
    marcaPreset(ov, -1);
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
            btn.textContent = 'encender el sinte';
            closeModule(ov);
        } else {
            oscAnim.on = true;
            root.classList.add('oscillator');
            btn.textContent = 'apagar el sinte';
            pintaPotes(ov);
            synth.startEngine();
            oscAnimStart(ov);
        }
        pintaPads(ov);
        refreshMods(ov);
    });

    // el nombre del modulo enciende y apaga el efecto (un clic, se oye);
    // los ajustes finos estan detras de los "···". Las voces no son un
    // efecto: no hay nada que encender, asi que abren sus ajustes directas
    ov.querySelectorAll('.oscab-mod').forEach(b => {
        b.addEventListener('click', () => {
            if (SIN_TOGGLE[b.dataset.m]) openModule(ov, b.dataset.m);
            else toggleModule(ov, b.dataset.m);
        });
    });
    ov.querySelectorAll('.oscab-modset').forEach(b => {
        b.addEventListener('click', () => openModule(ov, b.dataset.m));
    });

    // presets: la puerta de entrada, un clic y suena otra cosa
    ov.querySelectorAll('.oscab-preset').forEach(b => {
        b.addEventListener('click', () => aplicaPreset(ov, +b.dataset.preset));
    });

    // pads: la pentatonica para tocar con el dedo o el raton
    ov.querySelectorAll('.oscab-pad').forEach(p => {
        const i = +p.dataset.i;
        const suelta = () => {
            if (!synth.engineOn()) return;
            synth.noteOff();
            pintaPads(ov);
        };
        p.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (!synth.engineOn()) return;
            try { p.setPointerCapture(e.pointerId); } catch (_) {}
            synth.noteOn(i);
            pintaPads(ov, i);
            pintaPotes(ov);
        });
        p.addEventListener('pointerup', suelta);
        p.addEventListener('pointercancel', suelta);
        // con el pad enfocado, Enter tambien toca (el espacio ya esta cogido)
        p.addEventListener('keydown', e => {
            if (e.key !== 'Enter' || !synth.engineOn()) return;
            synth.playNote(i, 400);
            pintaPads(ov, i);
            setTimeout(() => pintaPads(ov), 400);
        });
    });
    pintaPads(ov);

    // subir y bajar la escala entera
    ov.querySelectorAll('.oscab-octbtn').forEach(b => {
        b.addEventListener('click', () => cambiaOctava(ov, +b.dataset.d));
    });
    pintaOctava(ov);

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
        pintaPads(ov);
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
        pintaPads(ov, SYNTH.note);
    });
    cv.addEventListener('pointermove', e => {
        if (!toca) return;
        synth.noteGlide(stepAt(e));
        pintaPotes(ov);
        pintaPads(ov, SYNTH.note);
    });
    const sueltaCv = () => { if (toca) { toca = false; synth.noteOff(); pintaPads(ov); } };
    cv.addEventListener('pointerup', sueltaCv);
    cv.addEventListener('pointercancel', sueltaCv);
}

/* ===== Teclado: A–Ñ tocan la pentatonica, espacio mantiene la nota ===== */

const teclas = new Set();

function bindTeclado() {
    document.addEventListener('keydown', e => {
        if (!oscOverlay || oscOverlay.classList.contains('hidden') || !synth.engineOn()) return;
        if (e.key === ' ') {
            e.preventDefault();
            if (!e.repeat) { synth.noteOn(SYNTH.note); pintaPads(oscOverlay, SYNTH.note); }
            return;
        }
        const k = e.key.toLowerCase();
        // Z / X mueven la escala entera una octava
        if (k === 'z' || k === 'x') {
            e.preventDefault();
            if (!e.repeat) cambiaOctava(oscOverlay, k === 'x' ? 1 : -1);
            return;
        }
        const i = KEYS.indexOf(k);
        if (i < 0 || e.repeat) return;
        teclas.add(k);
        synth.noteOn(i);
        pintaPotes(oscOverlay);
        pintaPads(oscOverlay, i);   // el pad se enciende tambien desde el teclado
    });
    document.addEventListener('keyup', e => {
        if (!oscOverlay || oscOverlay.classList.contains('hidden') || !synth.engineOn()) { teclas.clear(); return; }
        if (e.key === ' ') { synth.noteOff(); pintaPads(oscOverlay); return; }
        if (!teclas.delete(e.key.toLowerCase())) return;
        if (!teclas.size) { synth.noteOff(); pintaPads(oscOverlay); }
        else {
            // legato: al soltar una tecla vuelve la ultima que siga pulsada
            const i = KEYS.indexOf([...teclas][teclas.size - 1]);
            synth.noteOn(i);
            pintaPotes(oscOverlay);
            pintaPads(oscOverlay, i);
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
