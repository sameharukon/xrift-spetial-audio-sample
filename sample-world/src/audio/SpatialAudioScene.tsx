import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Vector3 } from 'three'
import {
  applyVolumeStages,
  createMuffle,
  createSoftCeiling,
  createTestSource,
  type ClubPA,
  type FilterSpec,
  type Muffle,
  type TestSourceType,
} from 'xrift-spatial-audio'
import { SpatialAudioListener, Speaker, useAudioFilters, useClubPA, useSpatialAudio } from 'xrift-spatial-audio/r3f'
import { Visualizer } from '../components/Visualizer'
import { BEACON_POSITION, PA_ACOUSTIC_CENTRE, PA_POSITIONS, VISUALIZER_POSITION } from '../constants'
import { SpeakerCabinet } from '../components/SpeakerCabinet'
import { occlusionFor } from './occlusion'
import { percentToLevel } from './volume'

export interface SpatialAudioSceneProps {
  /** occlusion door state */
  doorOpen: boolean
  /** user volume, percent (0..200) */
  volumePct: number
  /** sine beacon in the corner on/off */
  beacon: boolean
  /** programme of the PA (default 'drumLoop') */
  programme?: TestSourceType
  /** filters applied to the PA programme and the beacon (Unity-style filter chain) */
  filters?: FilterSpec[]
}

/**
 * Output chain (built once per AudioContext):
 *
 *   drumLoop ─► filter chain ─► clubPA.input ─► [crossover / bed / 2 panners / reverb] ─► clubPA.pre (boost) ─► limiter ─► clubPA.output ─┐
 *   sine ─► <Speaker filters> chain ─► own panner ──────────────────────────────────────────────────────────────────────────────────────┤
 *                                                                                   mix (→ analyser / visualiser) ─► muffle ◄┘
 *                                                                                             ─► cut (volume ≤ 100 %) ─► soft ceiling ─► destination
 */
interface OutputChain {
  /** all sources sum here (tapped by the visualiser, independent of position / volume) */
  mix: GainNode
  muffle: Muffle
  cut: GainNode
}

function useOutputChain(ctx: AudioContext | null): OutputChain | null {
  const [chain, setChain] = useState<OutputChain | null>(null)
  useEffect(() => {
    if (!ctx) return
    const mix = ctx.createGain()
    const muffle = createMuffle(ctx, { initial: 0 })
    mix.connect(muffle.input)
    const cut = ctx.createGain()
    const ceiling = createSoftCeiling(ctx)
    muffle.output.connect(cut)
    cut.connect(ceiling.input)
    ceiling.output.connect(ctx.destination)
    setChain({ mix, muffle, cut })
    return () => {
      ceiling.output.disconnect()
      setChain(null)
    }
  }, [ctx])
  return chain
}

const SIDES = [{ side: 'L' as const }, { side: 'R' as const }]
const _p = new Vector3()

function PA({ chain, programme, volumePct, filters }: { chain: OutputChain; programme: TestSourceType; volumePct: number; filters: FilterSpec[] }) {
  const ctx = useSpatialAudio()?.context ?? null
  const pa: ClubPA | null = useClubPA(SIDES, undefined, chain.mix)
  const fx = useAudioFilters(filters)
  useEffect(() => {
    if (!fx || !pa) return
    fx.output.connect(pa.input)
    return () => { try { fx.output.disconnect(pa.input) } catch { /* */ } }
  }, [fx, pa])
  useEffect(() => {
    if (!ctx || !fx) return
    const src = createTestSource(ctx, { type: programme, bpm: 124 })
    src.output.connect(fx.input)
    src.start()
    return () => {
      src.stop()
      src.output.disconnect()
    }
  }, [ctx, fx, programme])
  useEffect(() => {
    if (!ctx || !pa) return
    applyVolumeStages(percentToLevel(volumePct), chain.cut, pa.pre, ctx.currentTime)
  }, [ctx, pa, chain, volumePct])
  return (
    <>
      {PA_POSITIONS.map((p, i) => (
        <Speaker key={i} position={p} offset={PA_ACOUSTIC_CENTRE} node={pa?.panners[i] ?? null}>
          <SpeakerCabinet />
        </Speaker>
      ))}
    </>
  )
}

function Beacon({ chain, on, filters }: { chain: OutputChain; on: boolean; filters: FilterSpec[] }) {
  const ctx = useSpatialAudio()?.context ?? null
  const [input, setInput] = useState<AudioNode | null>(null)
  useEffect(() => {
    if (!ctx || !input || !on) return
    const src = createTestSource(ctx, { type: 'sine', frequency: 523.25, gain: 0.12 })
    src.output.connect(input)
    src.start()
    return () => {
      src.stop()
      src.output.disconnect()
    }
  }, [ctx, input, on])
  return (
    <Speaker position={BEACON_POSITION} destination={chain.mix} panner={{ refDistance: 1, rolloffFactor: 1.2, maxDistance: 25 }} filters={filters} onInput={setInput}>
      <mesh>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={on ? 1.2 : 0.1} />
      </mesh>
    </Speaker>
  )
}

/** visual speakers (always) + audio graph (after the first user gesture) */
const NO_FILTERS: FilterSpec[] = []

export function SpatialAudioScene({ doorOpen, volumePct, beacon, programme = 'drumLoop', filters = NO_FILTERS }: SpatialAudioSceneProps) {
  const ctx = useSpatialAudio()?.context ?? null
  const chain = useOutputChain(ctx)
  const camera = useThree((s) => s.camera)

  // occlusion follows the listener (camera) position
  useFrame(() => {
    if (!ctx || !chain) return
    camera.getWorldPosition(_p)
    chain.muffle.set(occlusionFor(_p.x, _p.z, doorOpen), ctx.currentTime)
  })

  return (
    <>
      <SpatialAudioListener smoothing={0.03} />
      <Visualizer node={chain?.mix ?? null} position={VISUALIZER_POSITION} />
      {chain ? (
        <>
          <PA chain={chain} programme={programme} volumePct={volumePct} filters={filters} />
          <Beacon chain={chain} on={beacon} filters={filters} />
        </>
      ) : (
        <>
          {PA_POSITIONS.map((p, i) => (
            <group key={i} position={p}>
              <SpeakerCabinet />
            </group>
          ))}
          <mesh position={BEACON_POSITION}>
            <sphereGeometry args={[0.18, 24, 16]} />
            <meshStandardMaterial color="#4fc3f7" emissive="#4fc3f7" emissiveIntensity={0.1} />
          </mesh>
        </>
      )}
    </>
  )
}
