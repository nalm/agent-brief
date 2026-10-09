#!/usr/bin/env node
/**
 * X 게시물 JSON 을 검증·병합해 x-data 브랜치로 push 한다. master 작업 트리는 건드리지 않는다.
 *
 *   node scripts/push-x-items.mjs <new-items.json> [--dry-run]
 *
 * 입력: { "items": [...] } 또는 [...]. 항목 스키마는 sources.js / x-data README 참고.
 * - 하나라도 스키마에 어긋나면 아무것도 쓰지 않고 종료 코드 1.
 * - 기존 항목과 id 로 병합(입력이 우선), 14일 지난 항목 제거, 최신 150개만 유지.
 * - 바뀐 것이 없으면 커밋하지 않는다.
 * 환경변수: X_DATA_WORKTREE (기본 /workspace/agent-brief-xdata), X_DATA_BRANCH (기본 x-data)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PRODUCTS = ["grok", "dots", "muse"];
const TOPICS = ["launch", "pricing", "partnership", "reviews", "regulation"];
const METRICS = ["replies", "reposts", "likes", "views"];
const MAX_ITEMS = 150;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const BRANCH = process.env.X_DATA_BRANCH || "x-data";
const WORKTREE = process.env.X_DATA_WORKTREE || "/workspace/agent-brief-xdata";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "x-items.json";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const input = args.find((arg) => !arg.startsWith("--"));
if (!input) {
  console.error("usage: node scripts/push-x-items.mjs <new-items.json> [--dry-run]");
  process.exit(2);
}

function git(cwd, ...cmd) {
  return execFileSync("git", cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function validateItem(item, index) {
  const errors = [];
  const at = `items[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) return [`${at}: not an object`];
  if (typeof item.id !== "string" || !/^\d{1,25}$/.test(item.id)) errors.push(`${at}.id: digit string required`);
  if (!PRODUCTS.includes(item.product)) errors.push(`${at}.product: one of ${PRODUCTS.join("|")}`);
  const m = typeof item.url === "string" ? item.url.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/) : null;
  if (!m) errors.push(`${at}.url: must be https://x.com/<handle>/status/<id>`);
  else {
    if (m[2] !== item.id) errors.push(`${at}.url: status id ${m[2]} != id ${item.id}`);
    if (typeof item.author === "string" && m[1].toLowerCase() !== item.author.toLowerCase()) errors.push(`${at}.author: ${item.author} != url handle ${m[1]}`);
  }
  if (typeof item.author !== "string" || !/^[A-Za-z0-9_]{1,15}$/.test(item.author)) errors.push(`${at}.author: handle without @`);
  if (typeof item.authorName !== "string") errors.push(`${at}.authorName: string required`);
  if (typeof item.text !== "string" || !item.text.trim()) errors.push(`${at}.text: non-empty string required`);
  if (typeof item.postedAt !== "string" || !Number.isFinite(Date.parse(item.postedAt))) errors.push(`${at}.postedAt: ISO date required`);
  if (item.metrics !== undefined) {
    if (!item.metrics || typeof item.metrics !== "object" || Array.isArray(item.metrics)) errors.push(`${at}.metrics: object`);
    else for (const [key, value] of Object.entries(item.metrics)) {
      if (!METRICS.includes(key)) errors.push(`${at}.metrics.${key}: unknown key`);
      else if (typeof value !== "number" || !Number.isFinite(value) || value < 0) errors.push(`${at}.metrics.${key}: non-negative number`);
    }
  }
  if (item.topic !== undefined && !TOPICS.includes(item.topic)) errors.push(`${at}.topic: one of ${TOPICS.join("|")}`);
  const extra = Object.keys(item).filter((key) => !["id", "product", "url", "author", "authorName", "text", "postedAt", "metrics", "topic"].includes(key));
  if (extra.length) errors.push(`${at}: unknown keys ${extra.join(",")}`);
  return errors;
}

function clean(item) {
  const out = {
    id: item.id,
    product: item.product,
    url: item.url,
    author: item.author,
    authorName: item.authorName,
    text: item.text,
    postedAt: new Date(Date.parse(item.postedAt)).toISOString(),
  };
  if (item.metrics) out.metrics = item.metrics;
  if (item.topic) out.topic = item.topic;
  return out;
}

// 1. 입력 검증
let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(input, "utf8"));
} catch (error) {
  console.error(`cannot read ${input}: ${error.message}`);
  process.exit(1);
}
const incoming = Array.isArray(parsed) ? parsed : parsed?.items;
if (!Array.isArray(incoming)) {
  console.error('input must be an array or { "items": [...] }');
  process.exit(1);
}
const errors = incoming.flatMap(validateItem);
if (errors.length) {
  console.error(`invalid input (${errors.length} problems):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

// 2. 작업 트리 준비 (없으면 만들고, 있으면 fast-forward)
if (!fs.existsSync(path.join(WORKTREE, ".git"))) {
  git(REPO, "fetch", "origin", BRANCH);
  git(REPO, "worktree", "add", WORKTREE, BRANCH);
}
if (git(WORKTREE, "rev-parse", "--abbrev-ref", "HEAD") !== BRANCH) {
  console.error(`${WORKTREE} is not on ${BRANCH}`);
  process.exit(1);
}
if (git(WORKTREE, "status", "--porcelain")) {
  console.error(`${WORKTREE} has uncommitted changes; resolve them first`);
  process.exit(1);
}
git(WORKTREE, "pull", "--ff-only", "--quiet", "origin", BRANCH);

// 3. 병합
const target = path.join(WORKTREE, FILE);
const current = JSON.parse(fs.readFileSync(target, "utf8"));
const before = Array.isArray(current.items) ? current.items : [];
const byId = new Map(before.map((item) => [item.id, item]));
let added = 0;
for (const item of incoming.map(clean)) {
  if (!byId.has(item.id)) added += 1;
  byId.set(item.id, item);
}
const cutoff = Date.now() - MAX_AGE_MS;
const merged = [...byId.values()]
  .filter((item) => Date.parse(item.postedAt) >= cutoff)
  .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt) || b.id.localeCompare(a.id))
  .slice(0, MAX_ITEMS);

if (JSON.stringify(merged) === JSON.stringify(before)) {
  console.log(`no changes (${merged.length} items); nothing committed`);
  process.exit(0);
}
const summary = `${merged.length} items, +${added} new, ${before.length + added - merged.length} dropped`;
if (dryRun) {
  console.log(`dry run: would write ${summary}`);
  process.exit(0);
}

// 4. 커밋·push (push 경합 시 한 번 rebase 후 재시도. force push 없음)
fs.writeFileSync(target, `${JSON.stringify({ updatedAt: new Date().toISOString(), items: merged }, null, 2)}\n`);
git(WORKTREE, "add", FILE);
git(WORKTREE, "commit", "--quiet", "-m", `data: update x-items (${summary})`);
try {
  git(WORKTREE, "push", "--quiet", "origin", BRANCH);
} catch {
  git(WORKTREE, "pull", "--rebase", "--quiet", "origin", BRANCH);
  git(WORKTREE, "push", "--quiet", "origin", BRANCH);
}
console.log(`pushed ${git(WORKTREE, "rev-parse", "--short", "HEAD")} to ${BRANCH}: ${summary}`);
