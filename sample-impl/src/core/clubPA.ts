import { createSpeakerPanner, PANNER_DEFAULTS, type SpeakerPannerOptions } from './panner'

/**
 * Club PA for a small basement: the music should fill the room, not come from one point.
 *
 *   input ─┬─ LR4 low-pass 140 Hz ── mono sum ───────────────────────────────┐   (lows: same everywhere)
 *          └─ LR4 high-pass 140 Hz ─┬─ stereo "room bed" (non-spatial) ───────┤
 *                                   ├─ L → left PA stacks  (equal-power panners)┤
 *                                   ├─ R → right PA stacks (equal-power panners)┤
 *                                   └─ HPF 300 Hz → basement reverb (IR) → wet ┤
 *                                                                              └─ bus → glue limiter → destination
 *
 * Notes
 * - Equal-power panners (not HRTF): Web Audio panners apply no propagation delay, so feeding the same
 *   signal to several equal-power panners only sums gains → no comb filtering / phasing. HRTF would add
 *   per-source ITD filters (colouration when summed) and costs much more CPU (Quest).
 * - Left stacks get the left channel and right stacks the right channel → natural decorrelation.
 * - Gentle distance model (large refDistance, low rolloff) → level stays even across the room.
 * - The LR4 crossover (two cascaded 2nd-order Butterworth sections per side) sums flat in magnitude.
 */
export interface PASpeaker {
  /** which programme channel feeds this stack */
  side: 'L' | 'R'
}

export interface ClubPAOptions {
  /** overall level into the PA (programme assumed to peak at about -1 dBFS) */
  master?: number
  /** level of the non-spatial stereo bed for mids/highs (0..1 share of the direct level) */
  bed?: number
  /** per-stack level of the spatial part */
  pa?: number
  /** reverb wet level */
  wet?: number
  crossoverHz?: number
  /** reverb length (s, ≈ RT60) */
  rt60?: number
  /** distance model of the per-stack panners */
  panner?: SpeakerPannerOptions
}

export interface ClubPA {
  input: GainNode
  panners: PannerNode[]
  limiter: DynamicsCompressorNode
  /** gain into the glue limiter (user boost above 100 % goes here, so peaks are caught by the limiter) */
  pre: GainNode
  output: GainNode
  reverb: ConvolverNode
}

/** tuned for a ~10 m × 11 m basement with 4 stacks: ≈ -20 dB RMS everywhere in the room, peaks ≤ -5 dBFS (programme peaking at -1 dBFS) */
export const PA_DEFAULTS: Required<Omit<ClubPAOptions, 'panner'>> = { master: 0.3, bed: 0.6, pa: 0.55, wet: 0.16, crossoverHz: 140, rt60: 0.8 }

/** procedural basement impulse response: predelay, sparse early reflections, dark dense tail */
export function roomIR(ctx: BaseAudioContext, rt60 = 0.8): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.floor(sr * (rt60 + 0.05))
  const buf = ctx.createBuffer(2, len, sr)
  let seed = 424242
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) | 0) >>> 0) / 4294967296 * 2 - 1
  const pre = Math.floor(0.006 * sr)
  const early = [0.011, 0.017, 0.023, 0.031, 0.038, 0.047]
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    let energy = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      const env = Math.exp((-6.91 * t) / rt60) // -60 dB at rt60
      // damping: the tail gets darker over time (one-pole low-pass with a closing coefficient)
      const a = Math.min(0.97, 0.25 + t * 1.6)
      lp = lp * a + rnd() * (1 - a)
      const fadeIn = Math.min(1, t / 0.012)
      d[i] = lp * env * fadeIn * (1.6 + t) // compensate the LP energy loss a little
    }
    for (const [k, et] of early.entries()) {
      const i = pre + Math.floor((et + (ch ? 0.0013 * (k % 3) : 0.0009 * (k % 2))) * sr)
      if (i < len) d[i] += (k % 2 ? -1 : 1) * 0.55 * Math.exp((-6.91 * et) / rt60)
    }
    for (let i = 0; i < len; i++) energy += d[i] * d[i]
    const norm = 1 / Math.sqrt(energy || 1)
    for (let i = 0; i < len; i++) d[i] *= norm
  }
  return buf
}
/** alias of `roomIR` (the default IR models a small concrete basement) */
export const basementIR = roomIR

/** Linkwitz-Riley 4th-order section (two cascaded Butterworth biquads, Q = 1/√2). `src → a → b`, returns b. */
export function lr4(ctx: BaseAudioContext, type: BiquadFilterType, f: number, src: AudioNode): BiquadFilterNode {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter()
  for (const n of [a, b]) { n.type = type; n.frequency.value = f; n.Q.value = Math.SQRT1_2 }
  src.connect(a).connect(b)
  return b
}

/**
 * Build the club PA graph. Connect your programme (stereo) to `pa.input`, then move `pa.panners[i]`
 * to the speaker positions every frame (see `setPannerPosition` / the R3F `<Speaker>` binding).
 * The panner distance model can be tuned with `o.panner` (defaults: inverse, ref 3 m, rolloff 0.7, max 30 m).
 */
export function createClubPA(ctx: BaseAudioContext, speakers: PASpeaker[], o: ClubPAOptions = {}, dest: AudioNode = ctx.destination): ClubPA {
  const opt = { ...PA_DEFAULTS, ...o }
  const po = { ...PANNER_DEFAULTS, ...o.panner }
  const input = ctx.createGain()
  input.gain.value = opt.master
  const bus = ctx.createGain()

  // ---- lows: mono, non-directional ----
  const low = lr4(ctx, 'lowpass', opt.crossoverHz, input)
  const mono = ctx.createGain()
  mono.channelCount = 1
  mono.channelCountMode = 'explicit'
  mono.channelInterpretation = 'speakers' // stereo → mono = (L+R)/2
  // (L+R)/2 loses 3 dB on uncorrelated content; club-music lows are essentially mono, so keep unity
  low.connect(mono).connect(bus)

  // ---- mids / highs ----
  const high = lr4(ctx, 'highpass', opt.crossoverHz, input)
  const bed = ctx.createGain()
  bed.gain.value = opt.bed
  high.connect(bed).connect(bus)

  const split = ctx.createChannelSplitter(2)
  high.connect(split)
  const panners: PannerNode[] = []
  for (const s of speakers) {
    const g = ctx.createGain()
    g.gain.value = opt.pa
    g.channelCount = 1
    g.channelCountMode = 'explicit'
    split.connect(g, s.side === 'L' ? 0 : 1)
    const p = createSpeakerPanner(ctx, po)
    g.connect(p).connect(bus)
    panners.push(p)
  }

  // ---- basement reverb (send from mids/highs only → no muddy kick) ----
  const send = ctx.createBiquadFilter()
  send.type = 'highpass'
  send.frequency.value = 300
  send.Q.value = Math.SQRT1_2
  const reverb = ctx.createConvolver()
  reverb.normalize = false
  reverb.buffer = roomIR(ctx, opt.rt60)
  const wet = ctx.createGain()
  wet.gain.value = opt.wet
  high.connect(send).connect(reverb).connect(wet).connect(bus)

  // ---- glue limiter: only catches peaks from summing (the programme is expected to be limited already) ----
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -4
  limiter.knee.value = 4
  limiter.ratio.value = 12
  limiter.attack.value = 0.002
  limiter.release.value = 0.12
  const output = ctx.createGain()
  output.gain.value = 1
  const pre = ctx.createGain()
  pre.gain.value = 1
  bus.connect(pre).connect(limiter).connect(output).connect(dest)
  return { input, panners, limiter, pre, output, reverb }
}
