import { useEffect, useState } from 'react'
import { createClubPA, type ClubPA, type ClubPAOptions, type PASpeaker } from '../core/clubPA'
import { useSpatialAudio } from './SpatialAudioProvider'

/**
 * Club PA on the provider's context (null until audio is unlocked). The graph is built in an effect and
 * rebuilt only when the speaker layout (sides), the options (compared by value) or `destination` change.
 */
export function useClubPA(speakers: PASpeaker[], options?: ClubPAOptions, destination?: AudioNode): ClubPA | null {
  const ctx = useSpatialAudio()?.context ?? null
  const sides = speakers.map((s) => s.side).join('')
  const optKey = JSON.stringify(options ?? {})
  const [pa, setPa] = useState<ClubPA | null>(null)
  useEffect(() => {
    if (!ctx) return
    const spk = sides.split('').map((side) => ({ side: side as PASpeaker['side'] }))
    const g = createClubPA(ctx, spk, JSON.parse(optKey) as ClubPAOptions, destination ?? ctx.destination)
    setPa(g)
    return () => {
      g.input.disconnect()
      g.output.disconnect()
      setPa(null)
    }
  }, [ctx, sides, optKey, destination])
  return pa
}
