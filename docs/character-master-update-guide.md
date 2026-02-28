# characterMaster 更新手順

最終更新日: 2026-02-28

このドキュメントは、`src/data/characterMaster.json` に新キャラを追加・更新するときの運用手順をまとめたものです。

## 1. 更新対象

- マスターデータ: `src/data/characterMaster.json`
- 検索トークン生成スクリプト: `scripts/generate-search-tokens.mjs`
- 運用手順書: `docs/character-master-update-guide.md`

## 2. 情報ソース方針

- 1次ソース: 公式お知らせ（プリコネR公式サイト）
- 補完ソース: 主要攻略DB（例: GameWith）
- 公式で欠ける項目（属性・ロールなど）は、補完ソースで確認して反映する。

今回の追加例（ペコリーヌ（アストライア））:
- 公式: https://priconne-redive.jp/news/information/35135/
- 補完: https://gamewith.jp/pricone-re/article/show/488376

## 3. 入力ルール

- `name`: ゲーム内表記に合わせる（全角カッコ）
- `limited`: 限定キャラは `true`
- `attribute`: `火 / 水 / 風 / 光 / 闇`
- `role`: `アタッカー / タンク / ヒーラー / バッファー / デバッファー / ブレイカー / ブースター / ジャマー`
- 属性/ロールの正本は `src/data/characterMaster.json` のみとし、別表は作らない
- `implemented`:
  - 新規実装直後の初期値は `star6:false, ue1:false, ue1Sp:false, ue2:false` を基本にする
  - 既に実装済みの育成要素がある場合は実装状況に合わせて更新する
- `memoryPieceSources`:
  - 情報が確定するまで空配列 `[]` を許容する
  - ショップ追加などで確定後に更新する
- `searchTokens` は手編集しない（`npm run generate` で再生成）

## 4. 作業手順

1. `src/data/characterMaster.json` にキャラを追加/更新する。
2. `npm run generate` を実行して `searchTokens` を再生成する。
3. 差分を確認して不要変更がないことを確認する。

## 5. 検証コマンド

- `npm run typecheck`
- `npm test`
- 必要に応じて `npm run build`

## 6. コミット前チェックリスト

- 追加キャラの `name` が重複していない
- `implemented` が実装状況と一致している
- `memoryPieceSources` が方針どおりに設定されている
- `searchTokens` が `npm run generate` 後の状態でコミット対象になっている
