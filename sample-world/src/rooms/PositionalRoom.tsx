import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Group, MeshStandardMaterial } from 'three'
import { Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { useTestSource } from '../audio/useTestSource'
import { ButtonStand, GlyphDot, GlyphRing } from '../components/Controls'
import { MiniSpeaker, OmniSpeaker } from '../components/SpeakerCabinet'
import { ROOM_BY_ID, rectCentre } from '../constants'

const room = ROOM_BY_ID.positional
const [CX, CZ] = rectCentre(room.rect)
const ORBIT_R = 4.2
const ORBIT_PERIOD = 18 // s per lap

/**
 * Room A — 3D positional audio / panning. Three point sources, each on its own equal-power (or HRTF) panner:
 *  - a drum loop on a pole in the middle (walk around it: left / right swap, level follows distance)
 *  - a sine "beacon" (523 Hz) orbiting the room (a moving source)
 *  - quiet pink noise in the far-left corner
 */
export function PositionalRoom({ bus }: { bus: RoomBus | null }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [drum, setDrum] = useState(true)
  const [orbit, setOrbit] = useState(true)
  const [noise, setNoise] = useState(false)
  const [hrtf, setHrtf] = useState(false)
  const model = hrtf ? 'HRTF' : 'equalpower'
  const [drumIn, setDrumIn] = useState<AudioNode | null>(null)
  const [orbitIn, setOrbitIn] = useState<AudioNode | null>(null)
  const [noiseIn, setNoiseIn] = useState<AudioNode | null>(null)
  useTestSource(ctx, bus ? drumIn : null, { type: 'drumLoop', bpm: 118, gain: 0.5 }, drum)
  useTestSource(ctx, bus ? orbitIn : null, { type: 'sine', frequency: 523.25, gain: 0.16 }, orbit)
  useTestSource(ctx, bus ? noiseIn : null, { type: 'pinkNoise', gain: 0.14, seed: 3 }, noise)
  const dest = bus?.input

  const arm = useRef<Group>(null)
  const orbMat = useRef<MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.y = (clock.elapsedTime / ORBIT_PERIOD) * Math.PI * 2
    if (orbMat.current) orbMat.current.emissiveIntensity = orbit ? 1.4 : 0.08
  })

  return (
    <group>
      {/* centre: drum loop */}
      <Speaker position={[CX, 0, CZ]} offset={[0, 1.25, 0]} destination={dest} panner={{ refDistance: 1.5, rolloffFactor: 1.1, maxDistance: 20, panningModel: model }} onInput={setDrumIn}>
        <OmniSpeaker color="#ffffff" lit={drum} />
      </Speaker>
      {/* orbit path marker on the floor (2 cm up) */}
      <mesh position={[CX, 0.02, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ORBIT_R - 0.03, ORBIT_R + 0.03, 96]} />
        <meshBasicMaterial color={room.colors.accent} transparent opacity={0.35} />
      </mesh>
      {/* orbiting sine */}
      <group ref={arm} position={[CX, 0, CZ]}>
        <Speaker position={[ORBIT_R, 1.6, 0]} destination={dest} panner={{ refDistance: 1, rolloffFactor: 1.3, maxDistance: 20, panningModel: model }} onInput={setOrbitIn}>
          <mesh>
            <sphereGeometry args={[0.2, 24, 16]} />
            <meshStandardMaterial ref={orbMat} color={room.colors.accent} emissive={room.colors.accent} emissiveIntensity={1.4} />
          </mesh>
        </Speaker>
      </group>
      {/* corner: pink noise, facing the centre */}
      <Speaker position={[room.rect.x0 + 1.3, 0, room.rect.z0 + 1.3]} rotation={[0, Math.PI / 4, 0]} offset={[0, 1.25, 0]} destination={dest} panner={{ refDistance: 1.2, rolloffFactor: 1.2, maxDistance: 20, panningModel: model }} onInput={setNoiseIn}>
        <MiniSpeaker color="#f48fb1" lit={noise} />
      </Speaker>
      <ButtonStand
        position={[2.6, 0, room.rect.z1 - 1.6]}
        buttons={[
          { id: 'sample-a-drum', text: drum ? '中央のドラムを止める' : '中央のドラムを鳴らす', color: '#eeeeee', on: drum, onPress: () => setDrum((v) => !v), glyph: <GlyphDot r={0.04} /> },
          { id: 'sample-a-orbit', text: orbit ? '周回するサイン波を止める' : '周回するサイン波を鳴らす', color: room.colors.accent, on: orbit, onPress: () => setOrbit((v) => !v), glyph: <GlyphRing r={0.07} /> },
          { id: 'sample-a-noise', text: noise ? 'ピンクノイズを止める' : 'ピンクノイズを鳴らす', color: '#f48fb1', on: noise, onPress: () => setNoise((v) => !v), glyph: <><GlyphDot r={0.015} x={-0.04} y={0.03} /><GlyphDot r={0.015} x={0.03} y={-0.02} /><GlyphDot r={0.015} x={0.05} y={0.04} /><GlyphDot r={0.015} x={-0.03} y={-0.04} /></> },
          { id: 'sample-a-hrtf', text: hrtf ? 'パンニング: HRTF → equal-power' : 'パンニング: equal-power → HRTF', color: '#ffd54f', on: hrtf, onPress: () => setHrtf((v) => !v), glyph: <><GlyphRing r={0.06} /><GlyphDot r={0.014} x={-0.075} /><GlyphDot r={0.014} x={0.075} /></> },
        ]}
      />
    </group>
  )
}
