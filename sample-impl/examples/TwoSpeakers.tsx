/**
 * Minimal demo: two PA speakers playing the built-in drum loop. Click anywhere to start audio.
 * (Uses the package source directly; in your world import from 'xrift-spatial-audio' / 'xrift-spatial-audio/r3f'.)
 */
import { useEffect } from 'react'
import { createTestSource } from '../src/core/testSource'
import { SpatialAudioListener, SpatialAudioProvider, Speaker, useClubPA, useSpatialAudio } from '../src/r3f'

const SIDES = [{ side: 'L' as const }, { side: 'R' as const }]

function TwoSpeakers() {
  const ctx = useSpatialAudio()?.context ?? null
  const pa = useClubPA(SIDES) // null until the first user gesture
  useEffect(() => {
    if (!ctx || !pa) return
    const src = createTestSource(ctx, { type: 'drumLoop', bpm: 124 })
    src.output.connect(pa.input)
    src.start()
    return () => { src.stop(); src.output.disconnect() }
  }, [ctx, pa])
  return (
    <>
      {[-2.4, 2.4].map((x, i) => (
        <Speaker key={x} position={[x, 0, -0.4]} offset={[0, 1.35, 0]} node={pa?.panners[i]}>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.7, 1.5, 0.6]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        </Speaker>
      ))}
    </>
  )
}

/** render inside your R3F <Canvas> (XRift worlds already are) */
export function TwoSpeakersDemo() {
  return (
    <SpatialAudioProvider>
      <SpatialAudioListener smoothing={0.03} />
      <TwoSpeakers />
    </SpatialAudioProvider>
  )
}
