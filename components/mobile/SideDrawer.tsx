"use client";

import { useDeferredValue, useMemo } from "react";
import type { GraphEdge, GraphNode } from "@/types/davinci";

type SideDrawerProps = {
  edges: GraphEdge[];
  memo: string;
  nodes: GraphNode[];
  onClose: () => void;
  onMemoChange: (value: string) => void;
  onSelectNode: (id: number) => void;
  open: boolean;
  rootId: number;
  selectedNodeId: number;
};

type OutlineNode = {
  children: OutlineNode[];
  node: GraphNode;
};

function buildTree(rootId: number, nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<number, GraphNode[]>();

  edges.forEach(([from, to]) => {
    const child = nodeMap.get(to);
    if (!child) return;
    const siblings = childrenMap.get(from);
    if (siblings) siblings.push(child);
    else childrenMap.set(from, [child]);
  });

  const visited = new Set<number>();
  const buildNode = (id: number): OutlineNode | null => {
    const node = nodeMap.get(id);
    if (!node || visited.has(id)) return null;
    visited.add(id);
    const children = (childrenMap.get(id) ?? [])
      .map((c) => buildNode(c.id))
      .filter((c): c is OutlineNode => c !== null);
    return { node, children };
  };

  return buildNode(rootId);
}

function TreeItem({
  item,
  onSelectNode,
  selectedNodeId,
  onClose,
}: {
  item: OutlineNode;
  onSelectNode: (id: number) => void;
  selectedNodeId: number;
  onClose: () => void;
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
        style={{ marginLeft: `${item.node.level * 12}px`, width: `calc(100% - ${item.node.level * 12}px)` }}
        className={`flex w-full items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-all duration-200 ${
          isSelected
            ? "border-[#8b6c42] bg-[rgba(250,248,243,0.98)]"
            : "border-transparent bg-white/50 active:bg-white/80"
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            item.node.level === 0 ? "bg-[#1a1208]" : isSelected ? "bg-[#8b6c42]" : "bg-[#d4b896]"
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
          <span className="mt-0.5 block text-[10px] tracking-[0.14em] text-[#c4a882]">
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
  edges,
  memo,
  nodes,
  onClose,
  onMemoChange,
  onSelectNode,
  open,
  rootId,
  selectedNodeId,
}: SideDrawerProps) {
  const deferredNodes = useDeferredValue(nodes);
  const deferredEdges = useDeferredValue(edges);
  const rootTree = useMemo(
    () => buildTree(rootId, deferredNodes, deferredEdges),
    [rootId, deferredNodes, deferredEdges],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 bg-[rgba(26,18,8,0.18)] transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        data-graph-control
        className={`absolute bottom-0 right-0 top-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-[rgba(250,248,243,0.99)] shadow-[-12px_0_40px_rgba(61,43,18,0.1)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8d5b8] px-5 py-4">
          <span className="text-[10px] uppercase tracking-[0.24em] text-[#8b6c42]">
            아이디어 구조
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[#c4a882] active:text-[#8b6c42]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {rootTree ? (
            <TreeItem
              item={rootTree}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
              onClose={onClose}
            />
          ) : null}
        </div>

        {/* Memo */}
        <div className="border-t border-[#e8d5b8] px-5 py-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[#c4a882]">전체 메모</p>
          <textarea
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
            rows={5}
            placeholder="이 아이디어 전체에 대한 메모를 남겨보세요."
            className="w-full resize-none rounded-[1rem] border border-[#e8d5b8] bg-white/80 px-4 py-3 text-[13px] leading-6 text-[#3d2b12] outline-none placeholder:text-[#c4a882] focus:border-[#8b6c42]"
            style={{ caretColor: "#3d2b12" }}
          />
        </div>
      </aside>
    </>
  );
}
