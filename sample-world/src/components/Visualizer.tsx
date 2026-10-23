import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type InstancedMesh, type MeshStandardMaterial } from 'three'
import { driveInstancedBars, useAudioAnalyser } from 'xrift-spatial-audio/r3f'

const BANDS = 24
const ANALYSER = { fftSize: 2048, bands: BANDS, minHz: 35, maxHz: 14000, minDb: -85, maxDb: -20, attack: 0.03, release: 0.3 }

/**
 * Spectrum bars + a beat lamp driven by an analyser tapped on `node` (refs only — no React re-renders).
 * The beat lamp fades over ~0.15 s and onsets are at least 0.25 s apart → flashing stays ≤ 4 Hz.
 */
export function Visualizer({ node, position }: { node: AudioNode | null; position: [number, number, number] }) {
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
    <group position={position}>
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
