import { VOLUME_STEPS } from '../audio/volume'
import { COLORS } from '../constants'
import { Button, GlyphBar } from './Controls'

/** room V: volume − / +, a level bar (0–200 %, tick at 100 %) and the audio-state lamp (red = locked, green = running) */
export function VolumeStand({ position, rotation = 0, volumePct, onVolume, running }: { position: [number, number, number]; rotation?: number; volumePct: number; onVolume: (v: number) => void; running: boolean }) {
  const idx = VOLUME_STEPS.indexOf(volumePct as (typeof VOLUME_STEPS)[number])
  const step = (d: number) => onVolume(VOLUME_STEPS[Math.min(VOLUME_STEPS.length - 1, Math.max(0, idx + d))])
  const barW = 1.0
  const fillW = Math.max(0.001, (barW * volumePct) / 200)
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.55, -0.02]}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <group position={[0, 1.25, 0]} rotation={[-0.3, 0, 0]}>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[1.4, 0.7, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* level bar: track (front at −0.02), fill (front at −0.005), 100 % tick (front at +0.005) */}
        <mesh position={[0, 0.18, -0.03]}>
          <boxGeometry args={[barW, 0.08, 0.02]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[-barW / 2 + fillW / 2, 0.18, -0.015]}>
          <boxGeometry args={[fillW, 0.06, 0.02]} />
          <meshStandardMaterial color={COLORS.bar} emissive={COLORS.bar} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[0.012, 0.14, 0.01]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Button position={[-0.4, -0.12, 0]} spec={{ id: 'sample-vol-down', text: `音量を下げる（${volumePct}%）`, color: '#607d8b', onPress: () => step(-1), glyph: <GlyphBar w={0.12} h={0.03} /> }} />
        <Button position={[-0.1, -0.12, 0]} spec={{ id: 'sample-vol-up', text: `音量を上げる（${volumePct}%）`, color: '#607d8b', onPress: () => step(1), glyph: <><GlyphBar w={0.12} h={0.03} /><GlyphBar w={0.03} h={0.12} /></> }} />
        <mesh position={[0.4, -0.12, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={running ? COLORS.ok : COLORS.off} emissive={running ? COLORS.ok : COLORS.off} emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  )
}
