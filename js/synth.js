// la diega — motor del sintetizador del about: estado, cadena de audio,
// notas con envolvente ADSR, arpegiador y efectos. La interfaz vive en about.js.

import { getAudioCtx } from './audio.js';

export const WAVES = [
    { type: 'sine',     label: 'seno' },
    { type: 'triangle', label: 'triangular' },
    { type: 'sawtooth', label: 'sierra' },
    { type: 'square',   label: 'cuadrada' }
];

// escala pentatonica: caiga donde caiga el pote, siempre suena afinado
const PENTA = [0, 3, 5, 7, 10];

export function noteHz(step) {
    const s = Math.max(0, Math.min(10, Math.round(step)));
    return 110 * Math.pow(2, (PENTA[s % 5] + Math.floor(s / 5) * 12) / 12);
}

const NOTA_NOMBRE = ['la', 'do', 're', 'mi', 'sol'];

export function noteLabel(step) {
    const s = Math.max(0, Math.min(10, Math.round(step)));
    return NOTA_NOMBRE[s % 5] + (2 + Math.floor(s / 5));
}

// filtro: 0..10 → 150 Hz .. 12 kHz en escala logaritmica
export function filterHz(step) {
    const s = Math.max(0, Math.min(10, step));
    return Math.round(150 * Math.pow(12000 / 150, s / 10));
}

export const ARP_PATRONES = [
    { label: 'subida', pasos: [0, 2, 4, 6] },
    { label: 'bajada', pasos: [6, 4, 2, 0] },
    { label: 'vaiven', pasos: [0, 2, 4, 2] },
    { label: 'salto',  pasos: [0, 4, 1, 5] }
];

// estado del sinte: lo editan los potes y los modales; persiste entre visitas al about
export const SYNTH = {
    wave: 0,
    note: 10,
    filter: 10,
    drone: true,   // true = siempre sonando · false = solo al tocar (ADSR / arpegio)
    adsr:    { a: 0.01, d: 0.20, s: 0.55, r: 0.30 },
    chorus:  { on: false, rate: 1.2,  depth: 0.5, mix: 0.4 },
    flanger: { on: false, rate: 0.35, depth: 0.6, feedback: 0.45, mix: 0.4 },
    reverb:  { on: true,  size: 1.8,  mix: 0.25 },
    arp:     { bpm: 300, patron: 0 }
};

let engine = null;
let vol = 5;
const arp = { on: false, timer: null, i: 0 };
let autoOff = null;

export function engineOn() { return !!engine; }
export function isArpOn() { return arp.on; }
export function getVolume() { return vol; }
export function getAnalyser() { return engine && engine.analyser; }

export function setVolume(v) {
    vol = Math.max(0, Math.min(8, v));
    applyParams();
}

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

/* cadena: osc → envolvente → filtro → seco + chorus + flanger + reverb → bus → master */
export function startEngine() {
    try {
        const ctx = getAudioCtx();

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
        env.gain.value = 0.0015;           // en silencio hasta la primera nota
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.Q.value = 2.5;
        const tone = ctx.createGain();
        tone.gain.value = 0.16;
        osc.connect(env); env.connect(filt); filt.connect(tone);
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

        engine = { ctx, osc, env, filt, tone, master, bus, analyser,
                   chLfo, chDepth, chWet, flLfo, flDepth, flFb, flWet, conv, rvWet };
        applyParams();
        // drone: arranca sonando sin parar; si no, una nota de bienvenida
        if (SYNTH.drone) setDrone(true);
        else playNote(SYNTH.note, 600);
    } catch (e) { engine = null; }
}

// alterna entre "siempre sonando" (envolvente clavada arriba) y
// "solo al tocar" (silencio hasta que el ADSR o el arpegio disparan)
export function setDrone(on) {
    SYNTH.drone = !!on;
    if (!engine || arp.on) return;
    clearTimeout(autoOff);
    const t = engine.ctx.currentTime, g = engine.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    if (SYNTH.drone) g.exponentialRampToValueAtTime(1, t + 0.06);
    else g.exponentialRampToValueAtTime(0.0015, t + Math.max(0.01, SYNTH.adsr.r));
}

export function stopEngine() {
    arpStop();
    if (!engine) return;
    try {
        const t = engine.ctx.currentTime;
        engine.master.gain.cancelScheduledValues(t);
        engine.master.gain.setTargetAtTime(0, t, 0.02);
        engine.osc.stop(t + 0.2);
        engine.chLfo.stop(t + 0.2);
        engine.flLfo.stop(t + 0.2);
    } catch (e) { /* ya parado */ }
    engine = null;
}

// vuelca SYNTH y el volumen a los nodos; los efectos en off van con wet a cero
export function applyParams() {
    if (!engine) return;
    const a = engine, t = a.ctx.currentTime, S = SYNTH;
    a.osc.type = WAVES[S.wave].type;
    if (!arp.on) a.osc.frequency.setTargetAtTime(noteHz(S.note), t, 0.02);
    a.filt.frequency.setTargetAtTime(filterHz(S.filter), t, 0.03);
    a.chLfo.frequency.setTargetAtTime(S.chorus.rate, t, 0.05);
    a.chDepth.gain.setTargetAtTime(S.chorus.depth * 0.006, t, 0.05);
    a.chWet.gain.setTargetAtTime(S.chorus.on ? S.chorus.mix : 0, t, 0.05);
    a.flLfo.frequency.setTargetAtTime(S.flanger.rate, t, 0.05);
    a.flDepth.gain.setTargetAtTime(S.flanger.depth * 0.003, t, 0.05);
    a.flFb.gain.setTargetAtTime(S.flanger.feedback * 0.85, t, 0.05);
    a.flWet.gain.setTargetAtTime(S.flanger.on ? S.flanger.mix : 0, t, 0.05);
    a.rvWet.gain.setTargetAtTime(S.reverb.on ? S.reverb.mix : 0, t, 0.05);
    a.master.gain.setTargetAtTime((vol / 8) * 0.5, t, 0.03);
}

export function rebuildReverb() {
    if (!engine) return;
    try { engine.conv.buffer = makeIR(engine.ctx, SYNTH.reverb.size); } catch (e) { /* nada */ }
}

/* ===== Notas: mono, con envolvente ADSR =====
   noteOn dispara ataque→decay→sustain y se queda sonando;
   noteOff suelta con el release. playNote hace las dos cosas sola. */

export function noteOn(step) {
    SYNTH.note = Math.max(0, Math.min(10, Math.round(step)));
    if (!engine || arp.on) return;
    clearTimeout(autoOff);
    const t = engine.ctx.currentTime, e = SYNTH.adsr, g = engine.env.gain;
    if (SYNTH.drone) {
        // siempre sonando: la nota solo cambia la altura, sin redisparar nada
        engine.osc.frequency.setTargetAtTime(noteHz(SYNTH.note), t, 0.02);
        return;
    }
    engine.osc.frequency.setValueAtTime(noteHz(SYNTH.note), t);
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    g.exponentialRampToValueAtTime(1, t + e.a);
    g.exponentialRampToValueAtTime(Math.max(0.0015, e.s), t + e.a + e.d);
}

export function noteOff() {
    if (!engine || arp.on || SYNTH.drone) return;
    const t = engine.ctx.currentTime, g = engine.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    g.exponentialRampToValueAtTime(0.0015, t + Math.max(0.01, SYNTH.adsr.r));
}

// disparo manual de la envolvente (boton "tocar" del ADSR): suena tambien
// en drone; alli, al soltar, el release desemboca en el tono continuo
export function envTrigger() {
    if (!engine || arp.on) return;
    clearTimeout(autoOff);
    const t = engine.ctx.currentTime, e = SYNTH.adsr, g = engine.env.gain;
    engine.osc.frequency.setValueAtTime(noteHz(SYNTH.note), t);
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0015, t);
    g.exponentialRampToValueAtTime(1, t + e.a);
    g.exponentialRampToValueAtTime(Math.max(0.0015, e.s), t + e.a + e.d);
}

export function envRelease() {
    if (!engine || arp.on) return;
    const t = engine.ctx.currentTime, g = engine.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    g.exponentialRampToValueAtTime(SYNTH.drone ? 1 : 0.0015, t + Math.max(0.01, SYNTH.adsr.r));
}

// nota que se suelta sola (potes, rueda, cambio de onda)
export function playNote(step, hold = 350) {
    noteOn(step);
    clearTimeout(autoOff);
    autoOff = setTimeout(noteOff, hold);
}

// glissando del theremin: cambia la nota sin redisparar la envolvente
export function noteGlide(step) {
    SYNTH.note = Math.max(0, Math.min(10, Math.round(step)));
    if (!engine || arp.on) return;
    engine.osc.frequency.setTargetAtTime(noteHz(SYNTH.note), engine.ctx.currentTime, 0.02);
}

/* ===== Arpegiador: recorre el patron y cada nota pasa por la envolvente ===== */

export function arpStart() {
    if (!engine || arp.on) return;
    arp.on = true;
    arp.i = 0;
    const paso = () => {
        if (!engine) return;
        const pat = ARP_PATRONES[SYNTH.arp.patron] || ARP_PATRONES[0];
        const n = Math.max(0, Math.min(10, SYNTH.note - 4 + pat.pasos[arp.i % pat.pasos.length]));
        const t = engine.ctx.currentTime;
        const e = SYNTH.adsr;
        const g = engine.env.gain;
        engine.osc.frequency.setValueAtTime(noteHz(n), t);
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.0015, t);
        g.exponentialRampToValueAtTime(1, t + e.a);
        g.exponentialRampToValueAtTime(Math.max(0.0015, e.s), t + e.a + e.d);
        g.exponentialRampToValueAtTime(0.0015, t + e.a + e.d + e.r);
        arp.i++;
        arp.timer = setTimeout(paso, Math.max(60, 60000 / SYNTH.arp.bpm));
    };
    paso();
}

export function arpStop() {
    if (arp.timer) clearTimeout(arp.timer);
    arp.timer = null;
    if (!arp.on) return;
    arp.on = false;
    if (engine) {
        // al parar: en drone vuelve el tono continuo, si no, silencio
        const t = engine.ctx.currentTime, g = engine.env.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(SYNTH.drone ? 1 : 0.0015, t, 0.05);
    }
    applyParams();  // el pote de frecuencia vuelve a mandar
}
