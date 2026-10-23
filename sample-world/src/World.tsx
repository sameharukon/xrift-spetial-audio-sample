import { SpawnPoint } from '@xrift/world-components'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { Color } from 'three'
import { SpatialAudioProvider, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import { SpatialAudioScene } from './audio/SpatialAudioScene'
import { FILTERS_OFF, filterSpecs, type FilterState } from './audio/filterPads'
import { ControlStand } from './components/ControlStand'
import { FilterPads } from './components/FilterPads'
import { Door } from './components/Door'
import { Room } from './components/Room'
import { SPAWN } from './constants'

export interface WorldProps {
  position?: [number, number, number]
  scale?: number
}

/**
 * Spatial audio sample:
 * - two PA stacks on the front wall play the built-in drum loop through `useClubPA` (L / R panners)
 * - a quiet sine "beacon" in the back-right corner uses a standalone <Speaker> panner
 * - the doorway in the back wall leads to a corridor; close the door to hear the occlusion (low-pass + level)
 * - volume − / + (0–200 %, boost above 100 % goes before the limiter), beacon toggle, audio-state lamp
 * - six filter pads (low-pass, high-pass, reverb, echo, distortion, chorus) on the PA programme and the beacon
 * - spectrum bars + beat lamp on the front wall (analyser on the source mix)
 * - audio starts on the first click / key / touch / pointer lock / XR session start
 *
 * The audio is local to each visitor (no instance-state sync).
 */
export const World: React.FC<WorldProps> = ({ position = [0, 0, 0], scale = 1 }) => {
  const [doorOpen, setDoorOpen] = useState(true)
  const [volumePct, setVolumePct] = useState(100)
  const [beacon, setBeacon] = useState(true)
  const [fx, setFx] = useState<FilterState>(FILTERS_OFF)
  const filters = useMemo(() => filterSpecs(fx), [fx])
  return (
    <group position={position} scale={scale}>
      <SceneBackground color="#101216" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 10, 6]} intensity={1.6} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
      <Room />
      <Door open={doorOpen} onToggle={() => setDoorOpen((o) => !o)} />
      <SpatialAudioProvider>
        <SpatialAudioScene doorOpen={doorOpen} volumePct={volumePct} beacon={beacon} filters={filters} />
        <Stand volumePct={volumePct} onVolume={setVolumePct} beacon={beacon} onBeacon={() => setBeacon((b) => !b)} />
      </SpatialAudioProvider>
      <FilterPads position={[-1.6, 0, 2.2]} state={fx} onToggle={(id) => setFx((s) => ({ ...s, [id]: !s[id] }))} />
      <SpawnPoint position={SPAWN.position} yaw={SPAWN.yaw} />
    </group>
  )
}

/** `<color attach="background">` inside a group would attach to the group, not the scene → set scene.background directly */
function SceneBackground({ color }: { color: string }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prev = scene.background
    scene.background = new Color(color)
    return () => { scene.background = prev }
  }, [scene, color])
  return null
}

function Stand(p: { volumePct: number; onVolume: (v: number) => void; beacon: boolean; onBeacon: () => void }) {
  const running = useSpatialAudio()?.running ?? false
  return <ControlStand position={[1.6, 0, 2.2]} running={running} {...p} />
}
