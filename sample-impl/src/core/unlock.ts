import { warmUpHrtf } from './panner'

/**
 * Lazy AudioContext + user-gesture unlock (browser autoplay policy).
 *
 * The context is created on the first `unlock()` call (call it from a user gesture) and resumed if it is
 * suspended. `attachGestureUnlock()` wires the usual gestures, including the pointer-lock click and the start
 * of a WebXR session (entering VR on Quest counts as a gesture).
 */
export interface AudioUnlocker {
  /** current context (null until the first unlock) */
  readonly context: AudioContext | null
  /** create (once) and resume the context; resolves true when it is running */
  unlock(): Promise<boolean>
  /** close the context (after `delayMs`, so a fade-out can finish) and forget it */
  close(delayMs?: number): void
}

export interface AudioUnlockerOptions {
  latencyHint?: AudioContextLatencyCategory | number
  sampleRate?: number
  /** load the HRTF database as soon as the context exists, so the first HRTF source does not stall (default true) */
  warmUpHrtf?: boolean
  /** called once, synchronously, right after the context is created (build your graph here) */
  onCreate?: (ctx: AudioContext) => void
  /** called whenever the context reached the running state after an unlock */
  onRunning?: (ctx: AudioContext) => void
}

/** create an AudioContext, or null if the browser refuses */
export function createAudioContext(o: AudioContextOptions = { latencyHint: 'interactive' }): AudioContext | null {
  try { return new AudioContext(o) } catch { return null }
}

export function createAudioUnlocker(o: AudioUnlockerOptions = {}): AudioUnlocker {
  let ctx: AudioContext | null = null
  return {
    get context() { return ctx },
    unlock() {
      if (!ctx) {
        ctx = createAudioContext({ latencyHint: o.latencyHint ?? 'interactive', ...(o.sampleRate ? { sampleRate: o.sampleRate } : {}) })
        if (!ctx) return Promise.resolve(false)
        if (o.warmUpHrtf !== false) warmUpHrtf(ctx)
        o.onCreate?.(ctx)
      }
      const c = ctx
      const done = () => { const ok = c.state === 'running'; if (ok) o.onRunning?.(c); return ok }
      if (c.state !== 'running') return c.resume().then(done, () => false)
      return Promise.resolve(done())
    },
    close(delayMs = 0) {
      const c = ctx
      ctx = null
      if (!c) return
      const go = () => void c.close().catch(() => undefined)
      if (delayMs > 0) setTimeout(go, delayMs)
      else go()
    },
  }
}

/** minimal shape of three's WebXRManager (or any EventTarget-like object) */
export interface XRSessionEvents {
  addEventListener?: (type: string, fn: () => void) => void
  removeEventListener?: (type: string, fn: () => void) => void
}

export const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'mousedown', 'click'] as const

/**
 * Call `unlock` on the first (and every) user gesture: pointer/key/touch/click (capture, passive),
 * pointer-lock changes and XR `sessionstart`. Returns a dispose function.
 */
export function attachGestureUnlock(unlock: () => void, o: { xr?: XRSessionEvents | null; target?: Window } = {}): () => void {
  const target = o.target ?? window
  const opts = { capture: true, passive: true } as const
  for (const e of GESTURE_EVENTS) target.addEventListener(e, unlock, opts)
  target.document.addEventListener('pointerlockchange', unlock)
  o.xr?.addEventListener?.('sessionstart', unlock)
  return () => {
    for (const e of GESTURE_EVENTS) target.removeEventListener(e, unlock, opts)
    target.document.removeEventListener('pointerlockchange', unlock)
    o.xr?.removeEventListener?.('sessionstart', unlock)
  }
}
