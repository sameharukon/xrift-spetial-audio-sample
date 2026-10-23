# xrift-spatial-audio

> **Status: local prototype (v0.1.0).** Not published yet. Public domain (CC0-1.0).

[日本語](#日本語) | [English](#english)

---

## 日本語

### これは何？
XRift（React Three Fiber）ワールド向けの 3D 音源（空間オーディオ）層です。オブジェクトに付けた音源を、聞き手（カメラ / XR の頭）の位置と向きに合わせて定位させ、壁やドア越しの遮蔽を表現します。
デモや動作確認用に、シンプルな合成テスト音源（ピンクノイズ / サイン波 / キックとハットのループ）を同梱しています。

- **core**（`xrift-spatial-audio`）: Web Audio API だけに依存（React / three.js 不要）
  - `createSpeakerPanner()` / `setPannerPosition()` / `setListenerPose()` … パンナー（既定 HRTF、多数の音源には軽い equal-power も可）と、平滑化付きの位置・向き更新。`warmUpHrtf()`（unlock 時に自動で HRTF データベースを先読み）
  - `createMuffle()` … 0..1 の量で駆動するローパス＋ゲイン（壁・ドア越しの遮蔽）
  - `createAudioUnlocker()` / `attachGestureUnlock()` … AudioContext の遅延生成と、ユーザー操作（pointer / key / touch / click / pointer lock / WebXR `sessionstart`）での resume
  - `volumeValue()` / `volumeStages()` / `applyVolumeStages()` / `createSoftCeiling()` … 出力段の補助（0–200 % の音量カーブ、クリップ防止）
  - `createTestSource(ctx, { type: 'pinkNoise' | 'sine' | 'drumLoop' })` … テスト音源（ピーク −1 dBFS、ループ再生）
- **r3f**（`xrift-spatial-audio/r3f`）: React Three Fiber バインディング
  - `<SpatialAudioProvider>` / `useSpatialAudio()`、`<SpatialAudioListener smoothing>`（実際に描画したカメラ＝XR 中は XR カメラのワールド姿勢に追従）、`<Speaker position rotation offset panner onPanner destination>`（グループのワールド位置でパンナーを毎フレーム更新）。どちらも描画直後（`addAfterEffect`）に姿勢を読むので、そのフレームに描かれた位置と音源位置が一致する、`updateListenerFromCamera()` / `updatePannerFromObject()`
- **examples/PointSource.tsx** … 点音源 1 つ（遮蔽の ON/OFF 付き）の最小デモ

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
import { useEffect, useState } from 'react'
import { createTestSource } from 'xrift-spatial-audio'
import { SpatialAudioProvider, SpatialAudioListener, Speaker, useSpatialAudio } from 'xrift-spatial-audio/r3f'

function Source() {
  const ctx = useSpatialAudio()?.context ?? null      // ユーザー操作までは null
  const [panner, setPanner] = useState<PannerNode | null>(null)
  useEffect(() => {
    if (!ctx || !panner) return
    const src = createTestSource(ctx, { type: 'drumLoop', bpm: 124 })
    src.output.connect(panner)                         // 自分の音源もパンナーに繋ぐ
    src.start()
    return () => src.stop()
  }, [ctx, panner])
  return <Speaker position={[0, 0, -3]} offset={[0, 1.2, 0]} onPanner={setPanner} />
}

export const World = () => (
  <SpatialAudioProvider>
    <SpatialAudioListener />
    <Source />
  </SpatialAudioProvider>
)
```
遮蔽: 音源 → `createMuffle(ctx)` → パンナー の順に繋ぎ、`muffle.set(0..1)` で壁・ドアの量を渡します（examples/PointSource.tsx）。

### equal-power と HRTF
- 既定は HRTF。前後・上下の手掛かりがあり、点音源の方向がいちばん分かりやすい。最初の HRTF 使用時にブラウザがデータベースを読み込む（デスクトップで約 0.25 s）ので、unlock 時に `warmUpHrtf()` で先読みします（`createAudioUnlocker({ warmUpHrtf: false })` で無効化）。
- 負荷（デスクトップ Chrome・Xeon 2.4 GHz・48 kHz での計測値。Quest では数倍になる見込み）: 動く音源は**どちらのモデルでも**パンナー 1 個あたり CPU 1 コアの約 1 %（位置が自動変化している間、Chrome がサンプルごとに方向・距離を計算し直すため）。HRTF の上乗せは 5–20 % 程度。静止音源は HRTF 約 0.1 %、equal-power 約 0.05 %。
- 音源が非常に多いとき、または同じ信号を複数スピーカーで鳴らすとき（PA など）は `panner={{ panningModel: 'equalpower' }}`（または `createSpeakerPanner(ctx, { panningModel: 'equalpower' })`）。equal-power は軽く、Web Audio のパンナーは伝搬遅延を付けないので同じ信号を複数のパンナーに送っても**ゲインが足されるだけ**でコムフィルタが起きません（HRTF は音源ごとに ITD / フィルタが掛かり、合算すると音色が濁る）。

### ライセンス
CC0 1.0 Universal（パブリックドメイン）。著作権を放棄しています。クレジット表記も不要で、自由に使用・改変・再配布できます。全文は LICENSE を参照してください。

---

## English

### What is it?
A 3D (spatial) audio layer for XRift (React Three Fiber) worlds: sources attached to objects are positioned relative to
the listener (camera / XR head), and can be occluded by walls and doors. For demos and level checks it ships a simple
synthesized test source (pink noise, sine, or a kick + hat loop).

- **core** (`xrift-spatial-audio`) — Web Audio only, no React / three.js:
  `createSpeakerPanner()` (HRTF by default, equal-power as the lighter option), `warmUpHrtf()` (preloads the HRTF database; run automatically at unlock), `setPannerPosition()`, `setListenerPose()` (smoothed),
  `createMuffle()` (0..1 low-pass + gain for walls / doors), `createAudioUnlocker()` / `attachGestureUnlock()` (lazy
  AudioContext, resume on pointer / key / touch / click / pointer-lock / WebXR `sessionstart`), output helpers
  `volumeValue()` / `volumeStages()` / `applyVolumeStages()` / `createSoftCeiling()` (0–200 % volume curve, no clipping),
  `createTestSource(ctx, { type: 'pinkNoise' | 'sine' | 'drumLoop' })` (looping test programme peaking at −1 dBFS).
- **r3f** (`xrift-spatial-audio/r3f`) — `<SpatialAudioProvider>` / `useSpatialAudio()`, `<SpatialAudioListener smoothing>`
  (follows the world pose of the camera actually rendered with, i.e. the WebXR camera while presenting),
  `<Speaker position rotation offset panner onPanner destination>` (drives a panner from the group's world position every
  frame). Both sample poses right after the frame is rendered (`addAfterEffect`), so the sound is where the mesh was drawn
  that frame. Also `useAfterRender()` / `renderedCamera()`, `updateListenerFromCamera()` / `updatePannerFromObject()`.
- **examples/PointSource.tsx** — minimal demo: one point source with switchable occlusion.

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
See the TSX example above (`SpatialAudioProvider` + `SpatialAudioListener` + `Speaker onPanner` + `createTestSource`);
connect your own source to the panner the same way. For occlusion, insert `createMuffle(ctx)` between the source and the
panner and drive `muffle.set(0..1)` (see examples/PointSource.tsx).

### Equal-power vs HRTF
- HRTF is the default: the best direction cues (front/back, elevation) for point sources. Browsers load the HRTF database on
  first use (≈ 0.25 s on desktop), so the unlocker preloads it with `warmUpHrtf()` (`createAudioUnlocker({ warmUpHrtf: false })` to skip).
- Cost, measured in desktop Chrome (Xeon 2.4 GHz, 48 kHz; expect several times more on Quest): a moving source costs ≈ 1 % of
  one core per panner with **either** model (Chrome recomputes the geometry per sample while positions are automated); HRTF
  adds only ≈ 5–20 % on top. Static sources: ≈ 0.1 % (HRTF) vs ≈ 0.05 % (equal-power) per panner.
- For very many sources, or one signal on several speakers (a PA), pass `{ panningModel: 'equalpower' }`: it is lighter, and
  since Web Audio panners add no propagation delay, equal-power panners of one signal only sum gains (no comb filtering),
  while HRTF's per-source ITD / filtering colours the sum.

### License
CC0 1.0 Universal (public domain dedication). No rights reserved, no attribution required. See LICENSE for the full text.
