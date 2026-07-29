# クラバト編成コピー機能 実装計画

## 背景・確定要件

左サイドバーの編成名にホバーするとコピーアイコンが出現し、クリックでその編成（TL 含む）の完全な複製を追加する。

- 複製対象: 編成名・与ダメージ・TL(timeline 文字列)・メンバー全員（キャラ名・サポート指定・育成スナップショット）
- 編成名は元の名前 + 「 (コピー)」（連番管理はしない。再コピーは「... (コピー) (コピー)」で可）
- 追加位置: **同じ月グループの末尾**（formations 配列に push）
- コピー後は**コピー先の編成を選択状態**にする（新規追加時の既存挙動と一致）
- ID は編成 `createClanBattleId("cbf")`・メンバー `createClanBattleId("cbp")` で全て新規採番
- タッチ端末（hover 非対応環境）ではアイコンを常時表示
- 永続化・同期は既存の `onChange` → `handleUpdateClanBattle` 経路に乗るのみ（追加実装なし）

## 変更ファイル

### 1. `src/domain/clanBattle.ts` — 複製ロジック

`createClanBattleFormation` の近くに追加:

```ts
// 既存編成の完全な複製を新規IDで作成する（TL・ダメージ・メンバー含む）。
export function duplicateClanBattleFormation(formation: ClanBattleFormation): ClanBattleFormation {
  return {
    ...formation,
    id: createClanBattleId("cbf"),
    name: `${formation.name} (コピー)`,
    members: formation.members.map((member) => ({ ...member, id: createClanBattleId("cbp") })),
  };
}
```

- メンバーのフィールドは全てプリミティブなので spread で十分（ネスト構造なし）
- メンバー並びは元の配列順を保持（元が `sortClanBattleMembers` 済みなのでそのまま整合）

### 2. `src/components/ClanBattleTab.tsx` — UI とハンドラ

#### 行マークアップの組み替え（382-395 行付近）

現状は編成行全体が単一 `<button>`。ボタンのネストは HTML 不正なので、行を「コンテナ div + 選択ボタン + コピーボタン」の横並びに組み替える:

- コンテナ `div`: `group flex items-center` + 既存の枠線/背景/選択スタイル（`rounded-[8px] border transition` と選択時 `border-accent bg-selected text-main` / 非選択時 `border-white/10 bg-black/20 text-muted` の分岐）をここへ移す
- ホバー時の色変化（`hover:border-accent/60 hover:text-main`）もコンテナ側へ
- 選択ボタン: `flex-1 min-w-0 px-3 py-2 text-left text-sm` + `<span className="block truncate font-semibold">`。`onClick={() => setSelectedFormationId(formation.id)}` は現状のまま
- コピーボタン: 既存 `Button` コンポーネント（variant="ghost" size="sm"）+ lucide `Copy` アイコン（`size-4`）。`aria-label={`${formation.name}をコピー`}`。月グループ削除ボタンと同様に `max-md:min-h-11 max-md:min-w-11` でタップ領域を確保

#### ホバー出現の実装

このコードベース初出のパターン。Tailwind の `group` を使う:

- hover 対応環境でのみ隠す: コピーボタンに `[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity`
- hover 非対応（タッチ）環境ではデフォルト表示（opacity-100 のまま）になる
- キーボード操作でもフォーカス時に見えるよう `focus-visible:opacity-100`（または `group-focus-within:opacity-100`）を付ける
- ※ Tailwind のバージョンで `pointer-coarse:`/`pointer-fine:` バリアントが使えるなら arbitrary variant の代わりにそちらを使ってよい（実装時に package.json を確認）

#### ハンドラ追加

`handleAddFormation` の近くに:

```ts
const handleCopyFormation = (groupId: string, formationId: string) => {
  // 対象グループの formations から formationId を探し duplicateClanBattleFormation で複製、末尾に push
  // onChange({ groups: ... }) 後に setSelectedFormationId(複製のid)
};
```

- コピーボタンは選択ボタンの兄弟要素なので stopPropagation は不要。ただし実装後に選択が誤発火しないことをテストで確認する

### 3. テスト

#### domain テスト（`src/domain/clanBattle.test.ts` 相当。既存テストファイルの配置に合わせる）

- `duplicateClanBattleFormation`: 編成 ID・全メンバー ID が元と異なること / name に「 (コピー)」が付くこと / timeline・damage・メンバー内容（characterName, support, スナップショット値）が一致すること / 元オブジェクトが変異しないこと

#### `src/components/ClanBattleTab.test.tsx`（既存に追記）

- コピーボタンをクリック → onChange に渡る state で対象グループ末尾に複製編成が追加されている
- 複製編成が選択状態になる（詳細パネルに複製編成の名前/TL が表示される等、既存テストの検証手法に合わせる）
- コピーボタンのクリックで元編成の選択に化けないこと

## 実装ステップ

- [x] 1. `git fetch origin` → `git switch -c feature/formation-copy origin/develop`（規約: feature → develop → main）
- [x] 2. domain 実装 + domain テスト
- [x] 3. UI 実装（行組み替え + ホバー出現 + ハンドラ）+ コンポーネントテスト
- [x] 4. `npm run typecheck` / `npm test` / `npm run build` を全て通す
- [x] 5. codex + Claude の2系統レビュー → 両系統とも致命的指摘ゼロ。Low 指摘（transition-opacity の tailwind-merge 打ち消し・クラス簡素化・複数グループテスト）を修正し、codex 再レビューでも致命的指摘ゼロ
- [x] 6. ブラウザ実画面で受け入れ確認（コピー動作・末尾追加・選択遷移・TL複製・永続化を実機確認。ホバー出現 CSS も computed style で確認）
- [ ] 7. Conventional Commits でコミット → PR 作成（base: develop、既存 PR の体裁に合わせる）

## スコープ外

- コピー名の連番管理（「(コピー2)」等）
- 月グループをまたぐコピー・移動
- 編成の並び替え UI

## レビュー（結果）

計画どおり実装完了。ブランチ `feature/formation-copy`（origin/develop 基点）、変更4ファイル + tasks/todo.md。

- `clanBattle.ts`: `duplicateClanBattleFormation` を追加（編成ID・全メンバーID新規採番、名前に「 (コピー)」付加。メンバーはプリミティブのみなので spread で十分）
- `ClanBattleTab.tsx`: 編成行を「コンテナ div + 選択ボタン + コピーボタン」に組み替え（ボタンネスト回避）。ホバー出現は `[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100`（Tailwind v4 では group-hover 自体が hover メディアでラップされるため簡素化。タッチ端末は常時表示）。`handleCopyFormation` は `updateClanBattle` 経由で末尾 push + 複製先を選択
- テスト: domain 4本（ID採番・名前付加・内容一致・非変異）+ コンポーネント3本（末尾追加・選択遷移・複数グループのルーティング）
- 検証: typecheck / test（40ファイル325テスト）/ build 全緑。実機で複製・TL コピー・選択遷移・localStorage 永続化・ホバー出現 CSS を確認
- レビュー: codex（gpt-5.6-sol、計画1回+実装2回）+ Claude Opus サブエージェントの全パスで致命的指摘ゼロ。実装レビューの Low 指摘（`transition-opacity` が tailwind-merge で base `transition` を打ち消しホバーアニメーションが消える件）を修正済み
