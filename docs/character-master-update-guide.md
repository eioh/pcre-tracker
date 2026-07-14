# characterMaster 更新手順

最終更新日: 2026-03-03

このドキュメントは、`src/data/characterMaster.json` に新キャラを追加・更新し、`src/data/characterMaster.generated.json` を再生成するときの運用手順をまとめたものです。

## 1. 更新対象

- マスターデータ（手編集元）: `src/data/characterMaster.json`
- 編成順リスト（手編集元）: `src/data/formationOrder.json`
- マスターデータ（生成・アプリ参照）: `src/data/characterMaster.generated.json`
- 検索トークン生成スクリプト: `scripts/generate-search-tokens.mjs`
- 運用手順書: `docs/character-master-update-guide.md`

## 2. 情報ソース方針

- 1次ソース: 公式お知らせ（プリコネR公式サイト）
  - https://priconne-redive.jp/news/
- 補完ソース: 主要攻略DB
  - https://gamewith.jp/pricone-re/
  - https://wikiwiki.jp/yabaidesune/
- 公式で欠ける項目（属性・ロールなど）は、補完ソースで確認して反映する。
- `attribute` と `role` は、確認ソースが揃うまで確定しない（推測で入力しない）。

## 3. 入力ルール

- `name`: ゲーム内表記に合わせる（全角カッコ）
- `limited`: 限定キャラは `true`
- `attribute`: `火 / 水 / 風 / 光 / 闇`
- `role`: `アタッカー / タンク / ヒーラー / バッファー / デバッファー / ブレイカー / ブースター / ジャマー`
- `attribute` / `role`:
  - 先に確認元URL（公式 + 補完）を特定してから入力する
  - 確認できない場合は追加作業を保留し、暫定値を入れない
- 属性/ロールの正本は `src/data/characterMaster.json` のみとし、別表は作らない
- `implemented`:
  - 新規実装直後の初期値は `star6:false, ue1:false, ue1Sp:false, ue2:false` を基本にする
  - 既に実装済みの育成要素がある場合は実装状況に合わせて更新する
- `memoryPieceSources`:
  - 情報が確定するまで空配列 `[]` を許容する
  - ショップ追加などで確定後に更新する
- `searchTokens` は手編集しない（`npm run generate` で生成ファイルへ再生成）
- `formationOrder`（編成順）:
  - 正本は `src/data/formationOrder.json`（編成順=隊列の前衛側が先頭になるよう並べたキャラ名の配列）
  - 新キャラ追加時は、隊列表等で編成順の位置を確認し、`formationOrder.json` の該当位置に名前を1行挿入する
  - 番号は `npm run generate` が配列の並びから自動採番するため、手で番号を管理しない
  - `characterMaster.json` と `formationOrder.json` のキャラ集合が一致しないと `npm run generate` がエラーになる（入れ忘れ検出）

## 4. 作業手順

1. 追加対象キャラの確認元URL（公式 + 補完）を確定する。
2. `src/data/characterMaster.json` にキャラを追加/更新する（`attribute`/`role` は確認済み値のみ入力）。
3. `src/data/formationOrder.json` の編成順の正しい位置に追加キャラの名前を挿入する。
4. `npm run generate` を実行して `src/data/characterMaster.generated.json` を再生成する。
5. 差分を確認して不要変更がないことを確認する（元データは上書きされない）。

## 5. 検証コマンド

- `npm run typecheck`
- `npm test`
- 必要に応じて `npm run build`

## 6. コミット前チェックリスト

- 追加キャラの `name` が重複していない
- 追加キャラが `formationOrder.json` の正しい位置に挿入されている
- 追加キャラの `attribute` と `role` が確認元URLの記載と一致している
- 追加キャラの確認元URL（公式 + 補完）をPR本文またはコミットメモに残している
- `implemented` が実装状況と一致している
- `memoryPieceSources` が方針どおりに設定されている
- `git diff src/data/characterMaster.json` で追加キャラ行を目視確認し、`attribute`/`role` の誤入力がない
- `src/data/characterMaster.generated.json` が `npm run generate` 後の状態でコミット対象になっている
