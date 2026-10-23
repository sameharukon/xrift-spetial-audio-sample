import { CORRIDORS, DOORWAY, OCCLUDED_SPEAKER, PARTITION, WALL, inRect, type RoomDef } from '../constants'

/**
 * Per-room bus level for a listener position, so rooms do not bleed into each other: in the room → open;
 * in a corridor that joins it → cross-fades out and gets muffled with distance from its doorway (silent at
 * the other end); anywhere else → silent. Only the room you are in plays fully.
 */
export function roomMix(room: RoomDef, x: number, z: number): { gate: number; muffle: number } {
  if (inRect(room.rect, x, z)) return { gate: 1, muffle: 0 }
  for (const c of CORRIDORS) {
    if (!inRect(c.rect, x, z)) continue
    if (c.from !== room.id && c.to !== room.id) break
    const len = c.rect.x1 - c.rect.x0
    const f = Math.min(1, Math.max(0, (c.from === room.id ? x - c.rect.x0 : c.rect.x1 - x) / len))
    return { gate: 1 - f, muffle: 0.15 + 0.6 * f }
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
