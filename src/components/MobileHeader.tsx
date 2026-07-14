import { useState } from "react";
import { Download, MoreHorizontal, RotateCcw, Upload } from "lucide-react";
import type { SyncStatus } from "../hooks/useSync";
import { cn } from "../lib/utils";
import { formatSyncStatus, SyncHeader } from "./SyncHeader";
import { Button } from "./ui/button";
import { FileImportButton } from "./ui/file-import-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type Props = {
  // ログイン中か（コンパクトヘッダーの同期ステータス表示と SyncHeader 埋め込みに使う）。
  isLoggedIn: boolean;
  // セッション確認中か（確定前はステータスを出さない。SyncHeader 側のちらつき抑止と同じ方針）。
  isSessionPending: boolean;
  // 表示名（SyncHeader へそのまま渡す）。
  userLabel: string | null;
  // 同期ステータス。
  status: SyncStatus;
  // プライバシーポリシーページへ遷移する（SyncHeader のログインダイアログ内リンク用）。
  onOpenPrivacyPolicy: () => void;
  // アカウント削除リクエスト送信の直前に呼ぶ（SyncHeader へそのまま渡す）。
  onDeleteRequestStart: () => void;
  // アカウント削除成功の直前に呼ぶ（SyncHeader へそのまま渡す）。
  onBeforeAccountDeleted: () => void;
  // フォーマット済みの最終更新テキスト（App 側で整形済み）。
  updatedAt: string;
  // バックアップJSONをダウンロードする。
  onExportBackup: () => void;
  // 選択されたバックアップファイルをインポート確認へ渡す。
  onSelectImportFile: (file: File) => void;
  // 保存データ初期化の確認ダイアログを開く。
  onRequestReset: () => void;
};

// メニュー項目として使う大きめボタンの共通クラス（40px 以上のタップターゲットを確保する）。
const menuItemClass = "w-full justify-start rounded-[10px] px-4 py-3 text-sm";

// スマホ（768px 未満）向けのコンパクトヘッダー。
// タイトルと同期ステータスのみを1行に収め、エクスポート/インポート/初期化/ログイン導線は
// 「⋯」ボタンから開くボトムシートのメニューへ集約する。
export function MobileHeader({
  isLoggedIn,
  isSessionPending,
  userLabel,
  status,
  onOpenPrivacyPolicy,
  onDeleteRequestStart,
  onBeforeAccountDeleted,
  updatedAt,
  onExportBackup,
  onSelectImportFile,
  onRequestReset,
}: Props) {
  // メニューシートの開閉状態（永続化しないローカル state）。
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const statusInfo = formatSyncStatus(status);
  // 同期ステータスはログイン確定後のみ表示する（未ログイン時・セッション確認中は出さない）。
  const shouldShowStatus = isLoggedIn && !isSessionPending && statusInfo.text !== "";

  // シートを閉じてから App 側ハンドラを呼ぶ（確認ダイアログは App ルートにあるためネストしない）。
  const runAfterClose = (action: () => void) => () => {
    setIsMenuOpen(false);
    action();
  };

  // ファイル選択完了時はシートを閉じてからインポートハンドラへ渡す。
  const handleSelectImportFile = (file: File) => {
    setIsMenuOpen(false);
    onSelectImportFile(file);
  };

  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="m-0 font-orbitron text-xl tracking-[0.04em]">育成トラッカー</h1>
        {shouldShowStatus ? (
          <span
            className={cn(
              "min-w-0 truncate text-xs",
              statusInfo.tone === "accent" && "text-accent",
              statusInfo.tone === "danger" && "text-danger",
              statusInfo.tone === "muted" && "text-muted",
            )}
          >
            {statusInfo.text}
          </span>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        aria-label="メニューを開く"
        className="min-h-10 min-w-10 shrink-0 px-2.5"
        onClick={() => setIsMenuOpen(true)}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </Button>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>メニュー</SheetTitle>
            <SheetDescription className="sr-only">
              ログインやバックアップのエクスポート・インポート、保存データの初期化を行うメニューです。
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-2.5">
            {/*
              ログイン導線（未ログイン時）またはステータス・ログアウト・アカウント削除（ログイン時）。
              ダイアログ群は SyncHeader が保持しているため、これらの操作ではシートを閉じない
              （閉じると SyncHeader ごとアンマウントされダイアログが消えるため）。
              子ボタンをメニュー項目スタイルへ寄せるためのセレクタを併用する（SyncHeader 本体はレイアウト無改変）。
              角丸はシート内の他メニュー項目（rounded-[10px]）と揃える。ログイン後のログアウト/アカウント削除は
              div 内にネストされるため、角丸のみ子孫セレクタ（[&_button]）で全ボタンに適用する
              （ダイアログ群はポータルで body 直下に描画されるため影響しない）。
            */}
            <div className="[&_button]:rounded-[10px] [&>button]:w-full [&>button]:justify-start [&>button]:px-4 [&>button]:py-3 [&>button]:text-sm [&>div]:flex-wrap">
              <SyncHeader
                isLoggedIn={isLoggedIn}
                isSessionPending={isSessionPending}
                userLabel={userLabel}
                status={status}
                onOpenPrivacyPolicy={onOpenPrivacyPolicy}
                onDeleteRequestStart={onDeleteRequestStart}
                onBeforeAccountDeleted={onBeforeAccountDeleted}
              />
            </div>

            <Button variant="outline" className={menuItemClass} onClick={runAfterClose(onExportBackup)}>
              <Download className="size-4" aria-hidden="true" />
              エクスポート
            </Button>

            <FileImportButton
              label="インポート"
              icon={<Upload className="size-4" aria-hidden="true" />}
              accept="application/json,.json"
              className={menuItemClass}
              onSelectFile={handleSelectImportFile}
            />

            {/* 破壊的操作のため危険色にする（デスクトップのデータメニューの danger 項目と整合）。 */}
            <Button
              variant="outline"
              className={cn(menuItemClass, "text-danger hover:border-danger")}
              onClick={runAfterClose(onRequestReset)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              保存データを初期化
            </Button>
          </div>

          <p className="m-0 text-sm text-muted">最終更新: {updatedAt}</p>
        </SheetContent>
      </Sheet>
    </header>
  );
}
