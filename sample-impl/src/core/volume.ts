/**
 * Per-user volume curve and output safety stage.
 *
 * Fader position `level` 0..1, centre 0.5 = 100 % (the tuned level):
 *   lower half 0 → 100 %: cubic taper on amplitude (≈ perceptual; 25 % travel → −18 dB, 0 → mute),
 *     applied *after* the limiter ("cut" gain)
 *   upper half 100 % → max: amplitude rises linearly (200 % = ×2 = +6 dB), applied *before* the glue
 *     limiter ("boost" gain) so loud peaks are caught there instead of clipping
 */
export const VOL_MAX = 2

/** fader position → percentage / 100 (0 .. max) */
export function volumeValue(level: number, max = VOL_MAX): number {
  const p = Math.min(1, Math.max(0, level))
  return p <= 0.5 ? p * 2 : 1 + (max - 1) * (p * 2 - 1)
}

/** fader position → [post-limiter cut gain, pre-limiter boost gain] */
export function volumeStages(level: number, max = VOL_MAX): [number, number] {
  const v = volumeValue(level, max)
  return v <= 1 ? [v * v * v, 1] : [1, v]
}

/**
 * Apply a fader position to a cut gain (after the limiter) and a boost gain (before it),
 * with a short exponential glide (default ≈ 40 ms → no zipper noise / clicks).
 */
export function applyVolumeStages(level: number, cut: GainNode, boost: GainNode, t: number, tau = 0.04, max = VOL_MAX) {
  const [c, b] = volumeStages(level, max)
  cut.gain.setTargetAtTime(c, t, tau)
  boost.gain.setTargetAtTime(b, t, tau)
}

/**
 * Waveshaper curve for ±2.0 full scale (feed it ×0.5): identity up to `knee` (default −1 dBFS),
 * tanh knee up to `ceiling` (default −0.1 dBFS). Transparent for normal programme; only the rare boosted
 * peak that slips past the limiter is rounded off → never hard digital clipping.
 */
export function softCeilingCurve(n = 4097, knee = 0.891, ceiling = 0.989): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n)
  const k = knee, top = ceiling
  for (let i = 0; i < n; i++) {
    const a = ((i / (n - 1)) * 2 - 1) * 2
    const m = Math.abs(a)
    c[i] = Math.sign(a) * (m <= k ? m : k + (top - k) * Math.tanh((m - k) / (top - k)))
  }
  return c
}

export interface SoftCeiling {
  /** ×0.5 trim into the shaper */
  input: GainNode
  shaper: WaveShaperNode
  output: AudioNode
}

/** `input (×0.5) → waveshaper(softCeilingCurve, 2× oversampling)` — put it last, right before the destination */
export function createSoftCeiling(ctx: BaseAudioContext, o: { knee?: number; ceiling?: number; oversample?: OverSampleType } = {}): SoftCeiling {
  const input = ctx.createGain()
  input.gain.value = 0.5
  const shaper = ctx.createWaveShaper()
  shaper.curve = softCeilingCurve(4097, o.knee, o.ceiling)
  shaper.oversample = o.oversample ?? '2x'
  input.connect(shaper)
  return { input, shaper, output: shaper }
}
