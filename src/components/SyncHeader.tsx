import { useState } from "react";
import { signIn, signOut } from "../lib/authClient";
import type { SyncStatus } from "../hooks/useSync";
import { cn } from "../lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { LogIn, LogOut } from "lucide-react";

type Props = {
  // ログイン中か。
  isLoggedIn: boolean;
  // セッション確認中か（初期のちらつき抑止用）。
  isSessionPending: boolean;
  // 表示名 or メール（表示のみ）。
  userLabel: string | null;
  // 同期ステータス。
  status: SyncStatus;
};

// 同期ステータスを日本語テキストへ変換する。
function formatSyncStatus(status: SyncStatus): { text: string; tone: "muted" | "accent" | "danger" } {
  switch (status) {
    case "loading":
      return { text: "確認中...", tone: "muted" };
    case "syncing":
      return { text: "同期中...", tone: "accent" };
    case "idle":
      return { text: "同期済み", tone: "muted" };
    case "error":
      return { text: "同期エラー（自動で再試行します）", tone: "danger" };
    case "logged_out":
    default:
      return { text: "", tone: "muted" };
  }
}

// ヘッダーに配置するログイン UI・同期ステータス表示コンポーネント。
export function SyncHeader({ isLoggedIn, isSessionPending, userLabel, status }: Props) {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  // GitHub / Google でのソーシャルログインを開始する。
  const handleSignIn = (provider: "github" | "google") => {
    // 認証成功後はトップへ戻す。
    void signIn.social({ provider, callbackURL: "/" });
  };

  // ログアウトする。
  const handleSignOut = () => {
    void signOut();
  };

  // セッション確認中は UI を出さず、確定後に描画する（未ログイン時のちらつき抑止）。
  if (isSessionPending) {
    return null;
  }

  const statusInfo = formatSyncStatus(status);

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-2.5">
        {statusInfo.text ? (
          <span
            className={cn(
              "text-xs",
              statusInfo.tone === "accent" && "text-accent",
              statusInfo.tone === "danger" && "text-danger",
              statusInfo.tone === "muted" && "text-muted",
            )}
          >
            {statusInfo.text}
          </span>
        ) : null}
        {userLabel ? <span className="max-w-[160px] truncate text-xs text-muted">{userLabel}</span> : null}
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="size-4" aria-hidden="true" />
          ログアウト
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsLoginDialogOpen(true)}>
        <LogIn className="size-4" aria-hidden="true" />
        ログイン
      </Button>

      <AlertDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログイン</AlertDialogTitle>
            <AlertDialogDescription>
              ログインすると育成データを複数端末で同期できます。GitHub と Google は別アカウント扱いになります（アカウント統合には対応していません）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2.5">
            <Button variant="outline" onClick={() => handleSignIn("github")}>
              GitHub でログイン
            </Button>
            <Button variant="outline" onClick={() => handleSignIn("google")}>
              Google でログイン
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
