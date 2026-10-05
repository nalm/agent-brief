import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS } from "./data.js";
import { collect } from "./collector.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const INTERVAL = 30 * 60 * 1000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const blocked = /^(cache|logs|bin)(\/|$)/;

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (blocked.test(rel)) return null;
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

let snapshot = null;
let lastAttempt = 0;
let pending = null;

export async function refreshFeed({ force = false } = {}) {
  if (snapshot && Date.now() - lastAttempt < 15000) return snapshot;
  if (!force && snapshot && Date.now() - lastAttempt < INTERVAL) return snapshot;
  if (pending) return pending;
  pending = (async () => {
    const results = await Promise.all(
      PRODUCTS.map((product) => collect({ product: product.id, delayMs: 0 })),
    );
    const next = {
      collectedAt: new Date().toISOString(),
      intervalMs: INTERVAL,
      products: {},
    };
    for (const result of results) next.products[result.product] = result;
    snapshot = next;
    lastAttempt = Date.now();
    const counts = results.map((result) => `${result.product}:${result.items.length}${result.usedSample ? ":sample" : ""}`).join(" ");
    console.log(`수집 ${next.collectedAt} ${counts}`);
    return snapshot;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/feed") {
    const force = url.searchParams.get("refresh") === "1";
    refreshFeed({ force })
      .then((body) => {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(JSON.stringify(body));
      })
      .catch((error) => {
        if (snapshot) {
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
          });
          res.end(JSON.stringify({ ...snapshot, error: error instanceof Error ? error.message : "수집 실패" }));
          return;
        }
        res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "수집 실패" }));
      });
    return;
  }

  const file = resolveFile(url.pathname);
  if (!file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = types[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`에이전트 브리프  http://127.0.0.1:${port}`);
  refreshFeed({ force: true }).catch((error) => {
    console.error("초기 수집 실패", error instanceof Error ? error.message : error);
  });
  setInterval(() => {
    refreshFeed({ force: true }).catch((error) => {
      console.error("주기 수집 실패", error instanceof Error ? error.message : error);
    });
  }, INTERVAL).unref();
});
