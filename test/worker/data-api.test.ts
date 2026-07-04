import { describe, expect, it } from "vitest";
import worker from "../../worker/index";
import { RATE_LIMIT_MAX_REQUESTS } from "../../worker/data";
import {
  buildGetRequest,
  buildPutRequest,
  buildSyncPayload,
  createUserWithSession,
  testEnv,
  TEST_ORIGIN,
} from "./helpers";

// /api/data の統合テスト。
// 設計書の必須要件（データ隔離・楽観ロック・入力検証・CSRF・レート制限）を Worker 実体に対して検証する。
// 各テストは vitest-pool-workers の isolated storage により独立した D1 状態で実行される。

describe("/api/data 認証", () => {
  // セッションなしの GET は 401 を返す。
  it("未認証の GET は 401", async () => {
    const response = await worker.fetch(new Request(`${TEST_ORIGIN}/api/data`), testEnv);
    expect(response.status).toBe(401);
  });

  // セッションなしの PUT は 401 を返す（CSRF 検証は通過する正しいヘッダを付けた場合）。
  it("未認証の PUT は 401", async () => {
    const request = buildPutRequest("", { baseRevision: null, payload: buildSyncPayload() });
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(401);
  });
});

describe("/api/data CSRF ミドルウェア", () => {
  // GET / PUT 以外のメソッドは 405 を返す。
  it("DELETE は 405", async () => {
    const { cookie } = await createUserWithSession();
    const request = new Request(`${TEST_ORIGIN}/api/data`, { method: "DELETE", headers: { Cookie: cookie } });
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(405);
  });

  // PUT で Origin ヘッダが欠落している場合は拒否する。
  it("Origin なしの PUT は 403", async () => {
    const { cookie } = await createUserWithSession();
    const request = buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }, { origin: null });
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(403);
  });

  // PUT で Origin が許可リストに一致しない場合は拒否する。
  it("不正な Origin の PUT は 403", async () => {
    const { cookie } = await createUserWithSession();
    const request = buildPutRequest(
      cookie,
      { baseRevision: null, payload: buildSyncPayload() },
      { origin: "https://evil.example.com" },
    );
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(403);
  });

  // PUT で Content-Type が application/json 以外の場合は拒否する（単純リクエスト対策）。
  it("Content-Type: text/plain の PUT は 415", async () => {
    const { cookie } = await createUserWithSession();
    const request = buildPutRequest(
      cookie,
      { baseRevision: null, payload: buildSyncPayload() },
      { contentType: "text/plain" },
    );
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(415);
  });

  // GET は Origin 欠落を許可する（same-origin fetch の GET は Origin を送らないのが通常のため）。
  it("Origin なしの GET は許可される（データ未保存なら 404）", async () => {
    const { cookie } = await createUserWithSession();
    const response = await worker.fetch(buildGetRequest(cookie), testEnv);
    expect(response.status).toBe(404);
  });

  // GET でも Origin が付いていて不一致なら拒否する。
  it("不正な Origin 付きの GET は 403", async () => {
    const { cookie } = await createUserWithSession();
    const response = await worker.fetch(buildGetRequest(cookie, "https://evil.example.com"), testEnv);
    expect(response.status).toBe(403);
  });
});

describe("/api/data 入力検証", () => {
  // 計算タブキーの欠落は 400（キー欠落は許容しない。設計書「同期対象データの範囲」節）。
  it("計算タブキー欠落の PUT は 400", async () => {
    const { cookie } = await createUserWithSession();
    const payload = buildSyncPayload() as unknown as { storage: Record<string, unknown> };
    delete payload.storage.pcr_growth_tracker_connect_rank_calc;
    const response = await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload }), testEnv);
    expect(response.status).toBe(400);
  });

  // 育成データキーが null の場合も 400（null は許容しない）。
  it("育成データキーが null の PUT は 400", async () => {
    const { cookie } = await createUserWithSession();
    const payload = buildSyncPayload() as unknown as { storage: Record<string, unknown> };
    payload.storage.pcr_growth_tracker = null;
    const response = await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload }), testEnv);
    expect(response.status).toBe(400);
  });

  // 内側スキーマ（StoredStateV1 の CharacterProgress）まで深く検証されることを確認する。
  it("深い検証違反（connectRank 範囲外）の PUT は 400", async () => {
    const { cookie } = await createUserWithSession();
    const payload = buildSyncPayload();
    payload.storage.pcr_growth_tracker.progressByName["ペコリーヌ"] = {
      owned: true,
      limitBreak: false,
      star: 1,
      connectRank: 99, // 0〜15 の範囲外
      ue1Level: null,
      ue1SpEquipped: false,
      ue2Level: null,
      adventureMemoryPieceTarget: false,
      ownedMemoryPiece: 0,
      obtainedDate: null,
      gachaPullCount: 0,
    } as never;
    const response = await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload }), testEnv);
    expect(response.status).toBe(400);
  });

  // JSON として解釈できないボディは 400。
  it("不正 JSON の PUT は 400", async () => {
    const { cookie } = await createUserWithSession();
    const request = buildPutRequest(cookie, undefined, { rawBody: "{ broken json" });
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(400);
  });

  // 512KB を超えるボディは JSON parse 前に 413 で拒否する（設計書「乱用対策」節）。
  it("512KB 超の PUT は 413", async () => {
    const { cookie } = await createUserWithSession();
    // 有効な JSON の末尾に空白を詰めて 512KB + 1 バイトにする（サイズ検証が parse より先であることを確認）。
    const base = JSON.stringify({ baseRevision: null, payload: buildSyncPayload() });
    const rawBody = base + " ".repeat(512 * 1024 + 1 - base.length);
    const request = buildPutRequest(cookie, undefined, { rawBody });
    const response = await worker.fetch(request, testEnv);
    expect(response.status).toBe(413);
  });
});

describe("/api/data 楽観ロック", () => {
  // 初回アップロード（baseRevision: null）で行が作成され、revision 1 が発行される。
  it("初回 PUT は revision 1 を返し、GET で同じデータが取得できる", async () => {
    const { cookie } = await createUserWithSession();
    const payload = buildSyncPayload("マーカー初回");

    const putResponse = await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload }), testEnv);
    expect(putResponse.status).toBe(200);
    const putBody = (await putResponse.json()) as { revision: number; updatedAt: string };
    expect(putBody.revision).toBe(1);

    const getResponse = await worker.fetch(buildGetRequest(cookie), testEnv);
    expect(getResponse.status).toBe(200);
    const getBody = (await getResponse.json()) as { revision: number; payload: unknown; updatedAt: string };
    expect(getBody.revision).toBe(1);
    expect(getBody.payload).toEqual(payload);
    expect(getBody.updatedAt).toBe(putBody.updatedAt);
  });

  // 行が既に存在する状態での baseRevision: null（初回扱い）は 409（並行初回アップロード対策）。
  it("行が存在する状態での初回 PUT は 409", async () => {
    const { cookie } = await createUserWithSession();
    const first = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }),
      testEnv,
    );
    expect(first.status).toBe(200);

    const second = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }),
      testEnv,
    );
    expect(second.status).toBe(409);
  });

  // 正しい baseRevision による更新は成功し、revision が +1 される。
  it("正しい baseRevision の PUT は revision +1", async () => {
    const { cookie } = await createUserWithSession();
    await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }), testEnv);

    const update = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: 1, payload: buildSyncPayload("マーカー更新") }),
      testEnv,
    );
    expect(update.status).toBe(200);
    const body = (await update.json()) as { revision: number };
    expect(body.revision).toBe(2);
  });

  // baseRevision の不一致（競合）は 409 を返し、データは更新されない。
  it("baseRevision 不一致の PUT は 409 でデータ未更新", async () => {
    const { cookie } = await createUserWithSession();
    const original = buildSyncPayload("マーカー元");
    await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload: original }), testEnv);

    const conflict = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: 99, payload: buildSyncPayload("マーカー競合") }),
      testEnv,
    );
    expect(conflict.status).toBe(409);

    // データが元のままであることを確認する。
    const getResponse = await worker.fetch(buildGetRequest(cookie), testEnv);
    const getBody = (await getResponse.json()) as { revision: number; payload: unknown };
    expect(getBody.revision).toBe(1);
    expect(getBody.payload).toEqual(original);
  });
});

describe("/api/data データ隔離（設計書の最重要事項）", () => {
  // ユーザー A のデータがユーザー B から読めない・書き換えられないことを検証する。
  it("ユーザー A のデータはユーザー B から読めず、B の書き込みは A に影響しない", async () => {
    const userA = await createUserWithSession("user-a@example.com");
    const userB = await createUserWithSession("user-b@example.com");

    // A がデータを保存する。
    const payloadA = buildSyncPayload("ユーザーAの目印");
    const putA = await worker.fetch(buildPutRequest(userA.cookie, { baseRevision: null, payload: payloadA }), testEnv);
    expect(putA.status).toBe(200);

    // B のセッションで GET しても A のデータは見えない（B の行は存在しないため 404）。
    const getAsB = await worker.fetch(buildGetRequest(userB.cookie), testEnv);
    expect(getAsB.status).toBe(404);

    // B が自分のデータを保存しても、baseRevision: null の初回扱いで成功する（A の行とは独立）。
    const payloadB = buildSyncPayload("ユーザーBの目印");
    const putB = await worker.fetch(buildPutRequest(userB.cookie, { baseRevision: null, payload: payloadB }), testEnv);
    expect(putB.status).toBe(200);

    // A のデータは B の書き込み後も元のまま。
    const getAsA = await worker.fetch(buildGetRequest(userA.cookie), testEnv);
    const bodyA = (await getAsA.json()) as { payload: unknown };
    expect(bodyA.payload).toEqual(payloadA);

    // B は自分のデータのみ取得できる。
    const getAsB2 = await worker.fetch(buildGetRequest(userB.cookie), testEnv);
    const bodyB = (await getAsB2.json()) as { payload: unknown };
    expect(bodyB.payload).toEqual(payloadB);
  });
});

describe("/api/data レート制限", () => {
  // PUT は 30 回 / 5 分の固定ウィンドウ制限を超えると 429 を返す。
  // レート制限はボディ検証より先に適用されるため、2 回目以降は軽量な不正ボディで回数だけ消費する。
  it("31 回目の PUT は 429", async () => {
    const { cookie } = await createUserWithSession();

    // 1 回目: 正常な保存（レート制限 1 回消費）。
    const first = await worker.fetch(
      buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }),
      testEnv,
    );
    expect(first.status).toBe(200);

    // 2〜30 回目: 上限まで消費する（検証エラー 400 でもカウントされる）。
    for (let i = 1; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      const response = await worker.fetch(buildPutRequest(cookie, { baseRevision: null }), testEnv);
      expect(response.status).toBe(400);
    }

    // 31 回目: 上限超過で 429。
    const overLimit = await worker.fetch(buildPutRequest(cookie, { baseRevision: null }), testEnv);
    expect(overLimit.status).toBe(429);
  });

  // GET はレート制限の対象外（31 回目以降も成功する）。
  it("レート制限超過後も GET は可能", async () => {
    const { cookie } = await createUserWithSession();
    await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }), testEnv);
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i += 1) {
      await worker.fetch(buildPutRequest(cookie, { baseRevision: null }), testEnv);
    }
    const getResponse = await worker.fetch(buildGetRequest(cookie), testEnv);
    expect(getResponse.status).toBe(200);
  });
});

describe("scheduled（rate_limit 掃除）", () => {
  // 期限切れウィンドウの行のみ削除され、現在ウィンドウの行は残ることを検証する。
  it("期限切れの rate_limit 行を削除する", async () => {
    const { cookie, userId } = await createUserWithSession();
    // 現在ウィンドウの行を作る（PUT 1 回）。
    await worker.fetch(buildPutRequest(cookie, { baseRevision: null, payload: buildSyncPayload() }), testEnv);
    // 期限切れウィンドウの行を直接挿入する（2 日前）。
    const oldWindowStart = Date.now() - 2 * 24 * 60 * 60 * 1000;
    await testEnv.DB.prepare("INSERT INTO rate_limit (user_id, window_start, count) VALUES (?, ?, 5)")
      .bind(userId, oldWindowStart)
      .run();

    // scheduled ハンドラを直接呼び出す（Cron Trigger 相当）。
    const controller = { scheduledTime: Date.now(), cron: "0 0 * * *", noRetry() {} } as ScheduledController;
    await worker.scheduled(controller, testEnv);

    // 期限切れ行は消え、現在ウィンドウの行は残る。
    const rows = await testEnv.DB.prepare("SELECT window_start FROM rate_limit WHERE user_id = ?")
      .bind(userId)
      .all<{ window_start: number }>();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0]?.window_start).toBeGreaterThan(oldWindowStart);
  });
});
