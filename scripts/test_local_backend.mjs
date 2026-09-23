import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalBackend } from "./run_local_backend.mjs";
const baseOptions = () => ({
  directory: fs.mkdtempSync(path.join(os.tmpdir(), "softbook-backend-test-")),
  port: 4199,
});
async function bApi(b, url, method, body, token) {
  // Real HTTP parsing and origin checks are exercised below.
  const response = await fetch(`http://127.0.0.1:4199/api${url}`, {
    method,
    headers: {
      connection: "close",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function start(options) {
  const b = createLocalBackend(options);
  await new Promise((resolve) =>
    b.server.listen(options.port, "127.0.0.1", resolve)
  );
  return b;
}
async function login(b, phone) {
  const challenge = await bApi(b, "/v2/auth/request-code", "POST", {
    phone_number: phone,
  });
  assert.equal(challenge.status, 200);
  const result = await bApi(b, "/v2/auth/verify-code", "POST", {
    phone_number: phone,
    challenge_id: challenge.body.data.challenge_id,
    sms_code: b.testCode,
  });
  assert.equal(result.status, 200);
  return result.body.data;
}
test("real auth, signed audio and account state survive server restart and remain isolated", async () => {
  const options = baseOptions();
  let b = await start(options);
  try {
    const session = await login(b, "13800138000");
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
    }).format(new Date());
    const url = `/v2/bootstrap?track=cet4&day_key=${day}`;
    const boot = await bApi(b, url, "GET", undefined, session.access_token);
    assert.equal(boot.status, 200);
    const selected = await bApi(
      b,
      "/v2/learning/session?track=cet4",
      "GET",
      undefined,
      session.access_token
    );
    assert.equal(selected.status, 200);
    const manifest = await bApi(
      b,
      `/v1/content/manifest?track=cet4&content_version=${encodeURIComponent(
        boot.body.data.content.version
      )}`,
      "GET",
      undefined,
      session.access_token
    );
    // The deployed route is v2; v1 remains disabled in the local server as well.
    assert.equal(manifest.status, 410);
    const published = await bApi(
      b,
      `/v2/content/manifest?track=cet4&content_version=${encodeURIComponent(
        boot.body.data.content.version
      )}`,
      "GET",
      undefined,
      session.access_token
    );
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert(published.body.data.downloads.length > 0);
    const media = await fetch(published.body.data.downloads[0].url);
    assert.equal(media.status, 200);
    assert((await media.arrayBuffer()).byteLength > 0);
    const bad = new URL(published.body.data.downloads[0].url);
    bad.searchParams.set("signature", "0".repeat(64));
    assert.equal((await fetch(bad)).status, 403);
    const selectedCard = (
      await bApi(
        b,
        "/v2/learning/card-source?track=cet4",
        "GET",
        undefined,
        session.access_token
      )
    ).body.data.card_records.find(
      (card) => card.card_id === selected.body.data.selection.card_id
    );
    const event = {
      event_id: "local_backend_persist_0001",
      selection_id: selected.body.data.selection.selection_id,
      card_id: selectedCard.card_id,
      interaction_id: selectedCard.interaction_id,
      phase: selected.body.data.selection.phase,
      outcome: selectedCard.interaction_id === "flip" ? "confident" : "correct",
      answer_grade: "passed",
      used_hint: false,
      used_peek: false,
      client_occurred_at: new Date().toISOString(),
      content_version: boot.body.data.content.version,
      device_cursor: { device_id: "local_backend_device_0001", sequence: 1 },
    };
    const completion = await bApi(
      b,
      "/v2/learning/events",
      "POST",
      { schema_version: "learning-events.v2", track: "cet4", events: [event] },
      session.access_token
    );
    assert.equal(completion.status, 200, JSON.stringify(completion.body));
    await b.close();
    b = await start(options);
    const restored = await bApi(b, url, "GET", undefined, session.access_token);
    assert.equal(restored.status, 200);
    assert.equal(
      restored.body.data.content.version,
      boot.body.data.content.version
    );
    assert.equal(restored.body.data.progress.total_completed_count, 1);
    const other = await login(b, "13800138001");
    assert.notEqual(other.session_id, session.session_id);
    assert.equal(
      (await bApi(b, url, "GET", undefined, other.access_token)).body.data
        .progress.total_completed_count,
      0
    );
    assert.equal((await bApi(b, url)).status, 401);
    assert.equal(
      (
        await fetch("http://127.0.0.1:4199/runtime-config.js", {
          headers: { origin: "http://untrusted.example" },
        })
      ).status,
      403
    );
    const config = await (
      await fetch("http://127.0.0.1:4199/runtime-config.js")
    ).text();
    assert.doesNotMatch(config, /privateKey|tokenSecret|indexSecret|testCode/);
  } finally {
    await b.close();
    fs.rmSync(options.directory, { recursive: true, force: true });
  }
});
test("failed disk commit rejects the operation and restores memory; corrupt data is never reset", async () => {
  const options = baseOptions();
  let b = createLocalBackend(options);
  try {
    const before = b.store.snapshot().memberships.size;
    fs.mkdirSync(path.join(options.directory, "state.bin.next"));
    await assert.rejects(
      b.execute(() => {
        b.store.snapshot().memberships.set("new", { stage: "free" });
      })
    );
    assert.equal(b.store.snapshot().memberships.size, before);
    fs.rmdirSync(path.join(options.directory, "state.bin.next"));
    b.unlock();
    fs.writeFileSync(path.join(options.directory, "state.bin"), "broken");
    assert.throws(() => createLocalBackend(options));
    assert.equal(
      fs.readFileSync(path.join(options.directory, "state.bin"), "utf8"),
      "broken"
    );
  } finally {
    b.unlock();
    fs.rmSync(options.directory, { recursive: true, force: true });
  }
});
