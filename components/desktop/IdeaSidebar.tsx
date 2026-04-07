"use client";

import { useDeferredValue, useMemo } from "react";
import { buildOutlineForest, type OutlineNode } from "@/lib/outline";
import type { GraphEdge, GraphNode } from "@/types/davinci";

type IdeaSidebarProps = {
  edges: GraphEdge[];
  memo: string;
  nodes: GraphNode[];
  onMemoChange: (value: string) => void;
  onSelectNode: (id: number) => void;
  open: boolean;
  rootId: number;
  selectedNodeId: number;
};

type OutlineTreeItemProps = {
  item: OutlineNode;
  onSelectNode: (id: number) => void;
  selectedNodeId: number;
};

function OutlineTreeItem({
  item,
  onSelectNode,
  selectedNodeId,
}: OutlineTreeItemProps) {
  const isSelected = item.node.id === selectedNodeId;

  return (
    <div className="mt-1 first:mt-0">
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectNode(item.node.id);
        }}
        className={`group flex w-full items-center gap-3 rounded-[1rem] border px-3 py-2 text-left transition-all duration-200 ${
          isSelected
            ? "border-[#8b6c42] bg-[rgba(250,248,243,0.98)] shadow-[0_10px_24px_rgba(61,43,18,0.08)]"
            : "border-transparent bg-white/55 hover:border-[#e8d5b8] hover:bg-white/80"
        }`}
        style={{
          marginLeft: `${item.node.level * 14}px`,
          width: `calc(100% - ${item.node.level * 14}px)`,
        }}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-200 ${
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
                ? "text-[1.05rem] text-[#1a1208]"
                : isSelected
                  ? "text-[0.98rem] text-[#1a1208]"
                  : "text-[0.94rem] text-[#5d4528]"
            }`}
          >
            {item.node.label}
          </span>
          <span className="mt-0.5 block text-[11px] uppercase tracking-[0.18em] text-[#c4a882]">
            레벨 {item.node.level}
          </span>
        </span>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] tracking-[0.16em] transition-colors duration-200 ${
            isSelected
              ? "border-[#d9c4a4] text-[#8b6c42]"
              : "border-[#ecdcc4] text-[#c4a882] group-hover:text-[#8b6c42]"
          }`}
        >
          가지 {item.children.length}
        </span>
      </button>

      {item.children.length > 0 ? (
        <div className="mt-1">
          {item.children.map((child) => (
            <OutlineTreeItem
              key={child.node.id}
              item={child}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}


export function IdeaSidebar({
  edges,
  memo,
  nodes,
  onMemoChange,
  onSelectNode,
  open,
  rootId,
  selectedNodeId,
}: IdeaSidebarProps) {
  const deferredNodes = useDeferredValue(nodes);
  const deferredEdges = useDeferredValue(edges);

  const { looseNodes, rootTree } = useMemo(
    () => buildOutlineForest(rootId, deferredNodes, deferredEdges),
    [deferredEdges, deferredNodes, rootId],
  );

  return (
    <div className="pointer-events-none absolute bottom-6 right-6 top-24 z-30">
      <aside
        data-graph-control
        className={`pointer-events-auto flex h-full min-h-0 w-[24rem] flex-col rounded-[1.75rem] border border-[#e8d5b8] bg-[rgba(250,248,243,0.97)] px-4 py-4 shadow-[0_22px_48px_rgba(61,43,18,0.1)] backdrop-blur-md transition-all duration-300 ${
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[1.5rem] opacity-0"
        }`}
      >
        <div className="rounded-[1.25rem] border border-[#ecdcc4] bg-white/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a882]">
            구조 보기
          </p>

          <div className="mt-3 max-h-[16rem] overflow-y-auto pr-1">
            {rootTree ? (
              <OutlineTreeItem
                item={rootTree}
                onSelectNode={onSelectNode}
                selectedNodeId={selectedNodeId}
              />
            ) : null}

            {looseNodes.length > 0 ? (
              <div className="mt-4 border-t border-dashed border-[#ecdcc4] pt-3">
                <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[#c4a882]">
                  분리된 노드
                </p>
                {looseNodes.map((item) => (
                  <OutlineTreeItem
                    key={item.node.id}
                    item={item}
                    onSelectNode={onSelectNode}
                    selectedNodeId={selectedNodeId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[1.25rem] border border-[#ecdcc4] bg-white/55 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c4a882]">
            전체 메모
          </p>
          <p className="mt-1 text-[11px] leading-5 tracking-[0.03em] text-[#c4a882]">
            지금 노트의 방향, 다음 액션, 생각 흐름을 자유롭게 정리해 보세요.
          </p>

          <textarea
            value={memo}
            onChange={(event) => onMemoChange(event.target.value)}
            rows={8}
            placeholder="노트 전체에 대한 메모를 적어보세요."
            className="mt-3 min-h-[11rem] flex-1 resize-none rounded-[1.1rem] border border-[#e8d5b8] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-[13px] leading-6 tracking-[0.02em] text-[#3d2b12] outline-none transition-colors duration-200 placeholder:text-[#c4a882] focus:border-[#8b6c42]"
          />
        </div>
      </aside>
    </div>
  );
}
