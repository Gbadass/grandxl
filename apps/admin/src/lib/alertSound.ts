/**
 * Lightweight audio alert via Web Audio API — no assets, no external libs.
 * Plays a two-tone chime so the kitchen hears every new order, even with the tab unfocused.
 */

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

/**
 * Most browsers suspend AudioContext until a user gesture. Call this once on
 * mount; on the first click/keypress the context resumes and stays open.
 */
export function primeAudio(): void {
  const c = getContext()
  if (c && c.state === 'suspended') {
    void c.resume().then(() => {
      console.debug('[alertSound] AudioContext resumed successfully, state:', c.state)
    })
  }
}

/** Returns true if the AudioContext is running (i.e. a user gesture has unlocked it). */
export function isAudioUnlocked(): boolean {
  const c = getContext()
  return c?.state === 'running'
}

function beep(freq: number, durationMs: number, startOffsetMs = 0, volume = 0.25): void {
  const c = getContext()
  if (!c) return
  const t0 = c.currentTime + startOffsetMs / 1000
  const t1 = t0 + durationMs / 1000

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t0)

  // Short attack/decay so it sounds like a chime, not a tone
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t1)

  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t1)
}

/** Two-tone chime: G5 → C6 — about 450ms total. */
export function playNewOrderChime(): void {
  beep(784, 220, 0)
  beep(1047, 280, 180)
}

// ── Looping urgent alarm (for persistent modals) ─────────────────────────────

let loopHandle: ReturnType<typeof setInterval> | null = null

function playUrgentBell(): void {
  beep(784,  150,   0, 0.4)
  beep(988,  150, 130, 0.4)
  beep(1175, 250, 260, 0.5)
}

export function startLoopAlarm(): void {
  const c = getContext()
  if (c?.state === 'suspended') void c.resume()
  playUrgentBell()
  if (!loopHandle) {
    loopHandle = setInterval(playUrgentBell, 2800)
  }
}

export function stopLoopAlarm(): void {
  if (loopHandle) {
    clearInterval(loopHandle)
    loopHandle = null
  }
}
