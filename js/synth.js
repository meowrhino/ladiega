// la diega — motor del sintetizador del about: estado, cadena de audio,
// notas con envolvente, voces con detune, arpegiador y efectos.
// La interfaz vive en about.js.

import { getAudioCtx } from './audio.js';

export const WAVES = [
    { type: 'sine',     label: 'seno' },
    { type: 'triangle', label: 'triangular' },
    { type: 'sawtooth', label: 'sierra' },
    { type: 'square',   label: 'cuadrada' }
];

// teclado de verdad: una octava cromatica de do a do (13 pasos, 0 = do).
// La octava en la que cae se mueve entera con SYNTH.oct (teclas Z / X)
export const PASOS = 12;          // el paso 12 es el do de arriba
export const OCT_MIN = -2;
export const OCT_MAX = 2;
const DO4 = 261.6255653;          // do central

export function noteHz(step) {
    const s = Math.max(-12, Math.min(24, Math.round(step)));
    return DO4 * Math.pow(2, SYNTH.oct + s / 12);
}

const NOTA_NOMBRE = ['do', 'do#', 're', 're#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si'];

export function noteLabel(step) {
    const s = Math.max(0, Math.min(PASOS, Math.round(step)));
    return NOTA_NOMBRE[s % 12] + (4 + SYNTH.oct + Math.floor(s / 12));
}

// true = tecla negra (las que se dibujan encima, entre las blancas)
export function esNegra(step) {
    return [1, 3, 6, 8, 10].indexOf(step % 12) !== -1;
}

// sube o baja la escala entera. Devuelve false si ya estaba en el tope
export function shiftOctave(d) {
    const n = Math.max(OCT_MIN, Math.min(OCT_MAX, SYNTH.oct + d));
    if (n === SYNTH.oct) return false;
    SYNTH.oct = n;
    applyParams();   // reafina en el sitio lo que este sonando
    return true;
}

// filtro: 0..10 → 150 Hz .. 12 kHz en escala logaritmica
export function filterHz(step) {
    const s = Math.max(0, Math.min(10, step));
    return Math.round(150 * Math.pow(12000 / 150, s / 10));
}

// en semitonos sobre la nota que este puesta: acorde mayor, siempre afinado
export const ARP_PATRONES = [
    { label: 'subida', pasos: [0, 4, 7, 12] },
    { label: 'bajada', pasos: [12, 7, 4, 0] },
    { label: 'vaiven', pasos: [0, 4, 7, 4] },
    { label: 'salto',  pasos: [0, 7, 4, 12] }
];

const MAX_VOICES = 5;
const RELEASE = 0.3;   // release fijo al soltar una nota (el ataque si es editable)

// estado del sinte: lo editan los potes y los modales; persiste entre visitas al about
export const SYNTH = {
    wave: 0,
    note: 0,
    oct: 0,        // desplazamiento de la escala entera, OCT_MIN..OCT_MAX
    filter: 10,
    drone: true,   // true = siempre sonando · false = solo al tocar (teclas / arpegio)
    voices:  { n: 1, detune: 10 },
    chorus:  { on: false, rate: 1.2,  depth: 0.5, mix: 0.4 },
    flanger: { on: false, rate: 0.35, depth: 0.6, feedback: 0.45, mix: 0.4 },
    reverb:  { on: true,  time: 1.8,  predelay: 20, mix: 0.25 },
    arp:     { bpm: 300, patron: 0, attack: 0.01 }
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

// impulso sintetico para el reverb: ruido que se apaga, con la energia
// normalizada para que el 100% wet suene presente sea cual sea el tiempo
function makeIR(ctx, segundos) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * segundos));
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let energia = 0;
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
            energia += d[i] * d[i];
        }
        const esc = 1 / Math.sqrt(Math.max(energia, 1e-6));
        for (let i = 0; i < len; i++) d[i] *= esc;
    }
    return buf;
}

/* cadena: voces (osc × 5, detune y pan) → envolvente → filtro → tono
   → mezcla (seco + chorus + flanger) → reverb (crossfade dry/wet) → master */
export function startEngine() {
    try {
        const ctx = getAudioCtx();

        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        master.connect(analyser);          // el osciloscopio dibuja lo que suena de verdad

        const env = ctx.createGain();
        env.gain.value = 0.0015;           // en silencio hasta la primera nota
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.Q.value = 2.5;
        const tone = ctx.createGain();
        tone.gain.value = 0.16;
        env.connect(filt); filt.connect(tone);

        // voces: cinco osciladores fijos; el numero activo y el detune se
        // gobiernan por ganancia (asi cambiar de voces no corta el sonido)
        const voices = [];
        for (let i = 0; i < MAX_VOICES; i++) {
            const o = ctx.createOscillator();
            o.type = WAVES[SYNTH.wave].type;
            o.frequency.value = noteHz(SYNTH.note);
            const vg = ctx.createGain();
            vg.gain.value = 0;
            const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            o.connect(vg);
            if (pan) { vg.connect(pan); pan.connect(env); }
            else vg.connect(env);
            o.start();
            voices.push({ o, vg, pan });
        }

        // mezcla previa a la reverb: seco + chorus + flanger
        const mixBus = ctx.createGain();
        tone.connect(mixBus);

        const chDelay = ctx.createDelay(0.1);
        chDelay.delayTime.value = 0.026;
        const chLfo = ctx.createOscillator();
        chLfo.frequency.value = SYNTH.chorus.rate;
        const chDepth = ctx.createGain();
        chLfo.connect(chDepth); chDepth.connect(chDelay.delayTime); chLfo.start();
        const chWet = ctx.createGain();
        chWet.gain.value = 0;
        tone.connect(chDelay); chDelay.connect(chWet); chWet.connect(mixBus);

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
        tone.connect(flDelay); flDelay.connect(flWet); flWet.connect(mixBus);

        // etapa final de reverb: crossfade de señal limpia a solo reverb
        const rvDry = ctx.createGain();
        rvDry.gain.value = 1;
        mixBus.connect(rvDry); rvDry.connect(master);
        const rvPre = ctx.createDelay(0.3);
        rvPre.delayTime.value = SYNTH.reverb.predelay / 1000;
        const conv = ctx.createConvolver();
        conv.buffer = makeIR(ctx, SYNTH.reverb.time);
        const rvWet = ctx.createGain();
        rvWet.gain.value = 0;
        mixBus.connect(rvPre); rvPre.connect(conv); conv.connect(rvWet); rvWet.connect(master);

        engine = { ctx, voices, env, filt, tone, master, analyser, mixBus,
                   chLfo, chDepth, chWet, flLfo, flDepth, flFb, flWet,
                   rvDry, rvPre, conv, rvWet };
        applyParams();
        // drone: arranca sonando sin parar; si no, una nota de bienvenida
        if (SYNTH.drone) setDrone(true);
        else playNote(SYNTH.note, 600);
    } catch (e) { engine = null; }
}

// alterna entre "siempre sonando" (envolvente clavada arriba) y
// "solo al tocar" (silencio hasta que las teclas o el arpegio disparan)
export function setDrone(on) {
    SYNTH.drone = !!on;
    if (!engine || arp.on) return;
    clearTimeout(autoOff);
    const t = engine.ctx.currentTime, g = engine.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    if (SYNTH.drone) g.exponentialRampToValueAtTime(1, t + 0.06);
    else g.exponentialRampToValueAtTime(0.0015, t + RELEASE);
}

export function stopEngine() {
    arpStop();
    if (!engine) return;
    try {
        const t = engine.ctx.currentTime;
        engine.master.gain.cancelScheduledValues(t);
        engine.master.gain.setTargetAtTime(0, t, 0.02);
        engine.voices.forEach(v => v.o.stop(t + 0.2));
        engine.chLfo.stop(t + 0.2);
        engine.flLfo.stop(t + 0.2);
    } catch (e) { /* ya parado */ }
    engine = null;
}

// pone la frecuencia base en todas las voces (con o sin suavizado)
function setFreq(hz, suave) {
    const t = engine.ctx.currentTime;
    engine.voices.forEach(v => {
        if (suave) v.o.frequency.setTargetAtTime(hz, t, 0.02);
        else v.o.frequency.setValueAtTime(hz, t);
    });
}

// vuelca SYNTH y el volumen a los nodos; los efectos en off van con wet a cero
export function applyParams() {
    if (!engine) return;
    const a = engine, t = a.ctx.currentTime, S = SYNTH;

    // voces: ganancia, detune simetrico y spread estereo por voz
    const n = Math.max(1, Math.min(MAX_VOICES, Math.round(S.voices.n)));
    a.voices.forEach((v, i) => {
        v.o.type = WAVES[S.wave].type;
        const activa = i < n;
        v.vg.gain.setTargetAtTime(activa ? 1 / Math.sqrt(n) : 0, t, 0.03);
        const pos = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;   // -1 .. +1
        v.o.detune.setTargetAtTime(activa ? S.voices.detune * pos : 0, t, 0.03);
        if (v.pan) v.pan.pan.setTargetAtTime(activa ? pos * 0.6 : 0, t, 0.03);
    });
    if (!arp.on) setFreq(noteHz(S.note), true);

    a.filt.frequency.setTargetAtTime(filterHz(S.filter), t, 0.03);
    a.chLfo.frequency.setTargetAtTime(S.chorus.rate, t, 0.05);
    a.chDepth.gain.setTargetAtTime(S.chorus.depth * 0.006, t, 0.05);
    a.chWet.gain.setTargetAtTime(S.chorus.on ? S.chorus.mix : 0, t, 0.05);
    a.flLfo.frequency.setTargetAtTime(S.flanger.rate, t, 0.05);
    a.flDepth.gain.setTargetAtTime(S.flanger.depth * 0.003, t, 0.05);
    a.flFb.gain.setTargetAtTime(S.flanger.feedback * 0.85, t, 0.05);
    a.flWet.gain.setTargetAtTime(S.flanger.on ? S.flanger.mix : 0, t, 0.05);

    // reverb: crossfade — a tope de mix queda SOLO la reverb
    const wet = S.reverb.on ? S.reverb.mix : 0;
    a.rvDry.gain.setTargetAtTime(1 - wet, t, 0.05);
    a.rvWet.gain.setTargetAtTime(wet * 2, t, 0.05);
    a.rvPre.delayTime.setTargetAtTime(S.reverb.predelay / 1000, t, 0.05);

    a.master.gain.setTargetAtTime((vol / 8) * 0.5, t, 0.03);
}

export function rebuildReverb() {
    if (!engine) return;
    try { engine.conv.buffer = makeIR(engine.ctx, SYNTH.reverb.time); } catch (e) { /* nada */ }
}

/* ===== Notas: mono (con sus voces), envolvente de ataque editable =====
   noteOn dispara el ataque y se queda sonando; noteOff suelta con un
   release corto fijo. En drone la nota solo cambia la altura. */

export function noteOn(step) {
    SYNTH.note = Math.max(0, Math.min(PASOS, Math.round(step)));
    if (!engine || arp.on) return;
    clearTimeout(autoOff);
    const t = engine.ctx.currentTime, g = engine.env.gain;
    if (SYNTH.drone) {
        // siempre sonando: la nota solo cambia la altura, sin redisparar nada
        setFreq(noteHz(SYNTH.note), true);
        return;
    }
    setFreq(noteHz(SYNTH.note), false);
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    g.exponentialRampToValueAtTime(1, t + Math.max(0.001, SYNTH.arp.attack));
}

export function noteOff() {
    if (!engine || arp.on || SYNTH.drone) return;
    const t = engine.ctx.currentTime, g = engine.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(g.value, 0.0015), t);
    g.exponentialRampToValueAtTime(0.0015, t + RELEASE);
}

// nota que se suelta sola (potes, rueda, cambio de onda)
export function playNote(step, hold = 350) {
    noteOn(step);
    clearTimeout(autoOff);
    autoOff = setTimeout(noteOff, hold);
}

// glissando del theremin: cambia la nota sin redisparar la envolvente
export function noteGlide(step) {
    SYNTH.note = Math.max(0, Math.min(PASOS, Math.round(step)));
    if (!engine || arp.on) return;
    setFreq(noteHz(SYNTH.note), true);
}

/* ===== Arpegiador: recorre el patron; cada nota sube con el ataque
   y cae sola antes del paso siguiente (ataque corto = pluck) ===== */

export function arpStart() {
    if (!engine || arp.on) return;
    arp.on = true;
    arp.i = 0;
    const paso = () => {
        if (!engine) return;
        const pat = ARP_PATRONES[SYNTH.arp.patron] || ARP_PATRONES[0];
        const n = SYNTH.note + pat.pasos[arp.i % pat.pasos.length];
        const durMs = Math.max(60, 60000 / SYNTH.arp.bpm);
        const dur = durMs / 1000;
        const atk = Math.min(Math.max(0.001, SYNTH.arp.attack), dur * 0.5);
        const t = engine.ctx.currentTime;
        const g = engine.env.gain;
        setFreq(noteHz(n), false);
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.0015, t);
        g.exponentialRampToValueAtTime(1, t + atk);
        g.exponentialRampToValueAtTime(0.0015, t + dur * 0.9);
        arp.i++;
        arp.timer = setTimeout(paso, durMs);
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
