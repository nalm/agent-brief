# 에이전트 브리프

Grok Bot, OpenAI Dots, Meta Muse를 한국어로만 모아 보는 공개 큐레이션 MVP입니다.
빌드 단계와 외부 패키지는 없습니다. 브라우저와 Node만 있으면 됩니다.

## 실행

```bash
cd /workspace/agent-news-mvp
npm start
```

브라우저에서 [http://127.0.0.1:4173](http://127.0.0.1:4173) 을 엽니다.
`npm` 설치는 필요 없습니다. `node server.js` 와 같습니다. 포트는 `PORT` 로 바꿉니다.

```bash
npm test
```

샘플 스키마, 주제 분류, 중복 제거, 실패 시 샘플 폴백, 그리고 네트워크가 되면 제품별 실수집 1건 이상을 확인합니다.


## 공개 주소 (이 서버)

로컬 `4173`은 박스 안에서만 열립니다. 밖에서는 무료 터널로 엽니다. API 키는 쓰지 않습니다.

1. 먼저 `bin/cloudflared tunnel --url http://127.0.0.1:4173` (Cloudflare 퀵 터널).
2. `trycloudflare.com`이 429를 주면 `ssh -R 80:127.0.0.1:4173 nokey@localhost.run` 으로 바꿉니다. 주소는 `https://….lhr.life` 입니다.

지금 이 박스에서는 퀵 터널이 429라서 localhost.run이 실제 공개 주소입니다. 떠 있는 주소는 `public-url.txt`입니다.

```bash
cd /workspace/agent-news-mvp
cat public-url.txt
```

서버나 터널이 꺼지면 `keepalive.sh`가 약 15초 안에 다시 켭니다. 이 환경에는 `systemd`가 없어서 `setsid`/`nohup` 루프입니다. 박스 프로세스가 살아있는 동안 유지됩니다. 머신이 재부팅되면 다시 켜야 합니다.

```bash
cd /workspace/agent-news-mvp
./keepalive.sh
```

이미 돌고 있으면 새로 띄우지 않고 끝납니다.

서버와 터널을 둘 다 내리고 다시 띄우려면 (주소가 바뀝니다):

```bash
cd /workspace/agent-news-mvp
./restart-public.sh
```

퀵 터널이든 localhost.run이든, 터널 프로세스가 다시 뜰 때마다 호스트 이름이 바뀝니다. 고정 도메인이 아닙니다. `restart-public.sh` 뒤에는 `public-url.txt`를 다시 읽으세요. 429가 난 뒤에는 30분 동안 퀵 터널을 다시 치지 않고 localhost.run만 씁니다. `./restart-public.sh`는 그 대기만 지우고 퀵 터널을 한 번 더 시도합니다.

로그: `logs/server.log`, `logs/cloudflared.log`, `logs/localhost-run.log`, `logs/keepalive.log`.

`bin/cloudflared`가 없으면 (linux amd64):

```bash
mkdir -p bin
curl -fsSL -o bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x bin/cloudflared
```

localhost.run 폴백은 `ssh`가 필요합니다 (`sudo apt-get install -y openssh-client`).

## 화면

- 제품 탭: Grok Bot / Dots / Muse. 주소는 `#grok`, `#dots`, `#muse`.
- 주제 필터: 전체, 출시, 가격, 제휴, 후기·바이럴, 규제·보안.
- 카드: 제목, 한 줄 요약, 출처, 시각(KST 기준 날짜), 주제 태그, 원문 링크.
- 30분 수집: 마지막 수집 시각, 다음 수집까지 카운트다운, 막대. 0이 되면 자동으로 다시 수집합니다.
- `지금 수집` 은 서버의 `/api/feed?refresh=1` 을 호출합니다. 서버는 15초 안의 중복 요청은 합칩니다.
- 웹에서만 동작합니다. 푸시, 이메일, 로그인, 결제는 없습니다.

탭을 닫았다가 30분 안에 다시 열면 마지막 수집 시각을 이어 갑니다. 그 시간이 지나면 열자마자 한 번 수집합니다.

## 목업인 것 / 실제인 것

목업 (모든 어댑터가 실패하고 `cache/last-good.json` 도 없을 때만)

- `data.js` 샘플. 화면과 응답의 `fallback` 이 `시뮬레이션/폴백` 일 때만 씁니다.
- 샘플 가격 숫자 중 Meta Muse의 월 20달러·100달러는 공식 글이 아니라 정리 매체의 서술입니다.

실제

- 탭, 필터, 카운트다운, 30분 자동 재수집, 지금 수집 버튼.
- `collector.js` 어댑터. 서버가 `/api/feed` 에서 돌리고, 브라우저는 그 JSON만 받습니다.
- 원문 링크. 피드에 있던 주소입니다. Bing 추적 주소는 매체 URL로 바꿉니다.
- 정적 파일 서버.

영문 제목·요약은 수집 직후 한국어로 번역합니다. LibreTranslate 공개 인스턴스를 먼저 시도하고, 안 되면 MyMemory 무료 API를 씁니다. `cache/translations.json` 에 URL·텍스트 해시로 캐시해 30분 재수집 때 같은 문장은 다시 번역하지 않습니다. 네트워크 번역이 실패하면 원문을 두고 제목에 `·EN`, 요약에 `미번역` 표시를 붙입니다. 한국어 출처는 그대로 둡니다. 없는 사실은 만들지 않습니다.

## 출처와 약관

쓰는 곳. 기사 본문은 받지 않고 제목, 짧은 설명, 링크, 시각만 저장합니다.

- 공식: `https://openai.com/news/rss.xml` (robots Allow). `https://about.fb.com/news/feed/` 와 공개 WP JSON `wp-json/wp/v2/posts?search=Muse`. `https://x.ai/news` 목록 HTML 한 페이지. x.ai robots는 Allow 이고 Content-Signal 이 ai-input=yes 입니다. 개별 기사 HTML은 열지 않습니다.
- 미디어: Bing News RSS `format=RSS`, 영어 질의. robots.txt 에 `/news` 금지는 없었습니다. Bing 일반 약관은 자동 수집을 넓게 제한할 수 있어, 30분에 제품당 한 번, 결과 8건 이하만 가져옵니다.
- 한국어 RSS: 같은 Bing RSS를 `cc=KR`, `setlang=ko-KR` 로. 일본어·중국어 제목은 버립니다.
- 버즈: Hacker News Algolia API `hn.algolia.com`. HN HTML은 긁지 않습니다. Show HN, alternative, clone 류 제목은 버립니다.

쓰지 않는 곳

- Google News RSS. `news.google.com/robots.txt` 가 모든 사용자 에이전트에 `Disallow: /` 입니다.
- Reddit. 비로그인 수집은 API 약관과 맞지 않습니다.
- TechCrunch HTML/검색. 여러 AI 크롤러 사용자 에이전트를 막고, 대체 피드가 있습니다. (Bing 결과에 테크크런치 링크가 있으면 그 헤드라인만 씁니다.)
- GDELT. 공개 API지만 이 환경에서 429가 나 쓰지 않습니다.

주제는 제목 가중 키워드로 `launch | pricing | partnership | reviews | regulation` 중 하나입니다. 신호가 없으면 공식 글은 출시, 그 외는 후기입니다.

## 다시 읽기

서버가 뜰 때와 그 다음 30분마다 세 제품을 다시 수집합니다. 화면의 지금 수집과 카운트다운 0도 `/api/feed?refresh=1` 입니다.

```bash
curl -s http://127.0.0.1:4173/api/feed?refresh=1
```

어댑터가 모두 실패하면 `cache/last-good.json` 의 마지막 성공 항목을 유지하고 `staleCache` 를 켭니다. 그때는 시뮬레이션 표시를 하지 않습니다. 캐시마저 없으면 샘플과 `fallback: "시뮬레이션/폴백"` 입니다. 한 어댑터라도 항목이 있으면 그 제품은 샘플을 섞지 않습니다.

코드는 `sources.js` (가져오기·파싱·판별), `translate.js` (EN→KO·캐시), `collector.js` (어댑터·캐시·폴백) 입니다.

## X (SNS) 원천

X 게시물은 X API 없이 브라우저로 하루 두 번 모아 별도 브랜치 `x-data` 의 `x-items.json` 에 올린다.
master 가 아니므로 push 해도 Render 재배포가 없다. 앱은 수집 때마다
`https://raw.githubusercontent.com/nalm/agent-brief/x-data/x-items.json` 을 읽는다
(캐시 무효화 쿼리, 8초 제한, 실패 시 건너뜀). 테스트용으로 `X_ITEMS_URL` 에 URL·로컬 경로를 줄 수 있다.
스키마는 `sources.js` 하단 주석과 x-data 브랜치 README 참고.

    scripts/push-x-items.sh new-items.json            # 검증 → 병합(id 중복 제거, 14일·150개) → x-data push
    scripts/push-x-items.sh new-items.json --dry-run  # 쓰지 않고 결과만
