import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Vector3, type Mesh, type MeshStandardMaterial } from 'three'
import { createMuffle, type Muffle } from 'xrift-spatial-audio'
import { Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { partitionOcclusion } from '../audio/roomMix'
import { useTestSource } from '../audio/useTestSource'
import { ButtonStand, GlyphDot } from '../components/Controls'
import { PocketDoor } from '../components/PocketDoor'
import { SpeakerCabinet } from '../components/SpeakerCabinet'
import { OCCLUDED_SPEAKER, PARTITION, ROOM_BY_ID } from '../constants'

const room = ROOM_BY_ID.occlusion
const _p = new Vector3()
const METER_H = 1.6

/**
 * Room B — occlusion / muffling (`createMuffle`). The room is split by a thick partition with a pocket
 * door; a drum loop plays on the far side. On the near side the speaker goes through a muffle stage driven
 * by `partitionOcclusion()` (door closed → low-pass ≈ 220 Hz and −8 dB; door open → depends on whether
 * the doorway is in the line of sight). The meter on the partition shows the current amount (tall = clear).
 */
export function OcclusionRoom({ bus }: { bus: RoomBus | null }) {
  const ctx = useSpatialAudio()?.context ?? null
  const camera = useThree((s) => s.camera)
  const [doorOpen, setDoorOpen] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [muffle, setMuffle] = useState<Muffle | null>(null)
  const [input, setInput] = useState<AudioNode | null>(null)
  useEffect(() => {
    if (!ctx || !bus) return
    const m = createMuffle(ctx, { closedHz: 220, closedGain: 0.4, initial: 1 })
    m.output.connect(bus.input)
    setMuffle(m)
    return () => { m.output.disconnect(); setMuffle(null) }
  }, [ctx, bus])
  useTestSource(ctx, muffle ? input : null, { type: 'drumLoop', bpm: 128, gain: 0.55, seed: 7 }, playing)

  const amount = useRef(1)
  const fill = useRef<Mesh>(null)
  const fillMat = useRef<MeshStandardMaterial>(null)
  useFrame((_, dt) => {
    camera.getWorldPosition(_p)
    const target = partitionOcclusion(_p.x, _p.z, doorOpen)
    amount.current += (target - amount.current) * Math.min(1, dt * 8)
    if (muffle && ctx) muffle.set(target, ctx.currentTime)
    const clear = 1 - amount.current
    if (fill.current) {
      fill.current.scale.y = Math.max(0.02, clear)
      fill.current.position.y = 0.6 + (METER_H * Math.max(0.02, clear)) / 2
    }
    if (fillMat.current) fillMat.current.emissiveIntensity = 0.15 + clear * 0.9
  })

  const nearFace = PARTITION.x - PARTITION.t / 2
  return (
    <group>
      <PocketDoor open={doorOpen} onToggle={() => setDoorOpen((o) => !o)} />
      <Speaker position={OCCLUDED_SPEAKER} rotation={[0, -Math.PI / 2 - 0.35, 0]} offset={[0, 1.35, 0]} destination={muffle?.input} panner={{ refDistance: 2.5, rolloffFactor: 0.9, maxDistance: 25 }} onInput={setInput}>
        <SpeakerCabinet />
      </Speaker>
      {/* occlusion meter on the near face of the partition (back 1 cm inside the wall) */}
      <group position={[nearFace - 0.03, 0, 2.3]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.6 + METER_H / 2, 0]}>
          <boxGeometry args={[0.3, METER_H + 0.1, 0.08]} />
          <meshStandardMaterial color="#1b1410" />
        </mesh>
        <mesh ref={fill} position={[0, 0.6, 0.05]}>
          <boxGeometry args={[0.18, METER_H, 0.03]} />
          <meshStandardMaterial ref={fillMat} color={room.colors.accent} emissive={room.colors.accent} emissiveIntensity={0.2} />
        </mesh>
      </group>
      {/* acoustic foam wedges on the near face (decor), 1 cm buried */}
      <FoamPanel x={nearFace} z={-4} />
      <FoamPanel x={nearFace} z={4.4} />
      <ButtonStand
        position={[13.2, 0, -2.6]}
        rotation={-Math.PI / 2}
        buttons={[
          { id: 'sample-b-play', text: playing ? '壁の向こうのドラムを止める' : '壁の向こうのドラムを鳴らす', color: room.colors.accent, on: playing, onPress: () => setPlaying((v) => !v), glyph: <GlyphDot r={0.04} /> },
        ]}
      />
    </group>
  )
}

/** 3 × 4 grid of pyramids on the −x face of the partition */
function FoamPanel({ x, z }: { x: number; z: number }) {
  const cells: [number, number][] = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) cells.push([i, j])
  return (
    <group position={[x + 0.01, 0, z]} rotation={[0, 0, Math.PI / 2]}>
      {cells.map(([i, j]) => (
        <mesh key={`${i}${j}`} position={[0.8 + j * 0.42, 0.09, (i - 1) * 0.42]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.29, 0.2, 4]} />
          <meshStandardMaterial color="#2b2522" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
