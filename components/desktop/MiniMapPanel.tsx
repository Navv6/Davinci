"use client";

import type { GraphEdge, GraphNode } from "@/types/davinci";

type MiniMapPanelProps = {
  edges: GraphEdge[];
  nodes: GraphNode[];
  onSelectNode: (id: number) => void;
  rootId: number;
  selectedNodeId: number;
  viewState: {
    focusX: number;
    focusY: number;
    focusZ: number;
    rotX: number;
    rotY: number;
  };
};

type ProjectedNode = {
  depth: number;
  id: number;
  isRoot: boolean;
  isSelected: boolean;
  label: string;
  px: number;
  py: number;
  radius: number;
};

const MAP_SIZE = 196;
const MAP_PADDING = 18;
const MAP_INNER_SIZE = MAP_SIZE - MAP_PADDING * 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectToMiniMap(
  node: GraphNode,
  center: { x: number; y: number; z: number },
  scale: number,
  rotX: number,
  rotY: number,
): Pick<ProjectedNode, "depth" | "px" | "py"> {
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const dz = node.z - center.z;

  const vector = {
    x: dx,
    y: dy,
    z: dz,
  };

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const afterY = {
    x: vector.x * cosY + vector.z * sinY,
    y: vector.y,
    z: -vector.x * sinY + vector.z * cosY,
  };

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const afterX = {
    x: afterY.x,
    y: afterY.y * cosX - afterY.z * sinX,
    z: afterY.y * sinX + afterY.z * cosX,
  };

  return {
    px: MAP_SIZE / 2 + afterX.x * scale,
    py: MAP_SIZE / 2 - afterX.y * scale,
    depth: afterX.z,
  };
}

export function MiniMapPanel({
  edges,
  nodes,
  onSelectNode,
  rootId,
  selectedNodeId,
  viewState,
}: MiniMapPanelProps) {
  if (nodes.length === 0) {
    return null;
  }

  const rootNode = nodes.find((node) => node.id === rootId) ?? nodes[0];
  const focusCenter = {
    x: viewState.focusX,
    y: viewState.focusY,
    z: viewState.focusZ,
  };

  const relativeMagnitudes = nodes.map((node) =>
    Math.max(
      Math.abs(node.x - focusCenter.x),
      Math.abs(node.y - focusCenter.y),
      Math.abs(node.z - focusCenter.z),
    ),
  );
  const extent = Math.max(6, ...relativeMagnitudes) * 1.3;
  const scale = MAP_INNER_SIZE / (extent * 2.4);

  const projectedNodes: ProjectedNode[] = nodes
    .map((node) => {
      const projected = projectToMiniMap(
        node,
        focusCenter,
        scale,
        viewState.rotX,
        viewState.rotY,
      );

      return {
        ...projected,
        id: node.id,
        label: node.label,
        isRoot: node.id === rootId,
        isSelected: node.id === selectedNodeId,
        radius:
          node.id === rootId ? 5.2 : node.id === selectedNodeId ? 4.6 : 3.3,
      };
    })
    .sort((a, b) => a.depth - b.depth);

  const projectedById = new Map(projectedNodes.map((node) => [node.id, node]));

  const projectedEdges = edges
    .map(([from, to]) => {
      const fromPoint = projectedById.get(from);
      const toPoint = projectedById.get(to);

      if (!fromPoint || !toPoint) {
        return null;
      }

      return {
        avgDepth: (fromPoint.depth + toPoint.depth) / 2,
        fromPoint,
        toPoint,
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))
    .sort((a, b) => a.avgDepth - b.avgDepth);

  const frameCorners = [
    { x: -extent, y: -extent, z: -extent },
    { x: extent, y: -extent, z: -extent },
    { x: extent, y: extent, z: -extent },
    { x: -extent, y: extent, z: -extent },
    { x: -extent, y: -extent, z: extent },
    { x: extent, y: -extent, z: extent },
    { x: extent, y: extent, z: extent },
    { x: -extent, y: extent, z: extent },
  ].map((corner) =>
    projectToMiniMap(
      {
        ...rootNode,
        id: -1,
        label: "",
        x: focusCenter.x + corner.x,
        y: focusCenter.y + corner.y,
        z: focusCenter.z + corner.z,
      },
      focusCenter,
      scale,
      viewState.rotX,
      viewState.rotY,
    ),
  );

  const frameEdges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  return (
    <div
      data-graph-control
      className="pointer-events-auto absolute left-6 top-28 z-30 w-[15.5rem] rounded-[1.45rem] border border-[#e8d5b8] bg-[rgba(250,248,243,0.95)] px-4 py-4 shadow-[0_20px_44px_rgba(61,43,18,0.08)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#8b6c42]">
            3D Mini Map
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSelectNode(rootId)}
          className="rounded-full border border-[#e8d5b8] px-3 py-1 text-[10px] tracking-[0.14em] text-[#8b6c42] transition-colors duration-200 hover:bg-[#8b6c42] hover:text-[#faf8f3]"
        >
          중심
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.1rem] border border-[#ecdcc4] bg-[radial-gradient(circle_at_50%_35%,rgba(255,253,249,0.98),rgba(246,240,229,0.94))]">
        <svg
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          className="block h-48 w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="0" width={MAP_SIZE} height={MAP_SIZE} fill="transparent" />

          {frameEdges.map(([from, to]) => {
            const start = frameCorners[from];
            const end = frameCorners[to];

            return (
              <line
                key={`frame-${from}-${to}`}
                x1={start.px}
                y1={start.py}
                x2={end.px}
                y2={end.py}
                stroke="rgba(226,205,174,0.48)"
                strokeWidth="1"
              />
            );
          })}

          {projectedEdges.map((edge, index) => (
            <line
              key={`edge-${index}`}
              x1={edge.fromPoint.px}
              y1={edge.fromPoint.py}
              x2={edge.toPoint.px}
              y2={edge.toPoint.py}
              stroke={
                edge.fromPoint.isSelected || edge.toPoint.isSelected
                  ? "rgba(139,108,66,0.84)"
                  : "rgba(196,168,130,0.58)"
              }
              strokeWidth={
                edge.fromPoint.isSelected || edge.toPoint.isSelected ? "1.5" : "1"
              }
            />
          ))}

          {projectedNodes.map((point) => {
            const depthAlpha = clamp(0.46 + (point.depth + extent) / (extent * 2), 0.45, 1);

            return (
              <g
                key={point.id}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectNode(point.id);
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={point.px}
                  cy={point.py}
                  r={point.radius + 6}
                  fill="transparent"
                />
                {point.isSelected ? (
                  <circle
                    cx={point.px}
                    cy={point.py}
                    r={point.radius + 4.8}
                    fill="rgba(139,108,66,0.1)"
                    stroke="rgba(139,108,66,0.32)"
                    strokeWidth="1"
                  />
                ) : null}
                <circle
                  cx={point.px}
                  cy={point.py}
                  r={point.radius}
                  fill={
                    point.isRoot ? "#1a1208" : point.isSelected ? "#8b6c42" : "#c4a882"
                  }
                  opacity={depthAlpha}
                />
              </g>
            );
          })}
        </svg>
      </div>

    </div>
  );
}
