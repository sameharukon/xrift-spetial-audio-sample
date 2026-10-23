import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useSpatialAudio } from './SpatialAudioProvider'
import { updateListenerFromCamera } from './three'

export interface SpatialAudioListenerProps {
  /** smoothing time constant (s) of the listener moves; 0.03 ≈ one 30 fps frame */
  smoothing?: number
  /** explicit context (or getter); defaults to the <SpatialAudioProvider> context */
  context?: AudioContext | null | (() => AudioContext | null | undefined)
}

/** syncs the AudioListener to the active (XR-aware) camera every frame (jumps on the first frame of a context) */
export function SpatialAudioListener({ smoothing = 0.03, context }: SpatialAudioListenerProps) {
  const sa = useSpatialAudio()
  const last = useRef<AudioContext | null>(null)
  useFrame(({ camera }) => {
    const ctx = typeof context === 'function' ? context() : context ?? sa?.context
    if (!ctx) return
    const first = last.current !== ctx
    last.current = ctx
    updateListenerFromCamera(ctx.listener, camera, ctx.currentTime, first ? 0 : smoothing)
  })
  return null
}
