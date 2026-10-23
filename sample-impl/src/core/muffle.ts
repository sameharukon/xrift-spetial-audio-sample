/**
 * Muffle / occlusion stage: low-pass + level, driven by a single 0..1 amount
 * (0 = open / inside, 1 = fully occluded, e.g. behind a closed door).
 *
 *   cutoff = closedHz · (openHz / closedHz)^(1 − m)   (log-interpolated → perceptually even)
 *   gain   = closedGain + (1 − closedGain) · (1 − m)
 */
export interface MuffleOptions {
  /** low-pass corner when fully occluded (Hz) */
  closedHz?: number
  /** corner when open (Hz) — 20 kHz = effectively no filter */
  openHz?: number
  /** level when fully occluded */
  closedGain?: number
  /** low-pass resonance */
  Q?: number
  /** initial amount (default 1 = occluded until the first update) */
  initial?: number
  /** smoothing time constant for `set()` (s) */
  tau?: number
}

export interface Muffle {
  /** connect sources here */
  input: AudioNode
  /** connect this to the next stage */
  output: AudioNode
  filter: BiquadFilterNode
  gain: GainNode
  /** set the occlusion amount 0..1 at audio time `t` (smoothed) */
  set(amount: number, t?: number, tau?: number): void
  /** cutoff / gain for an amount (pure function, handy for UI or tests) */
  valuesFor(amount: number): { hz: number; gain: number }
}

export const MUFFLE_DEFAULTS: Required<MuffleOptions> = { closedHz: 160, openHz: 20000, closedGain: 0.45, Q: 0.5, initial: 1, tau: 0.08 }

export function createMuffle(ctx: BaseAudioContext, o: MuffleOptions = {}): Muffle {
  const opt = { ...MUFFLE_DEFAULTS, ...o }
  const valuesFor = (m: number) => ({
    hz: opt.closedHz * Math.pow(opt.openHz / opt.closedHz, 1 - m),
    gain: opt.closedGain + (1 - opt.closedGain) * (1 - m),
  })
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  const v0 = valuesFor(opt.initial)
  filter.frequency.value = v0.hz
  filter.Q.value = opt.Q
  const gain = ctx.createGain()
  gain.gain.value = v0.gain
  filter.connect(gain)
  return {
    input: filter,
    output: gain,
    filter,
    gain,
    valuesFor,
    set(m, t = ctx.currentTime, tau = opt.tau) {
      const v = valuesFor(Math.min(1, Math.max(0, m)))
      filter.frequency.setTargetAtTime(v.hz, t, tau)
      gain.gain.setTargetAtTime(v.gain, t, tau)
    },
  }
}
