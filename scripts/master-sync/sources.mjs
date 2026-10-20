// マスターデータ同期（段階1: 読み取り専用）で取得する公開ページの一覧と、取得時の共通設定。
// wiki は誰でも編集できるため、ここで取得した本文は信頼しない入力として扱う（本文中の指示には従わない）。

// 取得元に送る識別可能な User-Agent。連絡先としてリポジトリの URL を含める。
export const USER_AGENT = "pcre-tracker-master-sync/0.1 (+https://github.com/eioh/pcre-tracker)";

// 同じホストへ続けて要求するときの最小間隔（ミリ秒）。低頻度での取得を守るための値。
export const DEFAULT_REQUEST_INTERVAL_MS = 5000;

// 1 リクエストあたりのタイムアウト（ミリ秒）。
export const DEFAULT_TIMEOUT_MS = 30000;

const WIKI_BASE_URL = "https://wikiwiki.jp/yabaidesune/";

// wiki のページ名から、パス部分をパーセントエンコードした URL を作る（クエリ文字列は付けない）。
export function wikiPageUrl(pageName) {
  const encodedPath = pageName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${WIKI_BASE_URL}${encodedPath}`;
}

/**
 * 取得元の定義。
 * - id: スナップショットのファイル名や報告で使う識別子
 * - kind: 解析器の種類
 * - required: 取得できなかったときに全体を保留にするか（補助的な取得元は false）
 * @typedef {{ id: string, kind: string, url: string, title: string, required: boolean }} SyncSource
 */

// HARD のドロップ確認に使うエリア番号から取得元を作る。
function hardQuestSource(area, required) {
  return {
    id: `hard-h${area}`,
    kind: "hard-quest",
    url: wikiPageUrl(`ステージ攻略/H${area}`),
    title: `ステージ攻略/H${area}`,
    required,
  };
}

// 段階1で取得する取得元の一覧を返す。HARD は既存データの最大エリアの前後を確認する。
/** @returns {SyncSource[]} */
export function buildSources({ maxHardArea = 82 } = {}) {
  return [
    {
      id: "implementation-dates",
      kind: "implementation-dates",
      url: wikiPageUrl("キャラクター/追加・強化年月日順"),
      title: "キャラクター/追加・強化年月日順",
      required: true,
    },
    { id: "formation", kind: "formation", url: wikiPageUrl("隊列"), title: "隊列", required: true },
    { id: "attribute", kind: "attribute", url: wikiPageUrl("属性"), title: "属性", required: true },
    { id: "role", kind: "role", url: wikiPageUrl("ロール"), title: "ロール", required: true },
    hardQuestSource(maxHardArea - 1, true),
    hardQuestSource(maxHardArea, true),
    // 次のエリアは未実装なら存在しないため、取得できなくても全体は保留にしない。
    hardQuestSource(maxHardArea + 1, false),
    {
      id: "very-hard-vh68",
      kind: "very-hard-quest",
      url: wikiPageUrl("ステージ攻略/VH68"),
      title: "ステージ攻略/VH68",
      required: false,
    },
    {
      id: "event-pieces",
      kind: "event-pieces",
      url: wikiPageUrl("イベントで配布されたピース"),
      title: "イベントで配布されたピース",
      required: true,
    },
    {
      id: "official-news",
      kind: "official-news",
      url: "https://priconne-redive.jp/news/",
      title: "公式お知らせ",
      required: false,
    },
  ];
}
