/** volume steps shown by the +/- buttons (percent of the tuned level; 100 % = centre of the fader) */
export const VOLUME_STEPS = [0, 25, 50, 75, 100, 125, 150, 175, 200] as const

/** percent → fader position for `applyVolumeStages` (0..1, 0.5 = 100 %, 1 = 200 %) */
export const percentToLevel = (pct: number) => Math.min(1, Math.max(0, pct / 200))
