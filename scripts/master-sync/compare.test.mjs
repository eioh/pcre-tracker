// 比較・判定規則のテスト。誤った false 化・削除の提案が出ないことを中心に確かめる。
import { describe, expect, it } from "vitest";
import { classifyDate, compareWithMaster, eventKey, resolveName } from "./compare.mjs";

const TODAY = "2026-10-21";

// マスターのキャラを作る。
function character(name, overrides = {}) {
  return {
    name,
    baseName: name.replace(/（.*）$/, ""),
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
    ...overrides,
  };
}

// 実装日一覧の解析結果の 1 行を作る。
function row(name, overrides = {}) {
  return {
    rowIndex: 1,
    baseName: name,
    version: null,
    linkName: name,
    initialStar: "☆☆☆",
    position: "中衛",
    attackType: "物理",
    attribute: "火",
    role: "アタッカー",
    acquisition: "ガチャ(恒常)",
    note: "",
    dates: { character: "2020/01/01", ue1: "", ue1Sp: "", ue2: "", star6: "" },
    ...overrides,
  };
}

/**
 * 比較の入力一式を作る。characters・rows などを差し替えて各規則を確かめる。
 * @param {{ characters?: any[], rows?: any[], formation?: string[], masterOrder?: string[], attribute?: Record<string, string[]>,
 *   role?: Record<string, string[]>, hardQuest?: Record<string, string>, hardStages?: any[], veryHardStages?: any[],
 *   sideStory?: any[], events?: any[] }} [options]
 */
function input(options = {}) {
  const characters = options.characters ?? [character("A"), character("B")];
  const names = characters.map((entry) => entry.name);
  const rows = options.rows ?? names.map((name) => row(name));
  const listed = rows.map((entry) => entry.linkName ?? entry.baseName);
  return {
    master: {
      characters,
      formationOrder: options.masterOrder ?? names,
      hardQuest: options.hardQuest ?? {},
      sideStory: options.sideStory ?? [],
      coinShop: {},
    },
    parsed: {
      implementation: { lastModified: null, rows },
      formation: { lastModified: null, sections: [], ordered: options.formation ?? names },
      attribute: { lastModified: null, byCategory: new Map(Object.entries(options.attribute ?? { 火: listed })) },
      role: { lastModified: null, byCategory: new Map(Object.entries(options.role ?? { アタッカー: listed })) },
      hardQuests: [{ sourceId: "hard-h81", page: { title: "HARD", lastModified: null, stages: options.hardStages ?? [] } }],
      veryHardQuests: [{ sourceId: "very-hard-vh68", page: { title: "VH", lastModified: null, stages: options.veryHardStages ?? [] } }],
      eventPieces: { lastModified: null, events: options.events ?? [] },
    },
    urls: {},
    aliases: {},
    today: TODAY,
  };
}

describe("classifyDate", () => {
  it("今日より前は実装済み、今日は再確認、未来・予定は未実装、空欄は不明とする", () => {
    expect(classifyDate("2026/10/20", TODAY)).toEqual({ status: "released", date: "2026-10-20" });
    expect(classifyDate("2026/10/21", TODAY).status).toBe("today");
    expect(classifyDate("2026/10/22", TODAY).status).toBe("planned");
    expect(classifyDate("2026/近日予定", TODAY).status).toBe("planned");
    expect(classifyDate("", TODAY).status).toBe("unknown");
    expect(classifyDate("2025/08/16(前倒し追加)", TODAY)).toEqual({ status: "released", date: "2025-08-16" });
    expect(classifyDate("近いうち", TODAY).status).toBe("unparseable");
  });
});

describe("名前とイベント名の照合", () => {
  it("別名表を優先し、なければ全角カッコに正規化する", () => {
    expect(resolveName("アメス(ガンナー)", {})).toBe("アメス（ガンナー）");
    expect(resolveName("ペコ", { ペコ: "ペコリーヌ" })).toBe("ペコリーヌ");
  });

  it("イベント名は空白とふりがなのカッコ書きを無視して照合する", () => {
    expect(eventKey("授けの財団(エンジェル)と聖なる学舎の異端児", null)).toBe(eventKey("授けの財団と聖なる学舎の異端児", null));
    expect(eventKey("Re:member　僕の願いが紡ぐ未来", "後編")).toBe(eventKey("Re:member　僕の願いが紡ぐ未来 後編", null));
  });
});

describe("compareWithMaster", () => {
  it("差分がなければ候補も保留も出さない", () => {
    const result = compareWithMaster(input());
    expect(result).toMatchObject({ globalHoldReasons: [], proposals: [], holds: [] });
  });

  it("実装日が今日以前なら false→true を候補にし（当日は印を付ける）、マスターが true で一覧が空欄・未来なら false 化を提案せず保留にする", () => {
    const characters = [
      character("A"),
      character("B", { implemented: { star6: true, ue1: true, ue1Sp: false, ue2: false } }),
    ];
    const rows = [
      row("A", { dates: { character: "2020/01/01", ue1: "2026/10/01", ue1Sp: "2026/10/30", ue2: "2026/10/21", star6: "" } }),
      row("B", { dates: { character: "2020/01/01", ue1: "", ue1Sp: "", ue2: "", star6: "2026/11/01" } }),
    ];
    const { proposals, holds } = compareWithMaster(input({ characters, rows }));
    expect(proposals.map((finding) => [finding.target, finding.kind, finding.after, finding.sameDay ?? false])).toEqual([
      ["A", "専用1を実装済みにする", true, false],
      ["A", "専用2を実装済みにする", true, true],
    ]);
    expect(proposals[1].detail).toContain("当日");
    expect(proposals.some((finding) => finding.after === false)).toBe(false);
    expect(holds.map((finding) => [finding.target, finding.kind])).toEqual([
      ["B", "専用1: マスターは実装済みだが一覧では未確認"],
      ["B", "★6: マスターは実装済みだが一覧では未確認"],
    ]);
  });

  it("一覧に見つからない既存キャラは削除を提案せず保留にする", () => {
    const { proposals, holds } = compareWithMaster(input({ rows: [row("A")], formation: ["A", "B"] }));
    expect(proposals).toEqual([]);
    expect(holds.map((finding) => finding.kind)).toEqual(["実装日一覧に見つからない既存キャラ"]);
  });

  it("新キャラは実装済みで属性・ロールが複数の取得元で一致し、編成順に挿入だけで入る場合に候補にする", () => {
    const rows = [row("A"), row("B"), row("C", { acquisition: "ガチャ(期間限定)", dates: { character: "2026/10/09", ue1: "", ue1Sp: "", ue2: "", star6: "" } })];
    const { proposals, holds } = compareWithMaster(input({ rows, formation: ["A", "C", "B"] }));
    expect(holds).toEqual([]);
    expect(proposals.map((finding) => finding.kind)).toEqual(["新キャラ追加", "編成順に挿入"]);
    expect(proposals[0].after).toMatchObject({ name: "C", limited: true, attribute: "火", role: "アタッカー" });
    expect(proposals[1].after).toEqual({ insertAfter: "A", insertBefore: "B" });
  });

  it("新キャラの属性が取得元どうしで食い違えば保留にし、実装日が未来なら参考に回す", () => {
    const rows = [
      row("A"),
      row("B"),
      row("C", { attribute: "水", dates: { character: "2026/10/09", ue1: "", ue1Sp: "", ue2: "", star6: "" } }),
      row("D", { linkName: null, dates: { character: "2026/10/31", ue1: "", ue1Sp: "", ue2: "", star6: "" } }),
    ];
    const result = compareWithMaster(input({ rows, formation: ["A", "B", "C"], attribute: { 火: ["A", "B", "C"] } }));
    expect(result.proposals).toEqual([]);
    expect(result.holds.map((finding) => [finding.target, finding.kind])).toEqual([
      ["C", "新キャラ追加"],
      ["C", "編成順に挿入"],
    ]);
    expect(result.holds[0].detail).toMatch(/属性が一致しない/);
    expect(result.notes.filter((finding) => finding.area === "キャラ").map((finding) => [finding.target, finding.kind])).toEqual([["D", "未実装（予定）"]]);
  });

  it("既存キャラの相対順が変わったら並び替えとして保留にし、挿入も候補にしない", () => {
    const characters = [character("A"), character("B"), character("C")];
    const rows = [row("A"), row("B"), row("C"), row("D", { dates: { character: "2026/10/09", ue1: "", ue1Sp: "", ue2: "", star6: "" } })];
    const { proposals, holds } = compareWithMaster(input({ characters, rows, formation: ["B", "A", "D", "C"] }));
    expect(proposals.map((finding) => finding.kind)).toEqual(["新キャラ追加"]);
    expect(holds.map((finding) => finding.kind)).toEqual(["既存キャラの並び替え", "編成順に挿入"]);
  });

  it("HARD の新ステージは候補にし、既存ステージの不一致は保留、VH のピュアメモリーピースは HARD として扱わない", () => {
    const hardStages = [
      { stage: "81-1", stagePrefix: "H", pieceKind: "memory", characters: ["A"], implemented: true, heading: "H81-1" },
      { stage: "81-2", stagePrefix: "H", pieceKind: "memory", characters: ["B"], implemented: true, heading: "H81-2" },
      { stage: "82-1", stagePrefix: "H", pieceKind: "memory", characters: ["A"], implemented: false, heading: "H82-1 (以下未実装)" },
      { stage: "68-1", stagePrefix: "VH", pieceKind: "pure", characters: ["B"], implemented: true, heading: "VH68-1" },
    ];
    const { proposals, holds, notes } = compareWithMaster(
      input({ hardQuest: { "81-1": "B" }, hardStages, veryHardStages: [hardStages[3]] }),
    );
    expect(proposals.map((finding) => [finding.target, finding.kind, finding.after])).toEqual([["81-2", "HARD ステージを追加", "B"]]);
    expect(holds.map((finding) => [finding.target, finding.kind])).toEqual([
      ["81-1", "既存ステージのキャラが異なる"],
      ["VH68-1", "HARD ページに HARD 以外の表"],
    ]);
    expect(notes.map((finding) => finding.kind)).toEqual(["未実装のステージ", "VH（ピュアメモリーピース）は照合のみ"]);
  });

  it("サイドストーリーは追加日が過去の未登録イベントを候補にし、分割なしで登録済みのイベントや不一致は保留・照合に回す", () => {
    const sideStory = [
      { event: "絆、つないで。こころ、結んで。", characters: ["A", "B"] },
      { event: "古いイベント", characters: ["A", "ぺー"] },
    ];
    const events = [
      { event: "絆、つないで。こころ、結んで。", part: "前編", pieces: ["A", "B"], sideStoryAdded: "2022/11/17", section: "" },
      { event: "絆、つないで。こころ、結んで。", part: "後編", pieces: ["A", "B"], sideStoryAdded: "2022/11/17", section: "" },
      { event: "古いイベント", part: null, pieces: ["A", "B"], sideStoryAdded: "2020/01/01", section: "" },
      { event: "新しいイベント", part: null, pieces: ["B", "A"], sideStoryAdded: "2026/10/16", section: "" },
      { event: "未来のイベント", part: null, pieces: ["A", "B"], sideStoryAdded: "", section: "" },
    ];
    const { proposals, holds } = compareWithMaster(input({ sideStory, events }));
    expect(proposals.map((finding) => [finding.target, finding.after])).toEqual([
      ["新しいイベント", { event: "新しいイベント", characters: ["B", "A"], sideStoryAdded: "2026-10-16", insertBefore: null }],
    ]);
    expect(holds.map((finding) => [finding.target, finding.kind])).toEqual([["古いイベント", "対象キャラの不一致"]]);
  });

  it("確認済みの限定区分の差分は参考に回し、マスターの値か入手手段が変われば再び保留にする", () => {
    const acknowledged = {
      limited: [{ name: "A", masterValue: false, acquisition: "イベント限定", reason: "配布キャラ" }],
      formationOrder: [],
    };
    const rows = [row("A", { acquisition: "イベント限定" }), row("B", { acquisition: "イベント限定" })];
    const result = compareWithMaster({ ...input({ rows }), acknowledged });
    expect(result.holds.map((finding) => [finding.target, finding.kind])).toEqual([["B", "限定区分の不一致"]]);
    expect(result.notes.filter((finding) => finding.area === "限定区分").map((finding) => finding.target)).toEqual(["A"]);
    const changed = compareWithMaster({ ...input({ rows: [row("A", { acquisition: "ガチャ(期間限定)" }), row("B")] }), acknowledged });
    expect(changed.holds.map((finding) => [finding.target, finding.kind])).toEqual([["A", "限定区分の不一致"]]);
  });

  it("確認済みの編成順のキャラは並び替えの判定と挿入位置の基準から外す", () => {
    const characters = [character("A"), character("B"), character("C")];
    const rows = [row("A"), row("B"), row("C"), row("D", { dates: { character: "2026/10/09", ue1: "", ue1Sp: "", ue2: "", star6: "" } })];
    const acknowledged = { limited: [], formationOrder: [{ name: "C", reason: "マスターが正しい" }] };
    // wiki では C が先頭に動き、新キャラ D は C の直後にある。C を基準にせず A の後ろ・B の前に挿入する。
    const result = compareWithMaster({ ...input({ characters, rows, formation: ["C", "A", "D", "B"] }), acknowledged });
    expect(result.holds).toEqual([]);
    expect(result.proposals.map((finding) => [finding.kind, finding.after])).toEqual([
      ["新キャラ追加", expect.objectContaining({ name: "D" })],
      ["編成順に挿入", { insertAfter: "A", insertBefore: "B" }],
    ]);
  });

  it("既存キャラの属性は、取得元どうしが一致していても変更候補にせず保留にする", () => {
    const rows = [row("A", { attribute: "水" }), row("B")];
    const { proposals, holds } = compareWithMaster(input({ rows, attribute: { 水: ["A"], 火: ["B"] } }));
    expect(proposals).toEqual([]);
    expect(holds.map((finding) => [finding.target, finding.kind])).toEqual([["A", "属性の不一致"]]);
    expect(holds[0].detail).toContain("取得元どうしは一致");
  });

  it("追加するサイドストーリーは、既存イベントの追加日をもとに挿入位置を決める", () => {
    const sideStory = [
      { event: "一", characters: ["A", "B"] },
      { event: "三", characters: ["A", "B"] },
    ];
    const events = [
      { event: "一", part: null, pieces: ["A", "B"], sideStoryAdded: "2025/01/16", section: "" },
      { event: "二", part: null, pieces: ["B", "A"], sideStoryAdded: "2025/03/17", section: "" },
      { event: "三", part: null, pieces: ["A", "B"], sideStoryAdded: "2025/04/16", section: "" },
    ];
    const { proposals } = compareWithMaster(input({ sideStory, events }));
    expect(proposals.map((finding) => finding.after)).toEqual([{ event: "二", characters: ["B", "A"], sideStoryAdded: "2025-03-17", insertBefore: "三" }]);
  });

  it("キャラ実装日・サイドストーリー追加日が当日なら候補にし、当日の印を付ける", () => {
    const rows = [row("A"), row("B"), row("C", { dates: { character: "2026/10/21", ue1: "", ue1Sp: "", ue2: "", star6: "" } })];
    const events = [{ event: "今日のイベント", part: null, pieces: ["A", "B"], sideStoryAdded: "2026/10/21", section: "" }];
    const { proposals } = compareWithMaster(input({ rows, formation: ["A", "C", "B"], events }));
    expect(proposals.map((finding) => [finding.kind, finding.target, finding.sameDay ?? false])).toEqual([
      ["新キャラ追加", "C", true],
      ["編成順に挿入", "C", false],
      ["サイドストーリーを追加", "今日のイベント", true],
    ]);
  });

  it("取得件数が既存より大きく少なければ全体保留にし、候補をすべて保留へ移す", () => {
    const characters = Array.from({ length: 20 }, (_, index) => character(`C${index}`));
    const rows = [...characters.slice(0, 5).map((entry) => row(entry.name)), row("新", { dates: { character: "2026/10/01", ue1: "", ue1Sp: "", ue2: "", star6: "" } })];
    const result = compareWithMaster(input({ characters, rows }));
    expect(result.globalHoldReasons[0]).toMatch(/実装日一覧の件数（6）が既存（20）を大きく下回っています/);
    expect(result.proposals).toEqual([]);
  });
});
