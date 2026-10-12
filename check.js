import { SAMPLE_ITEMS, PRODUCTS, TOPICS } from "./data.js";
import { collect } from "./collector.js";
import {
  classifyTopic,
  dedupeItems,
  parseFeed,
  parseXaiNews,
  presentKorean,
  presentKoreanFallback,
  relevant,
  normalizeUrl,
  mapXItems,
  loadX,
} from "./sources.js";
import { needsTranslation, translateText, localizeItems } from "./translate.js";

const topicIds = TOPICS.map((topic) => topic.id).filter((id) => id !== "all");
const required = ["id", "product", "topic", "title", "summary", "source", "sourceType", "url"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (SAMPLE_ITEMS.length < PRODUCTS.length * 3) throw new Error("not enough sample items");

for (const item of SAMPLE_ITEMS) {
  for (const key of required) {
    if (!item[key]) throw new Error(`${item.id} missing ${key}`);
  }
  const url = new URL(item.url);
  if (url.protocol !== "https:") throw new Error(`${item.id} url`);
  if (!topicIds.includes(item.topic)) throw new Error(`${item.id} topic`);
}

for (const product of PRODUCTS) {
  const owned = SAMPLE_ITEMS.filter((item) => item.product === product.id);
  if (owned.length < 5) throw new Error(`${product.id} count ${owned.length}`);
}

assert(classifyTopic("Introducing dots", "OpenAI launches a new agent") === "launch", "topic launch");
assert(classifyTopic("Grok Bot pricing", "subscription plans at $20 per month") === "pricing", "topic price");
assert(classifyTopic("Muse connectors", "Shopify and Slack partnership") === "partnership", "topic partner");
assert(classifyTopic("Hands-on review", "first reactions to the agent") === "reviews", "topic review");
assert(classifyTopic("Privacy lawsuit", "regulators ask about secure VM") === "regulation", "topic regulation");

const shown = presentKorean("launch", "Introducing dots", "Dots by OpenAI keep working.");
assert(shown.title.includes("dots"), shown.title);
assert(shown.lang === "en", "english lang mark");
assert(needsTranslation(shown.title), "english needs translation");
const fallback = presentKoreanFallback("launch", "Introducing dots", "Dots by OpenAI keep working.");
assert(fallback.title.includes("dots") && fallback.title.includes("·EN"), fallback.title);
assert(fallback.summary.includes("출시"), fallback.summary);
const korean = presentKorean("pricing", "오픈AI 닷츠 요금", "월 100달러부터라는 정리");
assert(korean.title.startsWith("오픈AI"), korean.title);
assert(korean.lang === "ko", "korean lang");
assert(!needsTranslation(korean.title), "korean skip");
assert(!korean.summary.includes("관련 보도"), "korean source should stay korean");

assert(needsTranslation("Introducing Grok Bot"), "latin detect");
assert(!needsTranslation("그록 봇 공개"), "hangul skip");

const cachedHit = await translateText("Introducing Grok Bot", { url: "https://example.com/t1", field: "title" });
assert(cachedHit.text.length > 0, "translate non-empty");
const again = await translateText("Introducing Grok Bot", { url: "https://example.com/t1", field: "title" });
assert(again.cached === true, "translation cache hit");
assert(again.text === cachedHit.text, "stable cache");

const localized = await localizeItems([
  {
    id: "t-en",
    product: "grok",
    topic: "launch",
    title: "Introducing Grok Bot",
    summary: "Always-on agents that use your computer.",
    source: "xAI",
    sourceType: "official",
    url: "https://example.com/localize-test",
    publishedAt: "2026-08-11T00:00:00Z",
  },
  {
    id: "t-ko",
    product: "grok",
    topic: "reviews",
    title: "그록 봇 사용기",
    summary: "한국어 요약은 그대로 둡니다.",
    source: "노트",
    sourceType: "rss",
    url: "https://example.com/ko-test",
    publishedAt: "2026-08-12T00:00:00Z",
  },
]);
if (localized[0].translated !== false) {
  assert(/[가-힣]/.test(localized[0].title), `en title should be Korean: ${localized[0].title}`);
  assert(/[가-힣]/.test(localized[0].summary), `en summary should be Korean: ${localized[0].summary}`);
} else {
  assert(localized[0].title.includes("·EN"), localized[0].title);
}
assert(localized[1].title === "그록 봇 사용기", "ko title untouched");
assert(localized[1].summary === "한국어 요약은 그대로 둡니다.", "ko summary untouched");

assert(relevant("dots", "Introducing dots", "Dots by OpenAI are assistants"), "dots official");
assert(!relevant("dots", "Connect the dots", "OpenAI research"), "dots idiom");
assert(!relevant("muse", "Introducing Muse Image", "Meta AI image generation"), "muse image");
assert(relevant("muse", "Introducing Muse", "Meta personal AI agent"), "muse agent");
assert(relevant("grok", "Introducing Grok Bot", "always-on agents"), "grok");
assert(!relevant("dots", "Run Dots.mocr", "OpenAI compatible API"), "dots model");
assert(relevant("muse", "Introducing Muse", "a personal AI agent", "https://about.fb.com/news/introducing-muse-personal-ai-agent/"), "official muse");
assert(!relevant("muse", "Présentation de Meta One", "un service d’abonnement", "https://about.fb.com/news/meta-one/"), "other meta product");
assert(relevant("spark", "Gemini Spark now integrates with Chrome", "Google personal agent"), "spark official");
assert(relevant("spark", "제미나이 스파크는 노트북을 닫아도 일한다", ""), "spark ko");
assert(!relevant("spark", "Gemini Enterprise adds Agent One", "Google enterprise agents with Spark"), "spark enterprise");
assert(!relevant("spark", "Apache Spark 4.1 released", "Databricks"), "apache spark");
assert(!relevant("spark", "Introducing Muse Spark", "Meta model"), "muse spark");
assert(classifyTopic("Investors are overlooking Grok Bot", "a TV hit", "media") === "reviews", "default reviews");
assert(!relevant("grok", "Grok 4.6", "a new model"), "plain grok");

const parsed = parseFeed(`<?xml version="1.0"?><rss><channel>
  <item><title><![CDATA[OpenAI announces Dots]]></title><link>https://example.com/a?utm_source=x</link>
  <description>Agents &amp; plans</description><pubDate>Tue, 29 Sep 2026 10:37:00 GMT</pubDate>
  <News:Source>Example</News:Source></item>
  </channel></rss>`);
assert(parsed.length === 1, "rss count");
assert(parsed[0].title === "OpenAI announces Dots", parsed[0].title);
assert(parsed[0].summary === "Agents & plans", parsed[0].summary);
assert(normalizeUrl(parsed[0].url) === "https://example.com/a", normalizeUrl(parsed[0].url));

const cards = parseXaiNews(`<a href="/news/introducing-grok-bot"><h3>Introducing Grok Bot</h3><p>Own computer.</p><div class="shrink-0 text-xs">Aug 11, 2026</div></a>`);
assert(cards.length === 1 && cards[0].url === "https://x.ai/news/introducing-grok-bot", "xai card");
const seoulDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(cards[0].publishedAt));
assert(seoulDay === "2026-08-11", seoulDay);

const duped = dedupeItems([
  { title: "Same", url: "https://www.Example.com/a/", sourceType: "media", publishedAt: "2026-09-01T00:00:00Z" },
  { title: "Same", url: "https://example.com/a", sourceType: "official", publishedAt: "2026-09-02T00:00:00Z" },
  { title: "Other", url: "https://example.com/b", sourceType: "sns", publishedAt: "2026-09-03T00:00:00Z" },
]);
assert(duped.length === 2, `dedupe ${duped.length}`);
assert(duped.find((item) => item.title === "Same").sourceType === "official", "dedupe rank");

const xRaw = [
  { id: "1844000000000000001", product: "grok", url: "https://x.com/xai/status/1844000000000000001", author: "xai", authorName: "xAI", text: "Grok Bot pricing: $20 per month\nMore details soon.", postedAt: "2026-10-08T01:00:00Z", metrics: { likes: 3 } },
  { id: "1844000000000000002", product: "grok", url: "https://twitter.com/someone/status/1844000000000000002", author: "someone", authorName: "S", text: "Hands-on review of Grok Bot", postedAt: "2026-10-08T02:00:00Z", topic: "reviews" },
  { id: "1844000000000000003", product: "dots", url: "https://x.com/openai/status/1844000000000000003", author: "openai", authorName: "OpenAI", text: "Dots", postedAt: "2026-10-08T03:00:00Z" },
  { id: "bad", product: "grok", url: "https://example.com/nope", author: "x", text: "bad url" },
  { id: "1844000000000000001", product: "grok", url: "https://x.com/xai/status/1844000000000000001", author: "xai", text: "dup", postedAt: "2026-10-08T01:00:00Z" },
];
const xItems = mapXItems("grok", xRaw);
assert(xItems.length === 2, `x map count ${xItems.length}`);
assert(xItems[0].url === "https://x.com/someone/status/1844000000000000002" && xItems[0].topic === "reviews", "x twitter->x + topic kept");
assert(xItems[1].source === "X" && xItems[1].sourceType === "sns" && xItems[1].topic === "pricing", "x shape/topic");
assert(xItems[1].title === "Grok Bot pricing: $20 per month", xItems[1].title);
assert(xItems[1].publishedAt === "2026-10-08T01:00:00.000Z", "x publishedAt");
for (const key of required) assert(xItems[1][key], `x missing ${key}`);
assert((await loadX("grok", { source: "/nonexistent/x-items.json" })).length === 0, "x failure is empty");

const memory = {
  saved: null,
  read() {
    return this.saved;
  },
  write(_product, items) {
    this.saved = items;
  },
};

const failed = await collect({
  product: "grok",
  delayMs: 0,
  cache: { read: () => null, write() {} },
  adapters: [
    { id: "official", label: "공식 블로그", fetch: async () => { throw new Error("down"); } },
    { id: "media", label: "테크 미디어", fetch: async () => [] },
    { id: "sns", label: "SNS 버즈", fetch: async () => [] },
    { id: "rss", label: "RSS·한국어 뉴스", fetch: async () => [] },
  ],
});
assert(failed.usedSample === true, "sample fallback");
assert(failed.fallback === "시뮬레이션/폴백", failed.fallback);
assert(failed.items.length >= 5, "sample size");
assert(failed.log.some((line) => line.id === "sample" && line.note === "폴백"), "fallback log");

memory.saved = [{ id: "cached", product: "dots", topic: "launch", title: "캐시", summary: "이전", source: "x", sourceType: "official", url: "https://example.com/cached", publishedAt: "2026-09-01T00:00:00Z" }];
const stale = await collect({
  product: "dots",
  delayMs: 0,
  cache: memory,
  adapters: [
    { id: "official", label: "공식 블로그", fetch: async () => [] },
    { id: "media", label: "테크 미디어", fetch: async () => { throw new Error("net"); } },
    { id: "sns", label: "SNS 버즈", fetch: async () => [] },
    { id: "rss", label: "RSS·한국어 뉴스", fetch: async () => [] },
  ],
});
assert(stale.usedSample === false && stale.staleCache === true, "stale cache");
assert(stale.fallback == null, "cache is not a simulation flag");
assert(stale.items[0].id === "cached", "cache item");

const live = [];
for (const product of PRODUCTS) {
  const result = await collect({ product: product.id, delayMs: 0 });
  live.push(result);
  const mode = result.log.map((line) => `${line.id}:${line.note}:${line.count}`).join(" ");
  if (result.usedSample) {
    throw new Error(`${product.id} fell back to sample. ${mode}`);
  }
  assert(result.fallback == null, `${product.id} fallback flag`);
  assert(result.items.length >= 1, `${product.id} no items ${mode}`);
  const ids = new Set();
  for (const item of result.items) {
    for (const key of required) {
      if (!item[key]) throw new Error(`${product.id} live missing ${key}`);
    }
    if (!topicIds.includes(item.topic)) throw new Error(`${product.id} bad topic ${item.topic}`);
    const url = new URL(item.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${product.id} url`);
    if (ids.has(item.id)) throw new Error(`${product.id} duplicate id`);
    ids.add(item.id);
    if (SAMPLE_ITEMS.some((sample) => sample.id === item.id)) throw new Error(`${product.id} sample id leaked`);
  }
  console.log(`${product.id} ${result.items.length} ${mode}`);
}

console.log(`ok samples ${SAMPLE_ITEMS.length}; live ${live.map((item) => item.items.length).join("/")}`);
