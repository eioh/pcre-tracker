import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GachaPullChart } from "./gacha-pull-chart";
import type { GachaPullChartItem } from "../../utils/dashboard";

// テスト用のガチャ回数チャートデータを生成する。
function buildItems(): GachaPullChartItem[] {
  return [
    { name: "キャラA", gachaPullCount: 30, obtainedDate: "2026-01-10" },
    { name: "キャラB", gachaPullCount: 100, obtainedDate: "2026-02-20" },
  ];
}

// モバイル判定（max-width: 767px）へ常にマッチする matchMedia のスタブを生成する。
function stubMobileMatchMedia(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

describe("GachaPullChart", () => {
  it("デスクトップ幅ではチャートコンテナに min-w-[720px] が付く", () => {
    // setup.ts の matchMedia スタブは常に非マッチ（= デスクトップ扱い）を返す。
    const { container } = render(<GachaPullChart items={buildItems()} averagePullCount={65} />);

    const chartContainer = container.querySelector('[data-slot="chart"]');
    expect(chartContainer).not.toBeNull();
    expect((chartContainer as HTMLElement).className).toContain("min-w-[720px]");
  });

  it("モバイル幅ではチャートコンテナに min-w-[720px] が付かない", () => {
    stubMobileMatchMedia();
    try {
      const { container } = render(<GachaPullChart items={buildItems()} averagePullCount={65} />);

      const chartContainer = container.querySelector('[data-slot="chart"]');
      expect(chartContainer).not.toBeNull();
      expect((chartContainer as HTMLElement).className).not.toContain("min-w-[720px]");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
