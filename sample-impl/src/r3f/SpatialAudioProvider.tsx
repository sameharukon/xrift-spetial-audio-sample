import { useThree } from '@react-three/fiber'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { attachGestureUnlock, createAudioUnlocker, type AudioUnlocker, type XRSessionEvents } from '../core/unlock'

export interface SpatialAudioContextValue {
  /** null until the first user gesture created it */
  context: AudioContext | null
  /** true while the context is running */
  running: boolean
  /** create / resume the context (call from a gesture handler) */
  unlock: () => Promise<boolean>
}

const SpatialAudioCtx = /* @__PURE__ */ createContext<SpatialAudioContextValue | null>(null)

export interface SpatialAudioProviderProps {
  children?: ReactNode
  latencyHint?: AudioContextLatencyCategory | number
  /** build your graph synchronously when the context is created */
  onCreate?: (ctx: AudioContext) => void
  /** wire gesture listeners automatically (default true) */
  autoUnlock?: boolean
  /** delay before closing the context on unmount (ms), lets a fade-out finish */
  closeDelayMs?: number
}

/**
 * Owns one lazily-created AudioContext for the world. Must be rendered inside the R3F <Canvas>
 * (XRift worlds always are), so it can also unlock on WebXR `sessionstart`.
 * Safe under React StrictMode (mount → unmount → mount): the unlocker is recreated after a close.
 */
export function SpatialAudioProvider({ children, latencyHint = 'interactive', onCreate, autoUnlock = true, closeDelayMs = 700 }: SpatialAudioProviderProps) {
  const gl = useThree((s) => s.gl)
  const [context, setContext] = useState<AudioContext | null>(null)
  const [running, setRunning] = useState(false)
  const onCreateRef = useRef(onCreate)
  onCreateRef.current = onCreate
  const latencyRef = useRef(latencyHint)
  latencyRef.current = latencyHint
  const unlocker = useRef<AudioUnlocker | null>(null)
  const getUnlocker = useCallback(() => {
    if (!unlocker.current) {
      unlocker.current = createAudioUnlocker({
        latencyHint: latencyRef.current,
        onCreate: (c) => {
          onCreateRef.current?.(c)
          setContext(c)
          setRunning(c.state === 'running')
          c.addEventListener('statechange', () => setRunning(c.state === 'running'))
        },
        onRunning: () => setRunning(true),
      })
    }
    return unlocker.current
  }, [])
  const unlock = useCallback(() => getUnlocker().unlock(), [getUnlocker])

  useEffect(() => {
    if (!autoUnlock) return
    const fn = () => void unlock()
    return attachGestureUnlock(fn, { xr: gl.xr as unknown as XRSessionEvents })
  }, [autoUnlock, unlock, gl])

  useEffect(
    () => () => {
      unlocker.current?.close(closeDelayMs)
      unlocker.current = null
      setContext(null)
      setRunning(false)
    },
    [closeDelayMs],
  )

  const value = useMemo(() => ({ context, running, unlock }), [context, running, unlock])
  return <SpatialAudioCtx.Provider value={value}>{children}</SpatialAudioCtx.Provider>
}

/** access the provider's AudioContext (null outside a <SpatialAudioProvider>) */
export function useSpatialAudio(): SpatialAudioContextValue | null {
  return useContext(SpatialAudioCtx)
}
