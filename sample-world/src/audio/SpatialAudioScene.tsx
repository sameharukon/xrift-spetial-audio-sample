import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import { SpatialAudioListener, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import { ROOMS } from '../constants'
import { OcclusionRoom } from '../rooms/OcclusionRoom'
import { PositionalRoom } from '../rooms/PositionalRoom'
import { VolumeRoom } from '../rooms/VolumeRoom'
import { applyVolume, useOutputChain } from './chain'
import { roomMix } from './roomMix'

const _p = new Vector3()

/**
 * The whole audio side: one output chain (per-room buses → boost → limiter → volume → soft ceiling) and the
 * three rooms in walking order (volume → positioning → occlusion). Visuals render before the first gesture; sources start once the AudioContext exists.
 */
export function SpatialAudioScene({ volumePct, onVolume }: { volumePct: number; onVolume: (v: number) => void }) {
  const ctx = useSpatialAudio()?.context ?? null
  const chain = useOutputChain(ctx)
  const camera = useThree((s) => s.camera)
  useEffect(() => { if (chain) applyVolume(chain, volumePct) }, [chain, volumePct])
  // per-room gate + muffle follow the listener (camera) position
  useFrame(() => {
    if (!chain) return
    camera.getWorldPosition(_p)
    const t = chain.ctx.currentTime
    for (const r of ROOMS) {
      const m = roomMix(r, _p.x, _p.z)
      const b = chain.buses[r.id]
      b.gate.gain.setTargetAtTime(m.gate, t, 0.12)
      b.muffle.set(m.muffle, t, 0.12)
    }
  })
  const bus = (id: (typeof ROOMS)[number]['id']) => chain?.buses[id] ?? null
  return (
    <>
      <SpatialAudioListener smoothing={0.03} />
      <VolumeRoom bus={bus('volume')} volumePct={volumePct} onVolume={onVolume} />
      <PositionalRoom bus={bus('positional')} />
      <OcclusionRoom bus={bus('occlusion')} />
    </>
  )
}
