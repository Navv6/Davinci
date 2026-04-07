# 다빈치노트 체크리스트
기준시각: 2026-04-07

## 1. 현재 완료 체크

### 무료 베타 핵심 기능
- [x] Google 로그인
- [x] 다중 노트 생성
- [x] 노트 전환
- [x] 노트별 세션 draft 저장
- [x] Supabase 클라우드 저장/복구
- [x] 즐겨찾기
- [x] 보관함
- [x] 계정 기준 AI quota
- [x] AI 확장 API 서버 인증
- [x] AI 확장 성공 시 서버에서 usage 차감
- [x] 데스크톱 개인화 사이드바
- [x] 모바일 개인화 드로어
- [x] robots / sitemap / manifest
- [x] 정책 페이지 노출
- [x] Vercel 배포 검증

### 검증
- [x] `npx tsc --noEmit`
- [x] `npx eslint .`
- [x] `npm run build`
- [x] 최신 `supabase/graphs.sql` 실행
- [x] 다중 노트 흐름 수동 검증
- [x] AI quota 차감 수동 검증

---

## 2. 수익화 준비 체크

### 플랜/분기
- [x] `profiles.plan`
- [x] `profiles.subscription_status`
- [x] `profiles.ai_quota`
- [x] `profiles.ai_used`
- [x] `plan`을 실제 UI 분기에 반영 (배지 스타일, progress bar)
- [x] `plan`을 실제 API entitlement 분기에 반영 (ai_quota 분기)
- [x] quota progress bar + 경고 + 업그레이드 CTA

### Stripe Billing Schema
- [x] `stripe_customer_id` 필드
- [x] `stripe_subscription_id` 필드
- [x] `current_period_end` 필드
- [x] `cancel_at_period_end` 필드
- [x] `stripe_status` 필드

### Stripe 연동
- [x] `stripe` npm 패키지 설치
- [x] `lib/stripeServer.ts` (lazy init)
- [x] `lib/supabaseAdmin.ts` (service role, lazy init)
- [x] `app/api/stripe/checkout/route.ts`
- [x] `app/api/stripe/webhook/route.ts`
  - [x] `checkout.session.completed` → pro 업그레이드
  - [x] `customer.subscription.updated` → 구독 상태 동기화
  - [x] `customer.subscription.deleted` → free 다운그레이드

### AI 과금 준비
- [x] 계정 기준 usage 구조
- [x] 서버에서 quota 차감
- [x] plan별 quota 분기 (`PLAN_QUOTAS: { free: 3, pro: 50 }`)
- [ ] quota reset 정책 확정 (현재 30일 window, pro는 webhook에서 갱신)
- [ ] usage ledger 또는 billing event 로그

---

## 3. 배포 전 필수 체크 (P0)

- [ ] Supabase SQL: 신규 Stripe 필드 `alter table` 실행
- [ ] Stripe 대시보드: Pro Product + Price 생성
- [ ] Vercel 환경변수 추가:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_PRO_PRICE_ID`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Vercel 재배포
- [ ] 테스트 결제 흐름 수동 검증 (4242 카드)
- [ ] Stripe webhook 엔드포인트 등록 (`/api/stripe/webhook`)

---

## 4. 다음 작업 플랜

### Step 1. 업그레이드 UX 완성 (P1)
- [ ] `?upgrade=success` 감지 → 성공 toast/배너 (`app/page.tsx`)
- [ ] billing portal 링크 (구독 취소/재개) → Stripe Customer Portal API

### Step 2. 운영 가시성 (P2)
- [ ] Sentry 또는 동등 에러 추적
- [ ] PostHog 또는 동등 분석 도구
- [ ] AI 요청 실패/성공 로그 기준 정리

### Step 3. 추가 수익화 (P3)
- [ ] 연간 플랜 추가
- [ ] 가격/플랜 랜딩 페이지 개선
- [ ] 전환 분석

---

## 5. 현재 판정

- 무료 베타 출시: 가능
- 수익형 SaaS 출시: **환경변수 설정 + 수동 검증 후 가능**

현재 코드는 완성됨. 배포 전 Supabase SQL 실행 + Vercel 환경변수 4개 추가 필요.
