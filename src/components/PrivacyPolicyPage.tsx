import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";

type Props = {
  // ポリシーページからアプリ本体へ戻るためのハンドラ。
  onBack: () => void;
};

// プライバシーポリシーページ。SPA フォールバックにより固定 URL `/privacy` で描画される（設計判断 1）。
// 設計書「PII の扱い」「アカウント削除・プライバシーポリシー」節の記載必須事項をすべて含む（設計判断 2）。
export function PrivacyPolicyPage({ onBack }: Props) {
  return (
    <div className="mx-auto w-full max-w-[800px] px-5 pb-9 pt-7">
      <header className="mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          アプリに戻る
        </Button>
        <h1 className="mb-1 mt-5 font-orbitron text-[clamp(1.6rem,4vw,2.2rem)] tracking-[0.04em]">プライバシーポリシー</h1>
        <p className="m-0 text-sm text-muted">育成トラッカーにおける個人情報・データの取り扱いについて</p>
      </header>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-sub">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-main">1. 保存する情報</h2>
          <p className="m-0">
            ログイン（GitHub / Google のソーシャルログイン）を利用した場合、認証のために次の情報をサーバー（Cloudflare
            D1）へ保存します。
          </p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-6">
            <li>メールアドレス</li>
            <li>プロバイダ ID（GitHub / Google 側のアカウント識別子）</li>
            <li>表示名</li>
            <li>
              OAuth トークン（アクセストークン・リフレッシュトークン・スコープと、Google でログインした場合は ID トークン）。
              これらは認証基盤（better-auth）の <code className="px-1">account</code> テーブルに、ログインのたびに保存・更新されます。
              本アプリはこれらのトークンを利用していないため、保存済みのトークン（スコープを除く）は一度すべて削除しました。
              現在保存されているトークンは、その削除後のログインで保存されたものです。
              アクセストークンとリフレッシュトークンは暗号化して保存します。ID トークンは暗号化の対象外です。
            </li>
            <li>
              ログインセッションの情報（セッションの有効期限と、ログイン時の IP アドレス・ブラウザのユーザーエージェント）
            </li>
            <li>同期対象の育成データ（育成状況・コネクトランク計算タブのデータ）</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-main">2. 情報の利用目的</h2>
          <p className="m-0">
            メールアドレス・プロバイダ ID・トークン等は<strong>認証目的にのみ使用</strong>します。画面上への表示や通知送信といった
            二次利用は行いません。表示名のみ、ログイン状態の表示（どのアカウントでログインしているかの識別）に使用します。
            メールアドレスは画面上には表示しません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-main">3. 未ログイン時の扱いと端末に残るデータ</h2>
          <p className="m-0">
            ログインせずに利用する場合、育成データはお使いの端末のブラウザ（localStorage）にのみ保存され、
            <strong>サーバーへは一切送信されません</strong>。すべての機能をログインなしで利用できます。
          </p>
          <p className="m-0">
            ログインして利用すると、この端末のデータをどのアカウントで使っているかを判別するため、アカウントの
            <strong>内部 ID</strong>（メールアドレスや表示名ではない識別子）を端末のブラウザに保存します。内部 ID は
            ログアウトしても端末に残り、別のアカウントでログインしたときに、端末に残っている前のアカウントのデータを
            引き継ぐか、使わずに削除するかを確認するために使います。選ぶまでは、端末のデータをサーバーへ送信しません。
          </p>
          <p className="m-0">
            ログアウトするときは、この端末の育成データと表示設定を<strong>残すか削除するかを選べます</strong>。
            共有の端末では、削除してからログアウトすると、次に使う人にデータが残りません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-main">4. アカウントの削除</h2>
          <p className="m-0">
            ログイン中のメニューからアカウントを削除できます。削除すると、サーバー上の認証情報（アカウント・セッション等）と
            同期済みの育成データが連動して削除されます。この端末のブラウザ（localStorage）に保存された育成データは削除されず、
            ローカルモードとして引き続き利用できます。
          </p>
          <p className="m-0">
            削除したアカウントの内部 ID も端末のブラウザに残り、次に別のアカウントでログインしたときの確認に使います。
            端末のデータも消したい場合は、ブラウザのサイトデータを削除してください。
          </p>
          <p className="m-0">
            なお、削除後も<strong>最大 7 日間</strong>は、データベースの災害復旧機能（Cloudflare D1 Time Travel。
            7 日間の Point-In-Time Recovery）により、削除済みデータが復元可能な状態でバックアップに残存します。
            7 日を経過すると復元不可能になります。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-main">5. GitHub と Google のアカウントの扱い</h2>
          <p className="m-0">
            GitHub と Google のそれぞれで確認済みの<strong>同じメールアドレス</strong>を使っている場合は、
            <strong>同じアカウント</strong>として扱われ、同期データも共通になります。
            メールアドレスが異なる場合は<strong>別々のアカウント</strong>となり、それぞれ独立した同期データになります。
            別々になったアカウントを後から手動で統合する機能はありません。
          </p>
        </section>

        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            アプリに戻る
          </Button>
        </div>
      </div>
    </div>
  );
}
