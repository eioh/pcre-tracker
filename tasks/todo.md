# クラバト編成: formationOrder 自動ソート化

計画: `C:\Users\user\.claude\plans\polymorphic-exploring-ocean.md`

## 背景

クラバト編成タブのメンバー並び順は現在、手動並び替え（モバイル▲▼ボタン + デスクトップのドラッグ&ドロップ）で管理している。PR #8 でキャラマスタに `formationOrder`（隊列順、小さいほど先頭）が追加されたため、これを使って並び順を自動決定し、手動並び替えUI・処理を全廃する。

作業ブランチ: `feature/clan-battle-formation-order`（origin/main = 813862d から作成）。

## 実装ステップ

- [x] `git fetch origin && git switch -c feature/clan-battle-formation-order origin/main`
- [x] ドメイン層: `src/domain/clanBattle.ts` に `sortClanBattleMembers` を新設（export、マスター未登録キャラは末尾）
- [x] ドメイン層: `normalizeClanBattleState` にソートを組み込む（ソート→`normalizeSupportMemberCount` の順）
- [x] ドメインテスト: `src/domain/clanBattle.test.ts` に `sortClanBattleMembers`（昇順/未登録末尾/未登録同士は元順維持/非破壊）と `normalizeClanBattleState`（逆順保存データの是正）のテストを追加
- [x] `npm test` で domain 側が緑であることを確認
- [x] UI層: `src/components/ClanBattleTab.tsx` の `handleAddMember` をソート追加に変更（既存 `characterByName` useMemo を再利用）
- [x] UI層: 並び替え関連の削除（`reorderMembers` / `moveMemberByDirection` / `draggingMemberId` state / `handleDropMember` / `handleMoveMember` / draggable系属性 / `GripVertical` / ▲▼ボタンブロック / 不要 import）
- [x] UI層: 案内文を「編成順（隊列の並び）で自動的に並びます。サポートは最大1人です。」の単一文言へ差し替え
- [x] UI層: `members.map` の未使用 `memberIndex` を削除
- [x] UIテスト: `src/components/ClanBattleTab.test.tsx` から並び替え関連テスト（`moveMemberByDirection` describe、▲▼操作、disabled、案内文出し分け、`buildMember`、不要なら `stubMobileMatchMedia`）を削除
- [x] UIテスト: 追加時の挿入位置（order 最小・最大の2体入り編成に中間キャラを追加 → `onChange` の members が昇順3体）のテストを新設
- [x] UIテスト: 新案内文の表示（旧2文言の不在）のテストを新設
- [x] 検証: `npm run typecheck`
- [x] 検証: `npm test`
- [x] 検証: `npm run build`

## スコープ外（計画どおり対象外）

- スキーマ・マイグレーション（不要）
- `updateMember` / `updateSelectedFormation` のソート再実行
- コネクトランク計算タブの▲▼並び替え（別機能）

## レビュー

計画どおりに実装完了。

- `src/domain/clanBattle.ts`: `sortClanBattleMembers` を新設し、`normalizeClanBattleState` に「ソート→`normalizeSupportMemberCount`」の順で組み込み。
- `src/components/ClanBattleTab.tsx`: `handleAddMember` をソート込みに変更。`reorderMembers`/`moveMemberByDirection`/`draggingMemberId`/`handleDropMember`/`handleMoveMember`/draggable属性/`GripVertical`/▲▼ボタン/未使用`memberIndex`/不要import(`ChevronDown`,`ChevronUp`,`GripVertical`)を削除。案内文を単一文言に差し替え。
- テスト: `src/domain/clanBattle.test.ts` に `sortClanBattleMembers`（昇順/未登録末尾/未登録同士は元順維持/非破壊）と `normalizeClanBattleState`（逆順是正）を追加。`src/components/ClanBattleTab.test.tsx` から並び替え関連テストを削除し、「追加時の挿入位置（昇順3体）」「新案内文表示・旧文言の不在」を追加。
- 検証: `npm run typecheck`（緑）/ `npm test`（37 files / 289 tests 全PASS）/ `npm run build`（front + client 両方成功）。
- 計画からの逸脱: なし。
- 気づいた懸念点: 実画面での動作確認（dev サーバーでの逆順追加・localStorage 逆順データのロード是正）は未実施（typecheck/test/build の自動検証のみ実施）。コミットは未実施（監督者のレビュー待ち）。
