import type { FilterSpec } from 'xrift-spatial-audio'

/** Room C: one speaker per filter (the first one is the dry reference). Colour + glyph identify it (no text). */
export const FILTER_SPEAKERS = [
  { id: 'dry', color: '#eeeeee', filters: [] },
  { id: 'lowpass', color: '#1e88e5', filters: [{ type: 'lowpass', cutoff: 600, resonance: 1.2 }] },
  { id: 'highpass', color: '#fb8c00', filters: [{ type: 'highpass', cutoff: 1500, resonance: 1 }] },
  { id: 'reverbSmall', color: '#ce93d8', filters: [{ type: 'reverb', preset: 'small', wet: 0.5, dry: 0.8 }] },
  { id: 'reverbHall', color: '#8e24aa', filters: [{ type: 'reverb', preset: 'hall', wet: 0.5, dry: 0.75 }] },
  { id: 'echo', color: '#43a047', filters: [{ type: 'echo', delay: 0.381, feedback: 0.45, wet: 0.35 }] }, // dotted 1/8 at 118 BPM
  { id: 'distortion', color: '#e53935', filters: [{ type: 'distortion', amount: 0.6 }] },
  { id: 'chorus', color: '#00acc1', filters: [{ type: 'chorus', rate: 0.6, depth: 0.003 }] },
] as const satisfies readonly { id: string; color: string; filters: readonly FilterSpec[] }[]

export type FilterSpeakerId = (typeof FILTER_SPEAKERS)[number]['id']
