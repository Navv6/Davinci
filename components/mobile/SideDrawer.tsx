"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  getEffectiveAIUsed,
  getEffectiveQuota,
  getPlanBadgeLabel,
  getQuotaPercent,
  getRemainingAIUses,
  isQuotaExhausted,
  isQuotaLow,
  isPro,
} from "@/lib/aiUsage";
import { buildOutlineForest, type OutlineNode } from "@/lib/outline";
import type {
  SupporterRequest,
  WorkspaceGraphSummary,
  WorkspaceProfile,
} from "@/lib/cloudStorage";
import type { GraphEdge, GraphNode } from "@/types/davinci";

type NoteFilter = "all" | "archived" | "favorites";

type SideDrawerProps = {
  authEmail?: string | null;
  authReady?: boolean;
  currentGraphId?: string;
  currentGraphTitle?: string;
  edges: GraphEdge[];
  graphs: WorkspaceGraphSummary[];
  memo: string;
  nodes: GraphNode[];
  onArchiveGraph?: (graphId: string) => Promise<void>;
  onClose: () => void;
  onCreateGraph?: () => Promise<void>;
  onMemoChange: (value: string) => void;
  onSelectGraph?: (graphId: string) => Promise<void>;
  onSelectNode: (id: number) => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onToggleFavoriteGraph?: (graphId: string, value: boolean) => Promise<void>;
  onUpgradeClick?: () => void;
  open: boolean;
  profile: WorkspaceProfile | null;
  rootId: number;
  selectedNodeId: number;
  supporterRequest: SupporterRequest | null;
};

function formatUpdatedAt(value: string) {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return "방금 전";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getSupportStatusCopy(
  profile: WorkspaceProfile | null,
  request: SupporterRequest | null,
) {
  if (request?.status === "pending") {
    return {
      cta: "후원 신청 보기",
      description: "신청 접수됨 · 입금 확인 대기",
    };
  }

  if (request?.status === "verified" || isPro(profile)) {
    return {
      cta: "Pro 상태 안내",
      description: "Pro 활성화됨 · 연장 문의 가능",
    };
  }

  if (request?.status === "expired") {
    return {
      cta: "다시 신청하기",
      description: "Pro 기간 만료 · 무료 플랜으로 복귀",
    };
  }

  if (request?.status === "rejected") {
    return {
      cta: "신청 다시 남기기",
      description: "입금 확인 필요 · 신청 수정 가능",
    };
  }

  return {
    cta: "후원하고 Pro 체험하기",
    description: "웹 후원 신청 후 계좌이체로 진행",
  };
}

function TreeItem({
  item,
  onSelectNode,
  selectedNodeId,
  onClose,
}: {
  item: OutlineNode;
  onClose: () => void;
  onSelectNode: (id: number) => void;
  selectedNodeId: number;
}) {
  const isSelected = item.node.id === selectedNodeId;

  return (
    <div className="mt-1 first:mt-0">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelectNode(item.node.id);
          onClose();
        }}
        style={{
          marginLeft: `${item.node.level * 12}px`,
          width: `calc(100% - ${item.node.level * 12}px)`,
        }}
        className={`flex w-full items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all duration-200 ${
          isSelected
            ? "border-[#8b6c42] bg-[rgba(250,248,243,0.98)]"
            : "border-transparent bg-white/50 active:bg-white/80"
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            item.node.level === 0
              ? "bg-[#1a1208]"
              : isSelected
                ? "bg-[#8b6c42]"
                : "bg-[#d4b896]"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-display tracking-[0.03em] ${
              item.node.level === 0
                ? "text-[1rem] text-[#1a1208]"
                : isSelected
                  ? "text-[0.94rem] text-[#1a1208]"
                  : "text-[0.9rem] text-[#5d4528]"
            }`}
          >
            {item.node.label}
          </span>
          <span className="mt-0.5 block text-[11px] tracking-[0.14em] text-[#c4a882]">
            레벨 {item.node.level} · 가지 {item.children.length}
          </span>
        </span>
      </button>

      {item.children.length > 0 ? (
        <div className="mt-1">
          {item.children.map((child) => (
            <TreeItem
              key={child.node.id}
              item={child}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
              onClose={onClose}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SideDrawer({
  authEmail,
  authReady,
  currentGraphId,
  currentGraphTitle,
  edges,
  graphs,
  memo,
  nodes,
  onArchiveGraph,
  onClose,
  onCreateGraph,
  onMemoChange,
  onSelectGraph,
  onSelectNode,
  onSignIn,
  onSignOut,
  onToggleFavoriteGraph,
  onUpgradeClick,
  open,
  profile,
  rootId,
  selectedNodeId,
  supporterRequest,
}: SideDrawerProps) {
  const [filter, setFilter] = useState<NoteFilter>("all");
  const deferredNodes = useDeferredValue(nodes);
  const deferredEdges = useDeferredValue(edges);
  const effectiveQuota = getEffectiveQuota(profile);
  const effectiveUsed = getEffectiveAIUsed(profile);
  const supportStatus = getSupportStatusCopy(profile, supporterRequest);
  const { rootTree, looseNodes } = useMemo(
    () => buildOutlineForest(rootId, deferredNodes, deferredEdges),
    [rootId, deferredNodes, deferredEdges],
  );

  const filteredGraphs = useMemo(() => {
    if (filter === "favorites") {
      return graphs.filter((graph) => graph.is_favorite && !graph.archived_at);
    }

    if (filter === "archived") {
      return graphs.filter((graph) => Boolean(graph.archived_at));
    }

    return graphs.filter((graph) => !graph.archived_at);
  }, [filter, graphs]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[rgba(26,18,8,0.18)] transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        data-graph-control
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-[min(21rem,88vw)] flex-col bg-[rgba(250,248,243,0.99)] shadow-[-12px_0_40px_rgba(61,43,18,0.1)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-[#e8d5b8] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] uppercase tracking-[0.24em] text-[#8b6c42]">
                Workspace
              </span>
              <p className="mt-1 truncate text-[12px] tracking-[0.04em] text-[#1a1208]">
                {authEmail ?? "게스트"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#c4a882] active:text-[#8b6c42]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3">
            {authReady === false ? (
              <p className="text-[11px] italic tracking-[0.18em] text-[#c4a882]">계정 확인 중</p>
            ) : authEmail ? (
              onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full rounded-full border border-[#e8d5b8] px-3 py-2 text-[11px] tracking-[0.14em] text-[#c4a882] active:text-[#8b6c42]"
                >
                  로그아웃
                </button>
              ) : null
            ) : onSignIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="w-full rounded-full border border-[#8b6c42] px-3 py-2 text-[12px] italic tracking-[0.14em] text-[#8b6c42] active:bg-[#f0ebe2]"
              >
                Google 로그인
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-[1rem] border border-[#ecdcc4] bg-white/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a882]">
                  플랜
                </p>
                <p
                  className={`mt-1 font-display text-[1rem] tracking-[0.03em] ${
                    isPro(profile) ? "text-[#6b4f2a] font-semibold" : "text-[#1a1208]"
                  }`}
                >
                  {getPlanBadgeLabel(profile)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a882]">
                  AI 사용량
                </p>
                <p className="mt-1 text-[13px] tracking-[0.03em] text-[#8b6c42]">
                  {profile ? `${effectiveUsed}/${effectiveQuota}` : "0/0"}
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

            <p
              className={`mt-2 text-[11px] tracking-[0.03em] ${
                isQuotaExhausted(profile) ? "text-[#c0392b]" : "text-[#c4a882]"
              }`}
            >
              남은 횟수 {getRemainingAIUses(profile)}
            </p>

            <p className="mt-2 text-[11px] tracking-[0.03em] text-[#8b6c42]">
              {supportStatus.description}
            </p>

            {onUpgradeClick ? (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="mt-3 w-full rounded-full border border-[#c4a882] px-3 py-1.5 text-[11px] tracking-[0.18em] text-[#8b6c42]"
              >
                {supportStatus.cta}
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-[1rem] border border-[#ecdcc4] bg-white/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8b6c42]">
                내 노트
              </p>
              <button
                type="button"
                onClick={() => void onCreateGraph?.()}
                className="rounded-full border border-[#c4a882] px-3 py-1 text-[11px] tracking-[0.16em] text-[#8b6c42]"
              >
                새 노트
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["all", "전체"],
                ["favorites", "즐겨찾기"],
                ["archived", "보관함"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-1 text-[11px] tracking-[0.16em] ${
                    filter === value
                      ? "border-[#8b6c42] bg-[#f0ebe2] text-[#8b6c42]"
                      : "border-[#ecdcc4] text-[#c4a882]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-[1rem] border border-[#ecdcc4] bg-[rgba(255,255,255,0.78)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a882]">
                현재 노트
              </p>
              <p className="mt-1 truncate font-display text-[1rem] tracking-[0.03em] text-[#1a1208]">
                {currentGraphTitle ?? "선택된 노트 없음"}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {filteredGraphs.length > 0 ? (
                filteredGraphs.map((graph) => (
                  <div
                    key={graph.id}
                    className={`rounded-[1rem] border px-3 py-3 ${
                      graph.id === currentGraphId
                        ? "border-[#8b6c42] bg-[rgba(250,248,243,0.98)]"
                        : "border-[#ecdcc4] bg-[rgba(255,255,255,0.72)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void onSelectGraph?.(graph.id)}
                      className="block w-full text-left"
                    >
                      <p className="truncate font-display text-[0.98rem] tracking-[0.03em] text-[#1a1208]">
                        {graph.title}
                      </p>
                      <p className="mt-1 text-[11px] tracking-[0.14em] text-[#c4a882]">
                        {formatUpdatedAt(graph.updated_at)}
                      </p>
                    </button>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void onToggleFavoriteGraph?.(graph.id, !graph.is_favorite)
                        }
                        className="rounded-full border border-[#ecdcc4] px-2.5 py-1 text-[11px] tracking-[0.14em] text-[#8b6c42]"
                      >
                        {graph.is_favorite ? "★" : "☆"}
                      </button>
                      {!graph.archived_at ? (
                        <button
                          type="button"
                          onClick={() => void onArchiveGraph?.(graph.id)}
                          className="rounded-full border border-[#ecdcc4] px-2.5 py-1 text-[11px] tracking-[0.14em] text-[#8b6c42]"
                        >
                          보관
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[#ecdcc4] px-3 py-4 text-[12px] text-[#c4a882]">
                  표시할 노트가 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[1rem] border border-[#ecdcc4] bg-white/60 px-4 py-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[#c4a882]">
              구조 보기
            </p>

            {rootTree ? (
              <TreeItem
                item={rootTree}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNodeId}
                onClose={onClose}
              />
            ) : null}

            {looseNodes.length > 0 ? (
              <div className="mt-4 border-t border-dashed border-[#ecdcc4] pt-3">
                {looseNodes.map((item) => (
                  <TreeItem
                    key={item.node.id}
                    item={item}
                    onSelectNode={onSelectNode}
                    selectedNodeId={selectedNodeId}
                    onClose={onClose}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#e8d5b8] px-5 py-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[#c4a882]">
            전체 메모
          </p>
          <textarea
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
            rows={5}
            placeholder="이 노트 전체에 대한 메모를 적어보세요"
            className="w-full resize-none rounded-[1rem] border border-[#e8d5b8] bg-white/80 px-4 py-3 text-[13px] leading-6 text-[#3d2b12] outline-none placeholder:text-[#c4a882] focus:border-[#8b6c42]"
            style={{ caretColor: "#3d2b12" }}
          />
        </div>
      </aside>
    </>
  );
}
