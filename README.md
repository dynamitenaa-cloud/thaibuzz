# ThaiBuzz — 태국 트렌드 이슈 자동 발행 사이트

태국에서 지금 뜨는 키워드를 감지 → 여러 언론사 기사로 사실 근거 수집 → Gemini 로 태국어 기사 작성 → 품질 검사 → 썸네일 생성 → 정적 사이트로 배포까지 **완전 자동**. 서버·DB 없이 **전부 무료 티어**로 돌아갑니다.

```
GitHub Actions (매시간)
  ├─ 소스: Google Trends TH 급상승 + Google News TH 연예 헤드라인
  ├─ 근거: Google News 검색(최근 3일) + 원문 기사 본문/og:image
  ├─ 작성: Gemini (구조화 출력: 제목/요약3줄/소제목 섹션/타임라인/FAQ/태그/카테고리)
  ├─ 게이트: 발행 불가 주제·분량 미달·중복 기사 자동 탈락
  ├─ 썸네일: 1200×630 JPG(OG/Discover) + WebP(사이트용) — 태국어 단어 단위 줄바꿈
  ├─ content/posts/*.json 커밋
  ├─ next build (static export) → Cloudflare Pages 직접 업로드
  └─ IndexNow 핑
```

## 사이트 기능 (경쟁사 대비)

| 항목 | 내용 |
|---|---|
| 홈 | 헤드라인(사진 위 제목) + 서브 2건, 실시간 "มาแรง" 티커, 최신 목록, 카테고리별 섹션, 사이드바 랭킹·태그 |
| 기사 | 3줄 요약 박스, 소제목 구조, 타임라인, FAQ 아코디언, 중간 "อ่านเพิ่มเติม" 박스, 관련/최신 기사, 이전/다음 |
| 공유 | LINE(태국 1위 메신저) · Facebook · X · 네이티브 공유, 모바일 하단 고정 공유바, 읽기 진행바 |
| 탐색 | 카테고리 6종 + 페이지네이션, 태그 페이지, 클라이언트 검색(하이라이트) |
| SEO | NewsArticle·BreadcrumbList·Organization·WebSite(SearchAction) JSON-LD, Google News 사이트맵, 일반 사이트맵, RSS, canonical, `max-image-preview:large`(Discover 필수), 빈약한 태그/페이지 noindex |
| 성능 | 정적 HTML, WebP + srcset, 광고 지연 로딩, CLS 0, Lighthouse 모바일 93–96 / 접근성·모범사례·SEO 100 |
| UX | 다크모드(깜빡임 없음), 반응형, 스킵 링크, 키보드 포커스, `prefers-reduced-motion` |
| 수익 | AdSense 슬롯(본문 중간·하단·사이드·목록), Shopee 제휴 박스 — 환경변수 없으면 자동 숨김 |
| 신뢰 | About / 편집 정책 / 개인정보(PDPA) / 연락처 페이지 — AdSense 승인 필수 요소 |

## 처음 설정 (약 20분, 전부 무료)

1. **Gemini 키** — https://aistudio.google.com/apikey
2. **Cloudflare** — 가입 → Workers & Pages → Pages → "Direct Upload" 로 프로젝트 `thaibuzz` 생성
   - API 토큰: My Profile → API Tokens → "Cloudflare Pages: Edit" 권한
   - Account ID: 대시보드 우측
3. **GitHub 저장소** 만들고 이 폴더 push
   - **Public 저장소 권장**: Actions 분 무제한. Private 은 월 2,000분 → 매시간 실행 정도가 한계
4. 저장소 Settings → Secrets and variables → Actions
   - **Secrets**: `GOOGLE_GENERATIVE_AI_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, (선택) `INDEXNOW_KEY`
   - **Variables**: `SITE_URL`(예: https://thaibuzz.pages.dev), (선택) `SITE_NAME`, `CONTACT_EMAIL`, `ADSENSE_ID`, `GA_ID`, `SHOPEE_AFFILIATE_ID`, `CF_PROJECT`, `MAX_PER_RUN`, `MAX_PER_DAY`, `GEMINI_MODEL`
5. Actions 탭 → `publish` → **Run workflow** 로 첫 실행. 이후 매시간 자동
6. Google Search Console 에 사이트 등록 → `sitemap.xml`, `news-sitemap.xml` 제출

## 로컬 명령

```bash
npm run demo            # UI 확인용 가상 데모 글 생성 (커밋 안 됨)
npm run dev             # http://localhost:3000
npm run pipeline:dry    # LLM 없이 소스/근거 수집만 확인
node scripts/run-pipeline.mjs --mock   # 키 없이 전체 흐름(저장·썸네일까지) 시험 — 끝나면 생성된 글 삭제
npm run pipeline        # 실제 발행 (.env.local 의 키 사용)
npm run build           # out/ 정적 사이트
npm run demo:clean      # 데모 글 삭제
npm run assets          # 아이콘·기본 OG 이미지 재생성 (브랜드 변경 시)
```

## 운영 팁

- **발행량**: 기본 1회 3개 / 하루 40개. 품질 게이트를 통과한 글만 나가므로 실제는 더 적을 수 있음. 저품질 대량 발행은 사이트 전체 평가를 깎으니 올릴 때는 천천히.
- **Gemini 무료 한도**: 분당/일일 요청 제한이 있음. 429 가 나면 자동 대기 후 재시도. 한 번 탈락한 키워드는 24시간 재시도 안 함(쿼터 절약).
- **브랜드 변경**: `lib/site.ts`(이름·카테고리·색), `app/icon.svg` 수정 후 `npm run assets`.
- **기사 수정/삭제 요청**: `content/posts/<slug>.json` 수정 또는 삭제 후 push → 자동 재배포.

## ⚠️ 알아둘 리스크

- **이미지 저작권**: 썸네일에 언론사 기사 사진(og:image)을 사용하고 출처를 표기합니다. 태국 언론사가 문제를 제기할 수 있으니, 요청이 오면 즉시 삭제하세요. 아예 끄려면 Variables 에 `USE_SOURCE_IMAGES=false` → 그라디언트+텍스트 썸네일만 사용.
- **소스 약관**: Google Trends / Google News RSS 는 공식 상업용 API 가 아닙니다. 구조가 바뀌거나 막히면 파이프라인이 해당 소스를 건너뛰고(다른 소스는 계속) 로그에 남깁니다.
- **실존 인물 가십**: 프롬프트·게이트가 루머 단정, 미성년자, 미확인 사망/질병을 막지만 AI 는 틀릴 수 있습니다. 정정 요청 경로(연락처 페이지)를 꼭 실제 이메일로 바꿔두세요.
- **Vercel Hobby 는 상업용(광고) 금지** → 그래서 Cloudflare Pages 를 씁니다.
