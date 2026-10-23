# xrift-spatial-audio sample

**XRift world:** https://app.xrift.net/world/b37fbdc6-d953-41b6-b157-cad92bb0e251 (Spatial Audio Sample)

## 日本語

XRift ワールド用の空間オーディオライブラリ（プロトタイプ）とサンプルワールドです。

- `sample-impl/` は `xrift-spatial-audio` 本体です。Web Audio の core と React Three Fiber のバインディングで、次の機能があります。
  - 空間定位と PA
  - 遮蔽
  - 音量
  - フィルター: LPF / HPF / リバーブ / エコー / ディストーション / コーラス
  - 解析: スペクトラム / 帯域 / ビート / ピッチ
- `sample-world/` は動作確認用の XRift ワールドです。画面をクリックすると音が出ます。ビートに合わせて控えめな点滅があります。
- `AI_BRIEF.md` は正式実装を担当する AI 向けの説明です。

```bash
npm install && npm run build   # sample-impl → sample-world
npm run dev                    # ローカル確認
npm run check                  # xrift check world
```

## English

This repo holds a prototype spatial-audio library for XRift worlds, plus a sample world.

- `sample-impl/` is the `xrift-spatial-audio` library: a Web Audio core and React Three Fiber bindings. It provides:
  - spatialisation and a club PA
  - occlusion
  - volume
  - filters: LPF / HPF / reverb / echo / distortion / chorus
  - analysis: spectrum / bands / beat / pitch
- `sample-world/` is a minimal XRift world for trying the library. Click to start the audio. It has mild flashing on the beat.
- `AI_BRIEF.md` is a short brief (in Japanese) for whoever implements the official version.

Run `npm install && npm run build` at the root, then `npm run dev`.

## License

The library and the sample world's own code are CC0-1.0 (see `sample-impl/LICENSE` and `sample-world/LICENSE`). The scaffolding files from the WebXR-JP/xrift-test-world template are MIT © WebXR-JP (see `sample-world/NOTICE-template-MIT.txt`).
