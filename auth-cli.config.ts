// better-auth CLI (`generate`) 専用の一時設定。auth テーブルの SQL スキーマ生成にのみ使う。
// 実行時（Worker）は worker/auth.ts の createAuth(env) が D1 バインディングで生成するため、
// このファイルはランタイムから import されない。
// D1 は Node プロセスから直接生成できないため、同じ SQLite 系ダイアレクトとして
// node:sqlite のインメモリ DB を渡し、CLI に sqlite 向け DDL を出力させる。
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // インメモリ SQLite。introspection（既存テーブル調査）は空 DB に対して行われ、全テーブルの CREATE 文が出力される。
  database: new DatabaseSync(":memory:"),
  socialProviders: {
    github: { clientId: "dummy", clientSecret: "dummy" },
    google: { clientId: "dummy", clientSecret: "dummy" },
  },
  user: { deleteUser: { enabled: true } },
});
