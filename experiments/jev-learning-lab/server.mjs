import http from "node:http";
import { pathToFileURL } from "node:url";
import { scenarios } from "./fixtures/scenarios.mjs";
import { evaluateSnapshot } from "./src/algorithm.mjs";
import { fixtureFor } from "./src/evaluation.mjs";
import { createJevProvider } from "./src/provider.mjs";

export function createLabServer({
  liveProvider = createJevProvider({ maxCalls: 20 }),
} = {}) {
  let liveBusy = false;
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body, null, 2));
    };
    const authority = `127.0.0.1:${res.socket.localPort}`;
    if (
      req.headers.host !== authority ||
      (req.headers.origin && req.headers.origin !== `http://${authority}`)
    ) {
      send(403, { error: "loopback_origin_required" });
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      send(200, {
        environment: "test",
        dataSource: "synthetic",
        productionConnected: false,
        defaultProvider: "fixture",
        liveKeyConfigured: Boolean(process.env.TYPESAFE_API_KEY),
      });
      return;
    }
    if (req.method === "GET" && req.url === "/scenarios") {
      send(
        200,
        scenarios().map((s) => ({ id: s.id, title: s.title }))
      );
      return;
    }
    if (req.method !== "POST" || req.url !== "/evaluate") {
      send(404, { error: "not_found" });
      return;
    }
    if (req.headers["content-type"] !== "application/json") {
      send(415, { error: "application_json_required" });
      return;
    }
    let held = false;
    try {
      let body = "";
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) {
          send(413, { error: "request_too_large" });
          return;
        }
        body += chunk.toString("utf8");
      }
      const data = JSON.parse(body);
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.keys(data).some(
          (k) => !["scenario", "provider", "mode"].includes(k)
        )
      )
        throw new Error("input");
      const scenario = scenarios().find((s) => s.id === data.scenario);
      const kind = data.provider ?? "fixture";
      const mode = data.mode ?? "shadow";
      if (
        !scenario ||
        !["fixture", "jev"].includes(kind) ||
        !["shadow", "rerank"].includes(mode)
      )
        throw new Error("input");
      if (kind === "jev" && liveBusy) {
        send(429, { error: "live_call_in_progress" });
        return;
      }
      if (kind === "jev") {
        liveBusy = true;
        held = true;
      }
      const decision = await evaluateSnapshot(scenario.snapshot, {
        provider: kind === "jev" ? liveProvider : fixtureFor(scenario),
        mode,
      });
      send(200, decision);
    } catch {
      send(400, { error: "invalid_test_request" });
    } finally {
      if (held) liveBusy = false;
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.JEV_LAB_PORT ?? 4319);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid JEV_LAB_PORT");
  const server = createLabServer();
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Jev learning lab: http://127.0.0.1:${port}/health (synthetic data only)`
    )
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      server.close();
      server.closeAllConnections();
    });
}
