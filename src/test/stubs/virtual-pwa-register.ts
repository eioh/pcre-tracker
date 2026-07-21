// vitest（front プロジェクト）用の `virtual:pwa-register` スタブ。
// 本番ビルドでは vite-plugin-pwa が同名の仮想モジュールを実体化するが、テスト環境には
// プラグインが無いため、Vite の import 解析（リテラル動的 import を静的解決する）が失敗する。
// PwaUpdatePrompt 側は import.meta.env.PROD ガードで実行時にはこのスタブを呼ばないが、
// トランスフォーム時の解決を満たすためにダミーを提供する（vitest.config.front.ts で alias 設定）。

// registerSW のスタブ。何も登録せず no-op の更新関数を返す。
export function registerSW(_options?: unknown): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
