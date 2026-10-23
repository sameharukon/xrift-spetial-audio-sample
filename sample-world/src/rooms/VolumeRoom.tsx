import { useState } from 'react'
import { Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import type { RoomBus } from '../audio/chain'
import { useTestSource } from '../audio/useTestSource'
import { SpeakerCabinet } from '../components/SpeakerCabinet'
import { VolumeStand } from '../components/VolumeStand'
import { PANELS, PANEL_YAW, REFERENCE_SPEAKER } from '../constants'

/**
 * Room V — set your volume first. A reference speaker plays the same drum loop, at the same level and with
 * the same distance roll-off, as room A, so the level you pick here is the level of the rest of the walk.
 * The panel (− / + , level bar, audio-state lamp) is per visitor and not saved.
 */
export function VolumeRoom({ bus, volumePct, onVolume }: { bus: RoomBus | null; volumePct: number; onVolume: (v: number) => void }) {
  const sa = useSpatialAudio()
  const ctx = sa?.context ?? null
  const [input, setInput] = useState<AudioNode | null>(null)
  useTestSource(ctx, bus ? input : null, { type: 'drumLoop', bpm: 118, gain: 0.5 })
  return (
    <group>
      {/* faces the spawn / the volume panel */}
      <Speaker position={REFERENCE_SPEAKER} rotation={[0, -1.15, 0]} offset={[0, 1.3, 0]} destination={bus?.input} panner={{ refDistance: 1.2, rolloffFactor: 1.1, maxDistance: 20 }} onPanner={setInput}>
        <SpeakerCabinet />
      </Speaker>
      <VolumeStand position={PANELS.volume} rotation={PANEL_YAW} volumePct={volumePct} onVolume={onVolume} running={sa?.running ?? false} />
    </group>
  )
}
