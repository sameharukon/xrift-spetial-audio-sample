import { useState } from 'react'
import type { FilterSpec } from 'xrift-spatial-audio'
import { Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { FILTER_SPEAKERS, type FilterSpeakerId } from '../audio/filterSpeakers'
import { useTestSource } from '../audio/useTestSource'
import { Button, GlyphBar, GlyphDot, GlyphRing } from '../components/Controls'
import { MiniSpeaker } from '../components/SpeakerCabinet'
import { ROOM_BY_ID, rectCentre } from '../constants'

const room = ROOM_BY_ID.filters
const [CX, CZ] = rectCentre(room.rect)
/** arc of speakers on the far (west) side, all facing a listening spot near the room centre */
const FOCUS: [number, number] = [CX + 1.5, CZ]
const RADIUS = 6
const SPREAD = (150 * Math.PI) / 180

/** glyphs: LPF ⟍ high side down, HPF ⟋, reverb rings (1 = small, 3 = hall), echo dots, distortion zig-zag, chorus double line, dry = one line */
function Glyph({ id }: { id: FilterSpeakerId }) {
  switch (id) {
    case 'dry': return <GlyphBar w={0.14} h={0.018} />
    case 'lowpass': return <><GlyphBar x={-0.04} y={0.03} w={0.1} h={0.018} /><GlyphBar x={0.05} y={-0.01} w={0.1} h={0.018} r={-0.9} /></>
    case 'highpass': return <><GlyphBar x={0.04} y={0.03} w={0.1} h={0.018} /><GlyphBar x={-0.05} y={-0.01} w={0.1} h={0.018} r={0.9} /></>
    case 'reverbSmall': return <GlyphRing r={0.05} />
    case 'reverbHall': return <>{[0.03, 0.06, 0.09].map((r) => <GlyphRing key={r} r={r} />)}</>
    case 'echo': return <>{[-0.06, 0, 0.06].map((x, i) => <GlyphDot key={x} x={x} r={0.025 - i * 0.006} />)}</>
    case 'distortion': return <>{[-0.06, -0.02, 0.02, 0.06].map((x, i) => <GlyphBar key={x} x={x} w={0.06} h={0.016} r={i % 2 ? -1 : 1} />)}</>
    case 'chorus': return <><GlyphBar y={0.025} w={0.14} h={0.016} /><GlyphBar y={-0.025} w={0.14} h={0.016} /></>
  }
}

/**
 * Room C — filters. Eight speakers, each with its own `<Speaker filters>` chain on the same drum loop:
 * dry, low-pass, high-pass, reverb (small / hall presets), echo, distortion, chorus. The pad in front of each
 * speaker switches it on / off (several can play at once to compare; the dry one starts on).
 */
export function FiltersRoom({ bus }: { bus: RoomBus | null }) {
  const [on, setOn] = useState<Record<FilterSpeakerId, boolean>>(() => Object.fromEntries(FILTER_SPEAKERS.map((s) => [s.id, s.id === 'dry'])) as Record<FilterSpeakerId, boolean>)
  const n = FILTER_SPEAKERS.length
  return (
    <group>
      {FILTER_SPEAKERS.map((s, i) => {
        const a = Math.PI - SPREAD / 2 + (SPREAD * i) / (n - 1)
        const x = FOCUS[0] + RADIUS * Math.cos(a), z = FOCUS[1] + RADIUS * Math.sin(a)
        const yaw = Math.atan2(FOCUS[0] - x, FOCUS[1] - z) // front (+z) towards the focus
        const pad: [number, number, number] = [x + Math.sin(yaw) * 1.3, 0, z + Math.cos(yaw) * 1.3]
        return (
          <group key={s.id}>
            <FilterSpeaker id={s.id} color={s.color} filters={s.filters} position={[x, 0, z]} yaw={yaw} bus={bus} on={on[s.id]} />
            <group position={pad} rotation={[0, yaw, 0]}>
              <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[0.07, 1.0, 0.07]} />
                <meshStandardMaterial color="#444" />
              </mesh>
              <group position={[0, 1.08, 0]} rotation={[-0.45, 0, 0]}>
                <Button
                  position={[0, 0, 0]}
                  spec={{ id: `sample-c-${s.id}`, text: `${s.id} ${on[s.id] ? 'OFF' : 'ON'}`, color: s.color, on: on[s.id], onPress: () => setOn((st) => ({ ...st, [s.id]: !st[s.id] })), glyph: <Glyph id={s.id} /> }}
                />
              </group>
            </group>
          </group>
        )
      })}
    </group>
  )
}

function FilterSpeaker({ color, filters, position, yaw, bus, on }: { id: FilterSpeakerId; color: string; filters: readonly FilterSpec[]; position: [number, number, number]; yaw: number; bus: RoomBus | null; on: boolean }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [input, setInput] = useState<AudioNode | null>(null)
  useTestSource(ctx, bus ? input : null, { type: 'drumLoop', bpm: 118, gain: 0.45, seed: 5 }, on)
  return (
    <Speaker position={position} rotation={[0, yaw, 0]} offset={[0, 1.25, 0]} destination={bus?.input} filters={filters} panner={{ refDistance: 2.5, rolloffFactor: 1.2, maxDistance: 15 }} onInput={setInput}>
      <MiniSpeaker color={color} lit={on} />
    </Speaker>
  )
}
