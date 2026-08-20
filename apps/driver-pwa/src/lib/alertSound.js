let ctx = null;
function getContext() {
    if (typeof window === 'undefined')
        return null;
    if (ctx)
        return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC)
        return null;
    ctx = new AC();
    return ctx;
}
export function primeAudio() {
    const c = getContext();
    if (c && c.state === 'suspended')
        void c.resume();
}
/** Returns true if the AudioContext is running (i.e. a user gesture has unlocked it). */
export function isAudioUnlocked() {
    const c = getContext();
    return c?.state === 'running';
}
function beep(freq, durationMs, startOffsetMs = 0, volume = 0.35) {
    const c = getContext();
    if (!c)
        return;
    const t0 = c.currentTime + startOffsetMs / 1000;
    const t1 = t0 + durationMs / 1000;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t1);
}
/** Distinct two-pulse alert for incoming job — hard to miss on a bike */
export function playJobAlert() {
    beep(1047, 180, 0, 0.5);
    beep(1047, 180, 220, 0.5);
    beep(1319, 280, 440, 0.6);
}
//# sourceMappingURL=alertSound.js.map