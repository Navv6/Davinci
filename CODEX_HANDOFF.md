# 다빈치노트 Codex Handoff

기준시각: 2026-04-07
브랜치: `main`

## 1. 현재 상태 요약

다빈치노트는 현재 `수익화 준비 완료` 단계다.
이번 세션까지 반영된 기준으로는 다음이 동작한다.

- Google 로그인
- 다중 노트 생성/전환
- 노트별 세션 draft 저장
- Supabase 클라우드 저장/복구
- 즐겨찾기 / 보관함
- 데스크톱 사이드바 + 모바일 드로어 기반 개인 워크스페이스 UI
- **free / pro 플랜 분기 (quota 시각화, 경고, 업그레이드 CTA)**
- **Stripe Checkout Session API**
- **Stripe webhook 핸들러 (결제 성공/변경/취소 반영)**
- robots / sitemap / manifest / not-found / 정책 페이지
- Vercel 배포 검증 완료 (이전 세션)

현재 판단:

- 무료 베타 출시: 가능 (이전 세션 완료)
- 유료 SaaS 출시: **환경변수 설정 + Stripe 대시보드 Product/Price 생성 후 가능**

---

## 2. 이번 세션 핵심 완료 항목

### Phase 1: free / pro 분기 구현

- `lib/aiUsage.ts`
  - `PLAN_QUOTAS = { free: 3, pro: 50 }` 추가
  - `getQuotaForPlan(plan)` / `isPro(profile)` / `getQuotaPercent(profile)` / `isQuotaLow(profile)` / `isQuotaExhausted(profile)` 헬퍼 추가
- `lib/cloudStorage.ts`
  - `WorkspaceProfile` 타입에 Stripe 필드 5개 추가
  - `ensureProfileInCloud()` ai_quota 기본값을 `getQuotaForPlan('free')`로 변경
  - select 절에 신규 Stripe 필드 포함
- `app/api/ai-expand/route.ts`
  - `DEFAULT_FREE_QUOTA` 하드코딩 → `getQuotaForPlan(DEFAULT_FREE_PLAN)` 으로 변경
  - select 절에 Stripe 필드 포함
- `components/desktop/IdeaSidebar.tsx`
  - progress bar 추가 (사용 비율 시각화)
  - quota 소진 시 경고 스타일 + 업그레이드 CTA 버튼
  - quota 낮을 때(≤1) 인라인 업그레이드 링크
  - PRO 배지 스타일 분기
  - `onUpgradeClick` prop 추가
- `components/mobile/SideDrawer.tsx`
  - 동일한 progress bar / 경고 / CTA 적용
  - `onUpgradeClick` prop 추가
- `components/desktop/IdeaSpace.tsx` / `components/mobile/IdeaSpace.tsx`
  - `onUpgradeClick` prop 추가 → IdeaSidebar/SideDrawer로 전달
- `components/desktop/DavinciExperience.tsx` / `components/mobile/DavinciExperience.tsx`
  - `onUpgradeClick` prop 추가 → IdeaSpace로 전달
- `lib/auth.ts`
  - `getAccessToken()` 헬퍼 추가 (Supabase session access token 반환)
- `app/page.tsx`
  - `handleUpgradeClick` 추가 (Checkout API 호출 → `window.location.href` 리다이렉트)
  - `sharedProps`에 `onUpgradeClick` 포함

### Phase 2: Billing-Ready Schema

- `supabase/graphs.sql`
  - profiles 테이블에 `alter table ... add column if not exists` 추가:
    - `stripe_customer_id text`
    - `stripe_subscription_id text`
    - `current_period_end timestamptz`
    - `cancel_at_period_end boolean not null default false`
    - `stripe_status text`
- `types/supabase.ts`
  - profiles Row/Insert/Update 타입에 신규 5개 필드 추가

### Phase 3: Stripe 설치 및 서버 유틸

- `stripe@22` npm 패키지 설치
- `lib/stripeServer.ts` 생성 (lazy init, `getStripe()` 팩토리)
- `lib/supabaseAdmin.ts` 생성 (service role 클라이언트, lazy init, `getSupabaseAdmin()` 팩토리)

### Phase 4: Stripe Checkout API

- `app/api/stripe/checkout/route.ts` 생성
  - Bearer 토큰 인증
  - stripe_customer_id 재사용 / 신규 생성 후 profiles 저장
  - Checkout Session 생성 → `{ url }` 반환

### Phase 5: Stripe Webhook

- `app/api/stripe/webhook/route.ts` 생성
  - `stripe.webhooks.constructEvent` 로 서명 검증
  - `checkout.session.completed` → plan='pro', ai_quota=50
  - `customer.subscription.updated` → current_period_end, cancel_at_period_end, stripe_status 동기화
  - `customer.subscription.deleted` → plan='free', ai_quota=3 다운그레이드
  - `getSupabaseAdmin()` (service role) 사용

---

## 3. 현재 DB 구조

### profiles

- `user_id uuid primary key references auth.users(id)`
- `plan text default 'free'`
- `subscription_status text default 'inactive'`
- `ai_quota integer default 3`
- `ai_used integer default 0`
- `quota_period_start timestamptz`
- `quota_period_end timestamptz`
- `stripe_customer_id text` ← 신규
- `stripe_subscription_id text` ← 신규
- `current_period_end timestamptz` ← 신규
- `cancel_at_period_end boolean default false` ← 신규
- `stripe_status text` ← 신규

### graphs

(이전 세션과 동일 — 변경 없음)

---

## 4. 현재 중요한 파일

### 워크스페이스 / 진입

- `E:\Claude\Davinci\app\page.tsx`
- `E:\Claude\Davinci\components\desktop\DavinciExperience.tsx`
- `E:\Claude\Davinci\components\mobile\DavinciExperience.tsx`

### 저장 / 클라우드

- `E:\Claude\Davinci\lib\storage.ts`
- `E:\Claude\Davinci\lib\cloudStorage.ts`
- `E:\Claude\Davinci\lib\supabase.ts`
- `E:\Claude\Davinci\lib\supabaseServer.ts`
- `E:\Claude\Davinci\lib\supabaseAdmin.ts` ← 신규
- `E:\Claude\Davinci\supabase\graphs.sql`
- `E:\Claude\Davinci\types\supabase.ts`

### AI

- `E:\Claude\Davinci\app\api\ai-expand\route.ts`
- `E:\Claude\Davinci\lib\aiUsage.ts`

### Stripe

- `E:\Claude\Davinci\lib\stripeServer.ts` ← 신규
- `E:\Claude\Davinci\app\api\stripe\checkout\route.ts` ← 신규
- `E:\Claude\Davinci\app\api\stripe\webhook\route.ts` ← 신규

### 워크스페이스 UI

- `E:\Claude\Davinci\components\desktop\IdeaSpace.tsx`
- `E:\Claude\Davinci\components\mobile\IdeaSpace.tsx`
- `E:\Claude\Davinci\components\desktop\IdeaSidebar.tsx`
- `E:\Claude\Davinci\components\mobile\SideDrawer.tsx`

---

## 5. 검증 상태

이번 세션 마지막 검증:

- `npx tsc --noEmit` ✅
- `npm run build` ✅

사용자 수동 검증 필요:

- DB: `supabase/graphs.sql` 에 추가된 `alter table` 실행
- Stripe 대시보드에서 Product/Price 생성 → `STRIPE_PRO_PRICE_ID` 설정
- Vercel에 신규 환경변수 설정 후 재배포
- `stripe listen --forward-to localhost:3000/api/stripe/webhook` 로 로컬 webhook 테스트
- 테스트 카드(4242 4242 4242 4242)로 결제 → profile plan='pro', ai_quota=50 확인

---

## 6. 환경변수 현황

### 기존 (이전 세션)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NEXT_PUBLIC_BASE_URL`

### 신규 추가 필요

- `STRIPE_SECRET_KEY` — Stripe 대시보드 > API keys
- `STRIPE_WEBHOOK_SECRET` — `stripe listen` 또는 Stripe 대시보드 Webhook endpoint secret
- `STRIPE_PRO_PRICE_ID` — Stripe 대시보드에서 생성한 Price ID
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase 대시보드 > Settings > API > service_role key

---

## 7. 지금 남아 있는 리스크

### 환경변수 미설정

- Vercel에 신규 env var 4개 미설정 시 Stripe 기능 전체 비활성
- `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 webhook DB 업데이트 실패

### 운영

- Sentry/PostHog 등 운영 가시성 없음
- AI 비용 로그/usage ledger 없음

### UX

- 업그레이드 성공 후 toast 등 피드백 UI 미구현 (url 쿼리 `?upgrade=success` 는 준비됐지만 UI 처리 없음)
- billing portal (구독 취소/관리) 없음

---

## 8. 다음 작업 우선순위

### P0: 배포 전 필수

1. Supabase SQL 실행 (신규 Stripe 필드 alter table)
2. Stripe 대시보드 Product/Price 생성
3. Vercel 신규 환경변수 4개 설정 후 재배포
4. 실제 결제 흐름 수동 검증

### P1: 업그레이드 UX 완성

5. `?upgrade=success` 감지 → toast/배너 표시 (`app/page.tsx`)
6. billing portal 링크 추가 (구독 취소/재개)

### P2: 운영 가시성

7. Sentry 또는 동등 에러 추적
8. PostHog 또는 동등 분석 도구

### P3: 추가 수익화

9. 연간 플랜 추가 (Stripe Price 추가)
10. 가격/플랜 랜딩 페이지 개선
