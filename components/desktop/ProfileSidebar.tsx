"use client";

import { useMemo, useState } from "react";
import {
  getEffectiveAIUsed,
  getEffectiveQuota,
  getPlanBadgeLabel,
  getQuotaPercent,
  getRemainingAIUses,
  isPro,
  isQuotaExhausted,
  isQuotaLow,
} from "@/lib/aiUsage";
import type {
  SupporterRequest,
  WorkspaceGraphSummary,
  WorkspaceProfile,
} from "@/lib/cloudStorage";

type NoteFilter = "all" | "archived" | "favorites";

type ProfileSidebarProps = {
  authEmail?: string | null;
  authReady?: boolean;
  currentGraphId?: string;
  graphs?: WorkspaceGraphSummary[];
  onArchiveGraph?: (graphId: string) => Promise<void>;
  onClose: () => void;
  onCreateGraph?: () => Promise<void>;
  onDeleteGraph?: (graphId: string) => Promise<void>;
  onSelectGraph?: (graphId: string) => Promise<void>;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onToggleFavoriteGraph?: (graphId: string, value: boolean) => Promise<void>;
  onUpgradeClick?: () => void;
  open: boolean;
  profile: WorkspaceProfile | null;
  supporterRequest: SupporterRequest | null;
};

function getSupportStatusCopy(
  profile: WorkspaceProfile | null,
  request: SupporterRequest | null,
) {
  if (request?.status === "pending") {
    return {
      cta: "후원 신청 보기",
      description: "신청이 접수되었습니다. 입금 확인 후 Pro가 활성화됩니다.",
    };
  }

  if (request?.status === "verified" || isPro(profile)) {
    return {
      cta: "Pro 상태 안내",
      description: "현재 Pro 상태입니다. 후원 내역 문의가 필요하면 연락해 주세요.",
    };
  }

  if (request?.status === "expired") {
    return {
      cta: "다시 신청하기",
      description: "Pro 기간이 만료되어 무료 플랜으로 돌아왔습니다.",
    };
  }

  if (request?.status === "rejected") {
    return {
      cta: "신청 다시 열기",
      description: "입금 정보 확인이 필요합니다. 내용을 보완해 다시 신청해 주세요.",
    };
  }

  return {
    cta: "후원하고 Pro 체험하기",
    description: "월 후원 신청 후 계좌이체로 진행합니다.",
  };
}

function formatUpdatedAt(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "방금 전";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function ProfileSidebar({
  authEmail,
  authReady,
  currentGraphId,
  graphs = [],
  onArchiveGraph,
  onClose,
  onCreateGraph,
  onDeleteGraph,
  onSelectGraph,
  onSignIn,
  onSignOut,
  onToggleFavoriteGraph,
  onUpgradeClick,
  open,
  profile,
  supporterRequest,
}: ProfileSidebarProps) {
  const effectiveQuota = getEffectiveQuota(profile);
  const effectiveUsed = getEffectiveAIUsed(profile);
  const supportStatus = getSupportStatusCopy(profile, supporterRequest);
  const [filter, setFilter] = useState<NoteFilter>("all");

  const filteredGraphs = useMemo(() => {
    if (filter === "favorites") return graphs.filter((g) => g.is_favorite && !g.archived_at);
    if (filter === "archived") return graphs.filter((g) => Boolean(g.archived_at));
    return graphs.filter((g) => !g.archived_at);
  }, [filter, graphs]);

  return (
    <div
      data-graph-control
      role="dialog"
      aria-hidden={!open}
      className={`pointer-events-auto absolute right-6 top-[4.8rem] z-40 flex max-h-[calc(100vh-7rem)] w-[20rem] flex-col overflow-hidden rounded-[1.45rem] border border-[#e8d5b8] bg-[rgba(250,248,243,0.97)] shadow-[0_20px_44px_rgba(61,43,18,0.12)] backdrop-blur-md transition-all duration-200 ${
        open
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      {/* 스크롤 가능 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">

        {/* 프로필 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b6c42]">
              Profile
            </p>
            <p className="mt-1 truncate font-display text-[0.98rem] tracking-[0.03em] text-[#1a1208]">
              {authEmail ?? "게스트"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.18em] ${
                isPro(profile)
                  ? "border-[#c4a882] bg-[#f5ede0] font-semibold text-[#6b4f2a]"
                  : "border-[#e8d5b8] text-[#8b6c42]"
              }`}
            >
              {getPlanBadgeLabel(profile)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid h-7 w-7 place-items-center rounded-full border border-[#e8d5b8] text-[#c4a882] transition-colors hover:border-[#8b6c42] hover:text-[#8b6c42]"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* AI 사용량 카드 */}
        <div className="mt-4 rounded-[1rem] border border-[#ecdcc4] bg-[rgba(255,255,255,0.78)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#c4a882]">
                AI 사용량
              </p>
              <p className="mt-1 font-display text-[1rem] tracking-[0.04em] text-[#1a1208]">
                {profile ? `${effectiveUsed}/${effectiveQuota}` : "0/0"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a882]">
                남은 횟수
              </p>
              <p
                className={`mt-1 text-[13px] tracking-[0.04em] ${
                  isQuotaExhausted(profile) ? "text-[#c0392b]" : "text-[#8b6c42]"
                }`}
              >
                {getRemainingAIUses(profile)}
              </p>
            </div>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ecdcc4]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isQuotaExhausted(profile)
                  ? "bg-[#c0392b]"
                  : isQuotaLow(profile)
                    ? "bg-[#d4a843]"
                    : "bg-[#8b6c42]"
              }`}
              style={{ width: `${getQuotaPercent(profile)}%` }}
            />
          </div>

          <p className="mt-3 text-[11px] leading-5 tracking-[0.03em] text-[#8b6c42]">
            {supportStatus.description}
          </p>

          {onUpgradeClick ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="mt-3 w-full rounded-full border border-[#c4a882] px-3 py-2 text-[11px] tracking-[0.18em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
            >
              {supportStatus.cta}
            </button>
          ) : null}
        </div>

        {/* 노트 목록 */}
        {graphs.length > 0 || onCreateGraph ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6c42]">
                노트 목록
              </p>
              {onCreateGraph ? (
                <button
                  type="button"
                  onClick={() => void onCreateGraph()}
                  className="rounded-full border border-[#c4a882] px-3 py-1 text-[11px] tracking-[0.18em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
                >
                  새 노트
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex gap-1.5">
              {([ ["all", "전체"], ["favorites", "즐겨찾기"], ["archived", "보관함"] ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.14em] transition-colors ${
                    filter === value
                      ? "border-[#8b6c42] bg-[#f0ebe2] text-[#8b6c42]"
                      : "border-[#ecdcc4] text-[#c4a882] hover:text-[#8b6c42]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-2">
              {filteredGraphs.length > 0 ? (
                filteredGraphs.map((graph) => {
                  const isCurrent = graph.id === currentGraphId;
                  return (
                    <div
                      key={graph.id}
                      className={`rounded-[1rem] border px-3 py-3 ${
                        isCurrent
                          ? "border-[#8b6c42] bg-[rgba(250,248,243,0.98)]"
                          : "border-[#ecdcc4] bg-[rgba(255,255,255,0.72)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void onSelectGraph?.(graph.id)}
                        className="block w-full text-left"
                      >
                        <p className="truncate font-display text-[1rem] tracking-[0.03em] text-[#1a1208]">
                          {graph.title}
                        </p>
                        <p className="mt-0.5 text-[11px] tracking-[0.12em] text-[#c4a882]">
                          {formatUpdatedAt(graph.updated_at)}
                        </p>
                      </button>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => void onToggleFavoriteGraph?.(graph.id, !graph.is_favorite)}
                          className="rounded-full border border-[#ecdcc4] px-2.5 py-1 text-[11px] tracking-[0.12em] text-[#8b6c42] transition-colors hover:border-[#8b6c42]"
                        >
                          {graph.is_favorite ? "즐겨찾기 해제" : "즐겨찾기"}
                        </button>
                        {!graph.archived_at ? (
                          <button
                            type="button"
                            onClick={() => void onArchiveGraph?.(graph.id)}
                            className="rounded-full border border-[#ecdcc4] px-2.5 py-1 text-[11px] tracking-[0.12em] text-[#8b6c42] transition-colors hover:border-[#8b6c42]"
                          >
                            보관
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void onDeleteGraph?.(graph.id)}
                          className="rounded-full border border-[#ecdcc4] px-2.5 py-1 text-[11px] tracking-[0.12em] text-[#b86b4b] transition-colors hover:border-[#b86b4b] hover:bg-[rgba(184,107,75,0.08)]"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[#ecdcc4] px-3 py-4 text-[12px] text-[#c4a882]">
                  표시할 노트가 없습니다.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* 인증 영역 */}
        <div className="mt-4 border-t border-[#ecdcc4] pt-3">
          {authReady === false ? (
            <p className="text-center text-[11px] italic tracking-[0.18em] text-[#c4a882]">
              계정 확인 중
            </p>
          ) : authEmail ? (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] tracking-[0.1em] text-[#c4a882]">
                {authEmail}
              </p>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="shrink-0 rounded-full border border-[#e8d5b8] px-3 py-1.5 text-[11px] tracking-[0.14em] text-[#c4a882] transition-colors hover:border-[#8b6c42] hover:text-[#8b6c42]"
                >
                  로그아웃
                </button>
              ) : null}
            </div>
          ) : onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="w-full rounded-full border border-[#8b6c42] px-3 py-2 text-[12px] italic tracking-[0.14em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
            >
              Google 로그인
            </button>
          ) : null}
        </div>

      </div>
    </div>
  );
}
