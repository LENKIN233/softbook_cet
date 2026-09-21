#!/usr/bin/env node
// Same v2 API/services as the deployed backend; only transport and storage are local.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import v8 from "node:v8";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require("../infra/cloudbase/functions/softbook-api/index.js");
const library = require("../infra/cloudbase/functions/softbook-api/card-content/index.js");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function atomicWrite(file, bytes) {
  const temp = `${file}.next`;
  const fd = fs.openSync(temp, "w", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
  const dir = fs.openSync(path.dirname(file), "r");
  try {
    fs.fsyncSync(dir);
  } finally {
    fs.closeSync(dir);
  }
}
export function createLocalBackend({
  directory,
  port = 4173,
  webRoot = path.join(ROOT, "apps/web/dist-backend"),
}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid local port.");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockFile = path.join(directory, "server.lock");
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, "utf8"));
    if (!Number.isSafeInteger(pid) || pid <= 0)
      throw new Error("Invalid backend lock; existing data preserved.");
    try {
      process.kill(pid, 0);
      throw new Error("Local backend is already running.");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    fs.unlinkSync(lockFile);
  }
  fs.writeFileSync(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
  const unlock = () => {
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
  };
  try {
    const origin = `http://127.0.0.1:${port}`;
    const keysFile = path.join(directory, "keys.json");
    if (!fs.existsSync(keysFile)) {
      if (fs.existsSync(path.join(directory, "state.bin")))
        throw new Error(
          "Backend keys missing; refusing to replace account identity."
        );
      const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
      atomicWrite(
        keysFile,
        JSON.stringify({
          tokenSecret: crypto.randomBytes(48).toString("hex"),
          indexSecret: crypto.randomBytes(48).toString("hex"),
          privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
          publicKey: publicKey
            .export({ type: "spki", format: "der" })
            .subarray(-32)
            .toString("hex"),
          testCode: String(crypto.randomInt(100000, 1000000)),
        })
      );
    }
    const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
    const store = createMemoryStore({ authIndexSecret: keys.indexSecret });
    const maps = store.snapshot();
    const stateFile = path.join(directory, "state.bin");
    function restore(snapshot) {
      if (
        snapshot.schema !== "local-backend-state.v1" ||
        Object.keys(maps).sort().join() !==
          Object.keys(snapshot.maps ?? {})
            .sort()
            .join() ||
        !Object.values(snapshot.maps).every((value) => value instanceof Map)
      )
        throw new Error(
          "Unreadable backend snapshot; original data preserved."
        );
      for (const [name, map] of Object.entries(maps)) {
        map.clear();
        for (const [key, value] of snapshot.maps[name]) map.set(key, value);
      }
    }
    if (fs.existsSync(stateFile))
      restore(v8.deserialize(fs.readFileSync(stateFile)));
    let saved = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
    function persist() {
      const bytes = v8.serialize({ schema: "local-backend-state.v1", maps });
      if (saved && hash(saved) === hash(bytes)) return;
      if (saved) atomicWrite(stateFile + ".bak", saved);
      atomicWrite(stateFile, bytes);
      saved = bytes;
    }
    const assets = new Map();
    for (const track of ["cet4", "cet6"]) {
      const source = validateCardSourceForImport(
        {
          track,
          source: { id: "card-make-local-backend", label: "软书卡库" },
          card_records: library[track].cards,
          assets: library[track].assets.map(({ asset_path, ...asset }) => ({
            ...asset,
            storage_file_id: `cloud://local-backend/${asset_path}`,
          })),
        },
        track
      );
      source.release = {
        schema_version: "content-release.v1",
        release_id: `local-development-${track}-${source.content_version.slice(
          7,
          19
        )}`,
        track,
        content_version: source.content_version,
        minimum_client_version: "1.0.0",
        parent_release_id: null,
        published_at: new Date().toISOString(),
      };
      const prior = maps.cardSources.get(track);
      if (prior?.content_version === source.content_version)
        source.release = prior.release;
      else if (prior)
        maps.cardSourceVersions.set(`${track}:${prior.content_version}`, prior);
      maps.cardSources.set(track, source);
      for (const asset of library[track].assets) {
        const file = path.join(
          ROOT,
          "apps/mobile/assets/card-audio",
          asset.asset_path.slice(6)
        );
        const bytes = fs.readFileSync(file);
        if (
          bytes.length !== asset.size_bytes ||
          "sha256:" + hash(bytes) !== asset.sha256
        )
          throw new Error(`Corrupt source audio: ${asset.asset_id}`);
        assets.set(asset.asset_id, { file, asset });
      }
    }
    persist();
    const signAsset = (id, expiry) =>
      crypto
        .createHmac("sha256", keys.tokenSecret)
        .update(`${id}:${expiry}`)
        .digest("hex");
    const api = createSoftbookApi({
      runtimeMode: "development",
      allowLegacyV1: false,
      apiKey: "",
      store,
      tokenSecret: keys.tokenSecret,
      authV2IndexSecret: keys.indexSecret,
      smsCode: keys.testCode,
      localAssetOrigin: origin,
      contentManifestSigner: {
        keyId: "local-backend",
        privateKey: crypto.createPrivateKey(keys.privateKey),
      },
      contentAssetUrlResolver: ({ asset, expiresAt }) =>
        `${origin}/local-assets/${
          asset.asset_id
        }?expires=${expiresAt.getTime()}&signature=${signAsset(
          asset.asset_id,
          expiresAt.getTime()
        )}`,
    });
    const runtime = {
      mode: "remote",
      clientKind: "web",
      baseUrl: origin + "/api",
      track: "cet4",
      contentManifestPublicKeys: { "local-backend": keys.publicKey },
    };
    let tail = Promise.resolve();
    async function execute(work) {
      const task = tail.then(async () => {
        const before = v8.serialize({ schema: "local-backend-state.v1", maps });
        try {
          const value = await work();
          persist();
          return value;
        } catch (error) {
          restore(v8.deserialize(before));
          throw error;
        }
      });
      tail = task.catch(() => {});
      return task;
    }
    const workerTimer = setInterval(() => {
      if (maps.accountDeletions.size > 0)
        void execute(() => store.runAccountDeletionWorkerForTest()).catch(
          () => {}
        );
    }, 5000);
    workerTimer.unref();
    const send = (res, status, data, type = "application/json") => {
      res.writeHead(status, {
        "content-type": type,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(
        data === null
          ? ""
          : typeof data === "string" || Buffer.isBuffer(data)
          ? data
          : JSON.stringify(data)
      );
    };
    const server = http.createServer(async (req, res) => {
      try {
        if (
          req.headers.host !== `127.0.0.1:${port}` ||
          (req.headers.origin && req.headers.origin !== origin)
        )
          return send(res, 403, { error: { code: "local_origin_rejected" } });
        const url = new URL(req.url, origin);
        if (url.pathname === "/runtime-config.js")
          return send(
            res,
            200,
            `window.__SOFTBOOK_WEB_RUNTIME__ = ${JSON.stringify(runtime)};`,
            "text/javascript"
          );
        if (url.pathname === "/health")
          return send(res, 200, {
            mode: "local_backend",
            storage: "durable",
            gate_eligible: false,
          });
        if (url.pathname.startsWith("/api/")) {
          if (
            req.method === "POST" &&
            !String(req.headers["content-type"]).startsWith("application/json")
          )
            return send(res, 415, { error: { code: "json_required" } });
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body) > 1048576)
              return send(res, 413, { error: { code: "request_too_large" } });
          }
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : undefined;
          } catch {
            return send(res, 400, { error: { code: "invalid_json" } });
          }
          const result = await execute(() =>
            api.handleHttpRequest({
              method: req.method,
              path: url.pathname.slice(4),
              query: Object.fromEntries(url.searchParams),
              headers: req.headers,
              clientIp: req.socket.remoteAddress,
              body: parsed,
            })
          );
          return send(res, result.statusCode, result.body);
        }
        if (url.pathname.startsWith("/local-assets/")) {
          const id = url.pathname.slice("/local-assets/".length),
            item = assets.get(id),
            expiry = Number(url.searchParams.get("expires")),
            signature = url.searchParams.get("signature") ?? "";
          const expected = signAsset(id, expiry);
          if (
            !item ||
            !Number.isSafeInteger(expiry) ||
            expiry <= Date.now() ||
            signature.length !== expected.length ||
            !crypto.timingSafeEqual(
              Buffer.from(signature),
              Buffer.from(expected)
            )
          )
            return send(res, 403, {
              error: { code: "asset_authorization_expired_or_invalid" },
            });
          return send(res, 200, fs.readFileSync(item.file), "audio/mpeg");
        }
        if (req.method !== "GET" && req.method !== "HEAD")
          return send(res, 405, null);
        const target = path.resolve(
          webRoot,
          "." +
            decodeURIComponent(
              url.pathname === "/" ? "/index.html" : url.pathname
            )
        );
        if (
          !target.startsWith(path.resolve(webRoot) + path.sep) ||
          !fs.existsSync(target) ||
          !fs.statSync(target).isFile() ||
          !fs
            .realpathSync(target)
            .startsWith(fs.realpathSync(webRoot) + path.sep)
        )
          return send(res, 404, "Not found", "text/plain");
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        };
        return send(
          res,
          200,
          fs.readFileSync(target),
          types[path.extname(target)] ?? "application/octet-stream"
        );
      } catch {
        send(res, 503, {
          error: {
            code: "local_backend_unavailable",
            message: "本地服务暂时不可用，记录已保留。",
          },
        });
      }
    });
    return {
      server,
      runtime,
      testCode: keys.testCode,
      store,
      execute,
      close: async () => {
        clearInterval(workerTimer);
        await new Promise((resolve) => server.close(resolve));
        await tail;
        unlock();
      },
      unlock,
    };
  } catch (error) {
    unlock();
    throw error;
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const backend = createLocalBackend({
    directory: path.resolve(
      process.env.SOFTBOOK_LOCAL_BACKEND_DIR ??
        path.join(ROOT, ".tmp/local-backend")
    ),
    port: Number(process.env.SOFTBOOK_LOCAL_BACKEND_PORT ?? 4173),
  });
  fs.writeFileSync(
    path.join(ROOT, "apps/mobile/backend-runtime.local.json"),
    JSON.stringify(
      {
        baseUrl: backend.runtime.baseUrl,
        learningTrack: "cet4",
        contentManifestPublicKeys: backend.runtime.contentManifestPublicKeys,
      },
      null,
      2
    ) + "\n"
  );
  backend.server.listen(
    new URL(backend.runtime.baseUrl).port,
    "127.0.0.1",
    () => {
      console.log(
        `Local backend: ${backend.runtime.baseUrl.replace("/api", "/")}`
      );
      console.log(
        `本地测试验证码：${backend.testCode}（不发送短信，不用于上线）`
      );
    }
  );
  backend.server.on("error", (error) => {
    backend.unlock();
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(
      signal,
      () => void backend.close().then(() => process.exit(0))
    );
}
