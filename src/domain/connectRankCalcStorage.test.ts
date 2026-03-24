import { beforeEach, describe, expect, it } from "vitest";
import {
  CONNECT_RANK_CALC_STORAGE_KEY,
  buildDefaultConnectRankCalcState,
  loadConnectRankCalcState,
  parseConnectRankCalcState,
  saveConnectRankCalcState,
} from "./connectRankCalcStorage";

describe("connectRankCalcStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("parseConnectRankCalcState", () => {
    it("正常なJSON文字列をパースできる", () => {
      const raw = JSON.stringify({
        schemaVersion: 1,
        entries: [{ characterName: "ヒヨリ", targetRank: 10 }],
      });
      const result = parseConnectRankCalcState(raw);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({ characterName: "ヒヨリ", targetRank: 10 });
    });

    it("不正なJSON文字列は既定値を返す", () => {
      expect(parseConnectRankCalcState("not json")).toEqual(buildDefaultConnectRankCalcState());
    });

    it("スキーマ不一致は既定値を返す", () => {
      expect(parseConnectRankCalcState('{"schemaVersion":2}')).toEqual(buildDefaultConnectRankCalcState());
    });

    it("targetRankが範囲外の場合は既定値を返す", () => {
      const raw = JSON.stringify({
        schemaVersion: 1,
        entries: [{ characterName: "ヒヨリ", targetRank: 20 }],
      });
      expect(parseConnectRankCalcState(raw)).toEqual(buildDefaultConnectRankCalcState());
    });
  });

  describe("loadConnectRankCalcState / saveConnectRankCalcState", () => {
    it("保存した状態を読み込める", () => {
      const state = {
        schemaVersion: 1 as const,
        entries: [{ characterName: "ペコリーヌ", targetRank: 15 }],
      };
      saveConnectRankCalcState(state);
      expect(loadConnectRankCalcState()).toEqual(state);
    });

    it("未保存時は既定値を返す", () => {
      expect(loadConnectRankCalcState()).toEqual(buildDefaultConnectRankCalcState());
    });

    it("不正なデータが保存されていても既定値にフォールバックする", () => {
      window.localStorage.setItem(CONNECT_RANK_CALC_STORAGE_KEY, "invalid");
      expect(loadConnectRankCalcState()).toEqual(buildDefaultConnectRankCalcState());
    });
  });
});
