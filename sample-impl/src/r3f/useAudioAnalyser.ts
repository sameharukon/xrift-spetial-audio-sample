import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import { createAnalyser, type AnalyserOptions, type AudioAnalyser } from '../core/analysis'

/**
 * Taps `node` with an analyser and calls `update()` once per frame (inside useFrame, before your own
 * callbacks that run later in the tree). Returns a ref — read `ref.current?.bands`, `.beatPulse`, … in your
 * own useFrame; nothing here triggers React re-renders. Options are compared by value.
 */
export function useAudioAnalyser(node: AudioNode | null | undefined, options?: AnalyserOptions, enabled = true): RefObject<AudioAnalyser | null> {
  const ref = useRef<AudioAnalyser | null>(null)
  const key = JSON.stringify(options ?? {})
  useEffect(() => {
    if (!node || !enabled) return
    const a = createAnalyser(node.context, JSON.parse(key) as AnalyserOptions)
    const untap = a.tap(node)
    ref.current = a
    return () => { untap(); a.dispose(); if (ref.current === a) ref.current = null }
  }, [node, key, enabled])
  useFrame(() => { ref.current?.update() })
  return ref
}
