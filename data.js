/** 샘플 큐레이션. 실시간 수집 결과가 아니다. */
export const PRODUCTS = [
  {
    id: "grok",
    name: "Grok Bot",
    maker: "xAI",
    blurb:
      "클라우드 컴퓨터를 가진 상시 에이전트. 기존 도구에 로그인해 여러 단계 일을 이어 가고, 단독 상품이 아니라 유료 구독에 포함된다.",
  },
  {
    id: "dots",
    name: "Dots",
    maker: "OpenAI",
    blurb:
      "DevDay에서 공개된 항상 켜진 개인 에이전트. GPT-6 Astra와 전용 클라우드 컴퓨터로 목표를 백그라운드에서 진행한다.",
  },
  {
    id: "muse",
    name: "Muse",
    maker: "Meta",
    blurb:
      "메시지 보내듯 일을 시키는 개인 에이전트. Muse Secure VM 위에서 동작하고, 미국·캐나다부터 앱·웹·WhatsApp으로 열렸다.",
  },
  {
    id: "spark",
    name: "Gemini Spark",
    maker: "Google",
    blurb:
      "Gemini 앱 안의 24시간 개인 에이전트. 5월에 공개됐고 7월부터 Google AI Pro·Ultra 구독자에게 넓혀졌다.",
  },
];

export const TOPICS = [
  { id: "all", label: "전체" },
  { id: "launch", label: "출시" },
  { id: "pricing", label: "가격" },
  { id: "partnership", label: "제휴" },
  { id: "reviews", label: "후기·바이럴" },
  { id: "regulation", label: "규제·보안" },
];

export const SOURCE_TYPES = {
  official: "공식",
  media: "테크 미디어",
  sns: "SNS",
  rss: "RSS·뉴스",
};

export const SAMPLE_ITEMS = [
  {
    id: "grok-launch",
    product: "grok",
    topic: "launch",
    title: "xAI, 자기 컴퓨터를 가진 상시 에이전트 Grok Bot 베타를 열었다",
    summary:
      "8월 11일 베타는 클라우드 컴퓨터에 올라가 고객 도구에 로그인한 뒤, 자리를 비운 동안에도 여러 단계 일을 끝내는 팀원으로 소개됐다.",
    source: "Unite.AI",
    sourceType: "media",
    url: "https://www.unite.ai/xai-launches-grok-bot-always-on-ai-teammates-with-their-own-cloud-computers/",
    publishedAt: "2026-08-11T21:00:00+09:00",
  },
  {
    id: "grok-pricing",
    product: "grok",
    topic: "pricing",
    title: "따로 팔지 않는다. Cursor·SuperGrok 구독에 사용량이 붙어 있다",
    summary:
      "9월 하순 정리에는 단독 요금이 없고, Cursor Pro(월 20달러)부터 Ultra·Teams, SuperGrok 연동에 주간 허용량이 포함된다. 초과분은 켠 경우에만 토큰으로 청구된다.",
    source: "Grok Bot Wiki",
    sourceType: "rss",
    url: "https://www.grokbotwiki.com/guides/grok-bot-pricing-access-download",
    publishedAt: "2026-09-23T12:00:00+09:00",
  },
  {
    id: "grok-partnership",
    product: "grok",
    topic: "partnership",
    title: "내려받기와 판매 동선이 출시 첫날부터 Cursor 쪽에 묶였다",
    summary:
      "데스크톱·iOS 배포와 유료 플랜 안내가 Cursor 인프라를 타고, 엔터프라이즈는 즉시 개방 대신 대기 명단으로 안내됐다는 보도가 나왔다.",
    source: "AIBase",
    sourceType: "media",
    url: "https://news.aibase.com/news/30285",
    publishedAt: "2026-08-11T23:00:00+09:00",
  },
  {
    id: "grok-reviews",
    product: "grok",
    topic: "reviews",
    title: "“꺼 두고 자도 초안이 쌓인다”는 역할 예시가 해설 글에 반복된다",
    summary:
      "영업 메일, 데모 환경 점검, CRM 정리, 버그 재현처럼 주니어 실무를 대신한다는 문장이 출시 해설에 공통으로 등장한다. 반응 수나 바이럴 순위는 이 샘플에 넣지 않았다.",
    source: "샘플 · 공개 해설 라운드업",
    sourceType: "sns",
    url: "https://theaidude.net/blog/what-grok-bot-is-and-who-can-use-it",
    publishedAt: "2026-08-17T12:00:00+09:00",
  },
  {
    id: "grok-regulation",
    product: "grok",
    topic: "regulation",
    title: "도구 로그인과 엔터프라이즈 대기. 초기 권한은 상위 플랜부터",
    summary:
      "초기 베타 접근은 SuperGrok Heavy, Cursor Ultra, Teams 상위 좌석으로 제한됐고 회사 계정은 영업 대기열이다. 에이전트가 기존 도구에 직접 로그인한다는 점이 보안 논의의 중심이다.",
    source: "The AI Dude",
    sourceType: "media",
    url: "https://theaidude.net/blog/what-grok-bot-is-and-who-can-use-it",
    publishedAt: "2026-08-17T18:00:00+09:00",
  },
  {
    id: "dots-launch",
    product: "dots",
    topic: "launch",
    title: "OpenAI, 항상 켜져 있는 에이전트 Dots를 DevDay에서 공개했다",
    summary:
      "9월 29일 공식 글은 Dots가 GPT-6 Astra로 움직이고, 전용 클라우드 컴퓨터에서 목표를 24시간 진행하며, 플러그인으로 수천 개 앱에 연결된다고 적었다.",
    source: "OpenAI",
    sourceType: "official",
    url: "https://openai.com/index/introducing-dots/",
    publishedAt: "2026-09-29T12:00:00+09:00",
  },
  {
    id: "dots-pricing",
    product: "dots",
    topic: "pricing",
    title: "첫 Dot은 Pro·Business Premium에 포함, 추가와 가속은 이후",
    summary:
      "첫 Dot은 플랜에 들어 있고 대화는 사용량에서 빠진다. 더 깊은 작업만 허용량을 쓰며, 속도와 월간 작업량을 키우는 과금은 앞으로 열 계획이라고 안내됐다. 출시 시점의 전용 API는 없다.",
    source: "Dots Guide",
    sourceType: "media",
    url: "https://dotsguide.com/faq",
    publishedAt: "2026-10-02T12:00:00+09:00",
  },
  {
    id: "dots-partnership",
    product: "dots",
    topic: "partnership",
    title: "전문가용 Dot은 Microsoft Agent 365 통제와 맞물린다",
    summary:
      "회사 안에서 신원·권한·업무 시스템을 갖는 specialist Dot을 미리 보여 주며, Microsoft와 Agent 365 보안 통제를 맞추는 중이라고 TechCrunch가 전했다.",
    source: "TechCrunch",
    sourceType: "media",
    url: "https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/",
    publishedAt: "2026-09-30T02:17:00+09:00",
  },
  {
    id: "dots-reviews",
    product: "dots",
    topic: "reviews",
    title: "출시 당일 헤드라인이 ‘Muse 대항마’와 동글한 아바타로 갈렸다",
    summary:
      "Axios는 Muse를 상대하는 도우미로, TechCrunch는 말풍선 같은 캐릭터 브랜딩으로 같은 날 소식을 밀었다. 사용자 게시물 집계는 이 샘플에 없다.",
    source: "Axios · 헤드라인 버즈",
    sourceType: "sns",
    url: "https://www.axios.com/2026/09/29/openai-dots-ai-assistant-devday",
    publishedAt: "2026-09-29T21:00:00+09:00",
  },
  {
    id: "dots-regulation",
    product: "dots",
    topic: "regulation",
    title: "Pro는 유럽경제지역·영국·스위스를 빼고 열린다",
    summary:
      "FAQ는 Pro 롤아웃이 EEA·스위스·영국을 제외하고, Business Premium은 ChatGPT 지원 지역 전반이며, 엔터프라이즈는 관리자가 베타를 켜야 한다고 정리했다.",
    source: "Dots Guide",
    sourceType: "rss",
    url: "https://dotsguide.com/faq",
    publishedAt: "2026-10-02T12:30:00+09:00",
  },
  {
    id: "muse-launch",
    product: "muse",
    topic: "launch",
    title: "Meta, 질문 대신 일을 하는 개인 에이전트 Muse를 미국부터 풀었다",
    summary:
      "9월 8일 공개 글은 Muse가 일을 수행하고, 전용 Secure VM 위에서 앱·WhatsApp·웹으로 말하듯 시킨다고 설명했다. 필요한 일의 대부분은 무료로 시작한다고 했다.",
    source: "Meta Newsroom",
    sourceType: "official",
    url: "https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/",
    publishedAt: "2026-09-08T12:00:00+09:00",
  },
  {
    id: "muse-pricing",
    product: "muse",
    topic: "pricing",
    title: "공식은 ‘대부분 무료, 더 쓰면 구독’. 매체는 20·100달러를 적었다",
    summary:
      "Meta는 필요한 일의 대부분은 무료이고 더 하려는 사람을 위한 구독이 있다고만 밝혔다. 가격을 숫자로 적은 정리는 Power 월 20달러, Maximum 월 100달러다.",
    source: "Pandromeda",
    sourceType: "media",
    url: "https://pandromeda.com/ai/meta-muse-price-plans-features-and-whats-new-after-connect",
    publishedAt: null,
  },
  {
    id: "muse-partnership",
    product: "muse",
    topic: "partnership",
    title: "소상공인용 Muse, Shopify·Slack·Notion 등 쓰던 도구와 연결",
    summary:
      "9월 29일 Meta는 목표를 주면 사업을 굴리도록 Asana, Canva, QuickBooks, Stripe, Instagram 비즈니스 계정 등과 붙는 커넥터를 열었다고 밝혔다.",
    source: "Meta Newsroom",
    sourceType: "official",
    url: "https://about.fb.com/news/2026/09/introducing-muse-small-business/",
    publishedAt: "2026-09-29T12:00:00+09:00",
  },
  {
    id: "muse-reviews",
    product: "muse",
    topic: "reviews",
    title: "경쟁사 출시 기사가 Muse를 이미 반응이 큰 상대로 호명했다",
    summary:
      "Dots 출시 기사는 Muse를 시장이 먼저 움직인 개인 에이전트로 적었다. Meta는 Connect에서 반응이 크다고 말했지만, 이 카드는 그 외부 헤드라인만 샘플로 담았다.",
    source: "Axios",
    sourceType: "media",
    url: "https://www.axios.com/2026/09/29/openai-dots-ai-assistant-devday",
    publishedAt: "2026-09-29T21:10:00+09:00",
  },
  {
    id: "muse-regulation",
    product: "muse",
    topic: "regulation",
    title: "Secure VM에 가두고, 승인 없는 발송·결제는 막는다",
    summary:
      "출시 글은 에이전트와 개인 데이터를 Muse Secure VM에 두고, 이후에는 이용자만 여는 Confidential VM을 예고했다. 소상공인 확장에서는 게시·발송·지출이 승인 없이 실행되지 않는다고 덧붙였다. 시작 지역은 미국·캐나다다.",
    source: "Meta Newsroom",
    sourceType: "official",
    url: "https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/",
    publishedAt: "2026-09-30T12:00:00+09:00",
  },
  {
    id: "spark-launch",
    product: "spark",
    topic: "launch",
    title: "Google, Gemini 앱에 24시간 일하는 개인 에이전트 Spark를 넣었다",
    summary:
      "Gemini 앱의 다음 단계로 소개된 Spark는 사용자가 자리를 비워도 백그라운드에서 일을 이어 간다. 7월부터 AI Pro·Ultra 구독자로 넓혀졌다.",
    source: "Google Blog",
    sourceType: "official",
    url: "https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/",
    publishedAt: "2026-05-20T02:00:00+09:00",
  },
  {
    id: "spark-chrome",
    product: "spark",
    topic: "partnership",
    title: "Gemini Spark가 Chrome과 연결됐다",
    summary:
      "7월 업데이트 글은 Spark가 Chrome과 맞물려 웹 작업을 이어 받는다고 소개했다.",
    source: "Google Blog",
    sourceType: "official",
    url: "https://blog.google/innovation-and-ai/products/gemini-app/gemini-spark-updates-july-2026",
    publishedAt: "2026-07-31T05:00:00+09:00",
  },
  {
    id: "spark-photos",
    product: "spark",
    topic: "partnership",
    title: "Gemini Spark가 Google 포토 라이브러리 정리까지 맡는다",
    summary:
      "TechCrunch는 Spark가 Google 포토 보관함을 말 한마디로 관리할 수 있게 됐다고 전했다.",
    source: "TechCrunch",
    sourceType: "media",
    url: "https://techcrunch.com/2026/09/04/googles-gemini-spark-can-now-manage-your-google-photos-library",
    publishedAt: "2026-09-04T16:47:00+09:00",
  },
  {
    id: "spark-reviews",
    product: "spark",
    topic: "reviews",
    title: "ZDNET 사용기: Spark는 구글의 또 다른 실패인가, 다크호스인가",
    summary:
      "ZDNET 기자가 Gemini Spark를 직접 써 보고 장단점을 정리했다.",
    source: "ZDNET",
    sourceType: "media",
    url: "https://zdnet.com/innovation/google-gemini-spark-ai-agent-test",
    publishedAt: "2026-10-09T15:02:00+09:00",
  },
  {
    id: "spark-korea",
    product: "spark",
    topic: "launch",
    title: "구글, 24시간 AI 에이전트 ‘제미나이 스파크’ 국내 출시",
    summary:
      "연합뉴스는 Spark가 한국에도 출시돼 화면이 꺼져도 백그라운드에서 일한다고 전했다.",
    source: "연합뉴스",
    sourceType: "rss",
    url: "https://yna.co.kr/view/AKR20260730062300017",
    publishedAt: "2026-07-30T11:59:00+09:00",
  },
];
