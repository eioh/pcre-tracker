import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "./ui/button";

// PWA の新バージョン検出時に表示する固定バナー（presentational）。
// 見た目と操作だけを担い、更新適用やローカル保存 flush の実処理は props のコールバックへ委譲する。
// これにより virtual:pwa-register に依存せず単体テストできる（onUpdate 押下順の検証など）。
export function PwaUpdateBanner({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  return (
    <div
      // 下部固定。モバイルは MobileBottomNav（h-14 + セーフエリア, z-40）に重ならないよう上に逃がし、
      // デスクトップ（md 以上, 下部ナビなし）は右下へピン留めする。バナーは z-50 でナビより前面に置く。
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] z-50 md:inset-x-auto md:bottom-4 md:right-4 md:w-[380px]"
    >
      <div className="flex items-start gap-3 rounded-[12px] border border-panel-border bg-popover-bg p-4 shadow-panel">
        {/* 更新を示すアイコン（装飾）。 */}
        <RefreshCw className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-main">新しいバージョンがあります</p>
          <p className="m-0 mt-0.5 text-xs text-muted">更新すると最新版で再読み込みします。</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onUpdate}>
              更新
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              後で
            </Button>
          </div>
        </div>
        {/* 右上の閉じるボタン（後で表示に戻す導線。次回更新確認で再度表示される）。 */}
        <button
          type="button"
          aria-label="閉じる"
          onClick={onDismiss}
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-muted transition hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// 表示制御レイヤー（テスト可能・virtual:pwa-register 非依存）。
// 更新検出フラグ needRefresh とローカルの dismissed 状態からバナーの表示可否を決め、
// 「更新」押下時に flushPendingSave → applyUpdate の順で呼ぶ（編集中データの消失防止）。
export function PwaUpdatePromptView({
  needRefresh,
  flushPendingSave,
  applyUpdate,
}: {
  needRefresh: boolean;
  flushPendingSave: () => void;
  applyUpdate: () => void;
}) {
  // ユーザーが「後で」を選んだら現在の通知を隠す（次の更新検出で再表示される）。
  const [dismissed, setDismissed] = useState(false);

  // 「更新」押下ハンドラ。保留中のローカル保存を必ず先に flush してから更新を適用する。
  const handleUpdate = useCallback(() => {
    flushPendingSave();
    applyUpdate();
  }, [flushPendingSave, applyUpdate]);

  // 通知を閉じる。
  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!needRefresh || dismissed) {
    return null;
  }
  return <PwaUpdateBanner onUpdate={handleUpdate} onDismiss={handleDismiss} />;
}

// 1 時間ごとに Service Worker の更新チェックを行う間隔（ミリ秒）。
// インストール型アプリは長時間開かれたままになるため、定期的に新バージョンを検出させる。
const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// App にマウントする PWA 更新プロンプトのコンテナ。
// virtual:pwa-register への配線は本番ビルド（PROD）でのみ useEffect 内の動的 import で行う。
// jsdom テスト（PROD=false）では仮想モジュールが解決できず失敗するため、静的 import は使わない。
export function PwaUpdatePrompt({ flushPendingSave }: { flushPendingSave: () => void }) {
  // 新バージョン検出フラグ（onNeedRefresh で true になる）。
  const [needRefresh, setNeedRefresh] = useState(false);
  // registerSW が返す更新適用関数の保持先（reloadPage=true でリロードを伴う更新）。
  const updateServiceWorkerRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // 本番ビルドのみ Service Worker を登録・配線する。
    if (!import.meta.env.PROD) {
      return;
    }
    let disposed = false;
    let intervalId: number | undefined;
    void (async () => {
      // 仮想モジュールは PROD ビルドでのみ実体化されるため動的に読み込む。
      const { registerSW } = await import("virtual:pwa-register");
      if (disposed) {
        return;
      }
      const updateServiceWorker = registerSW({
        // 新バージョン待機時にバナーを表示する。
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        // 登録完了後、1 時間ごとに更新チェックを行う。
        onRegisteredSW(_swScriptUrl, registration) {
          if (!registration) {
            return;
          }
          intervalId = window.setInterval(() => {
            void registration.update();
          }, SW_UPDATE_CHECK_INTERVAL_MS);
        },
      });
      updateServiceWorkerRef.current = updateServiceWorker;
    })();
    return () => {
      // アンマウント時に定期チェックを解除し、遅延 import 後の状態更新も抑止する。
      disposed = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  // 更新を適用する（リロードを伴う）。登録前は no-op。
  const applyUpdate = useCallback(() => {
    void updateServiceWorkerRef.current?.(true);
  }, []);

  return <PwaUpdatePromptView needRefresh={needRefresh} flushPendingSave={flushPendingSave} applyUpdate={applyUpdate} />;
}
