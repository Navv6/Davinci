"use client";

import { useRef } from "react";
import type { GraphNode } from "@/types/davinci";

type NodeInfoPanelProps = {
  aiError?: string | null;
  aiExpanding?: boolean;
  canDelete: boolean;
  node: GraphNode | null;
  onAIExpand?: () => void;
  onDelete: () => void;
  onDescriptionChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  remainingAIUses?: number;
  visible: boolean;
};

const CATEGORY_LABEL = {
  topic: "중심 주제",
  idea: "아이디어 가지",
  keyword: "키워드",
  task: "실행 항목",
  reference: "레퍼런스",
} as const;

export function NodeInfoPanel({
  aiError,
  aiExpanding,
  canDelete,
  node,
  onAIExpand,
  onDelete,
  onDescriptionChange,
  onLabelChange,
  remainingAIUses,
  visible,
}: NodeInfoPanelProps) {
  const labelFocusedNodes = useRef(new Set<number>());
  const descFocusedNodes = useRef(new Set<number>());

  if (!node) {
    return null;
  }

  const category = node.category ?? "idea";

  return (
    <div
      data-graph-control
      className={`pointer-events-auto absolute bottom-6 left-1/2 z-30 w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 cursor-default rounded-[1.5rem] border border-[#e8d5b8] bg-[rgba(250,248,243,0.97)] px-6 py-5 shadow-[0_20px_44px_rgba(61,43,18,0.09)] backdrop-blur-md transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.26em] text-[#c4a882]">
          {CATEGORY_LABEL[category]}
        </span>

        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] italic tracking-[0.1em] text-[#c4a882] transition-colors duration-200 hover:text-[#8b6c42]"
          >
            삭제
          </button>
        ) : null}
      </div>

      <input
        value={node.label}
        onChange={(event) => onLabelChange(event.target.value)}
        onFocus={(event) => {
          if (!labelFocusedNodes.current.has(node.id)) {
            labelFocusedNodes.current.add(node.id);
            event.target.select();
          }
        }}
        maxLength={28}
        style={{ caretColor: "#1a1208" }}
        className="w-full cursor-text border-b border-[#e8d5b8] bg-transparent pb-2 font-display text-[1.35rem] tracking-[0.03em] text-[#1a1208] outline-none transition-colors duration-200 placeholder:text-[#d4b896] focus:border-[#8b6c42]"
        placeholder="제목"
      />

      <textarea
        value={node.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onFocus={(event) => {
          if (!descFocusedNodes.current.has(node.id)) {
            descFocusedNodes.current.add(node.id);
            event.target.select();
          }
        }}
        rows={2}
        style={{ caretColor: "#3d2b12" }}
        className="mt-3 w-full cursor-text resize-none bg-transparent text-[13px] leading-6 tracking-[0.02em] text-[#5d4528] outline-none transition-colors duration-200 placeholder:text-[#d4b896]"
        placeholder="내용을 입력하세요"
      />

      {onAIExpand ? (
        <div className="mt-4 border-t border-[#e8d5b8] pt-4">
          {remainingAIUses !== undefined && remainingAIUses > 0 ? (
            <button
              type="button"
              onClick={onAIExpand}
              disabled={aiExpanding}
              className="flex w-full items-center justify-between rounded-[0.75rem] border border-[#e8d5b8] px-4 py-2.5 text-[12px] italic tracking-[0.1em] text-[#8b6c42] transition-colors duration-200 hover:border-[#8b6c42] hover:text-[#3d2b12] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{aiExpanding ? "확장 중.." : "AI로 아이디어 확장"}</span>
              {aiExpanding ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-[#c4a882] border-t-[#8b6c42]" />
              ) : (
                <span className="not-italic text-[10px] tracking-[0.15em] text-[#c4a882]">
                  {remainingAIUses}/3
                </span>
              )}
            </button>
          ) : remainingAIUses === 0 ? (
            <p className="text-center text-[11px] italic tracking-[0.12em] text-[#c4a882]">
              구독이 필요합니다 (0/3)
            </p>
          ) : null}

          {aiError ? (
            <p className="mt-2 text-[11px] italic tracking-[0.08em] text-[#b86b4b]">
              {aiError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
