let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  return ctx
}

export function primeAudio(): void {
  const c = getContext()
  if (c && c.state === 'suspended') void c.resume()
}

function beep(freq: number, durationMs: number, startOffsetMs = 0, volume = 0.3): void {
  const c = getContext()
  if (!c) return
  const t0 = c.currentTime + startOffsetMs / 1000
  const t1 = t0 + durationMs / 1000
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t1)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t1)
}

function playUrgentBell(): void {
  beep(784,  150,   0, 0.5)
  beep(988,  150, 130, 0.5)
  beep(1175, 300, 260, 0.6)
}

let loopHandle: ReturnType<typeof setInterval> | null = null

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

export function playStatusChime(): void {
  beep(880, 120, 0, 0.2)
  beep(1047, 160, 100, 0.2)
}
