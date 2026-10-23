import { Matrix4, Quaternion, Vector3, type Camera, type InstancedMesh, type Object3D } from 'three'
import { setListenerPose, setPannerPosition } from '../core/panner'

const _p = new Vector3()
const _f = new Vector3()
const _u = new Vector3()
const _q = new Quaternion()

/**
 * listener ← camera world position / view direction / up (smoothed with `tau` s; `tau = 0` jumps).
 * Uses the camera's *world* transform, so it also works when the camera is parented to a player rig.
 */
export function updateListenerFromCamera(L: AudioListener, camera: Camera, t: number, tau = 0.03) {
  camera.getWorldPosition(_p)
  camera.getWorldDirection(_f)
  _u.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(_q))
  setListenerPose(L, _p, _f, _u, t, tau)
}

/** panner ← `object.localToWorld(offset)` (smoothed with `tau` s; `tau = 0` jumps) */
export function updatePannerFromObject(P: PannerNode, object: Object3D, t: number, offset: readonly [number, number, number] = [0, 0, 0], tau = 0.03) {
  _p.set(offset[0], offset[1], offset[2])
  object.localToWorld(_p)
  setPannerPosition(P, _p, t, tau)
}

const _m = new Matrix4()
const _s = new Vector3()
const _pos = new Vector3()
const _qi = new Quaternion()

export interface InstancedBarsOptions {
  /** bar width / depth (local units) */
  width?: number
  depth?: number
  /** gap between bars */
  gap?: number
  /** height at value 0 / value 1 */
  minHeight?: number
  maxHeight?: number
}

/**
 * Lay out `values` (0..1) as a row of bars on an InstancedMesh with a unit box geometry
 * (bars grow upward from y = 0, centred on x = 0). No allocations; call it in useFrame.
 */
export function driveInstancedBars(mesh: InstancedMesh, values: ArrayLike<number>, o: InstancedBarsOptions = {}) {
  const w = o.width ?? 0.2, dpt = o.depth ?? w, gap = o.gap ?? 0.05, h0 = o.minHeight ?? 0.02, h1 = o.maxHeight ?? 1
  const n = Math.min(values.length, mesh.count)
  const total = n * w + (n - 1) * gap
  for (let i = 0; i < n; i++) {
    const h = h0 + (h1 - h0) * Math.min(1, Math.max(0, values[i]))
    _pos.set(-total / 2 + w / 2 + i * (w + gap), h / 2, 0)
    _s.set(w, h, dpt)
    mesh.setMatrixAt(i, _m.compose(_pos, _qi, _s))
  }
  mesh.instanceMatrix.needsUpdate = true
}
