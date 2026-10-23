# AI_BRIEF: XRift 空間オーディオ（実装担当 AI 向け）

## 目的
XRift のワールド作者が、音源の空間定位、PA（部屋全体を鳴らすスピーカー）、遮蔽、音量、フィルター、解析（ビジュアライザー）を共通 API で使えるようにする。このバンドルは動作するプロトタイプ（`sample-impl/`）と確認用ワールド（`sample-world/`）。これを参考に `@xrift/world-components` 側へ正式実装する。

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
| `src/core/clubPA.ts` | `createClubPA`: LR4 クロスオーバー 140 Hz。低域はモノラル・無指向、中高域はステレオベッド＋スタックごとのパンナー。合成 IR の部屋リバーブ → グルーリミッター |
| `src/core/muffle.ts` | `createMuffle`: 0..1 で LPF とゲインを動かす（壁・ドア越し） |
| `src/core/volume.ts` | `volumeStages` / `applyVolumeStages`（0–100 % は 3 乗カーブ、100–200 % はリミッター手前でブースト）、`createSoftCeiling` |
| `src/core/filters.ts` | フィルター（下表）、`createFilterChain` |
| `src/core/analysis.ts` | `createAnalyser`（下記） |
| `src/core/testSource.ts` | `createTestSource`: pinkNoise / sine / drumLoop。ピーク −1 dBFS |
| `src/r3f/*` | `<SpatialAudioProvider>`, `useSpatialAudio()`, `<SpatialAudioListener>`（カメラのワールド姿勢に追従）, `<Speaker position node panner filters onInput destination>`, `useClubPA`, `useAudioFilters`, `useAudioAnalyser`, `driveInstancedBars` |

フィルター（Unity 対応）。ファクトリはどれも `{input, output, params, set(p, t?), dispose()}` を返し、`set` での変化はなめらか。

| Unity | prototype | 主なパラメータ |
|---|---|---|
| AudioLowPassFilter / AudioHighPassFilter | `lowpass` / `highpass` | `cutoff`, `resonance`（線形 Q。内部で dB に変換） |
| AudioReverbFilter（プリセット） | `reverb` | `preset` small / room / basement / hall, `rt60`, `preDelay`, `damping`, `dry`, `wet`。IR は合成し、context × preset × rt60 ごとにキャッシュ |
| AudioEchoFilter | `echo` | `delay`, `feedback`（最大 0.95）, `damping`, `dry`, `wet` |
| AudioDistortionFilter | `distortion` | `amount` 0–1（メイクアップ自動） |
| AudioChorusFilter | `chorus` | `rate`, `depth`, `delay`, `dry`, `wet` |

- チェーンは `FilterSpec[]` で渡す。`enabled:false` にすると 15 ms のクロスフェードでバイパスされる。並び（種類の列）が変わった時だけ作り直す。
- 既定値は、−1 dBFS のドラムループを通しても 0 dBFS を超えないよう調整してある。

解析（Unity の `GetSpectrumData` / `GetOutputData` 対応）
- `createAnalyser(ctx, {fftSize, smoothing, minDb, maxDb, bands, ...})` を作り、`tap(node)` で任意のノードに分岐接続する。毎フレーム `update()` を呼ぶと次の値が更新される:
  - `spectrum`（dB）と `getByteSpectrum()`
  - `waveform`
  - `bands`: 0..1 の対数帯域。帯域数は N 本か `FOUR_BANDS`。attack / release つき
  - `rms`, `peak`, `beat`, `beatPulse`, `bpm`
- ピッチ推定: `dominantFrequency()`（放物線補間）と `pitch()`（自己相関。重いので必要な時だけ呼ぶ）。
- フレームごとのメモリ確保はしない。
- R3F 側は `useAudioAnalyser(node)` が ref を返すので再レンダーは起きない。

## 提案する正式 API（既存パターンに合わせる）
- `SpatialAudioContext` / `SpatialAudioProvider` / `useSpatialAudioContext()` / `createDefaultSpatialAudioImplementation()` を追加し、`XRiftProvider` に `spatialAudioImplementation` を足す。
- **AudioContext と listener はホストが 1 つ持って注入する。** ワールドが `new AudioContext()` しないので、ボイス・動画と同じ context・同じマスター音量・同じ unlock になる。listener もホストがカメラ（XR では頭）から更新する。
- default 実装はプロトタイプと同等にする（自前の context、ジェスチャーでの unlock）。ワールド作者向けの `<Speaker>` / `useClubPA` / `useAudioFilters` / `useAudioAnalyser` はこの context を使うだけにする。
- 動画の `useWebAudioVolume` も将来は同じ context に乗せる（任意）。

## 設計判断（理由）
- **equal-power が既定。** Web Audio のパンナーは遅延を付けないので、同じ信号を複数スピーカーに送ってもコムフィルタが出ない。HRTF は合算すると音色が濁り、Quest では負荷も大きい。点音源 1 つだけなら `panningModel:'HRTF'` を選べる。
- **低域はモノラル。** 140 Hz の LR4（和が平坦）で分け、低域はどこでも同じレベルにする。定位させるのは中高域だけ。
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
操作方法は `sample-world/README.md` を参照（ドア、音量、ビーコン、フィルターパッド 6 個、スペクトラムとビートランプ）。

## 受け入れ基準（プロトタイプで計測済みの値）
- ジェスチャー前は AudioContext 0 個。クリック後に 1 個で running になる。listener の位置と向きがカメラ（ワールド姿勢。親が回転していても正しい）に一致する。
- 振り向くと左右が入れ替わる（ビーコン 523 Hz: L−R −21 dB → 180° 回すと +23 dB）。ドアを閉めると廊下で −6.6 dB。音量 50 % で −18 dB、200 % で +6 dB、0 % で無音。
- LPF 1 kHz の減衰は 1 k で −3.0、2 k で −12.4、4 k で −24.5 dB（HPF は対称）。リバーブの実測 RT60 は設定値の ±3 % 以内。エコーは設定した遅延の整数倍に、feedback 0.5 で約 −6 dB ずつ減衰。NaN もクリップも無し。切り替えでクリックが出ない。
- 解析: サイン 110 / 440 / 1000 / 3150 Hz の推定が ±1 Hz 以内で、正しい帯域に入る。drumLoop 124 BPM で 20/20 のオンセットを検出し、BPM 推定は 124.3。LPF / HPF を掛けると帯域の値が追従する。`update()` は約 20 µs。
- StrictMode でエラーが出ない。`xrift check world` が APPROVE。

## ライセンス
`sample-impl/` とサンプルワールドの独自コードは CC0-1.0。雛形ファイルは WebXR-JP/xrift-test-world 由来の MIT（`sample-world/NOTICE-template-MIT.txt`）。
