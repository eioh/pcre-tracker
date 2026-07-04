import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll } from "vitest";

// cloudflare:test の `env` は `Cloudflare.Env` 型（wrangler types 生成の worker-configuration.d.ts が定義）。
// vitest.config.worker.ts の miniflare.bindings で渡す TEST_MIGRATIONS と、Phase 2 で追加予定の
// D1 バインディング DB を、その `Cloudflare.Env` に対して型拡張（declaration merging）する。
declare global {
  namespace Cloudflare {
    interface Env {
      // readD1Migrations() が返すマイグレーション配列（0 件なら空配列）。
      TEST_MIGRATIONS?: D1Migration[];
      // Phase 2 で wrangler.jsonc に D1 バインディング DB が追加されると実体が解決される。
      // 現時点（Phase 1）ではバインディング未定義のため optional 扱いにする。
      DB?: D1Database;
    }
  }
}

// D1 マイグレーション適用の骨格。
// 全 Worker テストの実行前に一度だけ、TEST_MIGRATIONS を DB バインディングへ適用する。
// Phase 1 時点では migrations/ が空（0 件）かつ DB バインディング未追加のため、
// どちらの条件でも安全にスキップし、テスト基盤が壊れないようにしている。
beforeAll(async () => {
  // DB バインディングが未定義（Phase 2 前）なら適用対象がないためスキップする。
  if (!env.DB) {
    return;
  }
  // マイグレーションが 0 件なら applyD1Migrations を呼ぶ必要はないためスキップする。
  if (!env.TEST_MIGRATIONS || env.TEST_MIGRATIONS.length === 0) {
    return;
  }
  // 未適用のマイグレーションを DB に適用する（適用状態は d1_migrations テーブルで管理される）。
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
