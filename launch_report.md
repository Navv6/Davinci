# 다빈치노트 출시 준비 보고서
기준시각: 2026-04-07 00:36

작성 기준: 현재 코드베이스와 실제 구현 파일, 최근 검증 결과 기준

## 1. 프로젝트 개요

- 현재 프로젝트의 목적
  - 다빈치노트는 3D 아이디어 맵을 만들고, 노드를 추가/편집/삭제하며, 선택 노드를 AI로 확장하는 시각형 노트 서비스다.
  - 현재는 무료 베타 출시 가능 수준까지 올라왔고, 이후 구독형 AI SaaS로 확장하는 구조를 준비 중이다.

- 추정 기술 스택
  - 프론트엔드: Next.js 16 App Router, React 19, Tailwind CSS 4
  - 시각화: Three.js
  - 인증/저장: Supabase Auth + Supabase Postgres
  - AI: OpenAI API (`gpt-5-nano`)
  - 배포: Vercel

- 전체 디렉토리 구조 요약
  - `app/`
    - 홈, 정책 페이지, not-found, sitemap/robots/manifest, AI API
  - `components/desktop/`
    - 데스크톱 워크스페이스 UI
  - `components/mobile/`
    - 모바일 워크스페이스 UI
  - `components/shared/`
    - 로그인 상태 UI
  - `lib/`
    - auth, storage, cloud storage, AI usage, outline, Supabase client
  - `supabase/`
    - DB/RLS SQL
  - `types/`
    - 그래프 및 Supabase 타입

## 2. 구현 현황 요약

- 구현 완료
  - Google 로그인 / 로그아웃
  - 다중 노트 생성
  - 노트 전환
  - 노트별 session draft 저장
  - Supabase 클라우드 저장/복구
  - 즐겨찾기 / 보관함
  - AI 확장 API
  - 계정 기준 AI quota 구조
  - 개인 워크스페이스 UI
  - SEO / PWA / 정책 페이지 노출
  - Vercel 배포 검증

- 부분 구현
  - 플랜/구독 필드는 DB에 있으나 실제 free/pro 기능 분기는 아직 없음
  - 정책 문서 노출은 되어 있으나 문구/인코딩 최종 polish는 필요
  - AI quota는 서버 반영까지 들어갔지만 billing-ready usage ledger는 없음

- 미구현
  - Stripe Checkout
  - Stripe webhook
  - subscription entitlement
  - 가격/플랜 페이지
  - 운영 로그/분석 도구

- 확인 필요
  - 배포 도메인에서 정책 문구 최종 확인
  - Stripe 도입 전 plan 설계 확정

## 3. 핵심 사용자 플로우 점검

### 랜딩 진입
- 동작 여부: 동작
- 관련 파일: `app/page.tsx`, `components/desktop/DavinciExperience.tsx`, `components/mobile/DavinciExperience.tsx`
- 문제점: 유료 전환용 플랜 설명 없음
- 출시 가능 여부: 무료 베타 가능

### 회원가입/로그인
- 동작 여부: 동작
- 관련 파일: `lib/auth.ts`, `components/shared/AuthStatus.tsx`
- 문제점: Google만 지원
- 출시 가능 여부: 가능

### 새 노트 생성
- 동작 여부: 동작
- 관련 파일: `app/page.tsx`, `lib/cloudStorage.ts`, `components/desktop/IdeaSidebar.tsx`, `components/mobile/SideDrawer.tsx`
- 문제점: 제목 자동 생성 로직이 단순
- 출시 가능 여부: 가능

### 노드 생성/편집
- 동작 여부: 동작
- 관련 파일: `components/desktop/IdeaSpace.tsx`, `components/mobile/IdeaSpace.tsx`, `components/desktop/NodeInfoPanel.tsx`
- 문제점: 일부 UI polish 후순위
- 출시 가능 여부: 가능

### 저장/불러오기
- 동작 여부: 동작
- 관련 파일: `lib/storage.ts`, `lib/cloudStorage.ts`
- 문제점: 버전 히스토리 없음
- 출시 가능 여부: 가능

### AI 확장 기능
- 동작 여부: 동작
- 관련 파일: `app/api/ai-expand/route.ts`, `lib/aiUsage.ts`
- 문제점: 아직 free/pro 분기 전
- 출시 가능 여부: 무료 체험 기능으로 가능

### 결제 진입
- 동작 여부: 미구현
- 관련 파일: 없음
- 문제점: 결제 흐름 전체 부재
- 출시 가능 여부: 불가

### 구독 상태 반영
- 동작 여부: 부분 준비
- 관련 파일: `supabase/graphs.sql`, `types/supabase.ts`
- 문제점: 필드는 있으나 실제 반영 로직 없음
- 출시 가능 여부: 불가

## 4. 출시 readiness 평가

- 기능 완성도: 7/10
- 안정성: 6/10
- UX: 6/10
- 보안: 6/10
- 확장성: 6/10
- 운영 가능성: 4/10
- 수익화 준비도: 4/10

## 5. 수익화 및 결제 readiness 평가

### 현재 유료화 가능한 핵심 가치 존재 여부
- 현재 상태
  - 3D 아이디어 맵 + AI 확장이라는 흥미 요소는 존재
- 부족한 점
  - 아직 돈을 낼 만큼 강한 free/pro 차이가 없음
- 출시 전 필요 여부: 필요
- 우선순위: 높음

### 무료 플랜과 유료 플랜 분리 가능성
- 현재 상태
  - `profiles.plan`, `subscription_status`, `ai_quota`, `ai_used` 존재
- 부족한 점
  - 실제 UI/API entitlement 분기 없음
- 출시 전 필요 여부: 유료화 전 필수
- 우선순위: 최상

### AI 기능을 유료 포인트로 활용할 수 있는지
- 현재 상태
  - 가능성 있음
- 부족한 점
  - 지금 AI는 단일 확장 기능 중심
- 출시 전 필요 여부: 필요
- 우선순위: 높음

### 결제 도입 전 필요한 선행 구조 존재 여부
- 현재 상태
  - 절반 이상 준비됨
- 부족한 점
  - Stripe customer / subscription sync / webhook 없음
- 출시 전 필요 여부: 필수
- 우선순위: 최상

### 사용량 제한 구현 가능성
- 현재 상태
  - 계정 기준 quota 가능
- 부족한 점
  - plan별 quota 분기 없음
- 출시 전 필요 여부: 유료화 전 필수
- 우선순위: 최상

### 결제 도입 시 필요한 최소 추가 작업
- 현재 상태
  - 결제 관련 구현 없음
- 부족한 점
  - Checkout, webhook, entitlement, UI 전부 필요
- 출시 전 필요 여부: 필수
- 우선순위: 최상

### 현재 상태에서 유료 서비스라고 부를 수 있는지 여부
- 현재 상태
  - 불가
- 이유
  - 결제와 유료 혜택이 아직 제품에 반영되지 않음

## 6. 치명적 이슈

- 결제/구독 구조 미구현
  - 예상 난이도: 중상
- free/pro 실분기 미구현
  - 예상 난이도: 중
- 운영 로깅/분석 부재
  - 예상 난이도: 하중
- 정책 문구 최종 polish 필요
  - 예상 난이도: 하

## 7. 출시 가능 MVP 범위 제안

- 지금 당장 출시 가능한 최소 범위
  - Google 로그인
  - 다중 노트 생성/전환
  - 저장/복구
  - AI 3회 체험
  - 무료 베타 공개

- 제외해도 되는 기능
  - 결제
  - Stripe
  - 협업
  - 고급 AI 정리 기능

- 후속 버전으로 미뤄도 되는 기능
  - 공유 링크
  - 팀 기능
  - 버전 히스토리

## 8. 수익형 MVP 범위 제안

- 무료 버전으로 출시 가능한 범위
  - 다중 노트
  - AI 3회 체험
  - 기본 저장/복구

- 유료 버전으로 전환하기 위해 반드시 필요한 기능
  - free/pro quota 분기
  - 업그레이드 CTA
  - Stripe 결제
  - 구독 상태 반영

- AI 기능을 넣는다면 최소 어떤 방식으로 넣어야 하는지
  - 무료: AI 3회
  - 유료: 더 높은 AI quota

- 결제 도입 전 선행해야 할 구조
  - `profiles.plan`
  - `profiles.subscription_status`
  - `profiles.ai_quota`
  - `profiles.ai_used`
  - `stripe_customer_id`

- 가장 현실적인 초기 과금 방식
  - 단일 구독 플랜
  - 무료는 제한된 quota
  - 유료는 더 높은 quota + 향후 고급 AI 기능

## 9. 작업 계획

### P0: 반드시 먼저
- free/pro 실제 분기 구현
- plan 기준 quota 적용
- 업그레이드 CTA 추가

### P1: 출시 전 필요
- billing-ready schema 확정
- Stripe Checkout API
- Stripe webhook
- 결제 후 profile 반영

### P2: 출시 후 개선
- 가격/플랜 랜딩 고도화
- usage ledger / analytics
- 고급 AI 기능

## 10. 수익화 기준 우선순위 작업

### M0
- 작업명: free/pro quota 분기
- 목적: 유료 포인트 형성

### M1
- 작업명: 업그레이드 UI와 plan 노출
- 목적: 무료→유료 전환 경로 확보

### M2
- 작업명: Stripe Checkout + webhook
- 목적: 실제 결제 가능 상태 만들기

### M3
- 작업명: usage / billing analytics
- 목적: AI 비용과 결제 효율 운영

## 11. 최종 결론

- 현재 상태에서 출시 가능 / 조건부 가능 / 불가
  - 무료 베타 출시 가능

- 현재 상태에서 수익형 출시 가능 / 조건부 가능 / 불가
  - 아직 불가

- 이유
  - 무료 베타 수준의 제품 가치는 충분히 보인다.
  - 하지만 결제/플랜/entitlement가 아직 실동작하지 않는다.

- 다음 액션 5개
  1. `profiles.plan` 기준 UI 분기
  2. `profiles.plan` 기준 quota 분기
  3. 업그레이드 CTA 추가
  4. Stripe Checkout 설계
  5. Stripe webhook 및 구독 상태 반영
