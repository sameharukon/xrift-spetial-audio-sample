import { addAfterEffect, useStore, type RootState } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Camera } from 'three'

/**
 * Runs `cb` once per frame right AFTER the frame was rendered (desktop loop and WebXR loop alike).
 * At that point every matrixWorld is exactly what was drawn: all useFrame animations of this frame have run,
 * the renderer has updated the scene graph, and in XR the headset pose of this frame has been applied.
 * Sampling poses in a normal useFrame instead depends on subscription order and reads last frame's matrices.
 */
export function useAfterRender(cb: (state: RootState) => void) {
  const store = useStore()
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => addAfterEffect(() => ref.current(store.getState())), [store])
}

/** the camera that was actually drawn with: the WebXR camera while presenting, otherwise the default camera */
export function renderedCamera(state: Pick<RootState, 'gl' | 'camera'>): Camera {
  const xr = state.gl.xr
  return xr && xr.isPresenting ? xr.getCamera() : state.camera
}
