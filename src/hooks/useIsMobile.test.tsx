import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./useIsMobile";

// マッチ状態を外部から切り替えられる matchMedia のモックを生成する。
function createMatchMediaMock(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(max-width: 767px)",
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  return {
    matchMedia: vi.fn().mockReturnValue(mediaQueryList),
    // マッチ状態を変更し、購読中のリスナーへ change イベントを通知する。
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) {
        listener({ matches: next, media: "(max-width: 767px)" } as MediaQueryListEvent);
      }
    },
    listeners,
  };
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("768px 未満にマッチしている場合は true を返す", () => {
    const mock = createMatchMediaMock(true);
    vi.stubGlobal("matchMedia", mock.matchMedia);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(mock.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("768px 以上の場合は false を返す", () => {
    const mock = createMatchMediaMock(false);
    vi.stubGlobal("matchMedia", mock.matchMedia);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it("メディアクエリの change イベントで判定値が更新される", () => {
    const mock = createMatchMediaMock(false);
    vi.stubGlobal("matchMedia", mock.matchMedia);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mock.setMatches(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mock.setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it("アンマウント時に change リスナーを解除する", () => {
    const mock = createMatchMediaMock(false);
    vi.stubGlobal("matchMedia", mock.matchMedia);

    const { unmount } = renderHook(() => useIsMobile());
    expect(mock.listeners.size).toBe(1);

    unmount();
    expect(mock.listeners.size).toBe(0);
  });
});
