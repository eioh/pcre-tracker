import { useSyncExternalStore } from "react";

// モバイル判定のブレークポイント。Tailwind の md（768px）未満をモバイルレイアウト対象として扱う。
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

// メディアクエリの変化を購読する（useSyncExternalStore の subscribe）。
function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQueryList.addEventListener("change", onStoreChange);
  return () => {
    mediaQueryList.removeEventListener("change", onStoreChange);
  };
}

// 現在のマッチ状態を返す（useSyncExternalStore の getSnapshot）。
function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

// 画面幅が 768px 未満（モバイルレイアウト対象）かどうかを返すフック。
// リサイズや画面回転による変化は matchMedia の change イベント経由で即座に反映される。
// SPA のため SSR は考慮不要で、getServerSnapshot は渡さない。
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
