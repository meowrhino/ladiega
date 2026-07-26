// la diega — audio compartido: un solo AudioContext, los bleeps de interfaz
// y la intención de sonido (el navegador bloquea el audio hasta el primer gesto)

let ctx = null;

export function getAudioCtx() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

// on: el usuario quiere sonido · unlocked: ya hubo un gesto que lo permite
export const sound = {
    on: true,
    unlocked: false
};

export function isAudible() {
    return sound.on && sound.unlocked;
}

/* ===== SFX estilo consola, ligados al toggle sound ===== */

const SFX = {
    move:   { f0: 620, f1: 620,  dur: 0.045 },
    select: { f0: 740, f1: 1180, dur: 0.09 },
    back:   { f0: 520, f1: 260,  dur: 0.08 }
};

export function playSfx(type) {
    if (!sound.on) return;
    try {
        const c = getAudioCtx();
        const def = SFX[type];
        if (!def) return;
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(def.f0, t);
        osc.frequency.linearRampToValueAtTime(def.f1, t + def.dur);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + def.dur + 0.02);
    } catch (e) { /* sin audio, no pasa nada */ }
}
