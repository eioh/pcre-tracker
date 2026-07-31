# クラバト編成の長押しドラッグ並び替え 実装計画

## 背景・確定要件

左サイドバーの編成一覧を、**長押し（約250ms）→ ドラッグ**で並び替えられるようにする。

- 操作: 長押しで行を持ち上げ、ドラッグしてドロップ位置に移動。**PC（マウス）もタッチも同じ長押し起動**（挙動統一・クリック選択との誤発火防止）
- 対象: **同一月グループ内のみ**（月グループ自体は年月降順の計算順なので対象外。グループをまたぐ移動はスコープ外）
- 実装手段: **dnd-kit を導入**（@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities）
- 永続化: 編成は配列順 = 表示順（順序フィールドなし、`normalizeClanBattleState` も順序保持）なので、`formations` 配列を並べ替えて既存の `onChange` 経路に乗せるだけ。**型変更・スキーマ変更は不要**
- 選択状態: 並び替えで選択は変えない（選択は id ベースなので自然に維持される）
- 既存機能との共存: クリック選択・ホバーコピーボタン（PR #18）・truncate（PR #20）を壊さない

## 変更ファイル

### 1. 依存追加

```
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. `src/domain/clanBattle.ts` — 並び替え純関数

jsdom では PointerEvent が未実装で D&D の結合テストが書けないため、並び替えロジックは純関数に切り出してドメイン層でテストする（過去の `reorderMembers` と同じ発想）。

```ts
// 編成配列内で activeId の編成を overId の位置へ移動した新しい配列を返す。
export function reorderClanBattleFormations(
  formations: ClanBattleFormation[],
  activeId: string,
  overId: string,
): ClanBattleFormation[]
```

- `activeId === overId`、どちらかが見つからない場合は元の配列をそのまま返す（参照維持で無駄な保存を防ぐ）
- 実装は splice ベース（dnd-kit の `arrayMove` 相当。domain 層に dnd-kit を依存させないため自前で書く）

### 3. `src/components/ClanBattleTab.tsx` — dnd-kit 組み込み

#### センサー設定（長押し起動）

- `useSensors(useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }))`
- **PointerSensor は使わない**（codex レビュー指摘: Pointer Events は開始後に `preventDefault()` でスクロールを抑止できず、`touch-action: manipulation` との組み合わせではドラッグがページスクロールに奪われうる。dnd-kit 公式も「行全体を操作対象にしつつ通常スクロールを残す」ケースでは MouseSensor + TouchSensor の併用を推奨。TouchSensor は `touchmove` を抑止できるため `touch-manipulation` と両立する）
- delay 起動によりマウス・タッチとも「250ms 長押しでドラッグ開始」に統一。tolerance 5px で長押し中の指ブレを許容
- 250ms 未満で離せば従来どおりクリック（選択・コピー）として動作

#### 構造

- 月グループごとに `<DndContext>` + `<SortableContext items={group.formations.map(f => f.id)} strategy={verticalListSortingStrategy}>` を置く（グループごとに独立させ、グループ間移動を構造的に不可能にする）
- 編成行コンテナ（`group flex min-w-0 ...` の div）を `useSortable({ id: formation.id })` 化した小コンポーネント（例: `SortableFormationRow`）に抽出。`transform` / `transition` は `@dnd-kit/utilities` の `CSS.Transform.toString()` で適用
- 行全体をドラッグ可能にする（`setNodeRef` + `attributes` + `listeners` を行コンテナに付与）。選択ボタン・コピーボタンは行の子のままで、クリックは従来どおり動く（長押ししない限りドラッグは始まらない）

#### タッチ対応の CSS（このコードベース初のタッチ操作制御）

- 行コンテナに `touch-action: manipulation`（Tailwind: `touch-manipulation`）を指定（dnd-kit の delay 起動と両立するスクロール制御。`touch-action: none` は行上からのサイドバースクロールを殺すので使わない）
- 長押し中のテキスト選択と iOS コンテキストメニュー抑止: 行に `select-none`、必要なら `[-webkit-touch-callout:none]` を追加
- ドラッグ中の行は視覚フィードバック（`isDragging` 時に `opacity-60` + `z-10` 等、控えめに）

#### ハンドラ

```ts
// ドラッグ終了時に同一グループ内で編成を並び替えて保存する。
const handleReorderFormations = (groupId: string, event: DragEndEvent): void => {
  // over が null（範囲外ドロップ）なら何もしない
  // reorderClanBattleFormations で新配列を作り、参照が変わったときだけ updateClanBattle で保存
};
```

- `updateClanBattle` 経由なので localStorage 保存・サーバー同期は自動（追加実装なし）
- 選択 ID は渡さない（選択維持）

### 4. テスト

#### `src/domain/clanBattle.test.ts`

`reorderClanBattleFormations` のテスト:
- 前→後ろ / 後ろ→前 への移動で期待順になる
- `activeId === overId` で同一参照を返す
- 存在しない id を渡すと同一参照を返す
- 元配列を変異させない

#### `src/components/ClanBattleTab.test.tsx`

- jsdom では PointerEvent 未実装のため D&D 操作そのもののテストは書かない（方針として明記）
- 既存テスト（コピー・選択・formationOrder ソート）が退行しないことを確認。編成行が配列順でレンダリングされることのアサーションを1本追加（並び替え結果の表示保証）

## 実装上の注意

- 379行の月グループタイトルボタンは `group.formations[0]?.id` を選択する仕様。並び替えで先頭が変われば選択先も変わるが、これは自然な挙動なので変更しない
- 旧メンバー並び替え（PR #11 で廃止）の ▲▼ボタンや「ドラッグで並び替えできます」案内文は復活させない。新規の案内文も既存テスト（非表示アサート）と被る文言にしない
- dnd-kit のバンドルサイズ影響は build 後に確認（ClanBattleTab は lazy チャンクなので他タブへの影響は軽微のはず）
- コピーボタン上での長押しでもドラッグが始まるが、タップ/クリックなら従来どおりコピー。実害がないため個別無効化はしない（シンプル優先）

## 実装ステップ

- [x] 1. `git fetch origin` → `git switch -c feature/formation-drag-reorder origin/develop`（#20 マージ済みの最新 develop 基点）
- [x] 2. 依存追加 + domain 純関数 + domain テスト
- [x] 3. ClanBattleTab に dnd-kit 組み込み（SortableFormationRow 抽出 + センサー + ハンドラ）+ テスト
- [x] 4. `npm run typecheck` / `npm test`（330件）/ `npm run build` 全緑
- [x] 5. codex + Claude の2系統レビュー → 指摘（行 div への attributes 展開による a11y 退行、両系統一致）を修正 → 再レビューで致命的指摘ゼロ
- [x] 6. ブラウザ実画面で受け入れ確認（長押し400msでドラッグ・並び替え・debounce後の永続化、短いクリックは選択のみ、attributes 除去後の role/tabindex 消失も確認）
- [ ] 7. Conventional Commits でコミット → PR 作成（base: develop）

## スコープ外

- 月グループをまたぐ編成の移動
- 編成メンバー（キャラ）の手動並び替え復活（formationOrder 自動整列を維持）
- キーボードでの並び替え操作（必要になったら別途）
- 月グループ自体の並び替え（年月降順の計算順を維持）

## レビュー（結果）

計画どおり実装完了。ブランチ `feature/formation-drag-reorder`（origin/develop 基点）。

- 計画段階: codex が PointerSensor の欠陥（タッチスクロールを抑止できない）を指摘 → MouseSensor + TouchSensor 併用に修正して確定
- 実装: `reorderClanBattleFormations` 純関数（domain、dnd-kit 非依存）+ `SortableFormationRow` 抽出 + 月グループごとの DndContext/SortableContext。dnd-kit は lazy チャンク内に閉じ（ClanBattleTab 15.3→59.9kB、他チャンク影響なし）
- 実装レビュー: 両系統が同一指摘（行 div への `{...attributes}` 展開 → role="button" の nested-interactive 違反 + KeyboardSensor 不在で死んだタブストップ）→ attributes を外し listeners のみに修正。ドラッグ機能への影響なし
- 検証: typecheck / 330テスト / build 全緑。実機で長押しドラッグ・永続化・クリック選択との共存・a11y 属性消失を確認
- レビューで得た保証: 活性化前は5px移動でキャンセルされサイドバースクロールが生きる / ドラッグ成立時は dnd-kit が click を capture で止めるため誤コピーなし / min-w-0 連鎖・ホバーコピー・正規化の順序保持はすべて維持
