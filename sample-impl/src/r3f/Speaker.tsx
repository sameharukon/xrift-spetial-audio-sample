import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import { createFilterChain, type FilterChain, type FilterSpec } from '../core/filters'
import { createSpeakerPanner, type SpeakerPannerOptions } from '../core/panner'
import { useSpatialAudio } from './SpatialAudioProvider'
import { updatePannerFromObject } from './three'

export interface SpeakerProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /**
   * an existing panner (e.g. `clubPA.panners[i]`) to drive. If omitted, the Speaker creates its own
   * equal-power panner (options from `panner`), connects it to `destination` (default ctx.destination)
   * and passes it to `onPanner` so you can connect a source to it.
   */
  node?: PannerNode | null
  /** options for the Speaker's own panner (compared by value, so an inline object is fine) */
  panner?: SpeakerPannerOptions
  destination?: AudioNode
  onPanner?: (p: PannerNode | null) => void
  /**
   * per-source filters (Unity-style low/high-pass, reverb, echo, distortion, chorus) inserted before the
   * Speaker's own panner. Compared by value; param / `enabled` changes are click-free.
   * Only for the Speaker's own panner (ignored when `node` is given — insert a chain upstream instead).
   */
  filters?: readonly FilterSpec[]
  /** the node to connect your source to: the filter chain input when `filters` is set, else the panner */
  onInput?: (n: AudioNode | null) => void
  /** acoustic centre relative to the group (e.g. between sub and top) */
  offset?: [number, number, number]
  smoothing?: number
  children?: ReactNode
}

/** a positioned group whose world position drives a PannerNode every frame (follows parents / animations) */
export function Speaker({ position, rotation, node, panner, destination, onPanner, filters, onInput, offset = [0, 0, 0], smoothing = 0.03, children }: SpeakerProps) {
  const sa = useSpatialAudio()
  const ctx = sa?.context ?? null
  const ref = useRef<Group>(null)
  const onPannerRef = useRef(onPanner)
  onPannerRef.current = onPanner
  const onInputRef = useRef(onInput)
  onInputRef.current = onInput
  const hasFilters = filters !== undefined
  const filterKey = JSON.stringify(filters ?? [])
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const chainRef = useRef<FilterChain | null>(null)
  const pannerKey = JSON.stringify(panner ?? {})
  const [own, setOwn] = useState<PannerNode | null>(null)
  useEffect(() => {
    if (node || !ctx) return
    const p = createSpeakerPanner(ctx, JSON.parse(pannerKey) as SpeakerPannerOptions)
    p.connect(destination ?? ctx.destination)
    const chain = hasFilters ? createFilterChain(ctx, filtersRef.current ?? []) : null
    chain?.output.connect(p)
    chainRef.current = chain
    setOwn(p)
    onPannerRef.current?.(p)
    onInputRef.current?.(chain ? chain.input : p)
    return () => {
      chain?.dispose()
      chainRef.current = null
      p.disconnect()
      setOwn(null)
      onPannerRef.current?.(null)
      onInputRef.current?.(null)
    }
  }, [node, ctx, pannerKey, destination, hasFilters])
  useEffect(() => { chainRef.current?.update(JSON.parse(filterKey) as FilterSpec[]) }, [filterKey, own])
  const placed = useRef<PannerNode | null>(null)
  useFrame(() => {
    const P = node ?? own
    const g = ref.current
    if (!P || !g) return
    const first = placed.current !== P
    placed.current = P
    if (first) g.updateWorldMatrix(true, false)
    updatePannerFromObject(P, g, P.context.currentTime, offset, first ? 0 : smoothing)
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  )
}
