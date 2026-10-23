import { useEffect, useState } from 'react'
import { createMuffle, createSoftCeiling, volumeStages, type Muffle } from 'xrift-spatial-audio'
import { ROOMS, type RoomId } from '../constants'
import { percentToLevel } from './volume'

/**
 *   [room sources] ─► bus.input ─► muffle ─► gate ─┐   (one bus per room, driven by roomMix())
 *                                                  ├─► boost (vol > 100 %) ─► limiter ─► cut (vol ≤ 100 %) ─► soft ceiling ─► out
 *   [other rooms] ─────────────────────────────────┘
 */
export interface RoomBus { input: GainNode; muffle: Muffle; gate: GainNode }
export interface OutputChain { ctx: AudioContext; buses: Record<RoomId, RoomBus>; boost: GainNode; cut: GainNode; master: GainNode }

export function useOutputChain(ctx: AudioContext | null): OutputChain | null {
  const [chain, setChain] = useState<OutputChain | null>(null)
  useEffect(() => {
    if (!ctx) return
    const boost = ctx.createGain()
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2; limiter.knee.value = 2; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.12
    const cut = ctx.createGain()
    const master = ctx.createGain()
    const ceiling = createSoftCeiling(ctx)
    boost.connect(limiter).connect(cut).connect(master).connect(ceiling.input)
    ceiling.output.connect(ctx.destination)
    const buses = {} as Record<RoomId, RoomBus>
    for (const r of ROOMS) {
      const input = ctx.createGain()
      const muffle = createMuffle(ctx, { initial: 1, closedHz: 300, closedGain: 0.5 })
      const gate = ctx.createGain()
      gate.gain.value = 0
      input.connect(muffle.input)
      muffle.output.connect(gate).connect(boost)
      buses[r.id] = { input, muffle, gate }
    }
    const c: OutputChain = { ctx, buses, boost, cut, master }
    if (import.meta.env.DEV) (globalThis as Record<string, unknown>).__sa = c // dev probes only
    setChain(c)
    return () => {
      ceiling.output.disconnect()
      setChain(null)
    }
  }, [ctx])
  return chain
}

export function applyVolume(chain: OutputChain, pct: number) {
  const [c, b] = volumeStages(percentToLevel(pct))
  const t = chain.ctx.currentTime
  chain.cut.gain.setTargetAtTime(c, t, 0.04)
  chain.boost.gain.setTargetAtTime(b, t, 0.04)
}

