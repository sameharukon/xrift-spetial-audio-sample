/**
 * Equal-power speaker panners + listener / panner pose helpers (framework-agnostic: plain numbers, no three.js).
 *
 * Why equal-power instead of HRTF: Web Audio panners apply no propagation delay, so feeding one signal to
 * several equal-power panners only sums gains (no comb filtering). HRTF adds per-source ITD/filtering that
 * colours the sum, and costs far more CPU — noticeable on standalone headsets (Quest).
 */
export interface SpeakerPannerOptions {
  distanceModel?: DistanceModelType
  refDistance?: number
  rolloffFactor?: number
  maxDistance?: number
  /** 'equalpower' (default) or 'HRTF' (single point sources only; see the note above) */
  panningModel?: PanningModelType
}

export const PANNER_DEFAULTS: Required<SpeakerPannerOptions> = {
  distanceModel: 'inverse',
  refDistance: 3,
  rolloffFactor: 0.7,
  maxDistance: 30,
  panningModel: 'equalpower',
}

/** mono-in panner with a gentle distance model (level stays even across a room) */
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
