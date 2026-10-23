import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { PerspectiveCamera } from 'three'

/**
 * DEV ONLY (mounted from dev.tsx, never part of the uploaded world): screenshot camera override.
 * globalThis.__camOverride = { pos: [x, y, z], look: [x, y, z] } renders from that viewpoint.
 */
const tmp = new PerspectiveCamera()
export function DevCamOverride() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const g = globalThis as Record<string, unknown>
    g.__scene = scene
    g.__gl = gl
    const prev = scene.onBeforeRender
    scene.onBeforeRender = (renderer, sc, camera, ...rest) => {
      prev.call(scene, renderer, sc, camera, ...rest)
      g.__cam = camera
      const o = g.__camOverride as { pos: number[]; look: number[] } | undefined
      if (!o) return
      tmp.position.set(o.pos[0], o.pos[1], o.pos[2])
      tmp.lookAt(o.look[0], o.look[1], o.look[2])
      tmp.updateMatrixWorld(true)
      camera.matrixWorld.copy(tmp.matrixWorld)
      camera.matrixWorldInverse.copy(tmp.matrixWorld).invert()
    }
    return () => { scene.onBeforeRender = prev }
  }, [scene, gl])
  return null
}
