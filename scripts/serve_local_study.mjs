#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../apps/web/dist-local"
);
const port = Number(process.env.SOFTBOOK_LOCAL_PORT || 4173);
if (!fs.existsSync(path.join(root, "index.html")))
  throw new Error("Run npm --prefix apps/web run build:local first.");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://127.0.0.1").pathname
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    let target = path.resolve(root, "." + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (pathname === "/") target = path.join(root, "index.html");
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    const real = fs.realpathSync(target);
    if (!real.startsWith(fs.realpathSync(root) + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(target).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Local study: http://127.0.0.1:${port} (records stay in this browser)`
    )
  );
