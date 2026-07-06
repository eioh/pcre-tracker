import { describe, expect, it } from "vitest";
import type { CharacterProgress, MasterCharacter } from "../../domain/types";
import { computeRowDerived, type RowDerivedOptions } from "./rowDerived";

// テスト用のマスターキャラデータを生成する。
function buildCharacter(overrides?: Partial<MasterCharacter>): MasterCharacter {
  return {
    name: "ヒヨリ",
    baseName: "ヒヨリ",
    limited: false,
    attribute: "火",
    role: "アタッカー",
    implemented: {
      star6: true,
      ue1: true,
      ue1Sp: true,
      ue2: true,
    },
    memoryPieceSources: ["hard_quest"],
    ...overrides,
  };
}

// テスト用の進捗データを生成する。
function buildProgress(overrides?: Partial<CharacterProgress>): CharacterProgress {
  return {
    owned: true,
    limitBreak: false,
    star: 3,
    connectRank: 1,
    ue1Level: 0,
    ue1SpEquipped: false,
    ue2Level: 0,
    adventureMemoryPieceTarget: false,
    ownedMemoryPiece: 0,
    obtainedDate: null,
    gachaPullCount: 0,
    ...overrides,
  };
}

// テスト用の計算オプションを生成する。
function buildOptions(overrides?: Partial<RowDerivedOptions>): RowDerivedOptions {
  return {
    includeSameBasePurePieceForUe2: false,
    starMemoryCalcMode: "implemented_max",
    ue1MemoryCalcMode: "implemented_max",
    ...overrides,
  };
}

describe("computeRowDerived", () => {
  it("必要メモピの内訳と合計を計算する", () => {
    const derived = computeRowDerived(buildCharacter(), buildProgress({ star: 1 }), 0, 0, buildOptions());

    expect(derived.starRemainingMemoryPiece).toBe(450);
    expect(derived.connectRankRemainingMemoryPiece).toBe(20);
    expect(derived.ue1RemainingMemoryPiece).toBe(620);
    expect(derived.limitBreakRemainingMemoryPiece).toBe(120);
    expect(derived.totalRemainingMemoryPiece).toBe(1210);
    expect(derived.adjustedTotalRemainingMemoryPiece).toBe(1210);
  });

  it("必要メモピ合計は所持メモピを差し引き下限0でクランプする", () => {
    const derived = computeRowDerived(buildCharacter(), buildProgress({ ownedMemoryPiece: 999999 }), 0, 0, buildOptions());

    expect(derived.adjustedTotalRemainingMemoryPiece).toBe(0);
  });

  it("必要ピュアピは同名別衣装の充当設定ONで内訳と合計を計算する", () => {
    const derived = computeRowDerived(
      buildCharacter(),
      buildProgress(),
      10,
      40,
      buildOptions({ includeSameBasePurePieceForUe2: true }),
    );

    expect(derived.star6PurePieceNeed).toBe(50);
    expect(derived.ue2PurePieceNeed).toBe(150);
    expect(derived.sameBasePurePieceUsed).toBe(30);
    expect(derived.star6PurePieceSubtotal).toBe(40);
    expect(derived.ue2PurePieceSubtotal).toBe(110);
    expect(derived.totalPurePieceNeeded).toBe(150);
  });

  it("必要ピュアピは充当設定OFFなら同名別衣装分を使わない", () => {
    const derived = computeRowDerived(buildCharacter(), buildProgress(), 10, 40, buildOptions());

    expect(derived.sameBasePurePieceUsed).toBe(0);
    expect(derived.star6PurePieceSubtotal).toBe(40);
    expect(derived.ue2PurePieceSubtotal).toBe(140);
    expect(derived.totalPurePieceNeeded).toBe(180);
  });

  it("必要ピュアピの各小計は所持分を差し引き下限0でクランプする", () => {
    const derived = computeRowDerived(buildCharacter(), buildProgress(), 220, 220, buildOptions());

    expect(derived.star6PurePieceSubtotal).toBe(0);
    expect(derived.ue2PurePieceSubtotal).toBe(0);
    expect(derived.totalPurePieceNeeded).toBe(0);
  });

  it("最大強化済みの判定とセレクト表示値を計算する", () => {
    const derived = computeRowDerived(
      buildCharacter(),
      buildProgress({ star: 6, connectRank: 15, ue1Level: 370, ue1SpEquipped: true, ue2Level: 5 }),
      0,
      0,
      buildOptions(),
    );

    expect(derived.starMax).toBe(6);
    expect(derived.isStarAtMax).toBe(true);
    expect(derived.isConnectRankAtMax).toBe(true);
    expect(derived.isUe1AtMax).toBe(true);
    expect(derived.isUe2AtMax).toBe(true);
    expect(derived.ue1CompositeValue).toBe("sp");
    expect(derived.ue2Value).toBe("5");
  });

  it("SP未実装キャラの専用1は最大レベル到達で最大強化済みと判定する", () => {
    const character = buildCharacter({
      implemented: { star6: true, ue1: true, ue1Sp: false, ue2: true },
    });
    const derived = computeRowDerived(character, buildProgress({ ue1Level: 370 }), 0, 0, buildOptions());

    expect(derived.isUe1AtMax).toBe(true);
    expect(derived.ue1CompositeValue).toBe("370");
  });

  it("未実装項目は表示値 null・判定 false・ピュアピ未実装として扱う", () => {
    const character = buildCharacter({
      implemented: { star6: false, ue1: false, ue1Sp: false, ue2: false },
    });
    const derived = computeRowDerived(character, buildProgress({ ue1Level: null, ue2Level: null }), 0, 0, buildOptions());

    expect(derived.isPurePieceImplemented).toBe(false);
    expect(derived.starMax).toBe(5);
    expect(derived.isUe1AtMax).toBe(false);
    expect(derived.isUe2AtMax).toBe(false);
    expect(derived.ue1CompositeValue).toBe("null");
    expect(derived.ue2Value).toBe("null");
    expect(derived.star6PurePieceNeed).toBe(0);
    expect(derived.ue2PurePieceNeed).toBe(0);
    expect(derived.totalPurePieceNeeded).toBe(0);
  });
});
