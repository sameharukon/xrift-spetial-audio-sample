/**
 * Audio analysis for visualisers (AnalyserNode based; ≈ Unity AudioSource.GetSpectrumData / GetOutputData).
 *
 * - Tap any node: `const a = createAnalyser(ctx); const untap = a.tap(speakerInputOrMaster)`.
 *   The analyser is a dead end (not connected to the destination), so tapping never changes the sound.
 * - Nothing is computed until you call `update()` (e.g. once per frame). All buffers are allocated once →
 *   no per-frame garbage.
 * - Exposes: spectrum (Float dB / Uint8), waveform, RMS / peak, log-spaced bands 0..1 with attack / release,
 *   a low-band onset ("beat") detector with a BPM estimate, and dominant-frequency / pitch estimates.
 */

export type BandPreset = 'four' | 'eight' | 'sixteen' | 'thirtyTwo'

/** named 4-band split (Hz) */
export const FOUR_BANDS = [
  { name: 'bass', lo: 20, hi: 150 },
  { name: 'lowMid', lo: 150, hi: 500 },
  { name: 'mid', lo: 500, hi: 2000 },
  { name: 'high', lo: 2000, hi: 16000 },
] as const

export interface AnalyserOptions {
  /** FFT size (power of two, 32..32768). 2048 @ 48 kHz → 23 Hz bins, 43 ms window */
  fftSize?: number
  /** AnalyserNode spectrum smoothing (0..1) */
  smoothing?: number
  /** dB mapped to 0 (bands, Uint8 spectrum) */
  minDb?: number
  /** dB mapped to 1 */
  maxDb?: number
  /** number of log-spaced bands between `minHz` and `maxHz`, or 'four' for bass / lowMid / mid / high */
  bands?: number | 'four'
  minHz?: number
  maxHz?: number
  /** band attack / release time constants (s) */
  attack?: number
  release?: number
  /** onset detector: low band (Hz), sensitivity (× std above the running mean) and minimum gap (s) */
  onsetLowHz?: number
  onsetHighHz?: number
  onsetSensitivity?: number
  /** minimum time between onsets (s). 0.25 → at most 4 beats/s (also keeps visual flashing ≤ 4 Hz) */
  onsetMinInterval?: number
}

export const ANALYSER_DEFAULTS: Required<Omit<AnalyserOptions, 'bands'>> & { bands: number | 'four' } = {
  fftSize: 2048,
  smoothing: 0.5,
  minDb: -90,
  maxDb: -10,
  bands: 16,
  minHz: 30,
  maxHz: 16000,
  attack: 0.03,
  release: 0.25,
  onsetLowHz: 30,
  onsetHighHz: 150,
  onsetSensitivity: 1.5,
  onsetMinInterval: 0.25,
}

export interface AudioAnalyser {
  node: AnalyserNode
  /** connect `source` into the analyser; returns an untap function */
  tap(source: AudioNode, output?: number): () => void
  /** read the analyser once and update every field below. `t` = audio time (default ctx.currentTime) */
  update(t?: number): void
  /** spectrum in dBFS per bin (length fftSize/2) */
  readonly spectrum: Float32Array<ArrayBuffer>
  /** waveform (−1..1, length fftSize) */
  readonly waveform: Float32Array<ArrayBuffer>
  /** smoothed band levels 0..1 */
  readonly bands: Float32Array<ArrayBuffer>
  /** band edges (Hz), length bands + 1 */
  readonly bandEdges: Float32Array<ArrayBuffer>
  /** band names (only for bands: 'four') */
  readonly bandNames: readonly string[]
  /** RMS / peak of the current window (linear) and RMS in dBFS */
  readonly rms: number
  readonly peak: number
  readonly rmsDb: number
  /** true on the update() where an onset was detected */
  readonly beat: boolean
  /** number of onsets so far / audio time of the last one */
  readonly beatCount: number
  readonly lastBeatTime: number
  /** tempo estimate from recent onset intervals (0 until ~4 onsets), folded into 70..180 BPM */
  readonly bpm: number
  /** 0..1, jumps to 1 on a beat and decays (τ ≈ 0.15 s) — ready-made pulse for visuals */
  readonly beatPulse: number
  /** Unity GetSpectrumData-like byte spectrum (0..255 over minDb..maxDb); computed on call into a reused buffer */
  getByteSpectrum(): Uint8Array<ArrayBuffer>
  /** frequency of the strongest bin (parabolic interpolation), Hz; from the last update() */
  dominantFrequency(minHz?: number, maxHz?: number): number
  /** monophonic pitch by normalised autocorrelation of the waveform (Hz, 0 if unvoiced) */
  pitch(minHz?: number, maxHz?: number): number
  dispose(): void
}

export function createAnalyser(ctx: BaseAudioContext, o: AnalyserOptions = {}): AudioAnalyser {
  const opt = { ...ANALYSER_DEFAULTS, ...o }
  const node = ctx.createAnalyser()
  node.fftSize = opt.fftSize
  node.smoothingTimeConstant = opt.smoothing
  node.minDecibels = opt.minDb
  node.maxDecibels = opt.maxDb
  const nBins = node.frequencyBinCount
  const binHz = ctx.sampleRate / opt.fftSize
  const spectrum = new Float32Array(nBins)
  const waveform = new Float32Array(opt.fftSize)
  const bytes = new Uint8Array(nBins)
  const acf = new Float32Array(opt.fftSize / 2)

  // band layout
  let edges: number[]
  let names: string[] = []
  if (opt.bands === 'four') {
    edges = [FOUR_BANDS[0].lo, ...FOUR_BANDS.map((b) => b.hi)]
    names = FOUR_BANDS.map((b) => b.name)
  } else {
    const n = Math.max(1, Math.floor(opt.bands))
    edges = Array.from({ length: n + 1 }, (_, i) => opt.minHz * Math.pow(opt.maxHz / opt.minHz, i / n))
  }
  const nb = edges.length - 1
  const bandEdges = new Float32Array(edges)
  const bands = new Float32Array(nb)
  // bin ranges per band (at least one bin each)
  const bLo = new Int32Array(nb), bHi = new Int32Array(nb)
  for (let i = 0; i < nb; i++) {
    const lo = Math.max(1, Math.round(edges[i] / binHz))
    const hi = Math.max(lo + 1, Math.round(edges[i + 1] / binHz))
    bLo[i] = Math.min(nBins - 1, lo); bHi[i] = Math.min(nBins, hi)
  }
  const oLo = Math.max(1, Math.round(opt.onsetLowHz / binHz))
  const oHi = Math.max(oLo + 1, Math.round(opt.onsetHighHz / binHz))

  // onset state
  const HIST = 64
  const hist = new Float32Array(HIST)
  let hN = 0, hI = 0
  let prevLow = NaN
  const ioi = new Float32Array(8)
  let ioiN = 0, ioiI = 0
  const ioiSorted = new Float32Array(8)

  const st = { rms: 0, peak: 0, rmsDb: -Infinity, beat: false, beatCount: 0, lastBeatTime: -Infinity, bpm: 0, beatPulse: 0, lastT: -1 }
  const range = opt.maxDb - opt.minDb

  const powerMeanDb = (lo: number, hi: number) => {
    let s = 0
    for (let k = lo; k < hi; k++) s += Math.pow(10, spectrum[k] / 10)
    return 10 * Math.log10(s / (hi - lo) + 1e-30)
  }

  const a: AudioAnalyser = {
    node,
    tap(source, output = 0) {
      source.connect(node, output)
      return () => { try { source.disconnect(node) } catch { /* */ } }
    },
    update(t = ctx.currentTime) {
      node.getFloatFrequencyData(spectrum)
      node.getFloatTimeDomainData(waveform)
      const dt = st.lastT < 0 ? 1 / 60 : Math.max(0, t - st.lastT)
      st.lastT = t
      // level
      let s2 = 0, pk = 0
      for (let i = 0; i < waveform.length; i++) { const v = waveform[i]; s2 += v * v; const m = v < 0 ? -v : v; if (m > pk) pk = m }
      st.rms = Math.sqrt(s2 / waveform.length); st.peak = pk; st.rmsDb = 20 * Math.log10(st.rms + 1e-12)
      // bands
      const ka = 1 - Math.exp(-dt / Math.max(1e-3, opt.attack))
      const kr = 1 - Math.exp(-dt / Math.max(1e-3, opt.release))
      for (let i = 0; i < nb; i++) {
        const v = Math.min(1, Math.max(0, (powerMeanDb(bLo[i], bHi[i]) - opt.minDb) / range))
        bands[i] += (v - bands[i]) * (v > bands[i] ? ka : kr)
      }
      // onset: positive flux of the low-band level (dB) above mean + k·std of recent flux
      const low = powerMeanDb(oLo, oHi)
      const flux = Number.isNaN(prevLow) ? 0 : Math.max(0, low - prevLow)
      prevLow = low
      let mean = 0, varr = 0
      for (let i = 0; i < hN; i++) mean += hist[i]
      mean /= hN || 1
      for (let i = 0; i < hN; i++) varr += (hist[i] - mean) ** 2
      const std = Math.sqrt(varr / (hN || 1))
      st.beat = false
      if (hN >= 8 && flux > mean + opt.onsetSensitivity * std && flux > 1.5 && t - st.lastBeatTime >= opt.onsetMinInterval && low > opt.minDb + 10) {
        if (Number.isFinite(st.lastBeatTime)) {
          ioi[ioiI] = t - st.lastBeatTime; ioiI = (ioiI + 1) % ioi.length; ioiN = Math.min(ioi.length, ioiN + 1)
          if (ioiN >= 3) {
            ioiSorted.set(ioi); const arr = ioiSorted.subarray(0, ioiN).sort()
            let bpm = 60 / arr[ioiN >> 1]
            while (bpm < 70) bpm *= 2
            while (bpm > 180) bpm /= 2
            st.bpm = bpm
          }
        }
        st.beat = true; st.beatCount++; st.lastBeatTime = t; st.beatPulse = 1
      }
      hist[hI] = flux; hI = (hI + 1) % HIST; hN = Math.min(HIST, hN + 1)
      if (!st.beat) st.beatPulse *= Math.exp(-dt / 0.15)
    },
    spectrum,
    waveform,
    bands,
    bandEdges,
    bandNames: names,
    get rms() { return st.rms },
    get peak() { return st.peak },
    get rmsDb() { return st.rmsDb },
    get beat() { return st.beat },
    get beatCount() { return st.beatCount },
    get lastBeatTime() { return st.lastBeatTime },
    get bpm() { return st.bpm },
    get beatPulse() { return st.beatPulse },
    getByteSpectrum() { node.getByteFrequencyData(bytes); return bytes },
    dominantFrequency(minHz = 20, maxHz = ctx.sampleRate / 2) {
      const lo = Math.max(1, Math.floor(minHz / binHz)), hi = Math.min(nBins - 2, Math.ceil(maxHz / binHz))
      let k = lo
      for (let i = lo + 1; i <= hi; i++) if (spectrum[i] > spectrum[k]) k = i
      const y0 = spectrum[k - 1], y1 = spectrum[k], y2 = spectrum[k + 1]
      const den = y0 - 2 * y1 + y2
      const d = den !== 0 && Number.isFinite(den) ? (0.5 * (y0 - y2)) / den : 0
      return (k + Math.max(-0.5, Math.min(0.5, d))) * binHz
    },
    pitch(minHz = 50, maxHz = 2000) {
      const sr = ctx.sampleRate
      const N = waveform.length
      const minLag = Math.max(2, Math.floor(sr / maxHz)), maxLag = Math.min(acf.length - 2, Math.ceil(sr / minHz))
      let e0 = 0
      for (let i = 0; i < N; i++) e0 += waveform[i] * waveform[i]
      if (e0 < 1e-8) return 0
      for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
        let s = 0, ea = 0, eb = 0
        for (let i = 0; i + lag < N; i++) { const x = waveform[i], y = waveform[i + lag]; s += x * y; ea += x * x; eb += y * y }
        acf[lag] = s / (Math.sqrt(ea * eb) + 1e-12)
      }
      // first strong peak (≥ 0.9 × global max) → avoids octave errors
      let best = -1
      for (let lag = minLag; lag <= maxLag; lag++) if (acf[lag] > best) best = acf[lag]
      if (best < 0.5) return 0
      for (let lag = minLag; lag <= maxLag; lag++) {
        if (acf[lag] >= 0.9 * best && acf[lag] >= acf[lag - 1] && acf[lag] >= acf[lag + 1]) {
          const y0 = acf[lag - 1], y1 = acf[lag], y2 = acf[lag + 1]
          const den = y0 - 2 * y1 + y2
          const d = den !== 0 ? (0.5 * (y0 - y2)) / den : 0
          return sr / (lag + d)
        }
      }
      return 0
    },
    dispose() { try { node.disconnect() } catch { /* */ } },
  }
  return a
}
