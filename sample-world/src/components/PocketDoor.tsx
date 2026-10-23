import { Interactable } from '@xrift/world-components'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { COLORS, DOORWAY, PARTITION } from '../constants'

const W = DOORWAY.width + 0.04 // 2 cm into each jamb (end faces buried, never coplanar with the jamb)
const Y0 = 0.01, Y1 = DOORWAY.height + 0.02 // top edge buried 2 cm in the lintel
const T = 0.08
const OPEN_Z = -(W - 0.27) // slides into the partition; 27 cm stays out as a handle

/** pocket door in room B's partition (slides along z inside the 0.6 m wall); click from either side */
export function PocketDoor({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const g = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!g.current) return
    const target = open ? OPEN_Z : 0
    const z = g.current.position.z
    g.current.position.z = Math.abs(target - z) < 0.002 ? target : z + (target - z) * Math.min(1, dt * 6)
  })
  return (
    <group>
      <group ref={g} position={[PARTITION.x, 0, open ? OPEN_Z : 0]}>
        <Interactable id="sample-occlusion-door" interactionText={open ? '扉を閉める' : '扉を開ける'} onInteract={onToggle}>
          <mesh position={[0, (Y0 + Y1) / 2, 0]}>
            <boxGeometry args={[T, Y1 - Y0, W]} />
            <meshStandardMaterial color={COLORS.door} roughness={0.7} />
          </mesh>
        </Interactable>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (T / 2 + 0.025), 1.05, W / 2 - 0.12]}>
            <boxGeometry args={[0.05, 0.3, 0.05]} />
            <meshStandardMaterial color="#c0c0c0" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[PARTITION.t / 2, 5, DOORWAY.width / 2]} position={[PARTITION.x, 5.1, 0]} />
        </RigidBody>
      )}
    </group>
  )
}
