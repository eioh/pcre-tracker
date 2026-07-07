import { useRef, useState } from "react";
import { authClient, signIn, signOut } from "../lib/authClient";
import type { SyncStatus } from "../hooks/useSync";
import { cn } from "../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { LogIn, LogOut, Trash2 } from "lucide-react";

type Props = {
  // ログイン中か。
  isLoggedIn: boolean;
  // セッション確認中か（初期のちらつき抑止用）。
  isSessionPending: boolean;
  // 表示名（表示のみ。email は PII 方針によりフォールバックに使わない。設計判断 4）。
  userLabel: string | null;
  // 同期ステータス。
  status: SyncStatus;
  // プライバシーポリシーページへ遷移する（ログインダイアログ内リンク用）。
  onOpenPrivacyPolicy: () => void;
  // 削除リクエスト送信の直前に呼ぶ。同期を停止し、削除〜リロード間の PUT による行再作成を防ぐ（設計判断 3）。
  onDeleteRequestStart: () => void;
  // アカウント削除成功の直前に呼ぶ。同期メタ破棄など App 側の後処理を委譲する（設計判断 3）。
  onBeforeAccountDeleted: () => void;
};

// アカウント削除処理の結果種別（UI 分岐用）。
type DeleteResult = "success" | "session_expired" | "error";

// 同期ステータスを日本語テキストへ変換する。
export function formatSyncStatus(status: SyncStatus): { text: string; tone: "muted" | "accent" | "danger" } {
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
export function SyncHeader({
  isLoggedIn,
  isSessionPending,
  userLabel,
  status,
  onOpenPrivacyPolicy,
  onDeleteRequestStart,
  onBeforeAccountDeleted,
}: Props) {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // 削除後に表示する結果ダイアログ（null なら非表示）。
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  // 結果ダイアログの閉じ処理を二重実行しないためのガード。
  // Radix の AlertDialogAction は onClick と（クローズに伴う）onOpenChange の両方を発火させるため、
  // 成功時のリロードが二重に走らないようにする。
  const isClosingDeleteResultRef = useRef(false);

  // GitHub / Google でのソーシャルログインを開始する。
  const handleSignIn = (provider: "github" | "google") => {
    // 認証成功後はトップへ戻す。
    void signIn.social({ provider, callbackURL: "/" });
  };

  // ログアウトする。
  const handleSignOut = () => {
    void signOut();
  };

  // アカウント削除を実行する（better-auth の /api/auth/delete-user を呼ぶ）。
  //
  // 裏取り（node_modules/better-auth 1.6.23 / update-user.mjs deleteUser エンドポイント）:
  // - 引数なし呼び出しで削除が実行される（password/token は任意。ソーシャルのみのため password 代替はない）。
  // - クライアントは `{ data, error }` を返し、失敗時 error は `{ status, statusText, message?, code? }`。
  // - fresh session 要件: セッション作成から freshAge（デフォルト 24h）以上経過していると
  //   HTTP 400・code `SESSION_EXPIRED` を返す。この場合は再ログイン案内を出す（freshAge は変更しない）。
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    // 新しい試行のたびに閉じ処理ガードを戻す（前回の結果ダイアログを閉じた後の再試行に備える）。
    isClosingDeleteResultRef.current = false;
    // リクエスト送信前に同期を停止し、削除〜リロード間の PUT による行再作成を防ぐ。
    onDeleteRequestStart();
    try {
      const { error } = await authClient.deleteUser();
      if (!error) {
        // 成功: App 側で同期メタ破棄等の後処理を行う（育成データ・touched は残す）。
        onBeforeAccountDeleted();
        setIsDeleteDialogOpen(false);
        setDeleteResult("success");
        return;
      }
      // fresh session 切れ（SESSION_EXPIRED / status 400）は再ログインを案内する。
      const isSessionExpired =
        error.code === "SESSION_EXPIRED" || (error.status === 400 && /session expired/i.test(error.message ?? ""));
      setIsDeleteDialogOpen(false);
      setDeleteResult(isSessionExpired ? "session_expired" : "error");
    } catch {
      // ネットワーク例外等（クライアントが throw する経路）も汎用エラー扱いにする。
      setIsDeleteDialogOpen(false);
      setDeleteResult("error");
    } finally {
      setIsDeleting(false);
    }
  };

  // 削除成功の結果ダイアログを閉じたらリロードする（ローカルモードとして再起動）。
  const handleCloseDeleteResult = () => {
    // onClick と onOpenChange の二重発火を吸収し、リロードを一度だけにする。
    if (isClosingDeleteResultRef.current) {
      return;
    }
    isClosingDeleteResultRef.current = true;
    const shouldReload = deleteResult === "success";
    setDeleteResult(null);
    if (shouldReload) {
      window.location.reload();
    }
  };

  // セッション確認中は UI を出さず、確定後に描画する（未ログイン時のちらつき抑止）。
  if (isSessionPending) {
    return null;
  }

  const statusInfo = formatSyncStatus(status);

  if (isLoggedIn) {
    return (
      <>
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
          {userLabel ? (
            <span className="max-w-[160px] truncate text-xs text-muted">{userLabel}</span>
          ) : (
            <span className="text-xs text-muted">ログイン中</span>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" aria-hidden="true" />
            ログアウト
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            アカウント削除
          </Button>
        </div>

        {/* 破壊的操作の確認ダイアログ。削除内容を明示する（設計判断 3）。 */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>アカウントを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                サーバー上の認証情報と同期済みの育成データが削除されます。この端末に保存された育成データは削除されず、
                ログインなしのローカルモードとして引き続き利用できます。なお削除後も最大 7 日間は、データベースの災害復旧機能
                （D1 Time Travel）により削除済みデータがバックアップに残存します。この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={(event) => {
                  // 削除完了までダイアログを開いたままにし、進行中状態を表示する。
                  event.preventDefault();
                  void handleDeleteAccount();
                }}
              >
                {isDeleting ? "削除中..." : "削除する"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 削除結果ダイアログ（成功 / セッション切れ / エラー）。 */}
        <AlertDialog open={deleteResult !== null} onOpenChange={(open) => !open && handleCloseDeleteResult()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteResult === "success"
                  ? "アカウントを削除しました"
                  : deleteResult === "session_expired"
                    ? "再ログインが必要です"
                    : "削除に失敗しました"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteResult === "success"
                  ? "アカウントの削除が完了しました。閉じると画面を再読み込みします。この端末の育成データはローカルモードとして残ります。"
                  : deleteResult === "session_expired"
                    ? "セキュリティのため、アカウント削除には最近のログインが必要です。一度ログアウトして再ログインしてからやり直してください。"
                    : "アカウントの削除に失敗しました。通信環境を確認してもう一度お試しください。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleCloseDeleteResult}>閉じる</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
          <p className="m-0 text-xs text-muted">
            ログインする前に{" "}
            <button
              type="button"
              className="text-accent underline underline-offset-2"
              onClick={() => {
                // ダイアログを閉じてからポリシーページへ遷移する。
                setIsLoginDialogOpen(false);
                onOpenPrivacyPolicy();
              }}
            >
              プライバシーポリシー
            </button>{" "}
            をご確認ください。
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
