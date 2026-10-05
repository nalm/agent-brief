/**
 * 실수집 원천. 기사 본문은 긁지 않고 제목·짧은 설명·링크·시각만 담는다.
 *
 * 쓰는 곳
 * - OpenAI News RSS (https://openai.com/news/rss.xml). robots.txt Allow: /.
 * - Meta Newsroom RSS + 공개 WP JSON (about.fb.com). robots는 경로에 /search/ 가 들어간 주소만 막고
 *   피드·wp-json 검색은 막지 않는다. HTML 검색 페이지는 쓰지 않는다.
 * - x.ai/news 목록 HTML 한 페이지. robots Allow: /, Content-Signal ai-input=yes.
 *   기사 본문 페이지는 열지 않는다.
 * - Bing News RSS (format=RSS). robots.txt에 /news 금지는 없다.
 *   일반 이용약관은 자동 수집을 넓게 제한할 수 있어, 30분에 제품당 소수 질의만 하고
 *   제목·요약·링크만 저장한다. 추적 리다이렉트는 매체 URL로 푼다.
 * - Hacker News의 공개 Algolia API. HN HTML은 긁지 않는다.
 *
 * 쓰지 않는 곳
 * - Google News RSS. robots.txt가 User-agent: * 에 Disallow: / 이다.
 * - Reddit. 비로그인 스크랩과 API 약관이 맞지 않는다.
 * - TechCrunch. 다수 AI 크롤러 User-agent를 Disallow 한다. 대체 피드가 있다.
 * - GDELT. 공개 API이나 이 환경에서 429(5초 1회 제한)가 나 안정적이지 않다.
 */

const UA = "AgentBriefMVP/0.1 (news brief; headlines only; RSS and public APIs)";

const memo = new Map();
const MEMO_MS = 5 * 60 * 1000;

export function clearFetchMemo() {
  memo.clear();
}

export async function fetchText(url) {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.body;
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/atom+xml, application/xml, application/json, text/html;q=0.8, */*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  memo.set(url, { at: Date.now(), body });
  return body;
}

export function decodeHtml(value) {
  if (!value) return "";
  let text = String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
  return text.replace(/\s+/g, " ").trim();
}

function tagValue(block, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const match = block.match(re);
  return match ? decodeHtml(match[1]) : "";
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)];
  let fallback = "";
  for (const link of links) {
    const attrs = link[1];
    const href = attrs.match(/\bhref="([^"]+)"/i)?.[1] || "";
    if (!href) continue;
    const rel = attrs.match(/\brel="([^"]+)"/i)?.[1] || "alternate";
    if (rel.split(/\s+/).includes("alternate")) return decodeHtml(href);
    if (!fallback) fallback = decodeHtml(href);
  }
  return fallback;
}

export function parseFeed(xml) {
  if (!xml || !/<item\b|<entry\b/i.test(xml)) return [];
  const chunks = String(xml).split(/<item\b|<entry\b/i).slice(1);
  const items = [];
  for (const chunk of chunks) {
    const end = chunk.search(/<\/item>|<\/entry>/i);
    const block = end >= 0 ? chunk.slice(0, end) : chunk;
    const title = tagValue(block, "title");
    let link = tagValue(block, "link") || atomLink(block);
    const summary = tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content");
    const publishedRaw =
      tagValue(block, "pubDate") ||
      tagValue(block, "updated") ||
      tagValue(block, "published") ||
      tagValue(block, "dc:date");
    const source = tagValue(block, "News:Source") || tagValue(block, "source");
    if (!title || !link) continue;
    items.push({
      title,
      summary,
      url: link,
      publishedAt: toIso(publishedRaw),
      source,
    });
  }
  return items;
}

export function parseXaiNews(html) {
  const items = [];
  const re = /<a\b[^>]*\bhref="(\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const block = match[2];
    const title = decodeHtml(block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    const summary = decodeHtml(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const dateText = decodeHtml(block.match(/<div class="shrink-0[\s\S]*?>([\s\S]*?)<\/div>/i)?.[1] || "");
    if (!title) continue;
    items.push({
      title,
      summary,
      url: `https://x.ai${match[1]}`,
      publishedAt: toIso(dateText),
      source: "xAI",
    });
  }
  return items;
}

export function unwrapUrl(value) {
  try {
    const url = new URL(value);
    if (/(^|\.)bing\.com$/i.test(url.hostname) && url.searchParams.get("url")) {
      return url.searchParams.get("url");
    }
    return url.href;
  } catch {
    return value;
  }
}

export function normalizeUrl(value) {
  try {
    const url = new URL(unwrapUrl(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "ref" || key === "ocid") url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    const query = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${path}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

export function toIso(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function hangulRatio(value) {
  const letters = value.match(/[A-Za-z\uAC00-\uD7A3]/g) || [];
  if (!letters.length) return 0;
  const hangul = letters.filter((char) => /[\uAC00-\uD7A3]/.test(char)).length;
  return hangul / letters.length;
}

function clip(value, max) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
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

const SIGNALS = [
  ["regulation", [
    [/보안|규제|개인정보|프라이버시|소송|과징금|암호화/g, 3],
    [/\b(privacy|private|permission|lawsuit|gdpr|regulat\w*|encrypt\w*|compliance|breach|secure vm)\b/gi, 3],
    [/\b(security|banned|ban)\b/gi, 2],
  ]],
  ["pricing", [
    [/가격|요금|구독/g, 3],
    [/\b(pricing|subscription|\$\d[\d,]*|per month)\b/gi, 3],
    [/\b(price|included with)\b/gi, 2],
  ]],
  ["partnership", [
    [/제휴|협력|연동|파트너/g, 3],
    [/\b(partnership|partner(?:s|ed|ing)?|integrat\w*|connector|teams up|shopify|slack)\b/gi, 3],
  ]],
  ["reviews", [
    [/후기|리뷰|비교|반응|바이럴/g, 3],
    [/\b(review|hands-on|compared|comparison|reaction|viral|opinion|vs\.?)\b/gi, 3],
    [/\b(show hn|open[- ]source|alternative)\b/gi, 2],
  ]],
  ["launch", [
    [/출시|공개|발표|베타/g, 3],
    [/\b(launch\w*|introduc\w*|unveil\w*|announc\w*|debut|roll(?:s|ed|ing)? out|now available)\b/gi, 3],
  ]],
];

export function classifyTopic(title, summary, sourceType) {
  const heading = title || "";
  const text = `${heading}\n${summary || ""}`;
  let best = "launch";
  let bestScore = 0;
  for (const [topic, rules] of SIGNALS) {
    let score = 0;
    for (const [pattern, weight] of rules) {
      const inTitle = heading.match(pattern)?.length || 0;
      const inBody = text.match(pattern)?.length || 0;
      if (inTitle) score += inTitle * weight * 2;
      else score += inBody * weight;
    }
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  if (bestScore === 0) return sourceType === "official" ? "launch" : "reviews";
  return best;
}

export function presentKorean(topic, title, summary) {
  const cleanTitle = decodeHtml(title);
  const cleanSummary = decodeHtml(summary || "");
  if (hangulRatio(cleanTitle) >= 0.2) {
    const body = hangulRatio(cleanSummary) >= 0.2 && cleanSummary !== cleanTitle ? cleanSummary : cleanTitle;
    return { title: clip(cleanTitle, 160), summary: clip(body, 200), lang: "ko" };
  }
  // 영문·라틴 위주는 원문을 유지한다. collector 가 localizeItems 로 번역한다.
  // 번역 실패 시에만 glossTitle + 주제 꼬리표(·EN) 폴백을 쓴다.
  const detail = cleanSummary && cleanSummary.toLowerCase() !== cleanTitle.toLowerCase() ? cleanSummary : cleanTitle;
  return {
    title: clip(cleanTitle, 160),
    summary: clip(detail, 200),
    lang: "en",
  };
}

/** 번역 실패 시 UI용 짧은 한국어 표시. translate.js 의 markEnglish 와 같은 의도. */
export function presentKoreanFallback(topic, title, summary) {
  const cleanTitle = decodeHtml(title);
  const cleanSummary = decodeHtml(summary || "");
  const lead = TOPIC_LEAD[topic] || "소식";
  const detail = cleanSummary && cleanSummary.toLowerCase() !== cleanTitle.toLowerCase() ? cleanSummary : cleanTitle;
  return {
    title: clip(`${glossTitle(cleanTitle)} ·EN`, 160),
    summary: clip(`${lead} 관련 보도(미번역). ${detail}`, 200),
    lang: "en",
  };
}

function mentionsMuse(value) {
  return /\bMuse\b|뮤즈/.test(value || "");
}

export function relevant(product, title, summary, url = "") {
  const text = `${title || ""} ${summary || ""}`;
  const heading = title || "";
  if (product === "grok") return /grok[\s-]?bot|그록\s?봇|그록봇/i.test(text);
  if (product === "dots") {
    if (/\bdotlink\b|polka dots|connect the dots|dots\.\w+/i.test(text)) return false;
    const named = /\bdots\b/i.test(heading) || /닷츠|['‘“]닷['’”]/.test(heading);
    const context = /openai|오픈\s?AI|chatgpt|devday|astra|agent|에이전트|유럽|europe/i.test(text);
    return named && context;
  }
  if (product === "muse") {
    if (/muse\s+(image|spark)\b/i.test(text)) return false;
    const head = `${heading} ${(summary || "").slice(0, 180)}`;
    if (!mentionsMuse(head)) return false;
    const fromMeta = /about\.fb\.com|fb\.com\/news|meta\.com/i.test(url || "");
    const hasMeta = fromMeta || /\b(meta|facebook|whatsapp)\b|메타/i.test(text);
    return hasMeta;
  }
  return false;
}

function keepLanguage(title) {
  const hangul = (title.match(/[\uAC00-\uD7A3]/g) || []).length;
  const latin = (title.match(/[A-Za-z]/g) || []).length;
  const kana = (title.match(/[\u3040-\u30ff]/g) || []).length;
  const han = (title.match(/[\u4e00-\u9fff]/g) || []).length;
  const letters = hangul + latin + kana + han;
  if (!letters) return true;
  if (kana / letters >= 0.12) return false;
  if (hangul / letters >= 0.12) return true;
  if (han / letters >= 0.45 && hangul === 0) return false;
  return latin / letters >= 0.35;
}

export function itemId(product, url) {
  const key = `${product}|${normalizeUrl(url)}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${product}-${(hash >>> 0).toString(36)}`;
}

const RANK = { official: 4, media: 3, rss: 2, sns: 1 };

export function dedupeItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const urlKey = normalizeUrl(item.url);
    const titleKey = (item.title || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const key = urlKey || titleKey;
    if (!key) continue;
    const titleOnly = `title:${titleKey}`;
    const prev = byKey.get(key) || (titleKey ? byKey.get(titleOnly) : null);
    if (!prev) {
      byKey.set(key, item);
      if (titleKey) byKey.set(titleOnly, item);
      continue;
    }
    const prevRank = RANK[prev.sourceType] || 0;
    const nextRank = RANK[item.sourceType] || 0;
    if (nextRank > prevRank) {
      byKey.set(key, item);
      if (titleKey) byKey.set(titleOnly, item);
    }
  }
  const seen = new Set();
  const unique = [];
  for (const item of byKey.values()) {
    if (seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }
  return unique;
}

function finish(product, sourceType, sourceName, raw, limit) {
  const items = [];
  for (const entry of raw) {
    if (!relevant(product, entry.title, entry.summary, entry.url)) continue;
    if (sourceType === "rss" && !keepLanguage(entry.title || "")) continue;
    if (sourceType === "sns" && /\b(show hn|alternative|open[- ]source|clone|like bots|-style)\b/i.test(entry.title || "")) continue;
    const url = normalizeUrl(entry.url);
    if (!url) continue;
    const topic = classifyTopic(entry.title, entry.summary, sourceType);
    const text = presentKorean(topic, entry.title, entry.summary);
    items.push({
      id: itemId(product, url),
      product,
      topic,
      title: text.title,
      summary: text.summary,
      source: entry.source || sourceName,
      sourceType,
      url,
      publishedAt: entry.publishedAt || null,
    });
  }
  items.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  return dedupeItems(items).slice(0, limit);
}

async function loadFeed(url) {
  return parseFeed(await fetchText(url));
}

function bing(query, lang) {
  const cc = lang === "ko" ? "KR" : "US";
  const setlang = lang === "ko" ? "ko-KR" : "en-US";
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS&setlang=${setlang}&cc=${cc}`;
}

const QUERIES = {
  grok: { en: '"Grok Bot"', ko: '"Grok Bot"', hn: '"Grok Bot"' },
  dots: { en: '"Dots" OpenAI', ko: "OpenAI Dots 에이전트", hn: '"Dots" OpenAI' },
  muse: { en: '"Muse" Meta AI agent', ko: "Meta Muse AI 에이전트", hn: '"Muse" Meta agent' },
};

export async function loadOfficial(product) {
  if (product === "grok") {
    const html = await fetchText("https://x.ai/news");
    return finish(product, "official", "xAI", parseXaiNews(html), 12);
  }
  if (product === "dots") {
    const feed = await loadFeed("https://openai.com/news/rss.xml");
    return finish(product, "official", "OpenAI", feed.map((item) => ({ ...item, source: item.source || "OpenAI" })), 8);
  }
  if (product === "muse") {
    const [feedResult, wpResult] = await Promise.allSettled([
      fetchText("https://about.fb.com/news/feed/"),
      fetchText("https://about.fb.com/wp-json/wp/v2/posts?search=Muse&per_page=20&_fields=link,date,title,excerpt"),
    ]);
    const feed = feedResult.status === "fulfilled"
      ? parseFeed(feedResult.value).map((item) => ({ ...item, source: "Meta Newsroom" }))
      : [];
    let posts = [];
    if (wpResult.status === "fulfilled") {
      try {
        const parsed = JSON.parse(wpResult.value);
        if (Array.isArray(parsed)) {
          posts = parsed.map((post) => ({
            title: decodeHtml(post.title?.rendered || ""),
            summary: decodeHtml(post.excerpt?.rendered || ""),
            url: post.link,
            publishedAt: toIso(post.date),
            source: "Meta Newsroom",
          }));
        }
      } catch {
        posts = [];
      }
    }
    if (!feed.length && !posts.length) {
      const reason = [feedResult, wpResult].find((entry) => entry.status === "rejected");
      throw reason?.reason || new Error("meta empty");
    }
    return finish(product, "official", "Meta Newsroom", [...posts, ...feed], 12);
  }
  return [];
}

export async function loadMedia(product) {
  const query = QUERIES[product];
  if (!query) return [];
  const feed = await loadFeed(bing(query.en, "en"));
  return finish(product, "media", "Bing News", feed, 8);
}

export async function loadSns(product) {
  const query = QUERIES[product];
  if (!query) return [];
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query.hn)}&tags=story&hitsPerPage=15`;
  const payload = JSON.parse(await fetchText(url));
  const hits = Array.isArray(payload.hits) ? payload.hits : [];
  const raw = hits.map((hit) => ({
    title: hit.title || "",
    summary: hit.story_text || hit.title || "",
    url: hit.url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : ""),
    publishedAt: toIso(hit.created_at),
    source: "Hacker News",
  }));
  return finish(product, "sns", "Hacker News", raw, 5);
}

export async function loadRss(product) {
  const query = QUERIES[product];
  if (!query) return [];
  const feed = await loadFeed(bing(query.ko, "ko"));
  return finish(product, "rss", "Bing News", feed, 8);
}
