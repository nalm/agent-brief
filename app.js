import { PRODUCTS, TOPICS, SOURCE_TYPES } from "./data.js";
const INTERVAL = 30 * 60 * 1000;
const els = {
  tabs: document.querySelector("#tabs"),
  blurb: document.querySelector("#blurb"),
  filters: document.querySelector("#filters"),
  list: document.querySelector("#list"),
  count: document.querySelector("#count"),
  log: document.querySelector("#log"),
  collected: document.querySelector("#collected"),
  countdown: document.querySelector("#countdown"),
  bar: document.querySelector("#bar"),
  status: document.querySelector("#status"),
  refresh: document.querySelector("#refresh"),
  live: document.querySelector("#live"),
  note: document.querySelector("#sim-note"),
  stamp: document.querySelector("#stamp"),
  foot: document.querySelector("#foot-note"),
};

const state = {
  product: "grok",
  topic: "all",
  byProduct: new Map(),
  lastCollectedAt: null,
  running: false,
  announced: false,
};

function readRoute() {
  const raw = location.hash.replace(/^#/, "");
  const [productId, topicId] = raw.split("/");
  const product = PRODUCTS.some((item) => item.id === productId) ? productId : "grok";
  const topic = TOPICS.some((item) => item.id === topicId) ? topicId : "all";
  return { product, topic };
}

function writeRoute() {
  const next = state.topic === "all" ? state.product : `${state.product}/${state.topic}`;
  if (location.hash !== `#${next}`) {
    history.replaceState(null, "", `#${next}`);
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    /* ignore */
  }
  return null;
}

function hostOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatDate(iso) {
  if (!iso) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function formatStamp(ms) {
  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
  return `${date} KST`;
}

function relative(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 14) return `${days}일 전`;
  if (days < 60) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function formatRemain(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function topicLabel(id) {
  return TOPICS.find((topic) => topic.id === id)?.label || id;
}

function currentItems() {
  const pack = state.byProduct.get(state.product);
  const items = pack ? pack.items.slice() : [];
  items.sort((a, b) => {
    const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return right - left;
  });
  if (state.topic === "all") return items;
  return items.filter((item) => item.topic === state.topic);
}

function paintClock() {
  if (state.running) {
    els.countdown.textContent = "수집 중";
    els.status.classList.add("is-busy");
    els.bar.style.width = "";
    return;
  }
  els.status.classList.remove("is-busy");
  if (!state.lastCollectedAt) return;
  const remain = Math.max(0, INTERVAL - (Date.now() - state.lastCollectedAt));
  els.countdown.textContent = formatRemain(remain);
  els.collected.textContent = formatStamp(state.lastCollectedAt);
  els.bar.style.width = `${(remain / INTERVAL) * 100}%`;
}

function renderTabs() {
  document.querySelector("#panel").setAttribute("aria-labelledby", `tab-${state.product}`);
  els.tabs.replaceChildren();
  for (const product of PRODUCTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.setAttribute("role", "tab");
    button.id = `tab-${product.id}`;
    button.setAttribute("aria-controls", "panel");
    button.setAttribute("aria-selected", product.id === state.product ? "true" : "false");
    button.tabIndex = product.id === state.product ? 0 : -1;
    const maker = document.createElement("span");
    maker.className = "maker";
    maker.textContent = product.maker;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = product.name;
    button.append(maker, name);
    button.addEventListener("click", () => {
      state.product = product.id;
      writeRoute();
      render();
    });
    els.tabs.append(button);
  }
}

function renderFilters() {
  els.filters.replaceChildren();
  for (const topic of TOPICS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = topic.label;
    button.setAttribute("aria-pressed", topic.id === state.topic ? "true" : "false");
    button.addEventListener("click", () => {
      state.topic = topic.id;
      writeRoute();
      render();
    });
    els.filters.append(button);
  }
}

function renderList() {
  const items = currentItems();
  const product = PRODUCTS.find((item) => item.id === state.product);
  els.blurb.textContent = product ? product.blurb : "";
  els.count.textContent = `${items.length}건`;
  els.list.replaceChildren();
  document.title = `${product.name} · 에이전트 브리프`;
  document.body.dataset.product = product.id;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "이 주제의 소식이 없습니다.";
    els.list.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "item";

    const kicker = document.createElement("div");
    kicker.className = "kicker";
    const topic = document.createElement("span");
    topic.className = "topic";
    topic.dataset.topic = item.topic;
    topic.textContent = topicLabel(item.topic);
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = SOURCE_TYPES[item.sourceType] || item.sourceType;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(index + 1).padStart(2, "0");
    kicker.append(topic, kind, num);

    const title = document.createElement("h3");
    const href = safeUrl(item.url);
    if (href) {
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title;
      title.append(link);
    } else {
      title.textContent = item.title;
    }

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = item.summary;

    const meta = document.createElement("p");
    meta.className = "meta";
    const source = document.createElement("span");
    source.className = "source";
    source.textContent = item.source;
    const when = document.createElement("span");
    const rel = relative(item.publishedAt);
    when.textContent = rel ? `${formatDate(item.publishedAt)} · ${rel}` : formatDate(item.publishedAt);
    meta.append(source, when);
    const host = hostOf(item.url);
    if (host) {
      const hostEl = document.createElement("span");
      hostEl.className = "host";
      hostEl.textContent = host;
      meta.append(hostEl);
    }
    if (href) {
      const out = document.createElement("a");
      out.className = "out";
      out.href = href;
      out.target = "_blank";
      out.rel = "noopener noreferrer";
      out.textContent = "원문";
      meta.append(out);
    }

    article.append(kicker, title, summary, meta);
    els.list.append(article);
  });
}

function renderLog() {
  const pack = state.byProduct.get(state.product);
  els.log.replaceChildren();
  if (!pack) return;
  for (const line of pack.log) {
    const row = document.createElement("div");
    row.className = "log-row";
    if (line.id === "sample") row.classList.add("is-sample");
    const name = document.createElement("span");
    name.textContent = line.label;
    const detail = document.createElement("span");
    detail.textContent = line.detail
      ? `${line.note} · ${line.count}건 · ${line.detail}`
      : `${line.note} · ${line.count}건`;
    row.append(name, detail);
    els.log.append(row);
  }
  const product = PRODUCTS.find((item) => item.id === state.product);
  if (pack.fallback) {
    els.note.textContent = `${product.name} 수집에 실패해 ${pack.fallback} 샘플 ${pack.items.length}건을 보여 줍니다.`;
  } else if (pack.staleCache) {
    els.note.textContent = `${product.name} 이번 수집은 비었습니다. 마지막 성공 캐시 ${pack.items.length}건을 유지합니다.`;
  } else {
    els.note.textContent = `${product.name} 실수집 ${pack.items.length}건. 샘플 피드는 꺼져 있습니다.`;
  }
  if (els.stamp) {
    els.stamp.textContent = pack.fallback ? "시뮬레이션\n폴백" : "실시간\n수집";
  }
  if (els.foot) {
    els.foot.textContent = pack.fallback
      ? "지금 카드는 수집 실패로 보여 주는 샘플입니다. 원문 링크만 실제 페이지로 갑니다."
      : "카드는 공개 RSS·공식 글·뉴스 피드에서 모은 제목과 짧은 요약입니다. 본문은 원문에서 확인하세요.";
  }
}

function render() {
  renderTabs();
  renderFilters();
  renderList();
  renderLog();
  paintClock();
}

async function loadFeed(refresh) {
  const response = await fetch(refresh ? "/api/feed?refresh=1" : "/api/feed");
  if (!response.ok) throw new Error("수집 실패");
  return response.json();
}

function applyFeed(body) {
  const products = body && body.products ? body.products : {};
  for (const product of PRODUCTS) {
    if (products[product.id]) state.byProduct.set(product.id, products[product.id]);
  }
  const stamp = Date.parse(body.collectedAt);
  state.lastCollectedAt = Number.isFinite(stamp) ? stamp : Date.now();
}

async function runCollect({ announce, refresh }) {
  if (state.running) return;
  state.running = true;
  els.refresh.disabled = true;
  paintClock();
  try {
    const body = await loadFeed(refresh);
    applyFeed(body);
    if (announce && state.announced) {
      const pack = state.byProduct.get(state.product);
      const mode = pack.fallback ? pack.fallback : pack.staleCache ? "이전 수집 유지" : "실수집";
      els.live.textContent = `${formatStamp(state.lastCollectedAt)} 수집 완료. ${mode} ${pack.items.length}건.`;
    }
    state.announced = true;
  } catch (error) {
    els.live.textContent = error instanceof Error ? error.message : "수집 실패";
  } finally {
    state.running = false;
    els.refresh.disabled = false;
    render();
    els.list.classList.remove("is-fresh");
    void els.list.offsetWidth;
    els.list.classList.add("is-fresh");
  }
}

function tick() {
  if (!state.lastCollectedAt) return;
  const remain = INTERVAL - (Date.now() - state.lastCollectedAt);
  if (remain <= 0) {
    runCollect({ announce: true, refresh: true });
    return;
  }
  paintClock();
}

function onHashChange() {
  const route = readRoute();
  state.product = route.product;
  state.topic = route.topic;
  render();
}

async function boot() {
  const route = readRoute();
  state.product = route.product;
  state.topic = route.topic;
  writeRoute();
  await runCollect({ announce: false, refresh: false });
  window.setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

els.refresh.addEventListener("click", () => runCollect({ announce: true, refresh: true }));
window.addEventListener("hashchange", onHashChange);
boot();
