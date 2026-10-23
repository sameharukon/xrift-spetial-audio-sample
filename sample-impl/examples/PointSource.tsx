/**
 * Minimal demo: one positioned point source (the built-in drum loop) that can be occluded (createMuffle).
 * Click anywhere to start audio. Walk around it and turn your head: the sound stays where the speaker is.
 * (Uses the package source directly; in your world import from 'xrift-spatial-audio' / 'xrift-spatial-audio/r3f'.)
 */
import { useEffect, useState } from 'react'
import { createMuffle, type Muffle } from '../src/core/muffle'
import { createTestSource } from '../src/core/testSource'
import { SpatialAudioListener, SpatialAudioProvider, Speaker, useSpatialAudio } from '../src/r3f'

function PointSource({ occluded }: { occluded: boolean }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [panner, setPanner] = useState<PannerNode | null>(null)
  const [muffle, setMuffle] = useState<Muffle | null>(null)
  // source → muffle (occlusion) → the Speaker's own panner → output
  useEffect(() => {
    if (!ctx) return
    const m = createMuffle(ctx, { initial: 0 })
    setMuffle(m)
    return () => { m.output.disconnect(); setMuffle(null) }
  }, [ctx])
  useEffect(() => {
    if (!ctx || !panner || !muffle) return
    muffle.output.connect(panner)
    const src = createTestSource(ctx, { type: 'drumLoop', bpm: 124 })
    src.output.connect(muffle.input)
    src.start()
    return () => { src.stop(); src.output.disconnect(); muffle.output.disconnect(panner) }
  }, [ctx, panner, muffle])
  useEffect(() => { muffle?.set(occluded ? 1 : 0) }, [muffle, occluded])
  return (
    <Speaker position={[0, 0, -3]} offset={[0, 1.2, 0]} panner={{ panningModel: 'HRTF', refDistance: 1, rolloffFactor: 1.2 }} onPanner={setPanner}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.5, 1.2, 0.4]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </Speaker>
  )
}

/** render inside your R3F <Canvas> (XRift worlds already are) */
export function PointSourceDemo({ occluded = false }: { occluded?: boolean }) {
  return (
    <SpatialAudioProvider>
      <SpatialAudioListener smoothing={0.03} />
      <PointSource occluded={occluded} />
    </SpatialAudioProvider>
  )
}
