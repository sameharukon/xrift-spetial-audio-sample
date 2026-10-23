import { COLORS } from '../constants'

/** 0.7 × 2.0 m PA stack (sub + top), front facing +z */
export function SpeakerCabinet() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.8, 0.9, 0.7]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.45, 0.351]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.01, 32]} />
        <meshStandardMaterial color={COLORS.cone} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.6, 1.0, 0.5]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.8} />
      </mesh>
      {[1.2, 1.62].map((y, i) => (
        <mesh key={y} position={[0, y, 0.251]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[i ? 0.08 : 0.17, i ? 0.08 : 0.17, 0.01, 24]} />
          <meshStandardMaterial color={COLORS.cone} />
        </mesh>
      ))}
    </group>
  )
}
