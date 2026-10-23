import { useState } from 'react'
import type { TestSourceType } from 'xrift-spatial-audio'
import { Speaker, useClubPA, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { useTestSource } from '../audio/useTestSource'
import { ButtonStand, GlyphBar, GlyphDot } from '../components/Controls'
import { MiniSpeaker, SpeakerCabinet } from '../components/SpeakerCabinet'
import { BandColumns, PitchMeter, Visualizer } from '../components/Visualizer'
import { ROOM_BY_ID } from '../constants'

const room = ROOM_BY_ID.analyser
const BACK = room.rect.z1 - 0.15 // inner face of the far wall
const PA_POSITIONS: [number, number, number][] = [[-3.6, 0, BACK - 0.75], [3.6, 0, BACK - 0.75]]
const SIDES = [{ side: 'L' as const }, { side: 'R' as const }]
const NOTES = [110, 165, 220, 330, 440, 660, 880]
const MELODY_POS: [number, number, number] = [room.rect.x1 - 1.6, 0, 13.2]

/**
 * Room D — club PA + analyser. Two PA stacks (`useClubPA`: mono sub, stereo bed, panned stacks, room reverb,
 * limiter) play the drum loop or pink noise. The room's mix feeds the spectrum bars + beat lamp (far wall)
 * and the four band columns; a sine speaker on the right drives the pitch meter (`pitch()`).
 */
export function AnalyserRoom({ bus }: { bus: RoomBus | null }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [paOn, setPaOn] = useState(true)
  const [programme, setProgramme] = useState<TestSourceType>('drumLoop')
  const [melodyOn, setMelodyOn] = useState(true)
  const [note, setNote] = useState(3)
  const pa = useClubPA(SIDES, undefined, bus?.input)
  useTestSource(ctx, bus && pa ? pa.input : null, { type: programme, bpm: 124, gain: programme === 'pinkNoise' ? 0.5 : 1 }, paOn)
  const [melodyIn, setMelodyIn] = useState<AudioNode | null>(null)
  const melodyOut = useTestSource(ctx, bus ? melodyIn : null, { type: 'sine', frequency: NOTES[note], gain: 0.14 }, melodyOn)

  return (
    <group>
      {PA_POSITIONS.map((p, i) => (
        <Speaker key={i} position={p} rotation={[0, Math.PI, 0]} offset={[0, 1.35, 0]} node={pa?.panners[i] ?? null}>
          <SpeakerCabinet />
        </Speaker>
      ))}
      <Visualizer node={bus?.input ?? null} position={[0, 0.4, BACK - 0.25]} rotation={Math.PI} />
      <BandColumns node={bus?.input ?? null} position={[0, 0, BACK - 3.2]} rotation={Math.PI} />
      <Speaker position={MELODY_POS} rotation={[0, -Math.PI / 2, 0]} offset={[0, 1.25, 0]} destination={bus?.input} panner={{ refDistance: 1, rolloffFactor: 1.4, maxDistance: 15 }} onInput={setMelodyIn}>
        <MiniSpeaker color={room.colors.accent} lit={melodyOn} />
      </Speaker>
      <PitchMeter node={melodyOut} position={[room.rect.x1 - 0.15 - 0.02, 0, MELODY_POS[2] + 1.6]} rotation={-Math.PI / 2} color={room.colors.accent} />
      <ButtonStand
        position={[-2.8, 0, room.rect.z0 + 2.2]}
        rotation={Math.PI}
        buttons={[
          { id: 'sample-d-pa', text: paOn ? 'PA を止める' : 'PA を鳴らす', color: '#eeeeee', on: paOn, onPress: () => setPaOn((v) => !v), glyph: <GlyphDot r={0.04} /> },
          { id: 'sample-d-prog', text: programme === 'drumLoop' ? 'PA: ドラム → ピンクノイズ' : 'PA: ピンクノイズ → ドラム', color: '#f48fb1', on: programme === 'pinkNoise', onPress: () => setProgramme((p) => (p === 'drumLoop' ? 'pinkNoise' : 'drumLoop')), glyph: <><GlyphDot r={0.015} x={-0.04} y={0.03} /><GlyphDot r={0.015} x={0.03} y={-0.02} /><GlyphDot r={0.015} x={0.05} y={0.04} /><GlyphDot r={0.015} x={-0.03} y={-0.04} /></> },
          { id: 'sample-d-melody', text: melodyOn ? 'サイン波を止める' : 'サイン波を鳴らす', color: room.colors.accent, on: melodyOn, onPress: () => setMelodyOn((v) => !v), glyph: <GlyphBar w={0.14} h={0.018} /> },
          { id: 'sample-d-down', text: `音程を下げる（${NOTES[note]} Hz）`, color: '#607d8b', onPress: () => setNote((n) => Math.max(0, n - 1)), glyph: <GlyphBar w={0.12} h={0.03} /> },
          { id: 'sample-d-up', text: `音程を上げる（${NOTES[note]} Hz）`, color: '#607d8b', onPress: () => setNote((n) => Math.min(NOTES.length - 1, n + 1)), glyph: <><GlyphBar w={0.12} h={0.03} /><GlyphBar w={0.03} h={0.12} /></> },
        ]}
      />
    </group>
  )
}

