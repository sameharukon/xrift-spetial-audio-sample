# xrift-spatial-audio

> **Status: local prototype (v0.1.0).** Not published yet. Public domain (CC0-1.0).

[日本語](#日本語) | [English](#english)

---

## 日本語

### これは何？
XRift（React Three Fiber）ワールド向けの「部屋を満たす」クラブ系 PA / 空間オーディオ層です。
デモや動作確認用に、シンプルな合成テスト音源（ピンクノイズ / サイン波 / キックとハットのループ）を同梱しています。

- **core**（`xrift-spatial-audio`）: Web Audio API だけに依存（React / three.js 不要）
  - `createClubPA()` … クロスオーバー（LR4）で低域はモノラル・無指向、中高域はステレオベッド＋スタック毎の等パワーパンナー、手続き生成の部屋 IR リバーブ、グルーリミッター
  - `createSpeakerPanner()` / `setPannerPosition()` / `setListenerPose()` … 等パワーパンナーと、平滑化付きの位置・向き更新
  - `createMuffle()` … 0..1 の量で駆動するローパス＋ゲイン（扉越し・遮蔽）
  - `volumeValue()` / `volumeStages()` / `applyVolumeStages()` … 0–100 % は 3 乗カーブ、100–200 % はリミッター手前でブースト
  - `createSoftCeiling()` … −1 dBFS まで透過、−0.1 dBFS へソフトニー（デジタルクリップ防止）
  - `createAudioUnlocker()` / `attachGestureUnlock()` … AudioContext の遅延生成と、ユーザー操作（pointer / key / touch / click / pointer lock / WebXR `sessionstart`）での resume
  - `createTestSource(ctx, { type: 'pinkNoise' | 'sine' | 'drumLoop' })` … テスト音源（ピーク −1 dBFS、ループ再生）
- **r3f**（`xrift-spatial-audio/r3f`）: React Three Fiber バインディング
  - `<SpatialAudioProvider>` / `useSpatialAudio()`、`<SpatialAudioListener smoothing>`、`<Speaker position node offset>`、`useClubPA()`、`updateListenerFromCamera()` / `updatePannerFromObject()`
- **examples/TwoSpeakers.tsx** … 2 台のスピーカーでドラムループを鳴らす最小デモ

### インストール
```bash
# ローカルパス（tarball 推奨: 依存の React / three が二重にならない）
cd xrift-spatial-audio && npm install && npm pack
cd ../my-world && npm install ../xrift-spatial-audio/xrift-spatial-audio-0.1.0.tgz

# git から（公開後）
npm install github:<owner>/xrift-spatial-audio   # prepare で dist をビルド
```
`file:../xrift-spatial-audio`（シンボリックリンク）でも動きますが、パッケージ側の `node_modules` にある react / three が解決されて二重読み込みになる可能性があるため、その場合は Vite の `resolve.dedupe` を設定してください。

XRift ではホスト（xrift.net）が共有していないパッケージはワールドのバンドル（`__federation_expose_World-*.js`）に同梱され、`xrift check world` の対象になります。本パッケージは eval / storage / navigator / network を使わず、ミニファイもしていません。`three` / `@react-three/fiber` / `react` は external なので、ワールドの Module Federation の shared（ホスト提供の単一インスタンス）が使われます。

### 最小の使い方
```tsx
import { useEffect } from 'react'
import { createTestSource } from 'xrift-spatial-audio'
import { SpatialAudioProvider, SpatialAudioListener, Speaker, useClubPA, useSpatialAudio } from 'xrift-spatial-audio/r3f'

const SIDES = [{ side: 'L' as const }, { side: 'R' as const }]

function PA() {
  const ctx = useSpatialAudio()?.context ?? null
  const pa = useClubPA(SIDES)            // ユーザー操作までは null
  useEffect(() => {
    if (!ctx || !pa) return
    const src = createTestSource(ctx, { type: 'drumLoop', bpm: 124 })
    src.output.connect(pa.input)          // 自分の音源もここ（pa.input）に繋ぐ
    src.start()
    return () => src.stop()
  }, [ctx, pa])
  return (
    <>
      <Speaker position={[-2.4, 0, 0]} offset={[0, 1.35, 0]} node={pa?.panners[0]} />
      <Speaker position={[2.4, 0, 0]} offset={[0, 1.35, 0]} node={pa?.panners[1]} />
    </>
  )
}

export const World = () => (
  <SpatialAudioProvider>
    <SpatialAudioListener smoothing={0.03} />
    <PA />
  </SpatialAudioProvider>
)
```
core のみ（任意のフレームワーク）:
```ts
import { createAudioUnlocker, createClubPA, createTestSource } from 'xrift-spatial-audio'
const audio = createAudioUnlocker({
  onCreate: (ctx) => {
    const pa = createClubPA(ctx, [{ side: 'L' }, { side: 'R' }])
    const src = createTestSource(ctx, { type: 'pinkNoise' })
    src.output.connect(pa.input)
    src.start()
  },
})
window.addEventListener('pointerdown', () => audio.unlock(), { once: true })
```

### なぜ HRTF ではなく等パワー（equal-power）か
- Web Audio のパンナーは伝搬遅延を付けないので、同じ信号を複数の等パワーパンナーに送っても**ゲインが足されるだけ**でコムフィルタ（位相干渉）が起きません。HRTF は音源ごとに ITD / フィルタを掛けるため、複数スピーカーを合算すると音色が濁ります。
- HRTF は一般にパンナー 1 個あたりの処理負荷が大きく、スタンドアロン VR（Meta Quest）では複数スタックを鳴らすと負担になります。
- クラブ PA は「点音源」ではなく「部屋全体」なので、低域はモノラル・無指向、中高域のみ緩やかな距離減衰で定位させる方が実際の体験に近く、部屋のどこでもレベルが揃います（実測: 10 m × 11 m の部屋の 9 地点で RMS の差 0.6 dB）。
- 単一の点音源には `createSpeakerPanner(ctx, { panningModel: 'HRTF' })` も選べます。

### フィルター（Unity の Audio Filter 相当）

`core` の各ファクトリは `{ input, output, params, set(params, t?), dispose() }` を返します。`set` は短い時定数でなめらかに変化します（クリックなし）。

| Unity | 本ライブラリ | 主なパラメータ（既定値） |
|---|---|---|
| AudioLowPassFilter | `createLowPass` / `{type:'lowpass'}` | `cutoff` 5000 Hz, `resonance` 0.707（線形 Q） |
| AudioHighPassFilter | `createHighPass` / `{type:'highpass'}` | `cutoff` 500 Hz, `resonance` 0.707 |
| AudioReverbFilter / Reverb Zone | `createReverb` / `{type:'reverb'}` | `preset` small / room / basement / hall, `rt60`, `preDelay`, `damping`, `dry` 0.85, `wet` 0.35 |
| AudioEchoFilter | `createEcho` / `{type:'echo'}` | `delay` 0.5 s, `feedback` 0.4（≤0.95）, `damping`, `dry` 1, `wet` 0.3 |
| AudioDistortionFilter | `createDistortion` / `{type:'distortion'}` | `amount` 0.5（0–1, 自動メイクアップ） |
| AudioChorusFilter | `createChorus` / `{type:'chorus'}` | `rate` 0.8 Hz, `depth` 2.5 ms, `delay` 20 ms, `dry` 0.6, `wet` 0.4 |

- リバーブ IR は合成（外部ファイル不要）。AudioContext × プリセット × RT60 ごとにキャッシュ共有。
- チェーン: `createFilterChain(ctx, specs)` → `{ input, output, update(specs), dispose }`。`enabled:false` は約 15 ms のクロスフェードでバイパス。種類の並びが変わった時だけ作り直し。
- R3F: `<Speaker filters={[{ type: 'lowpass', cutoff: 800 }, { type: 'reverb', preset: 'hall' }]} onInput={setInput}>`（音源は `onInput` で受け取るノードへ接続）、または `useAudioFilters(specs)`。
- 既定値は −1 dBFS のドラムループを入れても 0 dBFS を超えないよう調整済み。

### 解析（ビジュアライザー用, Unity の GetSpectrumData / GetOutputData 相当）

```ts
const an = createAnalyser(ctx, { fftSize: 2048, bands: 16 })   // bands: 本数 or FOUR_BANDS など
const untap = an.tap(someNode)       // 任意のノードに分岐接続（音には影響しない）
// 毎フレーム
an.update()
an.spectrum   // Float32Array dB   ≒ GetSpectrumData
an.waveform   // Float32Array -1..1 ≒ GetOutputData
an.bands      // 0..1 の対数帯域（attack / release 付き）
an.rms; an.peak; an.beat; an.beatPulse; an.bpm
an.dominantFrequency(); an.pitch()   // 最大ビン + 放物線補間 / 自己相関（pitch は重いので必要時のみ）
```

- フレームごとのメモリ確保なし。`update()` は fft 2048・16 帯域で約 20 µs。
- R3F: `const an = useAudioAnalyser(node, opts)`（ref を返す。再レンダーなし）。`driveInstancedBars(instancedMesh, an.current.bands)` で棒グラフ。
- ビート検出は低域（30–150 Hz）のスペクトルフラックス。連続検出は `onsetMinInterval`（既定 0.25 s）で制限 → 点滅は 4 Hz 以下。

### ライセンス
CC0 1.0 Universal（パブリックドメイン）。著作権を放棄しています。クレジット表記も不要で、自由に使用・改変・再配布できます。全文は LICENSE を参照してください。

---

## English

### What is it?
A "fill the room" club PA / spatial-audio layer for XRift (React Three Fiber) worlds. For demos and level checks it
ships a simple synthesized test source (pink noise, sine, or a kick + hat loop).

- **core** (`xrift-spatial-audio`) — Web Audio only, no React / three.js:
  `createClubPA()` (LR4 crossover → mono non-directional lows; stereo bed + per-stack equal-power panners for mids/highs;
  procedural room-IR reverb; glue limiter), `createSpeakerPanner()`, `setPannerPosition()`, `setListenerPose()` (smoothed),
  `createMuffle()` (0..1 low-pass + gain for doors / occlusion), `volumeValue()` / `volumeStages()` / `applyVolumeStages()`
  (cubic 0–100 %, boost into the limiter up to 200 %), `createSoftCeiling()` (transparent to −1 dBFS, soft knee to −0.1 dBFS),
  `createAudioUnlocker()` / `attachGestureUnlock()` (lazy AudioContext, resume on pointer / key / touch / click /
  pointer-lock / WebXR `sessionstart`), `createTestSource(ctx, { type: 'pinkNoise' | 'sine' | 'drumLoop' })`
  (looping test programme peaking at −1 dBFS).
- **r3f** (`xrift-spatial-audio/r3f`) — `<SpatialAudioProvider>` / `useSpatialAudio()`, `<SpatialAudioListener smoothing>`,
  `<Speaker position node offset>`, `useClubPA()`, `updateListenerFromCamera()` / `updatePannerFromObject()`.
- **examples/TwoSpeakers.tsx** — minimal demo: two speakers playing the drum loop.

### Install
```bash
# local path (tarball recommended: avoids a second copy of react / three)
cd xrift-spatial-audio && npm install && npm pack
cd ../my-world && npm install ../xrift-spatial-audio/xrift-spatial-audio-0.1.0.tgz
# from git (once published)
npm install github:<owner>/xrift-spatial-audio   # `prepare` builds dist
```
A `file:../xrift-spatial-audio` symlink also works, but Vite may then resolve react / three from the package's own
`node_modules`; add `resolve.dedupe` in that case.

In XRift, packages that the host (xrift.net) does not share are bundled into the world's
`__federation_expose_World-*.js` and scanned by `xrift check world`. This package uses no eval / storage / navigator /
network and ships unminified. `three`, `@react-three/fiber` and `react` are external, so the world's Module Federation
shared singletons (provided by the host) are used.

### Minimal usage
See the TSX example above (`SpatialAudioProvider` + `SpatialAudioListener` + `Speaker` + `useClubPA` +
`createTestSource`); connect your own programme to `pa.input` the same way.

### Why equal-power instead of HRTF
- Web Audio panners add no propagation delay, so feeding one signal to several equal-power panners only sums gains —
  no comb filtering. HRTF applies per-source ITD / filtering, which colours the sum of several speakers.
- HRTF panners are generally much more expensive; on standalone headsets (Meta Quest) several stacks add up.
- A club PA is "the room", not a point: mono lows and gently distance-attenuated mids/highs keep the level even
  everywhere (measured: 0.6 dB RMS spread over 9 positions in a 10 m × 11 m room).
- For a single point source you can still pass `{ panningModel: 'HRTF' }` to `createSpeakerPanner()`.

### Filters (Unity Audio Filter equivalents)

Each core factory returns `{ input, output, params, set(params, t?), dispose() }`; `set` glides (no clicks).
Low-pass / high-pass (`cutoff`, `resonance`), reverb (`preset` small/room/basement/hall, `rt60`, `preDelay`, `damping`, `dry`, `wet`; synthetic IR cached per context+preset), echo (`delay`, `feedback`, `damping`, `dry`, `wet`), distortion (`amount`), chorus (`rate`, `depth`, `delay`, `dry`, `wet`).
Chain with `createFilterChain(ctx, specs)` / `useAudioFilters(specs)` / `<Speaker filters={...} onInput={...}>`. `enabled: false` cross-fades to bypass.

### Analysis (visualisers; Unity `GetSpectrumData` / `GetOutputData`)

`createAnalyser(ctx, opts)` → `tap(node)`, `update()`, `spectrum` (dB), `waveform`, `bands` (0..1 log bands with attack/release), `rms`, `peak`, `beat`, `beatPulse`, `bpm`, `dominantFrequency()`, `pitch()`. Allocation-free; ~20 µs per `update()`. R3F: `useAudioAnalyser(node, opts)` (ref, no re-renders) + `driveInstancedBars(mesh, bands)`.

### License
CC0 1.0 Universal (public domain dedication). No rights reserved, no attribution required. See LICENSE for the full text.
