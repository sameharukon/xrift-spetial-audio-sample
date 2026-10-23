import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import { DOORWAY, WALL, type Rect } from '../constants'
import { buildLayout, type WallRun } from '../layout'

/** one wall run = one mesh: the outline with its doorways notched out, extruded by the wall thickness */
function WallMesh({ run }: { run: WallRun }) {
  const geo = useMemo(() => {
    const L = run.a1 - run.a0
    const s = new Shape()
    s.moveTo(0, 0)
    for (const [lo, hi] of [...run.openings].sort((a, b) => a[0] - b[0])) {
      const u0 = lo - run.a0, u1 = hi - run.a0
      s.lineTo(u0, 0); s.lineTo(u0, DOORWAY.height); s.lineTo(u1, DOORWAY.height); s.lineTo(u1, 0)
    }
    s.lineTo(L, 0); s.lineTo(L, WALL.height); s.lineTo(0, WALL.height); s.closePath()
    return new ExtrudeGeometry(s, { depth: run.t, bevelEnabled: false, curveSegments: 1 })
  }, [run])
  const props = run.axis === 'x'
    ? { position: [run.a0, 0, run.c - run.t / 2] as [number, number, number] }
    : { position: [run.c + run.t / 2, 0, run.a0] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] }
  return (
    <mesh geometry={geo} {...props}>
      <meshStandardMaterial color={run.color} roughness={0.92} />
    </mesh>
  )
}

function Slab({ rect, y0, y1, color, basic }: { rect: Rect; y0: number; y1: number; color: string; basic?: boolean }) {
  return (
    <mesh position={[(rect.x0 + rect.x1) / 2, (y0 + y1) / 2, (rect.z0 + rect.z1) / 2]}>
      <boxGeometry args={[rect.x1 - rect.x0, y1 - y0, rect.z1 - rect.z0]} />
      {basic ? <meshBasicMaterial color={color} /> : <meshStandardMaterial color={color} roughness={0.95} />}
    </mesh>
  )
}

/** thick colliders: everything that is not walkable (5 m beyond the outer walls), from 0.1 m above the floor */
function Colliders({ solids, bounds }: { solids: Rect[]; bounds: Rect }) {
  const H = WALL.height
  const box = (r: Rect, y0: number, y1: number, k: string) => (
    <CuboidCollider key={k} args={[(r.x1 - r.x0) / 2, (y1 - y0) / 2, (r.z1 - r.z0) / 2]} position={[(r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2]} />
  )
  return (
    <RigidBody type="fixed" colliders={false} restitution={0} friction={0}>
      {solids.map((r, i) => box(r, 0.1, H + 6, `w${i}`))}
      {box(bounds, -5, 0, 'floor')}
      {box(bounds, H, H + 10, 'ceiling')}
    </RigidBody>
  )
}

export function Architecture() {
  const L = useMemo(() => buildLayout(), [])
  const bounds = useMemo<Rect>(() => ({
    x0: Math.min(...L.colliders.map((r) => r.x0)), x1: Math.max(...L.colliders.map((r) => r.x1)),
    z0: Math.min(...L.colliders.map((r) => r.z0)), z1: Math.max(...L.colliders.map((r) => r.z1)),
  }), [L])
  const H = WALL.height
  return (
    <group>
      {L.walls.map((w, i) => <WallMesh key={i} run={w} />)}
      {L.floors.map((f, i) => <Slab key={`f${i}`} rect={f.rect} y0={-0.1} y1={0} color={f.color} />)}
      {L.ceilings.map((c, i) => <Slab key={`c${i}`} rect={c.rect} y0={H} y1={H + 0.2} color={c.color} />)}
      {/* light panels: 1 cm buried in the ceiling, 3 cm below it */}
      {L.lights.map((p, i) => (
        <Slab key={`l${i}`} rect={{ x0: p.position[0] - p.size[0] / 2, x1: p.position[0] + p.size[0] / 2, z0: p.position[2] - p.size[1] / 2, z1: p.position[2] + p.size[1] / 2 }} y0={H - 0.03} y1={H + 0.01} color={p.color} basic />
      ))}
      {L.bands.map((b, i) => (
        <mesh key={`b${i}`} position={b.position}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {L.strips.map((b, i) => (
        <mesh key={`s${i}`} position={b.position}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color={b.color} />
        </mesh>
      ))}
      <Colliders solids={L.colliders} bounds={bounds} />
    </group>
  )
}
