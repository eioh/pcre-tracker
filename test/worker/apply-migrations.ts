import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll } from "vitest";

// cloudflare:test の `env` は `Cloudflare.Env` 型（wrangler types 生成の worker-configuration.d.ts が定義）。
// vitest.config.worker.ts の miniflare.bindings で渡すテスト専用バインディングを型拡張（declaration merging）する。
// D1 バインディング DB は wrangler.jsonc の d1_databases 定義から生成型に含まれるため、ここでは宣言しない。
// 認証系の環境変数（BETTER_AUTH_SECRET 等）は .dev.vars の有無で生成型が揺れる（CI には .dev.vars が無い）ため
// あえて宣言せず、テスト側で AuthEnv へキャストして扱う（test/worker/helpers.ts 参照）。
declare global {
  namespace Cloudflare {
    interface Env {
      // readD1Migrations() が返すマイグレーション配列（0 件なら空配列）。
      TEST_MIGRATIONS?: D1Migration[];
    }
  }
}

// D1 マイグレーション適用。
// 全 Worker テストの実行前に一度だけ、TEST_MIGRATIONS を DB バインディングへ適用する。
beforeAll(async () => {
  // マイグレーションが 0 件なら applyD1Migrations を呼ぶ必要はないためスキップする。
  if (!env.TEST_MIGRATIONS || env.TEST_MIGRATIONS.length === 0) {
    return;
  }
  // 未適用のマイグレーションを DB に適用する（適用状態は d1_migrations テーブルで管理される）。
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
