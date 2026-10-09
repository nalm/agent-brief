import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_ITEMS } from "./data.js";
import { dedupeItems, loadMedia, loadOfficial, loadRss, loadSns, loadX } from "./sources.js";
import { localizeItems } from "./translate.js";

/**
 * 제품별 실수집.
 * 어댑터 중 하나라도 항목을 주면 그 제품은 샘플을 쓰지 않는다.
 * 전부 실패하면 마지막 성공 캐시를 유지한다.
 * 캐시도 없을 때만 샘플로 폴백하고 fallback 을 "시뮬레이션/폴백" 으로 표시한다.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const cacheFile = path.join(root, "cache", "last-good.json");

async function fetchOfficial({ product }) {
  return loadOfficial(product);
}

async function fetchMedia({ product }) {
  return loadMedia(product);
}

async function fetchSns({ product }) {
  return loadSns(product);
}

async function fetchRss({ product }) {
  return loadRss(product);
}

async function fetchX({ product }) {
  return loadX(product);
}

export const adapters = [
  { id: "official", label: "공식 블로그", fetch: fetchOfficial },
  { id: "media", label: "테크 미디어", fetch: fetchMedia },
  { id: "sns", label: "SNS 버즈", fetch: fetchSns },
  { id: "rss", label: "RSS·한국어 뉴스", fetch: fetchRss },
  { id: "x", label: "X (SNS)", fetch: fetchX },
];

function sampleFor(product) {
  return SAMPLE_ITEMS.filter((item) => item.product === product).map((item) => ({ ...item }));
}

function delay(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDiskCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  } catch {
    return {};
  }
}

function writeDiskCache(data) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  const tmp = `${cacheFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, cacheFile);
}

let cacheQueue = Promise.resolve();

function enqueueCache(task) {
  const run = cacheQueue.then(task, task);
  cacheQueue = run.then(() => {}, () => {});
  return run;
}

const diskCache = {
  read(product) {
    const all = readDiskCache();
    const pack = all[product];
    if (!pack || !Array.isArray(pack.items) || !pack.items.length) return null;
    return pack.items;
  },
  write(product, items) {
    return enqueueCache(() => {
      const all = readDiskCache();
      all[product] = { savedAt: new Date().toISOString(), items };
      writeDiskCache(all);
    });
  },
};

export async function collect({ product, delayMs = 0, adapters: adapterList = adapters, cache = diskCache } = {}) {
  const log = [];
  const live = [];
  let failures = 0;

  for (const adapter of adapterList) {
    const started = Date.now();
    try {
      const result = await adapter.fetch({ product });
      const items = Array.isArray(result) ? result.filter((item) => item && item.product === product) : [];
      live.push(...items);
      log.push({
        id: adapter.id,
        label: adapter.label,
        count: items.length,
        ms: Date.now() - started,
        note: items.length ? "수집" : "없음",
      });
      if (!items.length) failures += 1;
    } catch (error) {
      failures += 1;
      log.push({
        id: adapter.id,
        label: adapter.label,
        count: 0,
        ms: Date.now() - started,
        note: "오류",
        detail: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  await delay(delayMs);

  const deduped = dedupeItems(live).sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  if (deduped.length) {
    const localized = await localizeItems(deduped);
    try {
      await cache.write?.(product, localized);
    } catch {
      /* 캐시 실패는 수집 결과를 지우지 않는다 */
    }
    const translated = localized.filter((item) => item.translated !== false).length;
    log.push({
      id: "translate",
      label: "한국어 번역",
      count: translated,
      ms: 0,
      note: `${translated}/${localized.length}`,
    });
    log.push({ id: "sample", label: "샘플 피드", count: 0, ms: 0, note: "사용 안 함" });
    return {
      product,
      items: localized,
      log,
      usedSample: false,
      fallback: null,
      staleCache: false,
      collectedAt: new Date().toISOString(),
    };
  }

  let cached = null;
  try {
    cached = cache.read?.(product) || null;
  } catch {
    cached = null;
  }
  if (cached && cached.length) {
    const localized = await localizeItems(cached);
    log.push({
      id: "cache",
      label: "마지막 성공 캐시",
      count: localized.length,
      ms: 0,
      note: "유지",
    });
    log.push({ id: "sample", label: "샘플 피드", count: 0, ms: 0, note: "사용 안 함" });
    return {
      product,
      items: localized,
      log,
      usedSample: false,
      fallback: null,
      staleCache: true,
      collectedAt: new Date().toISOString(),
    };
  }

  const items = await localizeItems(sampleFor(product));
  log.push({
    id: "sample",
    label: "샘플 피드",
    count: items.length,
    ms: 0,
    note: "폴백",
  });
  return {
    product,
    items,
    log,
    usedSample: true,
    fallback: "시뮬레이션/폴백",
    staleCache: false,
    collectedAt: new Date().toISOString(),
    adapterFailures: failures,
  };
}
