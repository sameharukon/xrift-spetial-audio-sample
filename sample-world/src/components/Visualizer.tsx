import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type InstancedMesh, type Mesh, type MeshStandardMaterial } from 'three'
import { driveInstancedBars, useAudioAnalyser } from 'xrift-spatial-audio/r3f'

const BANDS = 24
const ANALYSER = { fftSize: 2048, bands: BANDS, minHz: 35, maxHz: 14000, minDb: -85, maxDb: -20, attack: 0.03, release: 0.3 }

/**
 * Spectrum bars + a beat lamp driven by an analyser tapped on `node` (refs only — no React re-renders).
 * The beat lamp fades over ~0.15 s and onsets are at least 0.25 s apart → flashing stays ≤ 4 Hz.
 */
export function Visualizer({ node, position, rotation = 0 }: { node: AudioNode | null; position: [number, number, number]; rotation?: number }) {
  const an = useAudioAnalyser(node, ANALYSER)
  const bars = useRef<InstancedMesh>(null)
  const lamp = useRef<MeshStandardMaterial>(null)
  const idle = useMemo(() => new Float32Array(BANDS), [])
  const base = useMemo(() => new Color('#0d47a1'), [])
  const hot = useMemo(() => new Color('#26c6da'), [])
  useFrame(() => {
    const a = an.current
    if (bars.current) {
      driveInstancedBars(bars.current, a ? a.bands : idle, { width: 0.16, depth: 0.08, gap: 0.05, minHeight: 0.03, maxHeight: 1.6 })
      const m = bars.current.material as MeshStandardMaterial
      m.emissive.copy(base).lerp(hot, a ? Math.min(1, a.bands[1] * 1.2) : 0)
    }
    if (lamp.current) lamp.current.emissiveIntensity = 0.08 + (a ? a.beatPulse : 0) * 1.4
  })
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <instancedMesh ref={bars} args={[undefined, undefined, BANDS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0a0f1a" emissive="#0d47a1" emissiveIntensity={0.9} roughness={0.6} />
      </instancedMesh>
      <mesh position={[0, 2.2, 0]}>
        <circleGeometry args={[0.28, 32]} />
        <meshStandardMaterial ref={lamp} color="#1a0a14" emissive="#ec407a" emissiveIntensity={0.08} />
      </mesh>
    </group>
  )
}

const FOUR = ['#e53935', '#fb8c00', '#43a047', '#1e88e5']
const FOUR_OPTS = { bands: 'four' as const, attack: 0.03, release: 0.25, minDb: -80, maxDb: -20 }

/** four columns: bass / low-mid / mid / high (`bands: 'four'`), each 0.1 … 2.2 m tall */
export function BandColumns({ node, position, rotation = 0 }: { node: AudioNode | null; position: [number, number, number]; rotation?: number }) {
  const an = useAudioAnalyser(node, FOUR_OPTS)
  const cols = useRef<(Mesh | null)[]>([])
  useFrame(() => {
    const a = an.current
    for (let i = 0; i < 4; i++) {
      const m = cols.current[i]
      if (!m) continue
      const v = a ? a.bands[i] : 0
      const hgt = 0.1 + 2.1 * v
      m.scale.y = hgt
      m.position.y = 0.06 + hgt / 2
      ;(m.material as MeshStandardMaterial).emissiveIntensity = 0.2 + v * 1.1
    }
  })
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {FOUR.map((c, i) => (
        <group key={c} position={[(i - 1.5) * 1.1, 0, 0]}>
          {/* plinth (top 6 cm above the floor; the column starts on top of it, never coplanar with it) */}
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.6, 0.06, 0.6]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh ref={(m) => { cols.current[i] = m }} position={[0, 0.11, 0]}>
            <boxGeometry args={[0.36, 1, 0.36]} />
            <meshStandardMaterial color="#111" emissive={c} emissiveIntensity={0.2} transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const PITCH_LO = 55, OCTAVES = 5, METER_Y0 = 0.4, METER_H = 2.2
const yForHz = (f: number) => METER_Y0 + (METER_H * Math.log2(Math.max(PITCH_LO, f) / PITCH_LO)) / OCTAVES

/** pitch column: one tick per octave from 55 Hz to 1760 Hz, the marker follows `pitch()` of `node` */
export function PitchMeter({ node, position, rotation = 0, color }: { node: AudioNode | null; position: [number, number, number]; rotation?: number; color: string }) {
  const an = useAudioAnalyser(node, { fftSize: 2048, smoothing: 0.2 })
  const marker = useRef<Mesh>(null)
  const y = useRef(METER_Y0)
  useFrame((_, dt) => {
    const a = an.current
    const f = a ? a.pitch(50, 2000) || a.dominantFrequency(50, 2000) : 0
    const target = a && a.rms > 0.002 && f > 0 ? yForHz(f) : METER_Y0
    y.current += (target - y.current) * Math.min(1, dt * 10)
    if (marker.current) marker.current.position.y = y.current
  })
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, METER_Y0 + METER_H / 2, 0]}>
        <boxGeometry args={[0.24, METER_H + 0.2, 0.06]} />
        <meshStandardMaterial color="#14181c" />
      </mesh>
      {Array.from({ length: OCTAVES + 1 }, (_, k) => (
        <mesh key={k} position={[0, METER_Y0 + (METER_H * k) / OCTAVES, 0.035]}>
          <boxGeometry args={[k % 2 ? 0.14 : 0.2, 0.012, 0.012]} />
          <meshBasicMaterial color="#9e9e9e" />
        </mesh>
      ))}
      <mesh ref={marker} position={[0, METER_Y0, 0.07]}>
        <boxGeometry args={[0.34, 0.05, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  )
}
