import { Interactable } from '@xrift/world-components'
import type { ReactNode } from 'react'

/** white glyph pieces drawn 6 mm in front of a button face (no text in the world) */
export const GlyphBar = ({ x = 0, y = 0, w, h, r = 0 }: { x?: number; y?: number; w: number; h: number; r?: number }) => (
  <mesh position={[x, y, 0.046]} rotation={[0, 0, r]}>
    <boxGeometry args={[w, h, 0.005]} />
    <meshBasicMaterial color="#ffffff" />
  </mesh>
)
export const GlyphRing = ({ r, x = 0, y = 0 }: { r: number; x?: number; y?: number }) => (
  <mesh position={[x, y, 0.046]}>
    <ringGeometry args={[r - 0.008, r, 24]} />
    <meshBasicMaterial color="#ffffff" />
  </mesh>
)
export const GlyphDot = ({ r, x = 0, y = 0 }: { r: number; x?: number; y?: number }) => (
  <mesh position={[x, y, 0.046]}>
    <circleGeometry args={[r, 16]} />
    <meshBasicMaterial color="#ffffff" />
  </mesh>
)

export interface ButtonSpec {
  id: string
  /** hover hint shown by XRift's Interactable UI */
  text: string
  color: string
  /** lit (on) or dim (off) */
  on?: boolean
  onPress: () => void
  glyph?: ReactNode
}

export function Button({ spec, position }: { spec: ButtonSpec; position: [number, number, number] }) {
  const on = spec.on ?? true
  return (
    <group position={position}>
      <Interactable id={spec.id} interactionText={spec.text} onInteract={spec.onPress}>
        <mesh>
          <boxGeometry args={[0.22, 0.22, 0.08]} />
          <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={on ? 0.8 : 0.04} transparent opacity={on ? 1 : 0.6} />
        </mesh>
      </Interactable>
      {spec.glyph}
    </group>
  )
}

/** a post with a tilted board holding a row of buttons (front faces +z) */
export function ButtonStand({ position, rotation = 0, buttons, children }: { position: [number, number, number]; rotation?: number; buttons: ButtonSpec[]; children?: ReactNode }) {
  const pitch = 0.3
  const w = buttons.length * pitch + 0.2
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.55, -0.02]}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <group position={[0, 1.2, 0]} rotation={[-0.35, 0, 0]}>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[w, 0.4, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {buttons.map((b, i) => <Button key={b.id} spec={b} position={[-((buttons.length - 1) * pitch) / 2 + i * pitch, 0, 0]} />)}
        {children}
      </group>
    </group>
  )
}
