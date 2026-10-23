import { Interactable } from '@xrift/world-components'
import { RigidBody } from '@react-three/rapier'
import { COLORS, DOOR, ROOM } from '../constants'

/** sliding door in the back wall; click it (from either side) to open / close */
export function Door({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const z = ROOM.half + ROOM.wall / 2 + 0.06
  const x = open ? DOOR.width * 0.95 : 0
  return (
    <group>
      <Interactable id="sample-door" interactionText={open ? '扉を閉める' : '扉を開ける'} onInteract={onToggle}>
        <mesh position={[x, DOOR.height / 2, z]} castShadow>
          <boxGeometry args={[DOOR.width, DOOR.height, 0.08]} />
          <meshStandardMaterial color={COLORS.door} roughness={0.7} />
        </mesh>
      </Interactable>
      {!open && (
        <RigidBody type="fixed" colliders="cuboid">
          <mesh position={[0, DOOR.height / 2, ROOM.half]} visible={false}>
            <boxGeometry args={[DOOR.width, DOOR.height, ROOM.wall]} />
          </mesh>
        </RigidBody>
      )}
    </group>
  )
}
