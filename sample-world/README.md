# Spatial Audio Sample World

`xrift-spatial-audio`（../sample-impl）の動作確認用の最小 XRift ワールド。音源はすべてコード生成（外部音声ファイルなし）。

## 実行

バンドルのルートで:

```bash
npm install        # workspaces: sample-impl を build（prepare）して symlink
npm run dev        # sample-impl を build → sample-world の vite dev server
npm run build      # 本番ビルド（sample-impl → sample-world）
npm run check      # xrift check world（コードセキュリティ検査）
```

画面を一度クリック（または XR セッション開始）で音が出る。アップロードは `xrift upload world`（新しいワールドが作られるので必要な時だけ）。

## シーン

- 14×14 m の部屋。前の壁に PA 2 台（`createTestSource` の drumLoop 124 BPM → `useClubPA` → `<Speaker>`）。
- 右奥にビーコン（523 Hz サイン、`<Speaker filters onInput>` で独自パンナー）。
- 後ろの壁にスライドドア（Interactable）→ 廊下。ドアを閉めると壁越しにこもる（muffle）。
- 右のスタンド: 音量 − / +（0–200 %）、ビーコン ON/OFF、音声状態ランプ（赤 = 未解除, 緑 = 再生中）。
- 左のスタンド: フィルターパッド 6 個（色 + 記号, 文字なし）。青 LPF / 橙 HPF / 紫 リバーブ(hall) / 緑 エコー / 赤 ディストーション / 水色 コーラス。PA とビーコン両方に掛かる。
- 前の壁: スペクトラムバー 24 本 + ビートランプ（ソースのミックスを解析。点滅 ≤ 4 Hz）。

## 主なファイル

- `src/audio/SpatialAudioScene.tsx` — 音声グラフ全体（mix → muffle → 音量 → soft ceiling → 出力）
- `src/audio/filterPads.ts` — パッドと `FilterSpec` の対応
- `src/audio/occlusion.ts` — 位置とドア状態から遮蔽量を計算
- `src/components/Visualizer.tsx` — `useAudioAnalyser` + `driveInstancedBars`
- `src/components/{Room,Door,ControlStand,FilterPads,SpeakerCabinet}.tsx`

## ライセンス

このディレクトリの独自コードは CC0-1.0（LICENSE）。プロジェクト雛形（vite / tsconfig / index.html / AGENTS.md / CLAUDE.md など）は `xrift create world` のテンプレート WebXR-JP/xrift-test-world 由来で、MIT © WebXR-JP（NOTICE-template-MIT.txt）。
