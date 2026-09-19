import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { baseSnapshot } from "../fixtures/scenarios.mjs";
import { makeRequest, prepare } from "../src/policy.mjs";
import {
  createJevProvider,
  createFixtureProvider,
  ENDPOINT,
  costUsd,
} from "../src/provider.mjs";

const request = () => makeRequest(prepare(baseSnapshot()));
async function validResponse(input) {
  const r = await createFixtureProvider(["contrast", "contrast"]).evaluate(
    input
  );
  return { ...r.response, usage: { input_tokens: 2000, output_tokens: 99 } };
}

test("pinned official endpoint, no redirect, server-only key, and usage-based cost", async () => {
  let observed;
  const provider = createJevProvider({
    apiKey: "TEST_KEY",
    fetchImpl: async (url, init) => {
      observed = { url, init };
      return Response.json(await validResponse(JSON.parse(init.body)));
    },
  });
  const result = await provider.evaluate(request());
  assert.equal(observed.url, ENDPOINT);
  assert.equal(observed.init.redirect, "error");
  assert.equal(observed.init.headers.Authorization, "Bearer TEST_KEY");
  assert.equal(result.meta.costUsd, 0.000084);
  assert.equal(result.meta.realModelCall, true);
  assert.ok(!JSON.stringify(result).includes("TEST_KEY"));
});

test("missing key and request budget stop before sending", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    throw new Error("network");
  };
  await assert.rejects(
    createJevProvider({ apiKey: "", fetchImpl }).evaluate(request()),
    { code: "missing_api_key" }
  );
  await assert.rejects(
    createJevProvider({ apiKey: "TEST", fetchImpl, maxInputBytes: 2 }).evaluate(
      request()
    ),
    { code: "request_too_large" }
  );
  await assert.rejects(
    createJevProvider({ apiKey: "TEST", fetchImpl, maxCalls: 0 }).evaluate(
      request()
    ),
    { code: "call_budget_exhausted" }
  );
  assert.equal(calls, 0);
});

test("call quota is reserved before dispatch and failed calls are not automatically retried", async () => {
  let calls = 0;
  const provider = createJevProvider({
    apiKey: "TEST",
    maxCalls: 1,
    fetchImpl: async () => {
      calls++;
      return new Response("private diagnostic", { status: 429 });
    },
  });
  await assert.rejects(provider.evaluate(request()), { code: "rate_limited" });
  await assert.rejects(provider.evaluate(request()), {
    code: "call_budget_exhausted",
  });
  assert.equal(calls, 1);
});

for (const status of [401, 403, 429, 500, 529])
  test(`HTTP ${status} is bounded and redacted`, async () => {
    const p = createJevProvider({
      apiKey: "TEST_SECRET",
      fetchImpl: async () =>
        new Response("TEST_SECRET PRIVATE_ACCOUNT", { status }),
    });
    await assert.rejects(
      p.evaluate(request()),
      (e) =>
        !e.message.includes("TEST_SECRET") &&
        !e.message.includes("PRIVATE_ACCOUNT")
    );
  });

test("transport error messages never leak secrets", async () => {
  const p = createJevProvider({
    apiKey: "TEST_SECRET",
    fetchImpl: async () => {
      throw new Error("TEST_SECRET");
    },
  });
  await assert.rejects(p.evaluate(request()), {
    message: "network_or_response_error",
  });
});

test("response size and malformed usage are rejected", async () => {
  await assert.rejects(
    createJevProvider({
      apiKey: "TEST",
      fetchImpl: async () => new Response("x".repeat(140000)),
    }).evaluate(request()),
    { code: "response_too_large" }
  );
  const r = await validResponse(request());
  r.usage.input_tokens = -1;
  await assert.rejects(
    createJevProvider({
      apiKey: "TEST",
      fetchImpl: async () => Response.json(r),
    }).evaluate(request()),
    { code: "invalid_usage" }
  );
});

test("real HTTP delayed response body is cancelled by the same deadline", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write("{");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const local = `http://127.0.0.1:${server.address().port}`;
    const p = createJevProvider({
      apiKey: "TEST",
      timeoutMs: 60,
      fetchImpl: (_url, init) => fetch(local, init),
    });
    const started = performance.now();
    await assert.rejects(p.evaluate(request()), { code: "timeout" });
    assert.ok(performance.now() - started < 1000);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("concurrent calls cannot exceed the configured quota", async () => {
  let sent = 0;
  const p = createJevProvider({
    apiKey: "TEST",
    maxCalls: 1,
    fetchImpl: async () => {
      sent++;
      await delay(10);
      return Response.json(await validResponse(request()));
    },
  });
  const results = await Promise.allSettled([
    p.evaluate(request()),
    p.evaluate(request()),
  ]);
  assert.equal(sent, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

test("costs match published input-only pricing", () => {
  assert.equal(costUsd(1_000_000), 0.042);
  assert.equal(costUsd(3_000_000_000), 126);
});
