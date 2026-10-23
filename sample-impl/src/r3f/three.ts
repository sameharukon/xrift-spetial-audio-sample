import { Quaternion, Vector3, type Camera, type Object3D } from 'three'
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
