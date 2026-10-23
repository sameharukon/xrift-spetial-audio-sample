import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', r3f: 'src/r3f/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2020',
  // readable output: XRift's code-security check scans the bundled world code (no-obfuscation etc.)
  minify: false,
  splitting: true,
  treeshake: true,
  external: ['react', 'react/jsx-runtime', 'three', '@react-three/fiber'],
})
