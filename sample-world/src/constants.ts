/**
 * Layout (metres, y up). One straight path from west to east, no branching; the order is the layout:
 *
 *   spawn → V volume ══ A 3D positioning ══ B occlusion (partition wall + pocket door)
 *           (x −21…−13)  (x −9…5)            (x 9…25)
 *
 * Consecutive rooms are joined by a 4 m corridor on the z = 0 axis (east wall of one room → west wall of
 * the next). Every rectangle is given by its wall *centre lines*; walls are WALL.t thick, so the walkable
 * interior is the rectangle shrunk by WALL.t / 2. Openings are 2 m wide, 2.4 m high, centred on z = 0.
 */
export const WALL = { t: 0.3, height: 3.6 } as const
export const DOORWAY = { width: 2, height: 2.4 } as const
/** corridor wall centre lines at ±CORRIDOR_HALF (inner width 2.2 m) */
export const CORRIDOR_HALF = 1.25

export type Rect = { x0: number; x1: number; z0: number; z1: number }
export type RoomId = 'volume' | 'positional' | 'occlusion'

export interface RoomDef {
  id: RoomId
  rect: Rect
  colors: { wall: string; floor: string; ceiling: string; corridor: string; accent: string; light: string }
}

/** in walking order; ROOMS[i] and ROOMS[i + 1] are joined by a corridor */
export const ROOMS: RoomDef[] = [
  {
    id: 'volume',
    rect: { x0: -21, x1: -13, z0: -4, z1: 4 },
    colors: { wall: '#8c8a84', floor: '#34373c', ceiling: '#2b2c2f', corridor: '#6e6c67', accent: '#cfd8dc', light: '#fafafa' },
  },
  {
    id: 'positional',
    rect: { x0: -9, x1: 5, z0: -7, z1: 7 },
    colors: { wall: '#6d7f96', floor: '#1f2a37', ceiling: '#2a3340', corridor: '#4a5868', accent: '#4fc3f7', light: '#e3f2fd' },
  },
  {
    id: 'occlusion',
    rect: { x0: 9, x1: 25, z0: -6, z1: 6 },
    colors: { wall: '#a8774c', floor: '#3a2a1e', ceiling: '#3b2e24', corridor: '#6a5240', accent: '#ffa726', light: '#fff3e0' },
  },
]
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>

export interface Corridor { from: RoomId; to: RoomId; rect: Rect }
/** corridor i joins ROOMS[i] (west end) to ROOMS[i + 1] (east end) */
export const CORRIDORS: Corridor[] = ROOMS.slice(1).map((to, i) => {
  const from = ROOMS[i]
  return { from: from.id, to: to.id, rect: { x0: from.rect.x1, x1: to.rect.x0, z0: -CORRIDOR_HALF, z1: CORRIDOR_HALF } }
})

/** room B: partition wall (thick "soundproof" wall) with a pocket door in the middle */
export const PARTITION = { x: 17, t: 0.6 } as const
/** the occluded speaker, on the far side of the partition, off the door axis */
export const OCCLUDED_SPEAKER: [number, number, number] = [22.2, 0, 2.6]

/** west end of the volume room, facing east (+x) along the path; yaw in degrees, 0 = −z, 270 = +x */
export const SPAWN: { position: [number, number, number]; yaw: number } = { position: [-19.8, 0, 0], yaw: 270 }

/**
 * Control panels: just inside each room's entrance, on the left (−z) of the path, angled back towards the
 * doorway so they face you as you come in. Board at ≈1.2 m (waist / chest height in VR and on desktop).
 * rotation = yaw of the board's front (+z) — −π/4 faces the incoming player (−x, +z).
 */
export const PANEL_YAW = -Math.PI / 4
export const PANELS: Record<RoomId, [number, number, number]> = {
  volume: [-18.3, 0, -1.6],
  positional: [-7.3, 0, -2.0],
  occlusion: [10.8, 0, -2.0],
}
/** room V: the reference speaker (drumLoop at the tuned level) beside the volume panel */
export const REFERENCE_SPEAKER: [number, number, number] = [-15.2, 0, -2.2]

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
