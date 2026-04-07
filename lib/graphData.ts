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
  existingNodes: GraphNode[] = [],
): GraphNode {
  const level = Math.min(parent.level + 1, 3) as GraphNodeLevel;
  const outwardAngle =
    Math.abs(parent.x) < 0.001 && Math.abs(parent.z) < 0.001
      ? -Math.PI / 2
      : Math.atan2(parent.z, parent.x);
  const angleOffsets = [0, -0.7, 0.7, -1.3, 1.3, -1.9, 1.9, -2.45, 2.45, Math.PI];
  const verticalOffsets = [0, -1.15, 1.15, -2.2, 2.2, -0.6, 0.6, -3, 3, 0];
  const baseRadius = parent.level === 0 ? 5.6 : 4.7 + Math.min(level, 3) * 0.7;
  const preferredDistance = level === 1 ? 4.4 : level === 2 ? 3.5 : 2.9;
  const preferredPlanarDistance = preferredDistance * 0.78;

  let bestCandidate:
    | {
        lift: number;
        radius: number;
        score: number;
        x: number;
        y: number;
        z: number;
      }
    | undefined;

  const evaluateCandidate = (x: number, y: number, z: number) => {
    let min3d = Number.POSITIVE_INFINITY;
    let minPlanar = Number.POSITIVE_INFINITY;

    for (const node of existingNodes) {
      if (node.id === parent.id) {
        continue;
      }

      const dx = x - node.x;
      const dy = y - node.y;
      const dz = z - node.z;
      const dist3d = Math.hypot(dx, dy, dz);
      const distPlanar = Math.hypot(dx, dz);

      min3d = Math.min(min3d, dist3d);
      minPlanar = Math.min(minPlanar, distPlanar);
    }

    if (!Number.isFinite(min3d)) {
      min3d = preferredDistance * 2;
    }

    if (!Number.isFinite(minPlanar)) {
      minPlanar = preferredPlanarDistance * 2;
    }

    return {
      ok: min3d >= preferredDistance && minPlanar >= preferredPlanarDistance,
      score: Math.min(min3d / preferredDistance, 2.5) + Math.min(minPlanar / preferredPlanarDistance, 2.5),
    };
  };

  for (let ring = 0; ring < 5; ring += 1) {
    const radius = baseRadius + ring * 1.1 + Math.floor(siblingCount / angleOffsets.length) * 0.45;

    for (let index = 0; index < angleOffsets.length; index += 1) {
      const patternIndex = (siblingCount + index) % angleOffsets.length;
      const drift = ring * 0.14 * (index % 2 === 0 ? 1 : -1);
      const angle = outwardAngle + (angleOffsets[patternIndex] ?? 0) + drift;
      const liftBase = verticalOffsets[patternIndex] ?? 0;
      const lift = liftBase + ring * 0.45 * (index % 2 === 0 ? 1 : -1);
      const x = parent.x + Math.cos(angle) * radius;
      const y = parent.y + lift;
      const z = parent.z + Math.sin(angle) * radius * 0.76;
      const evaluation = evaluateCandidate(x, y, z);

      if (evaluation.ok) {
        bestCandidate = {
          x,
          y,
          z,
          radius,
          lift,
          score: evaluation.score,
        };
        break;
      }

      if (!bestCandidate || evaluation.score > bestCandidate.score) {
        bestCandidate = {
          x,
          y,
          z,
          radius,
          lift,
          score: evaluation.score,
        };
      }
    }

    if (bestCandidate && bestCandidate.score >= 2) {
      break;
    }
  }

  const fallbackAngle =
    outwardAngle + (angleOffsets[siblingCount % angleOffsets.length] ?? 0);
  const fallbackLift = verticalOffsets[siblingCount % verticalOffsets.length] ?? 0;
  const candidate = bestCandidate ?? {
    x: parent.x + Math.cos(fallbackAngle) * baseRadius,
    y: parent.y + fallbackLift,
    z: parent.z + Math.sin(fallbackAngle) * baseRadius * 0.76,
    radius: baseRadius,
    lift: fallbackLift,
    score: 0,
  };

  return {
    id: nextId,
    label,
    level,
    x: candidate.x,
    y: candidate.y,
    z: candidate.z,
    born: 0,
    category: level >= 2 ? "keyword" : "idea",
    description: "",
  };
}
