import { Interactable } from '@xrift/world-components'
import { FILTER_PADS, type FilterPadId, type FilterState } from '../audio/filterPads'

/** one small glyph per filter (no text): LPF ⟍ high side down, HPF ⟋, reverb rings, echo dots, distortion zig-zag, chorus double line */
function Glyph({ id }: { id: FilterPadId }) {
  const m = <meshBasicMaterial color="#ffffff" />
  const bar = (x: number, y: number, w: number, h: number, r = 0, k = '') => (
    <mesh key={k || `${x}${y}${r}`} position={[x, y, 0.046]} rotation={[0, 0, r]}>
      <boxGeometry args={[w, h, 0.005]} />
      {m}
    </mesh>
  )
  switch (id) {
    case 'lowpass': return <>{bar(-0.04, 0.03, 0.1, 0.018)}{bar(0.05, -0.01, 0.1, 0.018, -0.9)}</>
    case 'highpass': return <>{bar(0.04, 0.03, 0.1, 0.018)}{bar(-0.05, -0.01, 0.1, 0.018, 0.9)}</>
    case 'reverb': return <>{[0.03, 0.06, 0.09].map((r) => <mesh key={r} position={[0, 0, 0.046]}><ringGeometry args={[r - 0.008, r, 24]} />{m}</mesh>)}</>
    case 'echo': return <>{[-0.06, 0, 0.06].map((x, i) => <mesh key={x} position={[x, 0, 0.046]}><circleGeometry args={[0.025 - i * 0.006, 16]} />{m}</mesh>)}</>
    case 'distortion': return <>{[-0.06, -0.02, 0.02, 0.06].map((x, i) => bar(x, 0, 0.06, 0.016, i % 2 ? -1 : 1, `d${i}`))}</>
    case 'chorus': return <>{bar(0, 0.025, 0.14, 0.016)}{bar(0, -0.025, 0.14, 0.016)}</>
  }
}

/** row of six toggle pads (colour = filter, bright = on) on a stand */
export function FilterPads({ position, state, onToggle }: { position: [number, number, number]; state: FilterState; onToggle: (id: FilterPadId) => void }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <group position={[0, 1.2, 0]}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[1.65, 0.4, 0.04]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {FILTER_PADS.map((p, i) => (
          <group key={p.id} position={[-0.675 + i * 0.27, 0, 0]}>
            <Interactable id={`sample-filter-${p.id}`} interactionText={`${p.id} ${state[p.id] ? 'OFF' : 'ON'}`} onInteract={() => onToggle(p.id)}>
              <mesh>
                <boxGeometry args={[0.24, 0.24, 0.08]} />
                <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={state[p.id] ? 0.9 : 0.05} transparent opacity={state[p.id] ? 1 : 0.55} />
              </mesh>
            </Interactable>
            <Glyph id={p.id} />
          </group>
        ))}
      </group>
    </group>
  )
}
