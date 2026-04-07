import type { GraphEdge, GraphNode } from "@/types/davinci";

export type OutlineNode = {
  children: OutlineNode[];
  node: GraphNode;
};

function sortChildren(a: GraphNode, b: GraphNode) {
  if (a.level !== b.level) {
    return a.level - b.level;
  }

  if (a.y !== b.y) {
    return a.y - b.y;
  }

  if (a.x !== b.x) {
    return a.x - b.x;
  }

  if (a.z !== b.z) {
    return a.z - b.z;
  }

  return a.label.localeCompare(b.label, "ko");
}

export function buildOutlineForest(
  rootId: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childrenMap = new Map<number, GraphNode[]>();

  edges.forEach(([from, to]) => {
    const child = nodeMap.get(to);

    if (!child) {
      return;
    }

    const siblings = childrenMap.get(from);

    if (siblings) {
      siblings.push(child);
    } else {
      childrenMap.set(from, [child]);
    }
  });

  childrenMap.forEach((children) => {
    children.sort(sortChildren);
  });

  const visited = new Set<number>();

  const buildNode = (id: number): OutlineNode | null => {
    const node = nodeMap.get(id);

    if (!node || visited.has(id)) {
      return null;
    }

    visited.add(id);

    const children = (childrenMap.get(id) ?? [])
      .map((child) => buildNode(child.id))
      .filter((child): child is OutlineNode => child !== null);

    return {
      node,
      children,
    };
  };

  const rootTree = buildNode(rootId);
  const looseNodes = nodes
    .filter((node) => !visited.has(node.id))
    .sort(sortChildren)
    .map((node) => buildNode(node.id))
    .filter((node): node is OutlineNode => node !== null);

  return {
    rootTree,
    looseNodes,
  };
}

function flattenOutlineNode(item: OutlineNode, depth: number, lines: string[]) {
  lines.push(`${"  ".repeat(depth)}- ${item.node.label.trim()}`);

  item.children.forEach((child) => {
    flattenOutlineNode(child, depth + 1, lines);
  });
}

export function serializeOutlineTree(rootId: number, nodes: GraphNode[], edges: GraphEdge[]) {
  const { rootTree, looseNodes } = buildOutlineForest(rootId, nodes, edges);
  const lines: string[] = [];

  if (rootTree) {
    flattenOutlineNode(rootTree, 0, lines);
  }

  looseNodes.forEach((node) => {
    flattenOutlineNode(node, 0, lines);
  });

  return lines.join("\n");
}

export function extractOutlineLabels(outlineText: string) {
  return outlineText
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*-\s+(.+)\s*$/u)?.[1]?.trim() ?? "")
    .filter((label) => label.length > 0);
}
