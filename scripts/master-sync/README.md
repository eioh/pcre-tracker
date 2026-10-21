# master-sync（マスターデータ同期）

公開サイトからゲーム共通のマスターデータを取得し、`src/data/` の既存データ全件と比較するためのスクリプト群です。
現在は段階1（読み取り専用）で、マスターデータは書き換えません。

## 構成

| 処理 | 実行場所 | 内容 |
|---|---|---|
| 取得 | GitHub Actions（`.github/workflows/master-sync-fetch.yml`） | `fetch.mjs` で取得元を取得し、非公開リポジトリ `eioh/pcre-tracker-snapshots` の `latest/` に push する |
| 解析・比較・報告 | Claude Code のクラウド環境・ローカル | スナップショットを読み、既存マスターと比較して差分・不足・保留理由を報告する |

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

## 使い方

```sh
# スナップショットを .master-sync/snapshots/<日本時間の日時>/ に保存する
node scripts/master-sync/fetch.mjs

# 保存先・対象を指定する
node scripts/master-sync/fetch.mjs --out /tmp/snapshots --only formation,attribute

# スナップショットを解析・比較し、.master-sync/reports/<日時>/ に report.md と report.json を書く（マスターは書き換えない）
node scripts/master-sync/report.mjs --snapshot ../pcre-tracker-snapshots/latest

# 保存した実ページで解析器を検証する（指定しなければ実ページのテストは省略される）
MASTER_SYNC_SNAPSHOT_DIR=../pcre-tracker-snapshots/latest npx vitest run --project scripts
```
