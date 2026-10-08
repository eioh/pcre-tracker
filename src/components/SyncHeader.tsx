import { useRef, useState } from "react";
import { authClient, signIn, signOut } from "../lib/authClient";
import { isDeviceDataEpochCurrent } from "../domain/deviceData";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown, LogIn, LogOut, Trash2, UserRound } from "lucide-react";

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
  // ログアウト（signOut）の直前に呼ぶ。同期を停止し、ログアウト〜削除の間の PUT を防ぐ。
  onLogoutStart: () => void;
  // ログアウト成功後、「この端末のデータを削除してログアウト」を選んでいたときに呼ぶ（呼び出し後にリロードする）。
  // 別のタブで端末データが変わっていて削除しなかった場合は false を返す。
  onDeleteDeviceData: () => boolean;
  // サーバーへまだ送られていない変更があるかを返す（ログアウト確認の警告に使う）。
  hasUnsyncedChanges: () => boolean;
  // レイアウト変形。"inline"（既定）は従来の横並び表示（モバイルのシート内で使用）、
  // "dropdown" はログイン後 UI をユーザー名チップ + ドロップダウンメニューに集約する（デスクトップヘッダー用）。
  variant?: "inline" | "dropdown";
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
  onLogoutStart,
  onDeleteDeviceData,
  hasUnsyncedChanges,
  variant = "inline",
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
  // ログアウト確認ダイアログの状態。
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // ダイアログを開いた時点で、サーバーへ送られていない変更があったか（警告の表示用）。
  const [logoutHasUnsyncedChanges, setLogoutHasUnsyncedChanges] = useState(false);
  // ログアウトに失敗したか（失敗時は端末データを削除せず、ダイアログ内で案内する）。
  const [logoutFailed, setLogoutFailed] = useState(false);
  // 別のタブで端末データが変わっていたため、削除を始めなかったか（再読み込みを案内する）。
  const [logoutDeviceDataChanged, setLogoutDeviceDataChanged] = useState(false);

  // GitHub / Google でのソーシャルログインを開始する。
  const handleSignIn = (provider: "github" | "google") => {
    // 認証成功後はトップへ戻す。
    void signIn.social({ provider, callbackURL: "/" });
  };

  // ログアウト確認ダイアログを開く（未同期の変更の有無はこの時点で確定させる）。
  const openLogoutDialog = () => {
    setLogoutHasUnsyncedChanges(hasUnsyncedChanges());
    setLogoutFailed(false);
    setLogoutDeviceDataChanged(false);
    setIsLogoutDialogOpen(true);
  };

  // ログアウトする。deleteDeviceData が true なら、ログアウト成功後に端末データを削除して再読み込みする。
  // 処理順: 同期停止 → signOut → 成功時のみ端末データ削除 → 再読み込み。
  // 先に削除すると、ログアウトに失敗したときにサーバーから再び取り込まれてしまうため、削除は必ず成功後に行う。
  // 別のタブで端末データが変わった後のタブからは削除を始めない（別のタブの新しいデータを消さないため）。
  // signOut の応答待ちの間に変わった場合は、削除処理（onDeleteDeviceData）が世代を確かめて削除しない。
  const handleLogout = async (deleteDeviceData: boolean) => {
    setLogoutFailed(false);
    if (deleteDeviceData && !isDeviceDataEpochCurrent()) {
      setLogoutDeviceDataChanged(true);
      return;
    }
    setIsLoggingOut(true);
    onLogoutStart();
    let succeeded = false;
    try {
      const result = await signOut();
      succeeded = !result?.error;
    } catch {
      // ネットワーク例外等（クライアントが throw する経路）も失敗扱いにする。
      succeeded = false;
    }
    if (!succeeded) {
      // 失敗: 端末データは削除せず、ダイアログ内で案内する（このタブで編集を続けられる）。
      setIsLoggingOut(false);
      setLogoutFailed(true);
      return;
    }
    if (deleteDeviceData) {
      // 削除しなかった場合（応答待ちの間に別のタブで端末データが変わった場合）も、ログアウト済みなので再読み込みする。
      onDeleteDeviceData();
      window.location.reload();
      return;
    }
    setIsLoggingOut(false);
    setIsLogoutDialogOpen(false);
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
    // 表示名（未設定時は汎用表記。email は PII 方針によりフォールバックに使わない）。
    const displayLabel = userLabel ?? "ログイン中";
    return (
      <>
        {variant === "dropdown" ? (
          // dropdown 変形: ユーザー名チップをトリガーに、ログアウト / アカウント削除をメニューへ集約する。
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* 「データ」メニューのトリガー（既定サイズ）と高さ・文字サイズを揃えるため size は既定にする。 */}
              <Button variant="outline" className="relative">
                <UserRound className="size-4" aria-hidden="true" />
                <span className="max-w-[160px] truncate">{displayLabel}</span>
                <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
                {/* 同期ステータスの常時表示が無い代償として、同期エラー時のみ危険色ドットで知らせる。 */}
                {statusInfo.tone === "danger" ? (
                  <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" role="status">
                    {/* スクリーンリーダー向けの読み上げテキスト（空要素の aria-label は読まれない場合があるため）。 */}
                    <span className="sr-only">同期エラー</span>
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* ヘッダー部: 表示名 + 同期ステータス（非インタラクティブ）。 */}
              <DropdownMenuLabel>
                <span className="block max-w-[220px] truncate text-sm text-main">{displayLabel}</span>
                {statusInfo.text ? (
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      statusInfo.tone === "accent" && "text-accent",
                      statusInfo.tone === "danger" && "text-danger",
                      statusInfo.tone === "muted" && "text-muted",
                    )}
                  >
                    {statusInfo.text}
                  </span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={openLogoutDialog}>
                <LogOut className="size-4" aria-hidden="true" />
                ログアウト
              </DropdownMenuItem>
              <DropdownMenuItem variant="danger" onSelect={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                アカウント削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // inline 変形（既定）: 従来の横並び表示（モバイルのシート内はこのまま）。
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
            <Button variant="outline" size="sm" onClick={openLogoutDialog}>
              <LogOut className="size-4" aria-hidden="true" />
              ログアウト
            </Button>
            {/* 破壊的操作のため危険色にする（dropdown 変形の danger メニュー項目と整合）。 */}
            <Button
              variant="outline"
              size="sm"
              className="text-danger hover:border-danger"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              アカウント削除
            </Button>
          </div>
        )}

        {/*
          ログアウトの確認ダイアログ。共有端末で次の利用者にデータが残らないよう、端末データを削除するかを選べる。
          ドロップダウン・インラインの両方から開く（メニューが閉じても表示されるよう SyncHeader ルートに置く）。
        */}
        <AlertDialog open={isLogoutDialogOpen} onOpenChange={(open) => !isLoggingOut && setIsLogoutDialogOpen(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この端末の育成データと表示設定を残すか、削除するかを選んでください。残した場合、次に別のアカウントでログインしたときに、このデータをどうするか確認します。共有の端末では、データを削除してからログアウトすることをおすすめします。
              </AlertDialogDescription>
            </AlertDialogHeader>
            {logoutHasUnsyncedChanges ? (
              <p className="m-0 text-sm text-danger">
                サーバーへまだ送られていない変更があります。この端末のデータを削除すると、その変更は失われます。
              </p>
            ) : null}
            {logoutFailed ? (
              <p className="m-0 text-sm text-danger" role="alert">
                ログアウトに失敗しました。通信環境を確認してもう一度お試しください。
              </p>
            ) : null}
            {logoutDeviceDataChanged ? (
              <p className="m-0 text-sm text-danger" role="alert">
                別のタブでこの端末のデータが変更されたため、削除できません。画面を再読み込みしてから、もう一度お試しください。
              </p>
            ) : null}
            {isLoggingOut ? (
              <p className="m-0 text-sm text-accent" role="status">
                ログアウト中...
              </p>
            ) : null}
            {/* 3 つのボタンは文言が長いため、画面幅によらず縦に並べる。 */}
            <AlertDialogFooter className="sm:flex-col-reverse sm:justify-start">
              <AlertDialogCancel disabled={isLoggingOut}>キャンセル</AlertDialogCancel>
              <Button
                variant="outline"
                className="border-danger/60 bg-danger-bg/40 text-danger hover:border-danger-strong hover:text-danger-strong"
                disabled={isLoggingOut}
                onClick={() => void handleLogout(true)}
              >
                この端末のデータを削除してログアウト
              </Button>
              <Button variant="outline" disabled={isLoggingOut} onClick={() => void handleLogout(false)}>
                データを残してログアウト
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
      {/* dropdown 変形（デスクトップヘッダー）では「データ」メニューのトリガーとサイズを揃えるため既定サイズにする。 */}
      <Button variant="outline" size={variant === "dropdown" ? "default" : "sm"} onClick={() => setIsLoginDialogOpen(true)}>
        <LogIn className="size-4" aria-hidden="true" />
        ログイン
      </Button>

      <AlertDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ログイン</AlertDialogTitle>
            <AlertDialogDescription>
              ログインすると育成データを複数端末で同期できます。GitHub と Google で確認済みの同じメールアドレスを使っている場合は同じアカウントになり、メールアドレスが異なる場合は別のアカウントになります。
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
