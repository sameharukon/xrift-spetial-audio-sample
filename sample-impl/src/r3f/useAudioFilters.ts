import { useEffect, useRef, useState } from 'react'
import { createFilterChain, type FilterChain, type FilterSpec } from '../core/filters'
import { useSpatialAudio } from './SpatialAudioProvider'

/**
 * A filter chain on the provider's context (null until audio is unlocked). `specs` are compared by value:
 * parameter / `enabled` changes glide (click-free); adding, removing or reordering filters rebuilds the chain
 * (input / output stay the same nodes, so your connections survive).
 *
 *   const chain = useAudioFilters([{ type: 'lowpass', cutoff: 800 }, { type: 'reverb', preset: 'hall', enabled: wet }])
 *   source.connect(chain.input); chain.output.connect(pa.input)
 */
export function useAudioFilters(specs: readonly FilterSpec[], context?: BaseAudioContext | null): FilterChain | null {
  const sa = useSpatialAudio()
  const ctx = context ?? sa?.context ?? null
  const key = JSON.stringify(specs)
  const [chain, setChain] = useState<FilterChain | null>(null)
  const specsRef = useRef(specs)
  specsRef.current = specs
  useEffect(() => {
    if (!ctx) return
    const c = createFilterChain(ctx, specsRef.current)
    setChain(c)
    return () => { c.dispose(); setChain(null) }
  }, [ctx])
  useEffect(() => { chain?.update(JSON.parse(key) as FilterSpec[]) }, [chain, key])
  return chain
}
