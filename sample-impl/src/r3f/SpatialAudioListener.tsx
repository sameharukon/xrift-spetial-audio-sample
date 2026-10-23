import { useRef } from 'react'
import { renderedCamera, useAfterRender } from './afterRender'
import { useSpatialAudio } from './SpatialAudioProvider'
import { updateListenerFromCamera } from './three'

export interface SpatialAudioListenerProps {
  /** smoothing time constant (s) of the listener moves (default 0.01: de-zippers without audible lag) */
  smoothing?: number
  /** explicit context (or getter); defaults to the <SpatialAudioProvider> context */
  context?: AudioContext | null | (() => AudioContext | null | undefined)
}

/**
 * Syncs the AudioListener to the camera the frame was actually rendered with (the WebXR camera while presenting),
 * sampled after the render so it is the drawn pose, not last frame's (jumps on the first frame of a context).
 */
export function SpatialAudioListener({ smoothing = 0.01, context }: SpatialAudioListenerProps) {
  const sa = useSpatialAudio()
  const last = useRef<AudioContext | null>(null)
  useAfterRender((state) => {
    const ctx = typeof context === 'function' ? context() : context ?? sa?.context
    if (!ctx) return
    const first = last.current !== ctx
    last.current = ctx
    updateListenerFromCamera(ctx.listener, renderedCamera(state), ctx.currentTime, first ? 0 : smoothing)
  })
  return null
}
