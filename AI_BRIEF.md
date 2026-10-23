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
| `src/core/panner.ts` | `createSpeakerPanner`（既定は HRTF）, `warmUpHrtf`, `setPannerPosition`, `setListenerPose`（平滑化つき） |
| `src/core/muffle.ts` | `createMuffle`: 0..1 で LPF とゲインを動かす（壁・ドア越し） |
| `src/core/volume.ts` | 出力段の補助: `volumeStages` / `applyVolumeStages`（0–100 % は 3 乗カーブ、100–200 % はリミッター手前でブースト）、`createSoftCeiling` |
| `src/core/testSource.ts` | `createTestSource`: pinkNoise / sine / drumLoop。ピーク −1 dBFS |
| `src/r3f/*` | `<SpatialAudioProvider>`, `useSpatialAudio()`, `<SpatialAudioListener>`（描画に使われたカメラのワールド姿勢に追従。VR では XR カメラ）, `<Speaker position rotation offset node panner onPanner destination>`（グループのワールド位置でパンナーを毎フレーム更新）。どちらも描画後（after-effect）に読むので、その後に動くカメラ・物体ともずれない, `updateListenerFromCamera`, `updatePannerFromObject` |

## 提案する正式 API（既存パターンに合わせる）
- `SpatialAudioContext` / `SpatialAudioProvider` / `useSpatialAudioContext()` / `createDefaultSpatialAudioImplementation()` を追加し、`XRiftProvider` に `spatialAudioImplementation` を足す。
- **AudioContext と listener はホストが 1 つ持って注入する。** ワールドが `new AudioContext()` しないので、ボイス・動画と同じ context・同じマスター音量・同じ unlock になる。listener もホストがカメラ（XR では頭）から更新する。
- default 実装はプロトタイプと同等にする（自前の context、ジェスチャーでの unlock）。ワールド作者向けの `<Speaker>` などはこの context を使うだけにする。
- 動画の `useWebAudioVolume` も将来は同じ context に乗せる（任意）。

## 設計判断（理由）
- **HRTF が既定。** 前後・上下の手掛かりがあり点音源の方向が分かりやすい。初回使用時のデータベース読み込み（デスクトップで約 0.25 s）は unlock 時の `warmUpHrtf()` で先に済ませる。負荷はデスクトップ Chrome（Xeon 2.4 GHz）での計測で、動く音源はどちらのモデルでもパンナー 1 個あたり 1 コアの約 1 %（HRTF の上乗せは 5–20 %）、静止音源は HRTF 約 0.1 %、equal-power 約 0.05 %。Quest では数倍と見込む。
- **equal-power は軽量オプション。** 音源が非常に多いとき、または同じ信号を複数スピーカーで鳴らすとき（PA など）に使う。Web Audio のパンナーは遅延を付けないので equal-power ならゲインが足されるだけでコムフィルタが出ない。HRTF は合算すると音色が濁る（サンプルの A 室は周回する drumLoop 音源 1 つで、HRTF ⇔ equal-power を切り替えて聴き比べられる）。
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
操作方法は `sample-world/README.md` を参照（一本道で 3 部屋: 音量調整 → 3D 定位 → 遮蔽。各部屋の入口すぐ左に操作盤）。

## 受け入れ基準（このサンプルで計測した値: ヘッドレス Chrome・既定 HRTF・drumLoop、マスター出力の約 3 s 平均パワー）
- ジェスチャー前は AudioContext 0 個。クリック後に 1 個で running になる。listener の位置と向きが描画に使われたカメラ（ワールド姿勢。親が回転・拡縮していても、VR の XR カメラでも。XR は描画カメラを差し替えるシミュレーションで確認）に一致し、パンナーの位置がスピーカーのメッシュに一致する（毎フレーム 1 cm・1° 以内）。
- 振り向くと左右が入れ替わる（音量の部屋の初期位置、スピーカーが右前のとき L−R −5.0 dB → 180° 回して左後ろにすると +1.5 dB。HRTF・低音の多い drumLoop なので広帯域の左右差は小さめ。equal-power ならもっと大きく出る）。遮蔽の部屋の入口でドアを閉めると開けたときより −6.4 dB。音量 50 % で −18 dB、200 % で +6 dB、0 % で無音（−150 dBFS）。
- StrictMode でエラーが出ない。`xrift check world` が APPROVE。

## ライセンス
`sample-impl/` とサンプルワールドの独自コードは CC0-1.0。雛形ファイルは WebXR-JP/xrift-test-world 由来の MIT（`sample-world/NOTICE-template-MIT.txt`）。
