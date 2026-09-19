import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createLabServer } from "../server.mjs";

async function withServer(run) {
  const server = createLabServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("local API runs a complete synthetic evaluation with shadow default", () =>
  withServer(async (base) => {
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.productionConnected, false);
    const res = await fetch(`${base}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "contrast" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.selectedCardId, "new_vocab");
    assert.equal(data.recommendedCardId, "new_contrast");
    assert.equal(data.modelCall.realModelCall, false);
  }));

test("cross-origin requests, arbitrary data, and remote hostnames are rejected", () =>
  withServer(async (base) => {
    assert.equal(
      (
        await fetch(`${base}/health`, {
          headers: { Origin: "https://example.com" },
        })
      ).status,
      403
    );
    const hostStatus = await new Promise((resolve, reject) => {
      http
        .get(`${base}/health`, { headers: { Host: "evil.example" } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        })
        .on("error", reject);
    });
    assert.equal(hostStatus, 403);
    for (const body of [
      { scenario: "contrast", snapshot: { phone: "TEST" } },
      { scenario: "unknown" },
      { scenario: "contrast", mode: "production" },
    ]) {
      assert.equal(
        (
          await fetch(`${base}/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        ).status,
        400
      );
    }
  }));

test("only explicit JSON POST can run the algorithm", () =>
  withServer(async (base) => {
    assert.equal((await fetch(`${base}/evaluate`)).status, 404);
    assert.equal(
      (
        await fetch(`${base}/evaluate`, {
          method: "POST",
          body: "scenario=contrast",
        })
      ).status,
      415
    );
  }));
