/**
 * Per-source audio filters (the Unity "Audio … Filter" set): low-pass, high-pass, reverb, echo, distortion, chorus.
 *
 * Every factory returns an `AudioFilter`: `{ input, output, params, set(params, t?), dispose() }`.
 * - `set()` changes are smoothed with setTargetAtTime (default τ = 20 ms) → no zipper noise / clicks.
 *   Reverb preset / RT60 changes cross-fade between two convolvers.
 * - `createFilterChain()` wires several filters in series between a stable `input` / `output`, and toggles
 *   each one with a click-free dry/wet cross-fade (`enabled: false` also disconnects the filter after the fade,
 *   so a disabled reverb costs no CPU).
 * - Reverb impulse responses are generated procedurally and cached per AudioContext + preset + RT60, so many
 *   reverbs share one buffer (Quest-friendly).
 */

// ------------------------------------------------------------------------------------------------ common

export interface AudioFilter<P = Record<string, unknown>> {
  readonly type: FilterType
  input: AudioNode
  output: AudioNode
  /** current (target) parameters */
  readonly params: Readonly<Required<P>>
  /** change parameters at audio time `t` (smoothed with `tau` seconds) */
  set(p: Partial<P>, t?: number, tau?: number): void
  /** stop oscillators, disconnect everything */
  dispose(): void
}

export type FilterType = 'lowpass' | 'highpass' | 'reverb' | 'echo' | 'distortion' | 'chorus'

export const FILTER_TAU = 0.02

const glide = (p: AudioParam, v: number, t: number, tau: number) => p.setTargetAtTime(v, t, tau)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** linear Q (Unity's "resonance Q", 0.707 = flat Butterworth) → Web Audio lowpass/highpass Q (dB) */
export const resonanceToBiquadQ = (q: number) => 20 * Math.log10(clamp(q, 0.1, 30))

function disconnectAll(...nodes: AudioNode[]) {
  for (const n of nodes) { try { n.disconnect() } catch { /* already */ } }
}

// ------------------------------------------------------------------------------------- low / high pass

export interface PassFilterParams {
  /** corner frequency (Hz) */
  cutoff?: number
  /** linear Q: 0.707 = flat (Butterworth), 1 = Unity's default, up to ~10 for a resonant peak */
  resonance?: number
}

export const LOWPASS_DEFAULTS: Required<PassFilterParams> = { cutoff: 5000, resonance: Math.SQRT1_2 }
export const HIGHPASS_DEFAULTS: Required<PassFilterParams> = { cutoff: 500, resonance: Math.SQRT1_2 }

function createPass(ctx: BaseAudioContext, type: 'lowpass' | 'highpass', o: PassFilterParams): AudioFilter<PassFilterParams> {
  const params = { ...(type === 'lowpass' ? LOWPASS_DEFAULTS : HIGHPASS_DEFAULTS), ...o }
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = clamp(params.cutoff, 10, ctx.sampleRate / 2)
  f.Q.value = resonanceToBiquadQ(params.resonance)
  return {
    type,
    input: f,
    output: f,
    get params() { return params },
    set(p, t = ctx.currentTime, tau = FILTER_TAU) {
      Object.assign(params, p)
      // glide the corner in the log domain feel: setTargetAtTime on Hz is fine for τ ≈ 20 ms
      glide(f.frequency, clamp(params.cutoff, 10, ctx.sampleRate / 2), t, tau)
      glide(f.Q, resonanceToBiquadQ(params.resonance), t, tau)
    },
    dispose() { disconnectAll(f) },
  }
}

/** Unity AudioLowPassFilter */
export const createLowPass = (ctx: BaseAudioContext, o: PassFilterParams = {}) => createPass(ctx, 'lowpass', o)
/** Unity AudioHighPassFilter */
export const createHighPass = (ctx: BaseAudioContext, o: PassFilterParams = {}) => createPass(ctx, 'highpass', o)

// --------------------------------------------------------------------------------------------- reverb

export type ReverbPreset = 'small' | 'room' | 'basement' | 'hall'

export interface ReverbShape {
  /** default RT60 (s) */
  rt60: number
  /** early-reflection spread (1 = ~10 m room) */
  size: number
  /** how fast the tail darkens (one-pole closing rate per second) */
  darken: number
  /** early reflection level */
  early: number
}

export const REVERB_PRESETS: Record<ReverbPreset, ReverbShape & { preDelay: number; damping: number; lowCut: number }> = {
  small: { rt60: 0.4, size: 0.5, darken: 2.0, early: 0.6, preDelay: 0.004, damping: 7000, lowCut: 200 },
  room: { rt60: 0.8, size: 1, darken: 1.2, early: 0.5, preDelay: 0.01, damping: 6000, lowCut: 200 },
  basement: { rt60: 1.0, size: 0.9, darken: 1.6, early: 0.55, preDelay: 0.006, damping: 4000, lowCut: 250 },
  hall: { rt60: 2.2, size: 2.6, darken: 0.5, early: 0.35, preDelay: 0.025, damping: 5000, lowCut: 150 },
}

/**
 * Procedural stereo impulse response: sparse early reflections + decorrelated noise tail with
 * an exponential envelope reaching −60 dB at `rt60`, darkening over time. Energy-normalised per channel.
 */
export function reverbIR(ctx: BaseAudioContext, shape: ReverbShape, seed = 9001): AudioBuffer {
  const sr = ctx.sampleRate
  const rt60 = Math.max(0.05, shape.rt60)
  const len = Math.floor(sr * (rt60 * 1.1 + 0.05))
  const buf = ctx.createBuffer(2, len, sr)
  const early = [0.011, 0.017, 0.023, 0.031, 0.038, 0.047, 0.058, 0.071].map((e) => e * shape.size)
  for (let ch = 0; ch < 2; ch++) {
    let s = (seed + ch * 7919) | 0
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 0) / 4294967296 * 2 - 1
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const env = Math.exp((-6.91 * t) / rt60)
      const a = Math.min(0.97, 0.2 + t * shape.darken)
      lp = lp * a + rnd() * (1 - a)
      // × sqrt((1+a)/(1−a)) keeps the filtered noise at unit variance → the decay follows `env` exactly
      d[i] = lp * Math.sqrt((1 + a) / (1 - a)) * env * Math.min(1, t / 0.01)
    }
    for (const [k, et] of early.entries()) {
      const i = Math.floor((et + (ch ? 0.0013 * (k % 3) : 0.0009 * (k % 2))) * sr)
      if (i < len) d[i] += (k % 2 ? -1 : 1) * shape.early * Math.exp((-6.91 * et) / rt60)
    }
    let e = 0
    for (let i = 0; i < len; i++) e += d[i] * d[i]
    const n = 1 / Math.sqrt(e || 1)
    for (let i = 0; i < len; i++) d[i] *= n
  }
  return buf
}

const irCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

/** cached IR for a preset + RT60 (RT60 quantised to 50 ms) — shared by every reverb on the context */
export function getReverbIR(ctx: BaseAudioContext, preset: ReverbPreset, rt60?: number): AudioBuffer {
  const base = REVERB_PRESETS[preset] ?? REVERB_PRESETS.room
  const r = Math.round(clamp(rt60 ?? base.rt60, 0.1, 8) * 20) / 20
  const key = `${preset}:${r}`
  let m = irCache.get(ctx)
  if (!m) irCache.set(ctx, (m = new Map()))
  let b = m.get(key)
  if (!b) m.set(key, (b = reverbIR(ctx, { ...base, rt60: r })))
  return b
}

export interface ReverbParams {
  preset?: ReverbPreset
  /** decay time to −60 dB (s); defaults to the preset's */
  rt60?: number
  /** pre-delay before the tail (s, 0..0.3) */
  preDelay?: number
  /** dry level (0..1) */
  dry?: number
  /** wet level (0..1) */
  wet?: number
  /** high cut on the wet signal (Hz) — Unity "HF reference / room HF" */
  damping?: number
  /** low cut on the wet signal (Hz) — keeps kicks / bass dry */
  lowCut?: number
}

/** Unity AudioReverbFilter (presets + decay / pre-delay / dry / wet / damping) */
export function createReverb(ctx: BaseAudioContext, o: ReverbParams = {}): AudioFilter<ReverbParams> {
  const pr = REVERB_PRESETS[o.preset ?? 'room']
  const params: Required<ReverbParams> = { preset: 'room', rt60: pr.rt60, preDelay: pr.preDelay, dry: 0.85, wet: 0.35, damping: pr.damping, lowCut: pr.lowCut, ...o }
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = params.dry
  input.connect(dry).connect(output)
  const pre = ctx.createDelay(0.5)
  pre.delayTime.value = clamp(params.preDelay, 0, 0.3)
  const lo = ctx.createBiquadFilter()
  lo.type = 'highpass'; lo.frequency.value = params.lowCut; lo.Q.value = resonanceToBiquadQ(Math.SQRT1_2)
  const hi = ctx.createBiquadFilter()
  hi.type = 'lowpass'; hi.frequency.value = params.damping; hi.Q.value = resonanceToBiquadQ(Math.SQRT1_2)
  const wet = ctx.createGain()
  wet.gain.value = params.wet
  input.connect(pre).connect(lo)
  // two convolvers, cross-faded when the IR changes
  const conv = [ctx.createConvolver(), ctx.createConvolver()]
  const fade = [ctx.createGain(), ctx.createGain()]
  conv.forEach((c, i) => { c.normalize = false; lo.connect(c).connect(fade[i]).connect(hi) })
  hi.connect(wet).connect(output)
  let active = 0
  let irKey = ''
  const loadIR = (t: number, tau: number) => {
    const key = `${params.preset}:${params.rt60}`
    if (key === irKey) return
    const buf = getReverbIR(ctx, params.preset, params.rt60)
    if (!irKey) {
      conv[0].buffer = buf; fade[0].gain.value = 1; fade[1].gain.value = 0
    } else {
      const next = 1 - active
      conv[next].buffer = buf
      glide(fade[next].gain, 1, t, tau * 3)
      glide(fade[active].gain, 0, t, tau * 3)
      active = next
    }
    irKey = key
  }
  loadIR(ctx.currentTime, FILTER_TAU)
  return {
    type: 'reverb',
    input,
    output,
    get params() { return params },
    set(p, t = ctx.currentTime, tau = FILTER_TAU) {
      if (p.preset && p.preset !== params.preset && p.rt60 === undefined) {
        const np = REVERB_PRESETS[p.preset]
        Object.assign(params, { rt60: np.rt60, preDelay: np.preDelay, damping: np.damping, lowCut: np.lowCut })
      }
      Object.assign(params, p)
      glide(dry.gain, params.dry, t, tau)
      glide(wet.gain, params.wet, t, tau)
      glide(pre.delayTime, clamp(params.preDelay, 0, 0.3), t, tau)
      glide(hi.frequency, clamp(params.damping, 200, ctx.sampleRate / 2), t, tau)
      glide(lo.frequency, clamp(params.lowCut, 10, 2000), t, tau)
      loadIR(t, tau)
    },
    dispose() { disconnectAll(input, dry, pre, lo, ...conv, ...fade, hi, wet, output) },
  }
}

// ----------------------------------------------------------------------------------------------- echo

export interface EchoParams {
  /** delay between repeats (s) — Unity "delay" (ms) / 1000 */
  delay?: number
  /** level ratio of each repeat to the previous one (0..0.95) — Unity "decayRatio" */
  feedback?: number
  dry?: number
  wet?: number
  /** high cut inside the feedback loop (Hz; repeats get darker). 20000 = off */
  damping?: number
}

export const ECHO_DEFAULTS: Required<EchoParams> = { delay: 0.5, feedback: 0.4, dry: 1, wet: 0.3, damping: 20000 }

/** Unity AudioEchoFilter */
export function createEcho(ctx: BaseAudioContext, o: EchoParams = {}, maxDelay = 2): AudioFilter<EchoParams> {
  const params = { ...ECHO_DEFAULTS, ...o }
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = params.dry
  input.connect(dry).connect(output)
  // first repeat: input → d (T) → sum; further repeats: sum → damp → fb → loop (T − 1 render quantum) → sum.
  // Chromium adds one render quantum (128 frames) to every delay inside a cycle; the loop delay is shortened by
  // that amount so the repeats land on T, 2T, 3T … (measured within ±0.1 ms).
  const q = 128 / ctx.sampleRate
  const d = ctx.createDelay(maxDelay)
  d.delayTime.value = clamp(params.delay, 0.001, maxDelay)
  const loop = ctx.createDelay(maxDelay)
  loop.delayTime.value = clamp(params.delay - q, q, maxDelay)
  const sum = ctx.createGain()
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'; damp.frequency.value = params.damping; damp.Q.value = resonanceToBiquadQ(Math.SQRT1_2)
  const fb = ctx.createGain()
  fb.gain.value = clamp(params.feedback, 0, 0.95)
  const wet = ctx.createGain()
  wet.gain.value = params.wet
  input.connect(d).connect(sum)
  sum.connect(damp).connect(fb).connect(loop).connect(sum)
  sum.connect(wet).connect(output)
  return {
    type: 'echo',
    input,
    output,
    get params() { return params },
    set(p, t = ctx.currentTime, tau = FILTER_TAU) {
      Object.assign(params, p)
      glide(dry.gain, params.dry, t, tau)
      glide(wet.gain, params.wet, t, tau)
      glide(fb.gain, clamp(params.feedback, 0, 0.95), t, tau)
      glide(d.delayTime, clamp(params.delay, 0.001, maxDelay), t, tau * 2)
      glide(loop.delayTime, clamp(params.delay - q, q, maxDelay), t, tau * 2)
      glide(damp.frequency, clamp(params.damping, 200, ctx.sampleRate / 2), t, tau)
    },
    dispose() { disconnectAll(input, dry, d, sum, damp, fb, loop, wet, output) },
  }
}

// ----------------------------------------------------------------------------------------- distortion

export interface DistortionParams {
  /** 0..1 — Unity "distortionLevel" */
  amount?: number
  dry?: number
  wet?: number
}

let distCurve: Float32Array<ArrayBuffer> | null = null
/** fixed soft-clip curve tanh(3x)/tanh(3); the amount drives the gain into it (smooth, no curve swaps) */
function softClipCurve() {
  if (distCurve) return distCurve
  const n = 2049
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(3 * x) / Math.tanh(3) }
  return (distCurve = c)
}

/** Unity AudioDistortionFilter (soft clipping; output peak stays ≤ the input full scale) */
export function createDistortion(ctx: BaseAudioContext, o: DistortionParams = {}): AudioFilter<DistortionParams> {
  const params: Required<DistortionParams> = { amount: 0.5, dry: 0, wet: 1, ...o }
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = params.dry
  input.connect(dry).connect(output)
  const drive = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  shaper.curve = softClipCurve()
  // no oversampling: the 2×/4× resampling filters overshoot (Gibbs) on hard-driven bass, up to +4 dB
  shaper.oversample = 'none'
  const makeup = ctx.createGain()
  const wet = ctx.createGain()
  wet.gain.value = params.wet
  const driveFor = (a: number) => 0.35 + clamp(a, 0, 1) * 12
  // tanh(3·x·drive)/tanh(3): keep moderate-level programme at roughly the same loudness
  const makeupFor = (a: number) => 1 / (1 + clamp(a, 0, 1) * 0.6)
  drive.gain.value = driveFor(params.amount)
  makeup.gain.value = makeupFor(params.amount)
  input.connect(drive).connect(shaper).connect(makeup).connect(wet).connect(output)
  return {
    type: 'distortion',
    input,
    output,
    get params() { return params },
    set(p, t = ctx.currentTime, tau = FILTER_TAU) {
      Object.assign(params, p)
      glide(drive.gain, driveFor(params.amount), t, tau)
      glide(makeup.gain, makeupFor(params.amount), t, tau)
      glide(dry.gain, params.dry, t, tau)
      glide(wet.gain, params.wet, t, tau)
    },
    dispose() { disconnectAll(input, dry, drive, shaper, makeup, wet, output) },
  }
}

// --------------------------------------------------------------------------------------------- chorus

export interface ChorusParams {
  /** LFO rate (Hz) */
  rate?: number
  /** modulation depth (s of delay swing, e.g. 0.002) */
  depth?: number
  /** centre delay (s) */
  delay?: number
  dry?: number
  wet?: number
}

export const CHORUS_DEFAULTS: Required<ChorusParams> = { rate: 0.8, depth: 0.0025, delay: 0.02, dry: 0.6, wet: 0.4 }

/** Unity AudioChorusFilter (two voices, LFOs 90° apart → stereo width) */
export function createChorus(ctx: BaseAudioContext, o: ChorusParams = {}): AudioFilter<ChorusParams> {
  const params = { ...CHORUS_DEFAULTS, ...o }
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = params.dry
  input.connect(dry).connect(output)
  const wet = ctx.createGain()
  wet.gain.value = params.wet
  const merger = ctx.createChannelMerger(2)
  const voices = [0, 1].map((i) => {
    const d = ctx.createDelay(0.1)
    d.delayTime.value = params.delay
    const lfo = ctx.createOscillator()
    lfo.frequency.value = params.rate
    const depth = ctx.createGain()
    depth.gain.value = params.depth
    lfo.connect(depth).connect(d.delayTime)
    lfo.start(ctx.currentTime + (i * 0.25) / Math.max(0.01, params.rate)) // 90° apart
    input.connect(d)
    d.connect(merger, 0, i)
    return { d, lfo, depth }
  })
  merger.connect(wet).connect(output)
  return {
    type: 'chorus',
    input,
    output,
    get params() { return params },
    set(p, t = ctx.currentTime, tau = FILTER_TAU) {
      Object.assign(params, p)
      for (const v of voices) {
        glide(v.d.delayTime, clamp(params.delay, 0.001, 0.09), t, tau)
        glide(v.lfo.frequency, clamp(params.rate, 0.01, 20), t, tau)
        glide(v.depth.gain, clamp(params.depth, 0, 0.02), t, tau)
      }
      glide(dry.gain, params.dry, t, tau)
      glide(wet.gain, params.wet, t, tau)
    },
    dispose() {
      for (const v of voices) { try { v.lfo.stop() } catch { /* */ } disconnectAll(v.lfo, v.depth, v.d) }
      disconnectAll(input, dry, merger, wet, output)
    },
  }
}

// ---------------------------------------------------------------------------------------------- specs

export type FilterSpec =
  | ({ type: 'lowpass' } & PassFilterParams & Toggle)
  | ({ type: 'highpass' } & PassFilterParams & Toggle)
  | ({ type: 'reverb' } & ReverbParams & Toggle)
  | ({ type: 'echo' } & EchoParams & Toggle)
  | ({ type: 'distortion' } & DistortionParams & Toggle)
  | ({ type: 'chorus' } & ChorusParams & Toggle)

interface Toggle {
  /** false = bypassed (click-free cross-fade; the filter is disconnected after the fade). Default true */
  enabled?: boolean
}

/** create one filter from a spec (`enabled` is handled by the chain) */
export function createFilter(ctx: BaseAudioContext, spec: FilterSpec): AudioFilter<any> {
  const { type, enabled: _e, ...rest } = spec
  const p = rest as any
  switch (type) {
    case 'lowpass': return createLowPass(ctx, p)
    case 'highpass': return createHighPass(ctx, p)
    case 'reverb': return createReverb(ctx, p)
    case 'echo': return createEcho(ctx, p)
    case 'distortion': return createDistortion(ctx, p)
    case 'chorus': return createChorus(ctx, p)
  }
}

// ---------------------------------------------------------------------------------------------- chain

export interface FilterChain {
  /** connect sources here (stable for the chain's lifetime) */
  input: GainNode
  /** connect this to a panner / bus (stable) */
  output: GainNode
  readonly filters: readonly AudioFilter<any>[]
  /**
   * apply specs: same types in the same order → params are glided and `enabled` cross-faded;
   * otherwise the filters are rebuilt (the output is ducked for ~30 ms around the rewire).
   */
  update(specs: readonly FilterSpec[], t?: number): void
  dispose(): void
}

interface Slot {
  f: AudioFilter<any>
  inGate: GainNode
  dry: GainNode
  wet: GainNode
  out: GainNode
  enabled: boolean
  connected: boolean
  timer: ReturnType<typeof setTimeout> | null
}

const XFADE = 0.015

/** a series chain of filters with click-free bypass per filter */
export function createFilterChain(ctx: BaseAudioContext, specs: readonly FilterSpec[] = []): FilterChain {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const duck = ctx.createGain()
  duck.connect(output)
  let slots: Slot[] = []
  let types = ''

  const makeSlot = (spec: FilterSpec): Slot => {
    const f = createFilter(ctx, spec)
    const inGate = ctx.createGain()
    const dry = ctx.createGain()
    const wet = ctx.createGain()
    const out = ctx.createGain()
    const on = spec.enabled !== false
    dry.gain.value = on ? 0 : 1
    wet.gain.value = on ? 1 : 0
    inGate.connect(dry).connect(out)
    f.output.connect(wet).connect(out)
    if (on) inGate.connect(f.input)
    return { f, inGate, dry, wet, out, enabled: on, connected: on, timer: null }
  }
  const setEnabled = (s: Slot, on: boolean, t: number) => {
    if (on === s.enabled) return
    s.enabled = on
    if (s.timer) { clearTimeout(s.timer); s.timer = null }
    if (on && !s.connected) { s.inGate.connect(s.f.input); s.connected = true }
    glide(s.dry.gain, on ? 0 : 1, t, XFADE)
    glide(s.wet.gain, on ? 1 : 0, t, XFADE)
    if (!on) {
      // keep reverb / echo tails out of the bypass, then free the CPU
      s.timer = setTimeout(() => {
        s.timer = null
        if (!s.enabled && s.connected) { try { s.inGate.disconnect(s.f.input) } catch { /* */ } s.connected = false }
      }, 200)
    }
  }
  const disposeSlot = (s: Slot) => {
    if (s.timer) clearTimeout(s.timer)
    s.f.dispose()
    disconnectAll(s.inGate, s.dry, s.wet, s.out)
  }
  const wire = () => {
    disconnectAll(input)
    let prev: AudioNode = input
    for (const s of slots) { prev.connect(s.inGate); prev = s.out }
    prev.connect(duck)
  }
  const rebuild = (next: readonly FilterSpec[], t: number) => {
    const old = slots
    slots = next.map(makeSlot)
    types = next.map((s) => s.type).join(',')
    if (old.length === 0 || ctx.state !== 'running') {
      old.forEach(disposeSlot)
      wire()
      return
    }
    // duck → rewire → unduck (≈ 30 ms gap instead of a click)
    duck.gain.cancelScheduledValues(t)
    glide(duck.gain, 0, t, 0.005)
    setTimeout(() => {
      old.forEach(disposeSlot)
      wire()
      glide(duck.gain, 1, ctx.currentTime, 0.008)
    }, 30)
  }
  rebuild(specs, ctx.currentTime)

  return {
    input,
    output,
    get filters() { return slots.map((s) => s.f) },
    update(next, t = ctx.currentTime) {
      if (next.map((s) => s.type).join(',') !== types) return rebuild(next, t)
      next.forEach((spec, i) => {
        const s = slots[i]
        const { type: _t, enabled, ...p } = spec
        s.f.set(p, t)
        setEnabled(s, enabled !== false, t)
      })
    },
    dispose() {
      slots.forEach(disposeSlot)
      slots = []
      disconnectAll(input, duck, output)
    },
  }
}
