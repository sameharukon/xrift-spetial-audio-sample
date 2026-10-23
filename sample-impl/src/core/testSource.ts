/**
 * Simple synthesized test programme for demos, examples and level checks (no samples, no external files).
 *
 *   pinkNoise  decorrelated stereo pink noise (Paul Kellet's filter), seeded → reproducible
 *   sine       a steady sine tone (default 440 Hz)
 *   drumLoop   one bar of four-on-the-floor: a pitched-down sine kick on every beat, an open hat on the
 *              off-beats and quiet closed hats on the 16ths (hats panned slightly apart)
 *
 * Buffers are peak-normalised to −1 dBFS (×0.89) before `gain`, leaving headroom for the output stage.
 */
export type TestSourceType = 'pinkNoise' | 'sine' | 'drumLoop'

export interface TestSourceOptions {
  type?: TestSourceType
  /** output gain (default 1 → peaks at about −1 dBFS) */
  gain?: number
  /** sine frequency (Hz) */
  frequency?: number
  /** drum loop tempo (BPM) */
  bpm?: number
  /** noise seed (pinkNoise / drumLoop hats) */
  seed?: number
}

export interface TestSource {
  /** stereo output: connect it to a muffle, a panner, … */
  output: GainNode
  /** start (or restart) playback at audio time `when` (loops until stopped) */
  start(when?: number): void
  stop(when?: number): void
  readonly playing: boolean
  /** the rendered loop (null for `sine`, which uses an OscillatorNode) */
  readonly buffer: AudioBuffer | null
}

const PEAK = 0.89

function makeRng(seed: number) {
  let s = seed | 0 || 1
  return () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 0) / 4294967296 * 2 - 1
}

function normalise(b: AudioBuffer) {
  let pk = 0
  for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) pk = Math.max(pk, Math.abs(v))
  if (pk > 0) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= PEAK / pk }
  return b
}

/** 4 s of stereo pink noise (loops; the seam is inaudible in noise) */
export function pinkNoiseBuffer(ctx: BaseAudioContext, seed = 1, seconds = 4): AudioBuffer {
  const sr = ctx.sampleRate
  const b = ctx.createBuffer(2, Math.floor(sr * seconds), sr)
  for (let c = 0; c < 2; c++) {
    const rnd = makeRng(seed * 7919 + c * 104729)
    const d = b.getChannelData(c)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < d.length; i++) {
      const w = rnd()
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
      b6 = w * 0.115926
    }
  }
  return normalise(b)
}

/** one bar (4 beats) of kick + hats at `bpm`, sample-exact so it loops seamlessly */
export function drumLoopBuffer(ctx: BaseAudioContext, bpm = 124, seed = 1): AudioBuffer {
  const sr = ctx.sampleRate
  const beat = 60 / bpm
  const len = Math.round(sr * beat * 4)
  const b = ctx.createBuffer(2, len, sr)
  const L = b.getChannelData(0), R = b.getChannelData(1)
  const rnd = makeRng(seed * 31337)
  // kick: sine with a fast exponential pitch drop (150 → 48 Hz) and a ~0.35 s decay, short click at the onset
  const kickLen = Math.floor(sr * 0.4)
  for (let k = 0; k < 4; k++) {
    const at = Math.round(k * beat * sr)
    let ph = 0
    for (let i = 0; i < kickLen && at + i < len; i++) {
      const t = i / sr
      const f = 48 + 102 * Math.exp(-t * 28)
      ph += (2 * Math.PI * f) / sr
      const env = Math.exp(-t * 9) * Math.min(1, t / 0.001)
      const click = i < sr * 0.004 ? 0.25 * rnd() * (1 - i / (sr * 0.004)) : 0
      const v = Math.sin(ph) * env + click
      L[at + i] += v; R[at + i] += v
    }
  }
  // hats: first-difference (high-passed) noise bursts; open hat on the off-beat, closed hats on the 16ths
  for (let s = 0; s < 16; s++) {
    const open = s % 4 === 2
    if (!open && s % 2 === 0) continue // closed hats on odd 16ths only
    const at = Math.round((s * beat * sr) / 4)
    const dur = Math.floor(sr * (open ? 0.12 : 0.03))
    const amp = open ? 0.32 : 0.14
    const panL = open ? 0.9 : 1, panR = open ? 1 : 0.85
    let prev = 0
    for (let i = 0; i < dur && at + i < len; i++) {
      const w = rnd()
      const hp = w - prev
      prev = w
      const env = Math.exp((-i / sr) * (open ? 30 : 120))
      L[at + i] += hp * amp * env * panL
      R[at + i] += hp * amp * env * panR
    }
  }
  return normalise(b)
}

export function createTestSource(ctx: BaseAudioContext, o: TestSourceOptions = {}): TestSource {
  const type = o.type ?? 'drumLoop'
  const output = ctx.createGain()
  output.gain.value = o.gain ?? 1
  const buffer = type === 'pinkNoise' ? pinkNoiseBuffer(ctx, o.seed ?? 1) : type === 'drumLoop' ? drumLoopBuffer(ctx, o.bpm ?? 124, o.seed ?? 1) : null
  let node: AudioScheduledSourceNode | null = null
  const stop = (when = ctx.currentTime) => {
    if (!node) return
    try { node.stop(when) } catch { /* already stopped */ }
    node = null
  }
  return {
    output,
    buffer,
    get playing() { return node !== null },
    start(when = ctx.currentTime) {
      stop(when)
      if (buffer) {
        const s = ctx.createBufferSource()
        s.buffer = buffer
        s.loop = true
        s.connect(output)
        s.start(when)
        node = s
      } else {
        const osc = ctx.createOscillator()
        osc.frequency.value = o.frequency ?? 440
        const g = ctx.createGain()
        g.gain.value = PEAK
        osc.connect(g).connect(output)
        osc.start(when)
        node = osc
      }
    },
    stop,
  }
}
