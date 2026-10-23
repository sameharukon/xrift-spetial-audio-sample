/**
 * Speaker panners + listener / panner pose helpers (framework-agnostic: plain numbers, no three.js).
 *
 * Default panning is HRTF: best direction cues (front/back, elevation) for point sources. Cost measured in desktop
 * Chrome (Xeon 2.4 GHz, 48 kHz): a moving source costs ≈ 1 % of one core per panner with either model (Chrome
 * recomputes the geometry per sample while positions are automated); HRTF adds only ≈ 5–20 % on top. Static
 * sources: ≈ 0.1 % (HRTF) vs ≈ 0.05 % (equal-power) per panner. The first HRTF use loads a database (≈ 0.25 s),
 * hence `warmUpHrtf()` at unlock.
 *
 * Choose 'equalpower' for many sources, or when one signal feeds several speakers (a PA): Web Audio panners add no
 * propagation delay, so equal-power panners of one signal only sum gains (no comb filtering), while HRTF applies
 * per-source ITD / filtering that colours the sum.
 */
export interface SpeakerPannerOptions {
  distanceModel?: DistanceModelType
  refDistance?: number
  rolloffFactor?: number
  maxDistance?: number
  /** 'HRTF' (default) or 'equalpower' (lighter; for many sources or one signal on several speakers, see above) */
  panningModel?: PanningModelType
}

export const PANNER_DEFAULTS: Required<SpeakerPannerOptions> = {
  distanceModel: 'inverse',
  refDistance: 3,
  rolloffFactor: 0.7,
  maxDistance: 30,
  panningModel: 'HRTF',
}

/** mono-in panner (HRTF by default) with a gentle distance model (level stays even across a room) */
export function createSpeakerPanner(ctx: BaseAudioContext, o: SpeakerPannerOptions = {}): PannerNode {
  const opt = { ...PANNER_DEFAULTS, ...o }
  const p = ctx.createPanner()
  p.panningModel = opt.panningModel
  p.distanceModel = opt.distanceModel
  p.refDistance = opt.refDistance
  p.rolloffFactor = opt.rolloffFactor
  p.maxDistance = opt.maxDistance
  p.channelCount = 1
  p.channelCountMode = 'explicit'
  return p
}

/**
 * Load the HRTF database now instead of on first use (browsers load it lazily, ≈ 0.25 s on desktop, which can stall
 * the first HRTF source): a silent HRTF panner, connected through a zero gain for `holdMs`, then removed.
 */
export function warmUpHrtf(ctx: BaseAudioContext, holdMs = 1000) {
  try {
    const p = ctx.createPanner()
    p.panningModel = 'HRTF'
    const g = ctx.createGain()
    g.gain.value = 0
    p.connect(g).connect(ctx.destination)
    setTimeout(() => { p.disconnect(); g.disconnect() }, holdMs)
  } catch { /* closed context or no HRTF: nothing to warm */ }
}

export interface Vec3Like { x: number; y: number; z: number }

/** smoothed AudioParam move (exponential approach with time constant `tau` seconds) */
export function glideParam(p: AudioParam | undefined, v: number, t: number, tau: number) {
  if (p) p.setTargetAtTime(v, t, tau)
}

/**
 * Move a panner to `pos` (world units = metres). With `tau > 0` the move is smoothed with setTargetAtTime
 * (no zipper noise when the source is attached to a moving object). Falls back to the legacy setPosition().
 */
export function setPannerPosition(p: PannerNode, pos: Vec3Like, t: number, tau = 0.03) {
  if (p.positionX) {
    glideParam(p.positionX, pos.x, t, tau); glideParam(p.positionY, pos.y, t, tau); glideParam(p.positionZ, pos.z, t, tau)
  } else p.setPosition(pos.x, pos.y, pos.z)
}

/**
 * Set the AudioListener pose (position, forward, up), smoothed with `tau` seconds.
 * Falls back to setPosition()/setOrientation() on browsers without listener AudioParams.
 */
export function setListenerPose(L: AudioListener, pos: Vec3Like, fwd: Vec3Like, up: Vec3Like, t: number, tau = 0.03) {
  if (L.positionX) {
    glideParam(L.positionX, pos.x, t, tau); glideParam(L.positionY, pos.y, t, tau); glideParam(L.positionZ, pos.z, t, tau)
    glideParam(L.forwardX, fwd.x, t, tau); glideParam(L.forwardY, fwd.y, t, tau); glideParam(L.forwardZ, fwd.z, t, tau)
    glideParam(L.upX, up.x, t, tau); glideParam(L.upY, up.y, t, tau); glideParam(L.upZ, up.z, t, tau)
  } else {
    L.setPosition(pos.x, pos.y, pos.z)
    L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z)
  }
}
