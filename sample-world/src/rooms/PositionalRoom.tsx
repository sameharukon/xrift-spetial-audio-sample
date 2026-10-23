import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group } from 'three'
import { Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { useTestSource } from '../audio/useTestSource'
import { ButtonStand, GlyphDot, GlyphRing } from '../components/Controls'
import { OmniSpeaker } from '../components/SpeakerCabinet'
import { PANELS, PANEL_YAW, ROOM_BY_ID, rectCentre } from '../constants'

const room = ROOM_BY_ID.positional
const [CX, CZ] = rectCentre(room.rect)
const ORBIT_R = 4.2
const ORBIT_PERIOD = 18 // s per lap

/**
 * Room A — 3D positional audio. One source: a drum loop (broadband transients localise far better than a sine)
 * in a speaker that circles the room, so its direction and distance keep changing. Stand still and listen to it
 * move around you, or turn your head. One button switches the panner between equal-power (library default) and HRTF.
 */
export function PositionalRoom({ bus }: { bus: RoomBus | null }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [playing, setPlaying] = useState(true)
  const [hrtf, setHrtf] = useState(false)
  const [input, setInput] = useState<AudioNode | null>(null)
  useTestSource(ctx, bus ? input : null, { type: 'drumLoop', bpm: 118, gain: 0.5 }, playing)

  const arm = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.y = (clock.elapsedTime / ORBIT_PERIOD) * Math.PI * 2
  })

  return (
    <group>
      {/* orbit path marker on the floor (2 cm up) */}
      <mesh position={[CX, 0.02, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ORBIT_R - 0.03, ORBIT_R + 0.03, 96]} />
        <meshBasicMaterial color={room.colors.accent} transparent opacity={0.35} />
      </mesh>
      {/* the moving source: an omni column speaker riding the ring */}
      <group ref={arm} position={[CX, 0, CZ]}>
        <Speaker
          position={[ORBIT_R, 0, 0]}
          offset={[0, 1.25, 0]}
          destination={bus?.input}
          panner={{ refDistance: 1.2, rolloffFactor: 1.1, maxDistance: 20, panningModel: hrtf ? 'HRTF' : 'equalpower' }}
          onPanner={setInput}
        >
          <OmniSpeaker color={room.colors.accent} lit={playing} />
        </Speaker>
      </group>
      <ButtonStand
        position={PANELS.positional}
        rotation={PANEL_YAW}
        buttons={[
          { id: 'sample-a-orbit', text: playing ? '周回する音源を止める' : '周回する音源を鳴らす', color: room.colors.accent, on: playing, onPress: () => setPlaying((v) => !v), glyph: <GlyphRing r={0.07} /> },
          { id: 'sample-a-hrtf', text: hrtf ? 'パンニング: HRTF → equal-power' : 'パンニング: equal-power → HRTF', color: '#ffd54f', on: hrtf, onPress: () => setHrtf((v) => !v), glyph: <><GlyphRing r={0.06} /><GlyphDot r={0.014} x={-0.075} /><GlyphDot r={0.014} x={0.075} /></> },
        ]}
      />
    </group>
  )
}
