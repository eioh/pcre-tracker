# クラバト編成サイドバーのフォルダツリー化

プラン: `C:\Users\user\.claude\plans\melodic-foraging-kahn.md`（codex レビュー承認済み 2026-08-03）

## 実装ステップ

- [x] 1. `moveClanBattleFormation` 追加 + ユニットテスト（domain）— d3d90ef
- [x] 2. サイドバーを `ClanBattleSidebar.tsx` へ機械的切り出し（挙動変更ゼロ）— ffed681
- [x] 3. ツリー化: 折りたたみ/Badge/reveal 自動展開、ホバー＋・削除、インライン追加、常設フォーム廃止、月追加ポップオーバー — b44f682
- [x] 4. D&D 刷新: 単一 DndContext、resolveDropTarget(onDragMove)、DragOverlay、インジケータ、reorderClanBattleFormations 削除 — 69fdb18
- [x] 5. 仕上げ: a11y 総点検、モバイルタップ領域、不要コード整理 — e8ffda1
- [x] 6. レビュー: codex + Claude 2系統 → 指摘修正（abb6a54, 76b3dcb）→ codex 再レビュー承認
- [x] 7. 実画面での受け入れ確認（D&D 全パターン、モバイル幅 375px）
- [x] 8. PR 作成

## レビューセクション

### レビューで検出・修正したバグ
1. 【高】インライン入力の Enter/Escape が IME 変換操作を拾う（isComposing 未ガード）→ abb6a54
2. 【中】ウィンドウ非アクティブ化の blur で入力全消去 / 同月＋再押下で文字消失 → abb6a54
3. 【中】リスト下端余白へのドロップが無反応（droppable の穴）→ 月ボディの弱い droppable + 4段 collision detection（abb6a54）
4. 【低】重複年月の追加が無反応 → サイドバー側で既存月を展開のみ（保存/同期も発火しない）（abb6a54）
5. 【低】DragOverlay プレビューにモバイル min-h がなく判定ずれ → abb6a54
6. 【高・実画面で発見】ドロップ確定位置がインジケータ表示とずれる（DragEnd 時の `active.rect.current.translated` が信頼できず before/after 判定が反転）→ 確定は表示中の dropIndicator を正とする `resolveCommitTarget` に変更（76b3dcb）

### 学び
- dnd-kit の DragEndEvent では `active.rect.current.translated` が DragOverlay の後始末で巻き戻ることがある。確定位置は onDragMove で更新し続けた表示用 state を正とする（WYSIWYG）
- 合成 MouseEvent での D&D 検証は単発なら信頼できるが、連続実行すると sensor 状態が汚れて誤動作する（ページリロードで区切ること）
- ブラウザ自動化ツールの Return キーは `key:""` を送ることがある。key ハンドラの検証は `new KeyboardEvent` の直接ディスパッチで行う

### 検証結果
- npm test: 41 files / 365 tests 全パス、typecheck・build グリーン
- 実画面: 折りたたみ/バッジ/reveal/ハイライト/インライン追加(IME・Esc・blur)/月追加ポップオーバー(Popover内Select)/重複月/同月内並び替え/月またぎ(before・after・空月・下端余白・折りたたみ見出し+自動展開)/Escキャンセル 全合格
- モバイル(375px): タップ領域44px、横はみ出しなし、＋/削除は hover:none 端末で常時表示（既存パターン）
