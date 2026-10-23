import { DOORWAY, HUB, OCCLUDED_SPEAKER, PARTITION, WALL, inRect, rectCentre, type RoomDef } from '../constants'

/**
 * Per-room bus level for a listener position, so rooms do not bleed into each other:
 *   in the room → open; in its corridor → slightly muffled; in the hub → quieter + muffled, only near
 *   that room's doorway (silent in the middle of the hub); in any other room / corridor → silent.
 */
export function roomMix(room: RoomDef, x: number, z: number): { gate: number; muffle: number } {
  if (inRect(room.rect, x, z)) return { gate: 1, muffle: 0 }
  const c = room.corridor
  if (inRect(c, x, z)) {
    const horizontal = room.door === 'e' || room.door === 'w'
    const len = horizontal ? c.x1 - c.x0 : c.z1 - c.z0
    const fromRoom = room.door === 's' ? z - c.z0 : room.door === 'n' ? c.z1 - z : room.door === 'e' ? c.x1 - x : x - c.x0
    const f = Math.min(1, Math.max(0, fromRoom / len))
    return { gate: 1 - 0.3 * f, muffle: 0.15 + 0.4 * f }
  }
  if (inRect(HUB, x, z)) {
    const [cx, cz] = rectCentre(c)
    const d = Math.hypot(x - cx, z - cz)
    return { gate: 0.35 * Math.max(0, 1 - d / 6.5), muffle: 0.7 } // ≈ silent in the middle of the hub
  }
  return { gate: 0, muffle: 1 }
}

/**
 * Room B: occlusion of the speaker behind the partition (0 = clear … 1 = behind the closed door / wall).
 * Same side as the speaker → 0. Door closed → 1. Door open → small when the straight line to the speaker
 * passes through the doorway, growing with how far that line misses the opening.
 */
export function partitionOcclusion(x: number, z: number, doorOpen: boolean): number {
  if (x > PARTITION.x + PARTITION.t / 2) return 0
  if (!doorOpen) return 1
  const [sx, , sz] = OCCLUDED_SPEAKER
  const t = (PARTITION.x - x) / Math.max(0.01, sx - x)
  const zc = z + (sz - z) * t
  const miss = Math.max(0, Math.abs(zc) - DOORWAY.width / 2)
  const inGap = x > PARTITION.x - PARTITION.t / 2 - WALL.t ? 0 : 0.08
  return Math.min(0.85, inGap + miss * 0.3)
}
