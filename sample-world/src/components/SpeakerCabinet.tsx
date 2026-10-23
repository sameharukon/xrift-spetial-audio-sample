import { COLORS } from '../constants'

/** 0.8 × 1.9 m PA stack (sub + top), front facing +z. Cones stand 1 cm proud of the baffle. */
export function SpeakerCabinet() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.9, 0.7]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.45, 0.355]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 32]} />
        <meshStandardMaterial color={COLORS.cone} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.6, 1.0, 0.5]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.8} />
      </mesh>
      {[1.2, 1.62].map((y, i) => (
        <mesh key={y} position={[0, y, 0.255]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[i ? 0.08 : 0.17, i ? 0.08 : 0.17, 0.02, 24]} />
          <meshStandardMaterial color={COLORS.cone} />
        </mesh>
      ))}
    </group>
  )
}

/** small monitor on a pole (acoustic centre at y ≈ 1.25), front facing +z, coloured trim */
export function MiniSpeaker({ color, lit = true }: { color: string; lit?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[0.42, 0.62, 0.36]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.15, 0.185]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 24]} />
        <meshStandardMaterial color={COLORS.cone} />
      </mesh>
      <mesh position={[0, 1.45, 0.185]}>
        <boxGeometry args={[0.3, 0.06, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 1.0 : 0.05} />
      </mesh>
    </group>
  )
}

/** omnidirectional column speaker (acoustic centre at y ≈ 1.25): pole, drum-shaped body, grille rings */
export function OmniSpeaker({ color, lit = true }: { color: string; lit?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.9, 12]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.7, 32]} />
        <meshStandardMaterial color={COLORS.cabinet} roughness={0.85} />
      </mesh>
      {[1.0, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.315, 0.315, 0.05, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 0.9 : 0.04} />
        </mesh>
      ))}
    </group>
  )
}
