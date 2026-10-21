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

## 使い方

```sh
# スナップショットを .master-sync/snapshots/<日本時間の日時>/ に保存する
node scripts/master-sync/fetch.mjs

# 保存先・対象を指定する
node scripts/master-sync/fetch.mjs --out /tmp/snapshots --only formation,attribute
```
