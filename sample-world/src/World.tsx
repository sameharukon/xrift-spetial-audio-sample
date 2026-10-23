import { SpawnPoint } from '@xrift/world-components'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Color } from 'three'
import { SpatialAudioProvider } from 'xrift-spatial-audio/r3f'
import { SpatialAudioScene } from './audio/SpatialAudioScene'
import { Architecture } from './components/Architecture'
import { SPAWN } from './constants'

export interface WorldProps {
  position?: [number, number, number]
  scale?: number
}

/**
 * Spatial audio sample: one straight walk from west to east, no branching (see constants.ts):
 *   V  set the volume against a reference speaker (volume panel + audio-state lamp)
 *   A  3D positional audio (one drum-loop source circling the room, equal-power ↔ HRTF)
 *   B  occlusion (`createMuffle`): a speaker behind a partition with a pocket door
 * Each corridor is lit (bands over its doorways, a floor strip) in the colour of the room it leads to.
 * Each room has its own bus, gated / muffled by where the listener is, so rooms do not bleed into each other.
 * Audio starts on the first click / key / touch / pointer lock / XR session start; it is local to each visitor.
 */
export const World: React.FC<WorldProps> = ({ position = [0, 0, 0], scale = 1 }) => {
  const [volumePct, setVolumePct] = useState(100)
  return (
    <group position={position} scale={scale}>
      <SceneBackground color="#08090b" />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#ffffff', '#6a6a6a', 0.6]} />
      <directionalLight position={[4, 10, 6]} intensity={0.9} />
      <Architecture />
      <SpatialAudioProvider>
        <SpatialAudioScene volumePct={volumePct} onVolume={setVolumePct} />
      </SpatialAudioProvider>
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
