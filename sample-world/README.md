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

中央のハブ（10×10 m、音なし）から東西南北の廊下で 4 部屋に分かれる。部屋ごとに音声バスがあり、自分がいる部屋だけが鳴る（廊下では少しこもり、ハブでは入口付近でかすかに聞こえるだけ。ほかの部屋の音は混ざらない）。音源はライブラリのテスト音源（`createTestSource` の drumLoop / sine / pinkNoise）のみ。ワールド内に文字はない（色と記号のみ）。

- ハブ: 音量スタンド（− / +、0–200 %、レベルバー、音声状態ランプ 赤 = 未解除 / 緑 = 再生中）。
- 北 A「3D 定位」（青, 14×14 m）: 中央に無指向スピーカー（drumLoop）、半径 4.2 m を 18 秒で周回する 523 Hz サイン、角のピンクノイズ（初期 OFF）。スタンドで各音源 ON/OFF と HRTF ⇔ equal-power 切替。
- 東 B「遮蔽」（橙, 16×12 m）: 厚さ 0.6 m の仕切り壁の向こうに drumLoop。仕切りのスライドドア（初期は閉）を開閉すると `createMuffle` のこもり量が変わり、ドア口の見通しでも変化する。手前の面に遮蔽メーター、スタンドで音源 ON/OFF。
- 西 C「フィルター」（紫, 14×14 m）: 弧状に並んだ 8 台のスピーカーが同じ drumLoop を別々の `filters` で再生（dry / LPF 600 Hz / HPF 1500 Hz / reverb small / reverb hall / echo / distortion / chorus）。各スピーカー前のパッドで ON/OFF（複数同時可、初期は dry のみ）。
- 南 D「解析」（黒, 14×14 m）: PA 2 台（`useClubPA`、drumLoop ⇔ pinkNoise）。奥の壁にスペクトラムバー + ビートランプ、床に 4 バンドの柱、右の壁にピッチメーター（メロディを鳴らすサインスピーカー）。スタンドの 5 ボタンで切替（点滅 ≤ 4 Hz）。

壁は部屋・廊下ごとに 1 枚の押し出しジオメトリ（ドア口をくり抜いた形状）で、面の重なりがない（Z ファイト対策）。コライダーは歩ける範囲の外側を約 5 m の厚みで埋めている（床 0.1 m 上から）。

## 主なファイル

- `src/layout.ts` — 部屋・廊下・壁・床・天井・コライダーの生成（`buildLayout`）
- `src/constants.ts` — 部屋の配置と色
- `src/audio/SpatialAudioScene.tsx` — 出力チェーンと 4 部屋（部屋バス → muffle → gate → リミッター → 音量 → soft ceiling）
- `src/audio/roomMix.ts` — 位置から部屋ごとの gate / muffle、B 室の遮蔽量
- `src/audio/{chain,useTestSource,filterSpeakers}.ts`
- `src/rooms/{PositionalRoom,OcclusionRoom,FiltersRoom,AnalyserRoom}.tsx`
- `src/components/{Architecture,PocketDoor,Controls,HubStand,SpeakerCabinet,Visualizer}.tsx`

## ライセンス

このディレクトリの独自コードは CC0-1.0（LICENSE）。プロジェクト雛形（vite / tsconfig / index.html / AGENTS.md / CLAUDE.md など）は `xrift create world` のテンプレート WebXR-JP/xrift-test-world 由来で、MIT © WebXR-JP（NOTICE-template-MIT.txt）。
