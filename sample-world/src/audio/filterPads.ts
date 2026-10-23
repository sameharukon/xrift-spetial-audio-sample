import type { FilterSpec } from 'xrift-spatial-audio'

/** the six filter pads: id, colour, and the spec applied when the pad is on */
export const FILTER_PADS = [
  { id: 'lowpass', color: '#1e88e5', spec: { type: 'lowpass', cutoff: 600, resonance: 1.2 } },
  { id: 'highpass', color: '#fb8c00', spec: { type: 'highpass', cutoff: 1500, resonance: 1 } },
  { id: 'reverb', color: '#8e24aa', spec: { type: 'reverb', preset: 'hall', wet: 0.45, dry: 0.8 } },
  { id: 'echo', color: '#43a047', spec: { type: 'echo', delay: 0.363, feedback: 0.45, wet: 0.35 } }, // dotted 1/8 at 124 BPM
  { id: 'distortion', color: '#e53935', spec: { type: 'distortion', amount: 0.6 } },
  { id: 'chorus', color: '#00acc1', spec: { type: 'chorus', rate: 0.6, depth: 0.003 } },
] as const satisfies readonly { id: string; color: string; spec: FilterSpec }[]

export type FilterPadId = (typeof FILTER_PADS)[number]['id']
export type FilterState = Record<FilterPadId, boolean>
export const FILTERS_OFF: FilterState = { lowpass: false, highpass: false, reverb: false, echo: false, distortion: false, chorus: false }

/** always the same six filters in the same order → toggling only cross-fades (no rebuild) */
export const filterSpecs = (s: FilterState): FilterSpec[] => FILTER_PADS.map((p) => ({ ...p.spec, enabled: s[p.id] }))
