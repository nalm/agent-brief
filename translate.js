/**
 * EN → KO 제목·요약 번역.
 * 1) DeepL (DEEPL_API_KEY 있을 때; Free/Pro 호스트 자동)
 * 2) LibreTranslate 공개 인스턴스 (키 없이 되면)
 * 3) MyMemory 무료 API (일일 단어 한도 있음)
 * 실패 시 원문 유지 + translated:false 표시.
 * cache/translations.json 에 URL·텍스트 해시로 캐시해 30분 재수집 때 재번역을 피한다.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const cacheFile = path.join(root, "cache", "translations.json");

const LIBRE_ENDPOINTS = [
  "https://libretranslate.com/translate",
  "https://translate.terraprint.co/translate",
];

const MYMEMORY = "https://api.mymemory.translated.net/get";
const MYMEMORY_DE = "agent-brief-mvp@users.noreply.github.com";
const MAX_CHUNK = 450;
const CONCURRENCY = 2;
const GAP_MS = 120;

let memory = null;
let dirty = false;
let deeplDeadUntil = 0;
let libreDeadUntil = 0;
let myMemoryDeadUntil = 0;
let writeQueue = Promise.resolve();

function readCache() {
  if (memory) return memory;
  try {
    memory = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!memory || typeof memory !== "object") memory = { byHash: {}, byUrl: {} };
    if (!memory.byHash) memory.byHash = {};
    if (!memory.byUrl) memory.byUrl = {};
  } catch {
    memory = { byHash: {}, byUrl: {} };
  }
  return memory;
}

function scheduleFlush() {
  if (!dirty) return;
  writeQueue = writeQueue.then(() => {
    if (!dirty) return;
    dirty = false;
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(readCache()));
    fs.renameSync(tmp, cacheFile);
  }, () => {});
}

function textHash(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex").slice(0, 24);
}

function urlFieldKey(url, field, hash) {
  return `${hash}|${url || ""}|${field}`;
}

export function needsTranslation(text) {
  if (!text) return false;
  const hangul = (String(text).match(/[\uAC00-\uD7A3]/g) || []).length;
  const latin = (String(text).match(/[A-Za-z]/g) || []).length;
  const letters = hangul + latin;
  if (!letters) return false;
  if (hangul / letters >= 0.2) return false;
  return latin / letters >= 0.5;
}

function lookup(url, field, original) {
  const cache = readCache();
  const hash = textHash(original);
  const byUrl = cache.byUrl[urlFieldKey(url, field, hash)];
  if (byUrl && byUrl.text) return byUrl;
  const byHash = cache.byHash[hash];
  if (byHash && byHash.text) return byHash;
  return null;
}

function store(url, field, original, translated, provider) {
  const cache = readCache();
  const hash = textHash(original);
  const entry = {
    text: translated,
    provider,
    at: new Date().toISOString(),
    src: original.slice(0, 120),
  };
  cache.byHash[hash] = entry;
  if (url) cache.byUrl[urlFieldKey(url, field, hash)] = entry;
  dirty = true;
  scheduleFlush();
}


async function viaDeepL(text) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  if (Date.now() < deeplDeadUntil) return null;
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  try {
    const body = new URLSearchParams();
    body.set("text", text);
    body.set("source_lang", "EN");
    body.set("target_lang", "KO");
    const response = await fetch(host, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429 || response.status === 456) {
      deeplDeadUntil = Date.now() + 30 * 60 * 1000;
      return null;
    }
    if (!response.ok) return null;
    const data = await response.json();
    const out = data?.translations?.[0]?.text || "";
    if (!out || !String(out).trim()) return null;
    if (String(out).trim() === String(text).trim()) return null;
    return { text: String(out).trim(), provider: "deepl" };
  } catch {
    return null;
  }
}

async function viaLibre(text) {
  if (Date.now() < libreDeadUntil) return null;
  for (const endpoint of LIBRE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ q: text, source: "en", target: "ko", format: "text" }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429 || response.status === 403 || response.status === 401) {
        libreDeadUntil = Date.now() + 30 * 60 * 1000;
        continue;
      }
      if (!response.ok) continue;
      const data = await response.json();
      const out = data?.translatedText || data?.translation || "";
      if (out && out.trim() && out.trim() !== text.trim()) {
        return { text: out.trim(), provider: `libre:${new URL(endpoint).hostname}` };
      }
    } catch {
      /* try next */
    }
  }
  libreDeadUntil = Date.now() + 10 * 60 * 1000;
  return null;
}

async function viaMyMemory(text) {
  if (Date.now() < myMemoryDeadUntil) return null;
  try {
    const url = new URL(MYMEMORY);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "en|ko");
    url.searchParams.set("de", MYMEMORY_DE);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      myMemoryDeadUntil = Date.now() + 30 * 60 * 1000;
      return null;
    }
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.quotaFinished) {
      myMemoryDeadUntil = Date.now() + 30 * 60 * 1000;
      return null;
    }
    const status = Number(data?.responseStatus);
    if (status === 429) {
      myMemoryDeadUntil = Date.now() + 30 * 60 * 1000;
      return null;
    }
    if (status !== 200) return null;
    const out = data?.responseData?.translatedText || "";
    if (!out || /MYMEMORY WARNING/i.test(out)) return null;
    if (out.trim() === text.trim()) return null;
    return { text: out.trim(), provider: "mymemory" };
  } catch {
    return null;
  }
}

function splitChunks(text) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_CHUNK) return [clean];
  const parts = [];
  let rest = clean;
  while (rest.length > MAX_CHUNK) {
    let cut = rest.lastIndexOf(". ", MAX_CHUNK);
    if (cut < MAX_CHUNK * 0.4) cut = rest.lastIndexOf(" ", MAX_CHUNK);
    if (cut < MAX_CHUNK * 0.4) cut = MAX_CHUNK;
    parts.push(rest.slice(0, cut + (rest[cut] === "." ? 1 : 0)).trim());
    rest = rest.slice(cut + (rest[cut] === "." ? 1 : 0)).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function translateOnce(text) {
  const deepl = await viaDeepL(text);
  if (deepl) return deepl;
  const libre = await viaLibre(text);
  if (libre) return libre;
  return viaMyMemory(text);
}

export async function translateText(text, { url = "", field = "text" } = {}) {
  const original = String(text || "").replace(/\s+/g, " ").trim();
  if (!original || !needsTranslation(original)) {
    return { text: original, cached: true, provider: "skip", translated: false };
  }
  const hit = lookup(url, field, original);
  if (hit) {
    return { text: hit.text, cached: true, provider: hit.provider || "cache", translated: true };
  }

  const chunks = splitChunks(original);
  const translated = [];
  let provider = "none";
  for (const chunk of chunks) {
    let result = null;
    try {
      result = await translateOnce(chunk);
    } catch {
      result = null;
    }
    if (!result?.text) {
      return { text: original, cached: false, provider: "failed", translated: false };
    }
    translated.push(result.text);
    provider = result.provider;
    if (chunks.length > 1) await delay(GAP_MS);
  }
  const joined = translated.join(" ").replace(/\s+/g, " ").trim();
  store(url, field, original, joined, provider);
  return { text: joined, cached: false, provider, translated: true };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await worker(items[i], i);
      await delay(GAP_MS);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

const TOPIC_LEAD = {
  launch: "출시·공개",
  pricing: "가격·요금",
  partnership: "제휴·연동",
  reviews: "후기·반응",
  regulation: "규제·보안",
};

function glossTitle(title) {
  const rules = [
    [/^Introducing\s+(.+)$/i, "$1 공개"],
    [/^(.+?)\s+launches\s+(.+)$/i, "$1, $2 출시"],
    [/^(.+?)\s+announces\s+(.+)$/i, "$1, $2 발표"],
    [/^(.+?)\s+unveils\s+(.+)$/i, "$1, $2 공개"],
    [/^(.+?)\s+is now included with more plans$/i, "$1, 더 많은 요금제에 포함"],
    [/^(.+?)\s+is now available\b(.*)$/i, "$1 이용 범위 확대$2"],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(title)) return title.replace(pattern, replacement);
  }
  return title;
}

function markEnglish(topic, title, summary) {
  const lead = TOPIC_LEAD[topic] || "소식";
  const detail = summary && summary.toLowerCase() !== title.toLowerCase() ? summary : title;
  return {
    title: `${glossTitle(title)} ·EN`,
    summary: `${lead} 관련 보도(미번역). ${detail}`,
  };
}

/**
 * 수집 직후 호출. 한국어 항목은 그대로, 라틴 문자 위주 제목·요약만 번역.
 */
export async function localizeItems(items) {
  if (!Array.isArray(items) || !items.length) return items || [];

  const jobs = [];
  for (const item of items) {
    if (needsTranslation(item.title)) jobs.push({ item, field: "title", text: item.title });
    if (needsTranslation(item.summary)) jobs.push({ item, field: "summary", text: item.summary });
  }

  if (!jobs.length) {
    return items.map((item) => ({ ...item, translated: item.translated ?? true }));
  }

  await mapPool(jobs, CONCURRENCY, async (job) => {
    const result = await translateText(job.text, { url: job.item.url, field: job.field });
    job.result = result;
    return result;
  });

  const byItem = new Map();
  for (const job of jobs) {
    let pack = byItem.get(job.item);
    if (!pack) {
      pack = { title: null, summary: null };
      byItem.set(job.item, pack);
    }
    pack[job.field] = job.result;
  }

  return items.map((item) => {
    const pack = byItem.get(item);
    if (!pack) return { ...item, translated: true };

    const next = { ...item };
    let ok = true;
    if (pack.title) {
      if (pack.title.translated) next.title = pack.title.text;
      else ok = false;
    }
    if (pack.summary) {
      if (pack.summary.translated) next.summary = pack.summary.text;
      else ok = false;
    }
    if (!ok) {
      const marked = markEnglish(item.topic, item.title, item.summary);
      if (pack.title && !pack.title.translated) next.title = marked.title;
      if (pack.summary && !pack.summary.translated) next.summary = marked.summary;
      next.translated = false;
    } else {
      next.translated = true;
    }
    return next;
  });
}

export function flushTranslationCache() {
  dirty = true;
  scheduleFlush();
  return writeQueue;
}
