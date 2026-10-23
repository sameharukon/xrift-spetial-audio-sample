import { CORRIDORS, CORRIDOR_HALF, DOORWAY, PARTITION, ROOMS, ROOM_BY_ID, WALL, type Rect } from './constants'

type Side = 'n' | 's' | 'e' | 'w'

/**
 * Pure geometry for the architecture (no React / three): wall runs, floor / ceiling slabs, the walkable
 * area and the physics boxes (= everything that is not walkable, extended 5 m outward).
 *
 * Z-fighting rules (why it is built this way):
 * - every wall run is ONE mesh (an extruded outline with the doorways notched out), so there are no
 *   abutting boxes with coplanar faces / seams around doorways;
 * - at a corner the run along x owns the corner; the run along z stops `BURY` inside it, so no two
 *   visible faces ever share a plane (the buried end face is hidden behind the other wall's face);
 * - floors / ceilings are split along wall centre lines (adjacent, never overlapping);
 * - anything mounted on a surface (bands, panels, doors) is offset ≥ 1 cm or buried ≥ 1 cm.
 */
export const BURY = 0.02
const h = WALL.t / 2

export interface WallRun {
  /** 'x' = runs along x at z = c; 'z' = runs along z at x = c */
  axis: 'x' | 'z'
  c: number
  a0: number
  a1: number
  t: number
  /** absolute [from, to] intervals along the axis, floor to DOORWAY.height */
  openings: [number, number][]
  color: string
}

export interface Slab { rect: Rect; color: string }
export interface Band { position: [number, number, number]; size: [number, number, number]; color: string }

const sideAxis = (s: Side): 'x' | 'z' => (s === 'n' || s === 's' ? 'x' : 'z')
const sideCoord = (r: Rect, s: Side) => (s === 'n' ? r.z0 : s === 's' ? r.z1 : s === 'w' ? r.x0 : r.x1)

/** four walls of a rectangle; `doors[side]` = centre (along the wall) of a doorway */
function rectWalls(r: Rect, color: string, doors: Partial<Record<Side, number>>): WallRun[] {
  return (['n', 's', 'w', 'e'] as Side[]).map((s) => {
    const axis = sideAxis(s)
    const [a0, a1] = axis === 'x' ? [r.x0 - h, r.x1 + h] : [r.z0 + h - BURY, r.z1 - h + BURY]
    const d = doors[s]
    return { axis, c: sideCoord(r, s), a0, a1, t: WALL.t, openings: d === undefined ? [] : [[d - DOORWAY.width / 2, d + DOORWAY.width / 2]], color }
  })
}

export function buildLayout() {
  const walls: WallRun[] = []
  const floors: Slab[] = []
  const ceilings: Slab[] = []
  const bands: Band[] = []
  const strips: Band[] = []
  const walk: Rect[] = []
  const lights: { position: [number, number, number]; size: [number, number]; color: string }[] = []

  const shrink = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d })
  const grow = (r: Rect, d: number) => shrink(r, -d)
  /** walkable gap through a z-axis wall run (at x = c) for the doorway on z = 0 */
  const doorGap = (c: number, t: number): Rect => ({ x0: c - t / 2, x1: c + t / 2, z0: -DOORWAY.width / 2, z1: DOORWAY.width / 2 })
  /** glowing band above a doorway on both faces of a z-axis wall (1 cm buried, 3 cm proud) */
  const doorBands = (c: number, t: number, color: string) => {
    const w = DOORWAY.width + 0.5, bh = 0.14, y = DOORWAY.height + 0.22
    for (const sgn of [-1, 1]) bands.push({ position: [c + sgn * (t / 2 + 0.01), y, 0], size: [0.04, bh, w], color })
  }

  // rooms: west / east doorways on z = 0 where a corridor joins (first room: east only, last room: west only)
  ROOMS.forEach((room, i) => {
    const { rect, colors } = room
    const doors: Partial<Record<Side, number>> = {}
    if (i > 0) doors.w = 0
    if (i < ROOMS.length - 1) doors.e = 0
    walls.push(...rectWalls(rect, colors.wall, doors))
    floors.push({ rect, color: colors.floor })
    ceilings.push({ rect: grow(rect, h), color: colors.ceiling })
    const [cx, cz] = [(rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2]
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0
    for (const [fx, fz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      lights.push({ position: [cx + fx * w, WALL.height, cz + fz * d], size: [w > 10 ? 1.2 : 0.9, w > 10 ? 1.2 : 0.9], color: colors.light })
    }
    if (room.id === 'occlusion') {
      // partition with a pocket door: the walkable interior is two halves + the door gap
      walls.push({ axis: 'z', c: PARTITION.x, a0: rect.z0 + h - BURY, a1: rect.z1 - h + BURY, t: PARTITION.t, openings: [[-DOORWAY.width / 2, DOORWAY.width / 2]], color: '#7d5638' })
      const inside = shrink(rect, h)
      walk.push({ ...inside, x1: PARTITION.x - PARTITION.t / 2 }, { ...inside, x0: PARTITION.x + PARTITION.t / 2 })
      walk.push(doorGap(PARTITION.x, PARTITION.t))
      doorBands(PARTITION.x, PARTITION.t, colors.accent)
    } else {
      walk.push(shrink(rect, h))
    }
  })

  // corridors: two side walls along x, buried BURY into the doorway walls at both ends.
  // The way on is lit in the colour of the room it leads to: the bands over both doorways and a floor strip.
  for (const cor of CORRIDORS) {
    const { rect: r } = cor
    const from = ROOM_BY_ID[cor.from], to = ROOM_BY_ID[cor.to]
    for (const s of [-1, 1]) walls.push({ axis: 'x', c: s * CORRIDOR_HALF, a0: r.x0 + h - BURY, a1: r.x1 - h + BURY, t: WALL.t, openings: [], color: from.colors.corridor })
    floors.push({ rect: r, color: from.colors.corridor })
    const a0 = r.x0 + h, a1 = r.x1 - h, inner = CORRIDOR_HALF - h, outer = CORRIDOR_HALF + h
    ceilings.push({ rect: { x0: a0, x1: a1, z0: -outer, z1: outer }, color: from.colors.ceiling })
    walk.push({ x0: a0, x1: a1, z0: -inner, z1: inner })
    walk.push(doorGap(r.x0, WALL.t), doorGap(r.x1, WALL.t))
    lights.push({ position: [(a0 + a1) / 2, WALL.height, 0], size: [2, 0.5], color: to.colors.light })
    doorBands(r.x0, WALL.t, to.colors.accent)
    doorBands(r.x1, WALL.t, to.colors.accent)
    // floor strip (1 cm buried, 1 cm proud), from 1.2 m inside the previous room to the next room's threshold
    strips.push({ position: [(r.x0 - 1.2 + r.x1) / 2, 0, 0], size: [r.x1 - r.x0 + 1.2, 0.02, 0.12], color: to.colors.accent })
  }
  return { walls, floors, ceilings, bands, strips, walk, lights, colliders: solidBoxes(walk, 5) }
}

/**
 * Complement of the union of `walk` rectangles inside their bounding box grown by `margin`,
 * merged into a small set of axis-aligned boxes (coordinate-compressed grid → row runs → vertical merge).
 */
export function solidBoxes(walk: Rect[], margin: number): Rect[] {
  const xs0 = walk.flatMap((r) => [r.x0, r.x1]), zs0 = walk.flatMap((r) => [r.z0, r.z1])
  const bx0 = Math.min(...xs0) - margin, bx1 = Math.max(...xs0) + margin
  const bz0 = Math.min(...zs0) - margin, bz1 = Math.max(...zs0) + margin
  const uniq = (a: number[]) => [...new Set(a.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q)
  const xs = uniq([bx0, bx1, ...xs0]), zs = uniq([bz0, bz1, ...zs0])
  const solid = (i: number, j: number) => {
    const x = (xs[i] + xs[i + 1]) / 2, z = (zs[j] + zs[j + 1]) / 2
    return !walk.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
  }
  // runs per row: key "i0-i1" → open box
  let open = new Map<string, Rect>()
  const out: Rect[] = []
  for (let j = 0; j < zs.length - 1; j++) {
    const runs: [number, number][] = []
    for (let i = 0; i < xs.length - 1; i++) {
      if (!solid(i, j)) continue
      if (runs.length && runs[runs.length - 1][1] === i) runs[runs.length - 1][1] = i + 1
      else runs.push([i, i + 1])
    }
    const next = new Map<string, Rect>()
    for (const [i0, i1] of runs) {
      const k = `${i0}-${i1}`
      const prev = open.get(k)
      if (prev) { prev.z1 = zs[j + 1]; next.set(k, prev); open.delete(k) }
      else next.set(k, { x0: xs[i0], x1: xs[i1], z0: zs[j], z1: zs[j + 1] })
    }
    out.push(...open.values())
    open = next
  }
  out.push(...open.values())
  return out
}
