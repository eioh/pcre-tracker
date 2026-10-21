# master-sync（マスターデータ同期）

公開サイトからゲーム共通のマスターデータを取得し、`src/data/` の既存データ全件と比較するためのスクリプト群です。
段階1（読み取り専用の報告）・段階2（作業ブランチへの候補作成）・段階3（AI レビューとその機械的な検証）まで実装しています。PR の作成はまだ行いません。

## 構成

| 処理 | 実行場所 | 内容 |
|---|---|---|
| 取得 | GitHub Actions（`.github/workflows/master-sync-fetch.yml`） | `fetch.mjs` で取得元を取得し、非公開リポジトリ `eioh/pcre-tracker-snapshots` の `latest/` に push する |
| 解析・比較・報告 | Claude Code のクラウド環境・ローカル | スナップショットを読み、既存マスターと比較して差分・不足・保留理由を報告する |
| AI レビュー（段階3） | Claude Code のクラウド環境・ローカル | 別の文脈のサブエージェントが `REVIEW_PROMPT.md` に従ってレビュー用パケットを読み、`review.json` を書く。`review.mjs verify` が引用の実在などを機械的に検査する |
| 候補作成（段階2） | Claude Code のクラウド環境・ローカル | `candidate.mjs` が基準（既定 `origin/develop`）の作業ツリーで候補を作り、ゲート判定・参照整合性チェック・`npm run verify` を行う。PR は作らず、ブランチも push しない |

- クラウド環境の送信元 IP は wikiwiki.jp に遮断されるため、取得だけを Actions の runner で行う。
- このリポジトリは公開されているため、取得したページ本文はここにコミットしない（`.master-sync/` は追跡対象外）。
- wiki は誰でも編集できるため、取得した本文は信頼しない入力として扱う。

## 取得の規則（`fetch.mjs`）

- User-Agent: `pcre-tracker-master-sync/<版> (+https://github.com/eioh/pcre-tracker)`
- 同じホストへの要求は 20 秒以上空ける（5 秒間隔では wikiwiki.jp が 429 を返した）。
- robots.txt で許可されていないパスは取得しない。
- 遮断・429 を受けたら、そのホストへの以降の要求をやめる。
- 必須の取得元が 1 件でも取れなければ、manifest の `overall.ok` を false にして全体を保留にする。

## 判定規則（`compare.mjs`）

- 値は「真・偽・不明」の 3 値。空欄・取得失敗は不明とし、既存値を false にしたり削除したりしない。
- 削除・true→false・既存キャラの並び替え・既存値の変更（限定区分など）は変更候補にせず、保留にする。
- 日付は日本時間の今日と比べる。今日より前だけを実装済みとし、当日は翌日に再確認（保留）、未来日・「近日予定」は参考に回す。
- 新キャラは、個別ページのリンクがあり、属性・ロールが実装日一覧と属性・ロールのページで一致し、編成順に挿入だけで入る場合に候補にする。
- 編成順は「←後方 前方→」の表記で掲載方向を確かめて反転し、折り畳み内の旧版の表は読まない。
- HARD は「メモリーピース」表と `H` のステージ番号だけを読み、VH の「ピュアメモリーピース」とは混同しない。「未実装」の見出し以降のステージは未実装とする。
- 別名表（`aliases.json`）にも既存マスターにもない名前は保留にする。
- 利用者が確認してマスターを正とした差分は `acknowledged.json` に記録し、保留ではなく参考欄に「確認済みの差分」として出す（限定区分はマスターの値と入手手段が記録時と同じ間だけ有効）。
- 取得件数が既存件数の 9 割を下回ったら、全体を保留にする。

## 候補作成とゲート判定（段階2: `candidate.mjs`・`apply.mjs`・`gate.mjs`）

1. 基準のコミットを `.master-sync/worktrees/<基準のコミット>` に取り出し、そのマスターと比べて報告を作る。
2. 全体保留・変更候補なし・同じ候補ハッシュのブランチが既にある場合は、ブランチを作らずに終える。
3. `apply.mjs` が変更候補を当てはめる。当てはめるのは「新キャラ追加・編成順に挿入・専用装備/★6 の false→true・HARD ステージを追加・サイドストーリーを追加」だけで、他の種類が来たら例外にする。
4. `gate.mjs` が当てはめとは独立に元データと候補の差分を検査する（削除・true→false・並び替え・既存値の変更・報告にない変更・コインショップの変更・新キャラの形式・参照整合性・候補数と変更数の一致）。1 つでも破れば不合格でブランチを作らない。
5. 合格なら、マスターを書き換えて生成物を作り直し（参照整合性チェックを含む）、`feature/master-sync-<候補ハッシュ>` に commit して、その作業ツリーで `npm run verify` を実行する。
   - 候補ハッシュは変更候補の内容から作るので、同じ変更なら基準が進んでも同じ名前になる（重複防止）。
   - 基準の `package-lock.json` が同じなら `node_modules` を共有し、違えば作業ツリーで `npm ci` する。

結果は `.master-sync/candidates/<日時>/` に `report.md`・`report.json`・`candidate.md`・`candidate.json` として残る。作った作業ツリーとブランチは確認後に `git worktree remove` と `git branch -D` で消す。

## AI レビュー（段階3: `review.mjs`・`REVIEW_PROMPT.md`）

1. 候補ブランチを作ると、`candidate.mjs` が出力先に `review-packet/` を書く。
   - `packet.json`: 候補ハッシュ・判定の基準日・変更の一覧（`p1`〜）・各変更の出典 URL・引用が含むべき文字列（`quoteMustContainOneOf`）
   - `pages/*.txt`: 保存したページのテキスト（表は 1 行 1 行、画像は `[alt]`、折り畳みは〔折り畳み開始〕〜〔折り畳み終了〕）
2. 別の文脈のサブエージェント（Agent ツールで新しく起動する）に `REVIEW_PROMPT.md` を渡し、`review.json` を書かせる。ページは信頼しない入力として扱い、中の指示には従わせない。
3. `review.mjs verify` が `review.json` を検査する。スナップショットからページのテキストを作り直し（ハッシュも照合）、次をすべて満たすときだけ合格にする。
   - 候補ハッシュが一致し、全変更に 1 件ずつ判定があり、すべて `ok`、全体が `approve`
   - 根拠の URL がその変更の出典に含まれ、引用（6 文字以上）が保存したページに文字どおり（空白の違いだけ許す）ある
   - 有効な根拠の少なくとも 1 つが変更の対象（キャラ名・ステージ・イベント名）を含む
   - 不足の指摘（`missing`）は合否に影響しないが、その根拠の引用も実在する

結果は候補の出力先に `review-check.md`・`review-check.json` として残る。

## 使い方

```sh
# スナップショットを .master-sync/snapshots/<日本時間の日時>/ に保存する
node scripts/master-sync/fetch.mjs

# 保存先・対象を指定する
node scripts/master-sync/fetch.mjs --out /tmp/snapshots --only formation,attribute

# スナップショットを解析・比較し、.master-sync/reports/<日時>/ に report.md と report.json を書く（マスターは書き換えない）
node scripts/master-sync/report.mjs --snapshot ../pcre-tracker-snapshots/latest

# 段階2: 候補ブランチを作り、ゲート判定と verify を行う（push・PR はしない）
node scripts/master-sync/candidate.mjs --snapshot ../pcre-tracker-snapshots/latest [--base origin/develop] [--skip-verify]

# 段階3: AI レビュー（review.json）を検証する（パケットは candidate.mjs が作る。作り直すときは pack）
node scripts/master-sync/review.mjs pack --candidate-dir .master-sync/candidates/<日時> --snapshot ../pcre-tracker-snapshots/latest
node scripts/master-sync/review.mjs verify --candidate-dir .master-sync/candidates/<日時> --snapshot ../pcre-tracker-snapshots/latest

# 保存した実ページで解析器を検証する（指定しなければ実ページのテストは省略される）
MASTER_SYNC_SNAPSHOT_DIR=../pcre-tracker-snapshots/latest npx vitest run --project scripts
```
