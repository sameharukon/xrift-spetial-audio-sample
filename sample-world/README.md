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

西から東へ一本道で 3 部屋を順に進む（分岐なし）: **音量調整 → 定位確認 → 遮蔽確認**。部屋どうしは 4 m の廊下でつながり、廊下は次の部屋の色で光る（ドア口上の帯と床のライン）ので、文字なしで順路がわかる。部屋ごとに音声バスがあり、いる部屋だけが鳴る（廊下では前後の部屋がクロスフェードし、こもる。ほかの部屋の音は混ざらない）。音源はライブラリのテスト音源 drumLoop のみ。ワールド内に文字はない（色と記号のみ）。

操作盤はどの部屋も入口を入ってすぐ左（−z 側）にあり、入ってくる人の方を向いている（板の高さ約 1.2 m、通路と周回する音源の軌道から外れた位置、入口付近から 2 m 前後で操作できる）。

1. V「音量」（灰, 8×8 m、スポーン地点）: 基準スピーカーが A 室と同じ drumLoop・同じレベル・同じ距離減衰で鳴る。これを聞きながら音量盤（− / +、0–200 %、レベルバー、音声状態ランプ 赤 = 未解除 / 緑 = 再生中）で音量を決める。音量はユーザーごと・保存しない。
2. A「3D 定位」（青, 14×14 m）: 音源は 1 つだけ。drumLoop を鳴らす無指向スピーカーが床のリングに沿って半径 4.2 m・18 秒で部屋を周回し、聞こえる方向と距離が連続して変わる（サイン波より打音の方が定位しやすいので drumLoop）。立ち止まって音が周りを回るのを聞く、または頭を回して左右が入れ替わるのを確かめる。操作盤は 2 ボタン: 音源の ON/OFF、パンニング HRTF（既定）⇔ equal-power。
3. B「遮蔽」（橙, 16×12 m）: 厚さ 0.6 m の仕切り壁の向こうに drumLoop。仕切りのスライドドア（初期は閉）を開閉すると `createMuffle` のこもり量が変わり、ドア口の見通しでも変化する。手前の面に遮蔽メーター。操作盤は 2 ボタン: 音源の ON/OFF、ドアの開閉（ドア本体をクリックしても開閉できる）。操作盤の前に立つとドア口越しにスピーカーへの見通しがあるので、その場で開閉前後の違いを聞き比べられる。

壁は部屋・廊下ごとに 1 枚の押し出しジオメトリ（ドア口をくり抜いた形状）で、面の重なりがない（Z ファイト対策）。コライダーは歩ける範囲の外側を約 5 m の厚みで埋めている（床 0.1 m 上から）。

## 主なファイル

- `src/layout.ts` — 部屋・廊下・壁・床・天井・コライダーの生成（`buildLayout`）
- `src/constants.ts` — 部屋の順序・配置・色、操作盤の位置
- `src/audio/SpatialAudioScene.tsx` — 出力チェーンと 3 部屋（部屋バス → muffle → gate → リミッター → 音量 → soft ceiling）
- `src/audio/roomMix.ts` — 位置から部屋ごとの gate / muffle、B 室の遮蔽量
- `src/audio/{chain,useTestSource}.ts`
- `src/rooms/{VolumeRoom,PositionalRoom,OcclusionRoom}.tsx`
- `src/components/{Architecture,PocketDoor,Controls,VolumeStand,SpeakerCabinet}.tsx`

## ライセンス

このディレクトリの独自コードは CC0-1.0（LICENSE）。プロジェクト雛形（vite / tsconfig / index.html / AGENTS.md / CLAUDE.md など）は `xrift create world` のテンプレート WebXR-JP/xrift-test-world 由来で、MIT © WebXR-JP（NOTICE-template-MIT.txt）。
