import { RigidBody } from '@react-three/rapier'
import { COLORS, CORRIDOR, DOOR, ROOM } from '../constants'

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" restitution={0} friction={0}>
      <mesh position={position} receiveShadow castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </RigidBody>
  )
}

/** 14 × 14 m room, doorway in the back wall (z = +7) leading to a 6 × 6 m corridor */
export function Room() {
  const { half: h, height: H, wall: t } = ROOM
  const side = (h * 2 - DOOR.width) / 2
  const cl = CORRIDOR.length
  const cw = CORRIDOR.halfWidth
  return (
    <group>
      {/* floor (room + corridor) */}
      <Box position={[0, -0.05, cl / 2]} size={[h * 2, 0.1, h * 2 + cl]} color={COLORS.floor} />
      {/* front / left / right walls */}
      <Box position={[0, H / 2, -h]} size={[h * 2, H, t]} color={COLORS.wall} />
      <Box position={[-h, H / 2, 0]} size={[t, H, h * 2]} color={COLORS.wall} />
      <Box position={[h, H / 2, 0]} size={[t, H, h * 2]} color={COLORS.wall} />
      {/* back wall with a doorway */}
      <Box position={[-(DOOR.width / 2 + side / 2), H / 2, h]} size={[side, H, t]} color={COLORS.wall} />
      <Box position={[DOOR.width / 2 + side / 2, H / 2, h]} size={[side, H, t]} color={COLORS.wall} />
      <Box position={[0, (H + DOOR.height) / 2, h]} size={[DOOR.width, H - DOOR.height, t]} color={COLORS.wall} />
      {/* corridor */}
      <Box position={[-cw, H / 2, h + cl / 2]} size={[t, H, cl]} color={COLORS.corridor} />
      <Box position={[cw, H / 2, h + cl / 2]} size={[t, H, cl]} color={COLORS.corridor} />
      <Box position={[0, H / 2, h + cl]} size={[cw * 2, H, t]} color={COLORS.corridor} />
    </group>
  )
}
