# AI_BRIEF: XRift 空間オーディオ（実装担当 AI 向け）

## 目的
XRift のワールド作者が、3D 音源（オブジェクトに付けた音源の空間定位、聞き手の追従、壁・ドア越しの遮蔽）を共通 API で使えるようにする。このバンドルは動作するプロトタイプ（`sample-impl/`）と確認用ワールド（`sample-world/`）。これを参考に `@xrift/world-components` 側へ正式実装する。

## XRift の現状（`@xrift/world-components` 0.57.1 で確認済み）
- ワールドは R3F 9 / React 19 / three 0.183。Module Federation で react, three, R3F, rapier, drei, uikit, `@xrift/world-components` が共有される。それ以外の依存は `__federation_expose_World-*.js` にインライン化され、`xrift check world`（`@xrift/code-security`）が検査する。
- 空間オーディオ API はまだ無い。音声関連で存在するのは次の 2 つだけ。
  - `VoiceVolumeOverrideContext`（旧名 `AudioVolumeContext`）: ユーザーごとのボイス音量の上書き。
  - `useWebAudioVolume`: `VideoScreen` / `Video180Sphere` / `LiveVideoPlayer` が使う。メディア要素ごとに `new AudioContext()` → `GainNode` を作る（定位なし）。
- ホストが実装を注入するパターンは既にある: `XRiftProvider` の `*Implementation` props と `createDefault*Implementation()`（開発用の no-op）。
- 永続化は `worldStorageImplementation`（ワールド単位の KV）。

## プロトタイプ API（`sample-impl/`, パッケージ名 `xrift-spatial-audio`）
| ファイル | 内容 |
|---|---|
| `src/core/unlock.ts` | `createAudioUnlocker`, `attachGestureUnlock`: AudioContext を遅延生成し、pointer / key / touch / click / pointer lock / XR `sessionstart` で resume |
| `src/core/panner.ts` | `createSpeakerPanner`（既定は equal-power）, `setPannerPosition`, `setListenerPose`（平滑化つき） |
| `src/core/muffle.ts` | `createMuffle`: 0..1 で LPF とゲインを動かす（壁・ドア越し） |
| `src/core/volume.ts` | 出力段の補助: `volumeStages` / `applyVolumeStages`（0–100 % は 3 乗カーブ、100–200 % はリミッター手前でブースト）、`createSoftCeiling` |
| `src/core/testSource.ts` | `createTestSource`: pinkNoise / sine / drumLoop。ピーク −1 dBFS |
| `src/r3f/*` | `<SpatialAudioProvider>`, `useSpatialAudio()`, `<SpatialAudioListener>`（カメラのワールド姿勢に追従）, `<Speaker position rotation offset node panner onPanner destination>`（グループのワールド位置でパンナーを毎フレーム更新）, `updateListenerFromCamera`, `updatePannerFromObject` |

## 提案する正式 API（既存パターンに合わせる）
- `SpatialAudioContext` / `SpatialAudioProvider` / `useSpatialAudioContext()` / `createDefaultSpatialAudioImplementation()` を追加し、`XRiftProvider` に `spatialAudioImplementation` を足す。
- **AudioContext と listener はホストが 1 つ持って注入する。** ワールドが `new AudioContext()` しないので、ボイス・動画と同じ context・同じマスター音量・同じ unlock になる。listener もホストがカメラ（XR では頭）から更新する。
- default 実装はプロトタイプと同等にする（自前の context、ジェスチャーでの unlock）。ワールド作者向けの `<Speaker>` などはこの context を使うだけにする。
- 動画の `useWebAudioVolume` も将来は同じ context に乗せる（任意）。

## 設計判断（理由）
- **equal-power が既定。** Web Audio のパンナーは遅延を付けないので、同じ信号を複数スピーカーに送ってもコムフィルタが出ない。HRTF は合算すると音色が濁り、Quest では負荷も大きい。独立した点音源なら `panningModel:'HRTF'` を選べる（サンプルの A 室で切替可能）。
- **遮蔽はパンナーの手前の muffle。** 音源 → `createMuffle` → パンナー。量（0..1）は呼び出し側が壁・ドアの状態と見通しから計算する（サンプル B 室の `partitionOcclusion`）。
- **unlock。** AudioContext は最初のジェスチャーまで作らない。XR では `renderer.xr` の `sessionstart` でも resume する（XR 内ではクリックが来ないことがある）。
- **ブーストはリミッターの手前。** 100 % を超える音量はリミッター入力側のゲインで上げ、ピークをリミッターで抑える。最後に soft ceiling を置き、−0.1 dBFS を超えないようにする。

## 制約
- `@xrift/code-security`（`xrift check world`）で `eval` / `new Function` / `fetch` / `XMLHttpRequest` / `WebSocket` / `Worker` / `localStorage` / `sessionStorage` / `document.cookie` などが検出される。音声はすべてコードで生成するので fetch は不要。AudioWorklet（Blob URL）は未検証なので使わない。
- 設定の永続化（音量など）が必要なら `worldStorageImplementation` を使う。`localStorage` は不可。
- react / three / R3F は federation の shared を使う。複製すると Invalid hook call になる。

## サンプルの実行
```bash
npm install && npm run build   # ルート: workspaces。sample-impl → sample-world の順に build
npm run dev                    # 画面クリックで音が出る
npm run check                  # xrift check world
```
操作方法は `sample-world/README.md` を参照（ハブ + 2 部屋: 3D 定位 / 遮蔽。ハブに音量スタンド）。

## 受け入れ基準（プロトタイプで計測済みの値）
- ジェスチャー前は AudioContext 0 個。クリック後に 1 個で running になる。listener の位置と向きがカメラ（ワールド姿勢。親が回転していても正しい）に一致する。
- 振り向くと左右が入れ替わる（ビーコン 523 Hz: L−R −21 dB → 180° 回すと +23 dB）。ドアを閉めると廊下で −6.6 dB。音量 50 % で −18 dB、200 % で +6 dB、0 % で無音。
- StrictMode でエラーが出ない。`xrift check world` が APPROVE。

## ライセンス
`sample-impl/` とサンプルワールドの独自コードは CC0-1.0。雛形ファイルは WebXR-JP/xrift-test-world 由来の MIT（`sample-world/NOTICE-template-MIT.txt`）。
