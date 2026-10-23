import { Interactable } from '@xrift/world-components'
import { COLORS } from '../constants'
import { VOLUME_STEPS } from '../audio/volume'

export interface ControlStandProps {
  position: [number, number, number]
  volumePct: number
  onVolume: (pct: number) => void
  beacon: boolean
  onBeacon: () => void
  /** AudioContext running (green) / not yet unlocked (red) */
  running: boolean
}

function Button({ id, text, position, color, onPress, children }: { id: string; text: string; position: [number, number, number]; color: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <group position={position}>
      <Interactable id={id} interactionText={text} onInteract={onPress}>
        <mesh>
          <boxGeometry args={[0.22, 0.22, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </Interactable>
      {children}
    </group>
  )
}

const Bar = ({ w, h }: { w: number; h: number }) => (
  <mesh position={[0, 0, 0.045]}>
    <boxGeometry args={[w, h, 0.01]} />
    <meshBasicMaterial color="#ffffff" />
  </mesh>
)

/** volume − / +, a level bar (0–200 %, tick at 100 %), beacon toggle and an audio-state lamp */
export function ControlStand({ position, volumePct, onVolume, beacon, onBeacon, running }: ControlStandProps) {
  const idx = VOLUME_STEPS.indexOf(volumePct as (typeof VOLUME_STEPS)[number])
  const step = (d: number) => onVolume(VOLUME_STEPS[Math.min(VOLUME_STEPS.length - 1, Math.max(0, idx + d))])
  const barW = 1.0
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <group position={[0, 1.25, 0]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[1.5, 0.75, 0.04]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* level bar */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[barW, 0.08, 0.02]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[-barW / 2 + (barW * volumePct) / 400, 0.2, 0.012]}>
          <boxGeometry args={[Math.max(0.001, (barW * volumePct) / 200), 0.08, 0.02]} />
          <meshStandardMaterial color={COLORS.bar} emissive={COLORS.bar} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0.03]}>
          <boxGeometry args={[0.01, 0.14, 0.01]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Button id="sample-vol-down" text={`音量を下げる（${volumePct}%）`} position={[-0.45, -0.1, 0]} color="#607d8b" onPress={() => step(-1)}>
          <Bar w={0.12} h={0.03} />
        </Button>
        <Button id="sample-vol-up" text={`音量を上げる（${volumePct}%）`} position={[-0.15, -0.1, 0]} color="#607d8b" onPress={() => step(1)}>
          <Bar w={0.12} h={0.03} />
          <Bar w={0.03} h={0.12} />
        </Button>
        <Button id="sample-beacon" text={beacon ? 'サイン波ビーコンを止める' : 'サイン波ビーコンを鳴らす'} position={[0.25, -0.1, 0]} color={beacon ? COLORS.beacon : '#37474f'} onPress={onBeacon} />
        {/* audio state lamp */}
        <mesh position={[0.55, -0.1, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={running ? COLORS.ok : COLORS.off} emissive={running ? COLORS.ok : COLORS.off} emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  )
}
