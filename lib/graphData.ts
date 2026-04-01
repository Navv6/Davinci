import type { GraphNode, GraphNodeLevel, GraphSeed } from "@/types/davinci";

export const GRAPH_PALETTE: Array<{
  edge: number;
  label: string;
  node: number;
}> = [
  { node: 0x1a1208, edge: 0x3d2b12, label: "#1a1208" },
  { node: 0x6b4f2f, edge: 0x8b6c42, label: "#6b4f2f" },
  { node: 0x8b6c42, edge: 0xc4a882, label: "#8b6c42" },
  { node: 0xb8956a, edge: 0xd4b896, label: "#9e7a52" },
];

export function getPaletteForLevel(level: number) {
  return GRAPH_PALETTE[Math.min(level, GRAPH_PALETTE.length - 1)];
}

export function createGraphSeed(topic: string): GraphSeed {
  const safeTopic = topic.trim() || "다빈치노트";

  return {
    rootId: 0,
    nextId: 1,
    nodes: [
      {
        id: 0,
        label: safeTopic,
        level: 0,
        x: 0,
        y: 0,
        z: 0,
        born: 0,
        description: "",
        category: "topic",
      },
    ],
    edges: [],
  };
}

export function createSpawnedNode(
  label: string,
  nextId: number,
  parent: GraphNode,
  siblingCount = 0,
): GraphNode {
  const level = Math.min(parent.level + 1, 3) as GraphNodeLevel;
  const outwardAngle =
    Math.abs(parent.x) < 0.001 && Math.abs(parent.z) < 0.001
      ? -Math.PI / 2
      : Math.atan2(parent.z, parent.x);
  const fanOffsets = [0, -0.65, 0.65, -1.2, 1.2, -1.75, 1.75];
  const offset = fanOffsets[siblingCount % fanOffsets.length] ?? 0;
  const wave = Math.floor(siblingCount / fanOffsets.length) * 0.16;
  const angle = outwardAngle + offset + wave;
  const radius = parent.level === 0 ? 5.4 : 4.3 + Math.min(level, 3) * 0.55;
  const verticalOffsets = [0, -1.1, 1.1, -2.1, 2.1, -0.55, 0.55];
  const lift = verticalOffsets[siblingCount % verticalOffsets.length] ?? 0;

  return {
    id: nextId,
    label,
    level,
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + lift,
    z: parent.z + Math.sin(angle) * radius * 0.72,
    born: 0,
    category: level >= 2 ? "keyword" : "idea",
    description: "",
  };
}
