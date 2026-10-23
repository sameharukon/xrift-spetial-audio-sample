import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import { createSpeakerPanner, type SpeakerPannerOptions } from '../core/panner'
import { useAfterRender } from './afterRender'
import { useSpatialAudio } from './SpatialAudioProvider'
import { updatePannerFromObject } from './three'

export interface SpeakerProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  /**
   * an existing panner (e.g. one shared by several sources) to drive. If omitted, the Speaker creates its own
   * panner (HRTF by default) (options from `panner`), connects it to `destination` (default ctx.destination)
   * and passes it to `onPanner` so you can connect a source to it.
   */
  node?: PannerNode | null
  /** options for the Speaker's own panner (compared by value, so an inline object is fine) */
  panner?: SpeakerPannerOptions
  destination?: AudioNode
  onPanner?: (p: PannerNode | null) => void
  /** acoustic centre relative to the group (e.g. between sub and top) */
  offset?: [number, number, number]
  /** smoothing time constant (s) of the panner moves (default 0.01) */
  smoothing?: number
  children?: ReactNode
}

/**
 * A positioned group whose world position drives a PannerNode every frame (follows parents / animations).
 * The position is sampled after the frame was rendered, so it is exactly where the group was drawn this frame
 * (independent of the order of useFrame callbacks that animate it).
 */
export function Speaker({ position, rotation, node, panner, destination, onPanner, offset = [0, 0, 0], smoothing = 0.01, children }: SpeakerProps) {
  const sa = useSpatialAudio()
  const ctx = sa?.context ?? null
  const ref = useRef<Group>(null)
  const onPannerRef = useRef(onPanner)
  onPannerRef.current = onPanner
  const pannerKey = JSON.stringify(panner ?? {})
  const [own, setOwn] = useState<PannerNode | null>(null)
  useEffect(() => {
    if (node || !ctx) return
    const p = createSpeakerPanner(ctx, JSON.parse(pannerKey) as SpeakerPannerOptions)
    p.connect(destination ?? ctx.destination)
    setOwn(p)
    onPannerRef.current?.(p)
    return () => {
      p.disconnect()
      setOwn(null)
      onPannerRef.current?.(null)
    }
  }, [node, ctx, pannerKey, destination])
  const placed = useRef<PannerNode | null>(null)
  useAfterRender(() => {
    const P = node ?? own
    const g = ref.current
    if (!P || !g) return
    const first = placed.current !== P
    placed.current = P
    updatePannerFromObject(P, g, P.context.currentTime, offset, first ? 0 : smoothing)
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  )
}
