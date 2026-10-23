import { useEffect, useState } from 'react'
import { createTestSource, type TestSourceOptions } from 'xrift-spatial-audio'

/** plays a library test source into `dest` while `on`; returns the source output */
export function useTestSource(ctx: AudioContext | null, dest: AudioNode | null, opts: TestSourceOptions, on = true): GainNode | null {
  const key = JSON.stringify(opts)
  const [out, setOut] = useState<GainNode | null>(null)
  useEffect(() => {
    if (!ctx || !dest || !on) return
    const src = createTestSource(ctx, JSON.parse(key) as TestSourceOptions)
    src.output.connect(dest)
    src.start()
    setOut(src.output)
    return () => {
      src.stop()
      src.output.disconnect()
      setOut(null)
    }
  }, [ctx, dest, key, on])
  return out
}
