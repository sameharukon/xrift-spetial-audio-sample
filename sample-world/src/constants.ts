/**
 * Layout (metres, y up). A hub in the middle; one room per topic, each behind a short corridor:
 *
 *                 A  3D positional audio / panning   (north, z < 0)
 *                 |
 *                HUB ── B occlusion (partition wall + pocket door)
 *
 * Every rectangle is given by its wall *centre lines*; walls are WALL.t thick, so the walkable interior is
 * the rectangle shrunk by WALL.t / 2. Openings are 2 m wide, 2.4 m high, centred on the wall.
 */
export const WALL = { t: 0.3, height: 3.6 } as const
export const DOORWAY = { width: 2, height: 2.4 } as const
/** corridor wall centre lines at ±CORRIDOR_HALF (inner width 2.2 m) */
export const CORRIDOR_HALF = 1.25

export type Rect = { x0: number; x1: number; z0: number; z1: number }
export type RoomId = 'positional' | 'occlusion'
export type Side = 'n' | 's' | 'e' | 'w'

export const HUB: Rect = { x0: -5, x1: 5, z0: -5, z1: 5 }

export interface RoomDef {
  id: RoomId
  rect: Rect
  /** the wall facing the hub (doorway side) */
  door: Side
  /** corridor between the hub wall and the room wall */
  corridor: Rect
  colors: { wall: string; floor: string; ceiling: string; corridor: string; accent: string; light: string }
}

export const ROOMS: RoomDef[] = [
  {
    id: 'positional',
    rect: { x0: -7, x1: 7, z0: -23, z1: -9 },
    door: 's',
    corridor: { x0: -CORRIDOR_HALF, x1: CORRIDOR_HALF, z0: -9, z1: -5 },
    colors: { wall: '#6d7f96', floor: '#1f2a37', ceiling: '#2a3340', corridor: '#4a5868', accent: '#4fc3f7', light: '#e3f2fd' },
  },
  {
    id: 'occlusion',
    rect: { x0: 9, x1: 25, z0: -6, z1: 6 },
    door: 'w',
    corridor: { x0: 5, x1: 9, z0: -CORRIDOR_HALF, z1: CORRIDOR_HALF },
    colors: { wall: '#a8774c', floor: '#3a2a1e', ceiling: '#3b2e24', corridor: '#6a5240', accent: '#ffa726', light: '#fff3e0' },
  },
]
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>

export const HUB_COLORS = { wall: '#8c8a84', floor: '#34373c', ceiling: '#2b2c2f', light: '#fafafa' } as const

/** room B: partition wall (thick "soundproof" wall) with a pocket door in the middle */
export const PARTITION = { x: 17, t: 0.6 } as const
/** the occluded speaker, on the far side of the partition, off the door axis */
export const OCCLUDED_SPEAKER: [number, number, number] = [22.2, 0, 2.6]

export const SPAWN: { position: [number, number, number]; yaw: number } = { position: [0, 0, 2.4], yaw: 0 }

export const COLORS = {
  cabinet: '#1d1d1f',
  cone: '#55595f',
  ok: '#43a047',
  off: '#e53935',
  bar: '#ffb300',
  door: '#7a4b2a',
} as const

export const rectCentre = (r: Rect): [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]
export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad
