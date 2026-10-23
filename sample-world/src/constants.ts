/** room: x ∈ [-ROOM.half, ROOM.half], z ∈ [-ROOM.half, ROOM.half]; corridor behind the back wall (z > ROOM.half) */
export const ROOM = { half: 7, height: 4, wall: 0.3 } as const
export const DOOR = { width: 2, height: 2.4 } as const
export const CORRIDOR = { halfWidth: 3, length: 6 } as const

/** PA stacks on the front wall (acoustic centre at ear height) */
export const PA_POSITIONS: [number, number, number][] = [
  [-3.5, 0, -6.2],
  [3.5, 0, -6.2],
]
export const PA_ACOUSTIC_CENTRE: [number, number, number] = [0, 1.35, 0]

/** small point source (sine) in the back-right corner */
export const BEACON_POSITION: [number, number, number] = [5.8, 1.2, 5.2]

/** spectrum bars on the front wall, between the PA stacks */
export const VISUALIZER_POSITION: [number, number, number] = [0, 0.4, -6.75]

export const SPAWN: { position: [number, number, number]; yaw: number } = { position: [0, 0, 3], yaw: 0 }

export const COLORS = {
  floor: '#3a3f47',
  wall: '#c9c4b8',
  corridor: '#8d8578',
  cabinet: '#1d1d1f',
  cone: '#55595f',
  door: '#7a4b2a',
  beacon: '#4fc3f7',
  ok: '#43a047',
  off: '#e53935',
  bar: '#ffb300',
} as const
