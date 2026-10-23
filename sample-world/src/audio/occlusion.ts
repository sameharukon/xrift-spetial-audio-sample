import { CORRIDOR, DOOR, ROOM } from '../constants'

/**
 * Occlusion amount (0 = open … 1 = behind a closed door) for a listener position.
 * Inside the room: 0. In the corridor: 1 with the door closed; with the door open it grows with the
 * distance from the doorway and with the angle off the door axis (0.2 … 0.7).
 */
export function occlusionFor(x: number, z: number, doorOpen: boolean): number {
  const wallZ = ROOM.half
  if (z < wallZ - ROOM.wall / 2) return 0
  if (!doorOpen) return 1
  const dz = Math.max(0, z - wallZ)
  const offAxis = Math.max(0, Math.abs(x) - DOOR.width / 2)
  return Math.min(0.7, 0.2 + (dz / CORRIDOR.length) * 0.3 + offAxis * 0.12)
}
