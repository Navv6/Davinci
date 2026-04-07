"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { IdeaSidebar } from "@/components/desktop/IdeaSidebar";
import { NodeInfoPanel } from "@/components/desktop/NodeInfoPanel";
import { ProfileSidebar } from "@/components/desktop/ProfileSidebar";
import { getEffectiveQuota, getRemainingAIUses } from "@/lib/aiUsage";
import type {
  SupporterRequest,
  WorkspaceGraphSummary,
  WorkspaceProfile,
} from "@/lib/cloudStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { createGraphSeed, createSpawnedNode, getPaletteForLevel } from "@/lib/graphData";
import { serializeOutlineTree } from "@/lib/outline";
import { saveGraph, type SavedGraph } from "@/lib/storage";
import type { GraphEdge, GraphNode, GraphSeed } from "@/types/davinci";

type IdeaSpaceProps = {
  authReady?: boolean;
  authUser?: { email: string | null; id: string } | null;
  graphId: string;
  graphTitle: string;
  initialMemo?: string;
  initialSeed?: GraphSeed;
  onAIUsageConsumed?: () => void;
  onArchiveGraph?: (graphId: string) => Promise<void>;
  onCreateGraph?: () => Promise<void>;
  onDeleteGraph?: (graphId: string) => Promise<void>;
  onGraphPersisted?: (graph: SavedGraph) => void;
  onRestart: () => void;
  onSelectGraph?: (graphId: string) => Promise<void>;
  onSignIn?: () => void;
  onSignOut?: () => void;
  supporterRequest?: SupporterRequest | null;
  onToggleFavoriteGraph?: (graphId: string, value: boolean) => Promise<void>;
  onUpgradeClick?: () => void;
  topic: string;
  workspaceGraphs?: WorkspaceGraphSummary[];
  workspaceProfile?: WorkspaceProfile | null;
};

type RuntimeNode = GraphNode & {
  bornAt: number;
};

type NodeRuntime = {
  faceMat: THREE.MeshBasicMaterial;
  group: THREE.Group;
  opacity: number;
  visualGroup: THREE.Group;
  wireMat: THREE.LineBasicMaterial;
};

type EdgeRuntime = {
  baseColor: number;
  from: number;
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  to: number;
};

type GraphApi = {
  clearSelection: () => void;
  deleteSelectedNode: () => void;
  resetCamera: () => void;
  selectNode: (id: number) => void;
  spawnMultipleNodes: (
    parentId: number,
    ideas: Array<{ description: string; label: string }>,
  ) => void;
  spawnNode: (parentId: number) => void;
  updateNode: (id: number, patch: Pick<GraphNode, "description" | "label">) => void;
};

function getNodeSize(level: number) {
  if (level === 0) {
    return 0.28;
  }

  if (level === 1) {
    return 0.2;
  }

  if (level === 2) {
    return 0.16;
  }

  return 0.12;
}

function stripRuntimeNode(node: RuntimeNode): GraphNode {
  return {
    id: node.id,
    label: node.label,
    level: node.level,
    x: node.x,
    y: node.y,
    z: node.z,
    born: node.born,
    description: node.description,
    category: node.category,
  };
}

function stripRuntimeNodes(nodes: RuntimeNode[]) {
  return nodes.map(stripRuntimeNode);
}

function disposeNodeRuntime(runtime: NodeRuntime) {
  runtime.group.traverse((child) => {
    const meshChild = child as THREE.Mesh & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    meshChild.geometry?.dispose();

    if (Array.isArray(meshChild.material)) {
      meshChild.material.forEach((material) => material.dispose());
    } else {
      meshChild.material?.dispose();
    }
  });
}

export function IdeaSpace({
  authReady,
  authUser,
  graphId,
  graphTitle,
  initialMemo,
  initialSeed,
  onAIUsageConsumed,
  onArchiveGraph,
  onCreateGraph,
  onDeleteGraph,
  onGraphPersisted,
  onRestart,
  onSelectGraph,
  onSignIn,
  onSignOut,
  supporterRequest,
  onToggleFavoriteGraph,
  onUpgradeClick,
  topic,
  workspaceGraphs = [],
  workspaceProfile = null,
}: IdeaSpaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<SVGSVGElement>(null);
  const graphApiRef = useRef<GraphApi | null>(null);
  const memoRef = useRef(initialMemo ?? "");
  const seed = useMemo(
    () => initialSeed ?? createGraphSeed(topic),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic],
  );
  const persistStateRef = useRef<{
    edges: GraphEdge[];
    nextId: number;
    nodes: GraphNode[];
  }>({
    nodes: seed.nodes,
    edges: seed.edges,
    nextId: seed.nextId,
  });

  const [webglFailed, setWebglFailed] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(
    seed.nodes[seed.rootId] ?? null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number>(seed.rootId);
  const [rootNode, setRootNode] = useState<GraphNode | null>(
    seed.nodes[seed.rootId] ?? null,
  );
  const [snapshotNodes, setSnapshotNodes] = useState<GraphNode[]>(seed.nodes);
  const [snapshotEdges, setSnapshotEdges] = useState<GraphEdge[]>(seed.edges);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceMemo, setWorkspaceMemo] = useState(initialMemo ?? "");
  const [aiExpanding, setAIExpanding] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const remainingAIUses = useMemo(
    () => getRemainingAIUses(workspaceProfile),
    [workspaceProfile],
  );
  const effectiveQuota = useMemo(
    () => getEffectiveQuota(workspaceProfile),
    [workspaceProfile],
  );
  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Updated every render so the Three.js closure always calls the latest fn
  const triggerSavedToastRef = useRef<() => void>(() => {});

  useEffect(() => {
    triggerSavedToastRef.current = () => {
      setSavedToast(true);

      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
      }

      savedToastTimerRef.current = setTimeout(() => {
        setSavedToast(false);
        savedToastTimerRef.current = null;
      }, 1200);
    };

    return () => {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
        savedToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;

    if (!container || !canvas || !labels) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    camera.position.set(0, 0, 30);

    const displayFont =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-display-family")
        .trim() || '"Cormorant Garamond", serif';

    const labelMeasureCanvas = document.createElement("canvas");
    const labelMeasureContext = labelMeasureCanvas.getContext("2d");

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
      });
    } catch {
      setWebglFailed(true);
      return;
    }
    canvas.addEventListener(
      "webglcontextlost",
      (e) => { e.preventDefault(); setWebglFailed(true); },
      { once: true },
    );
    renderer.setClearColor(0xfaf8f3, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const seededAt = performance.now();
    const nodes: RuntimeNode[] = seed.nodes.map((node) => ({
      ...node,
      bornAt: seededAt + node.born,
    }));
    const nodeMap = new Map<number, RuntimeNode>(nodes.map((node) => [node.id, node]));
    const edges: GraphEdge[] = [...seed.edges];
    const nodeRuntimes = new Map<number, NodeRuntime>();
    const edgeRuntimes = new Map<string, EdgeRuntime>();
    let nextId = seed.nextId;

    const selectedId = { current: seed.rootId };
    const focusCurrent = new THREE.Vector3(
      seed.nodes[seed.rootId]?.x ?? 0,
      seed.nodes[seed.rootId]?.y ?? 0,
      seed.nodes[seed.rootId]?.z ?? 0,
    );
    const focusTarget = focusCurrent.clone();
    const rotatedFocus = new THREE.Vector3();
    const userPanCurrent = new THREE.Vector3();
    const userPanTarget = new THREE.Vector3();

    let drag = false;
    let dragMode: "pan" | "rotate" | "select" | null = null;
    let mouse = { x: 0, y: 0 };
    let lastTouch: Touch | null = null;
    let rotX = 0.12;
    let rotY = 0.22;
    let targetRotX = 0.12;
    let targetRotY = 0.22;
    let zoom = 30;
    let targetZoom = 30;
    let tick = 0;
    let animationFrame = 0;
    const pressedKeys = new Set<string>();

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable
      );
    };

    const updatePersistState = () => {
      persistStateRef.current = {
        nodes: stripRuntimeNodes(nodes),
        edges: [...edges],
        nextId,
      };
    };

    const syncReactState = (id: number) => {
      const node = nodeMap.get(id);
      const root = nodeMap.get(seed.rootId);
      const strippedNodes = stripRuntimeNodes(nodes);
      const strippedEdges = [...edges];

      setSelectedNode(node ? stripRuntimeNode(node) : null);
      setSelectedNodeId(id);
      setRootNode(root ? stripRuntimeNode(root) : null);
      setSnapshotNodes(strippedNodes);
      setSnapshotEdges(strippedEdges);
      persistStateRef.current = {
        nodes: strippedNodes,
        edges: strippedEdges,
        nextId,
      };
    };

    const setSelected = (id: number) => {
      selectedId.current = id;
      const node = nodeMap.get(id);

      if (node) {
        focusTarget.set(node.x, node.y, node.z);
      }

      syncReactState(id);
    };

    const persistGraph = () => {
      updatePersistState();
      const snapshot: SavedGraph = {
        graphId,
        topic,
        title: graphTitle,
        seed: {
          rootId: seed.rootId,
          nextId: persistStateRef.current.nextId,
          nodes: persistStateRef.current.nodes,
          edges: persistStateRef.current.edges,
        },
        memo: memoRef.current,
        savedAt: new Date().toISOString(),
      };

      saveGraph(snapshot);
      onGraphPersisted?.(snapshot);
      triggerSavedToastRef.current();
    };

    const makeNode = (node: RuntimeNode, animated: boolean) => {
      const palette = getPaletteForLevel(node.level);
      const size = getNodeSize(node.level);
      const visualOffsetY = node.level === 0 ? 0.58 : node.level === 1 ? 0.44 : 0.32;

      const outerGeometry = new THREE.OctahedronGeometry(size, 0);
      const wireframe = new THREE.WireframeGeometry(outerGeometry);
      const wireMat = new THREE.LineBasicMaterial({
        color: palette.node,
        transparent: true,
        opacity: animated ? 0 : 0.36,
      });
      const outline = new THREE.LineSegments(wireframe, wireMat);

      const faceGeometry = new THREE.OctahedronGeometry(size * 0.78, 0);
      const faceMat = new THREE.MeshBasicMaterial({
        color: palette.node,
        opacity: animated ? 0 : 0.025,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const face = new THREE.Mesh(faceGeometry, faceMat);

      const group = new THREE.Group();
      group.position.set(node.x, node.y, node.z);
      group.userData = { id: node.id, level: node.level };

      const visualGroup = new THREE.Group();
      visualGroup.position.y = visualOffsetY;
      visualGroup.scale.setScalar(animated ? 0.01 : 1);
      visualGroup.add(outline, face);
      group.add(visualGroup);

      graphGroup.add(group);
      nodeRuntimes.set(node.id, {
        group,
        visualGroup,
        wireMat,
        faceMat,
        opacity: animated ? 0 : 1,
      });
    };

    const makeEdge = (fromId: number, toId: number, animated: boolean) => {
      const from = nodeMap.get(fromId);
      const to = nodeMap.get(toId);

      if (!from || !to) {
        return;
      }

      const palette = getPaletteForLevel(to.level);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, from.y, from.z),
        new THREE.Vector3(to.x, to.y, to.z),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: palette.edge,
        transparent: true,
        opacity: animated ? 0 : 0.22,
      });
      const line = new THREE.Line(geometry, material);

      graphGroup.add(line);
      edgeRuntimes.set(`${fromId}-${toId}`, {
        from: fromId,
        to: toId,
        line,
        mat: material,
        baseColor: palette.edge,
      });
    };

    const removeEdgeRuntime = (key: string) => {
      const runtime = edgeRuntimes.get(key);

      if (!runtime) {
        return;
      }

      graphGroup.remove(runtime.line);
      runtime.line.geometry.dispose();
      runtime.mat.dispose();
      edgeRuntimes.delete(key);
    };

    const spawnNode = (parentId: number) => {
      const parent = nodeMap.get(parentId);

      if (!parent) {
        return;
      }

      const siblingCount = edges.filter(([from]) => from === parentId).length;
      const node = createSpawnedNode("New", nextId, parent, siblingCount, nodes);
      const runtimeNode: RuntimeNode = {
        ...node,
        bornAt: performance.now(),
      };

      nextId += 1;
      nodes.push(runtimeNode);
      nodeMap.set(runtimeNode.id, runtimeNode);
      edges.push([parentId, runtimeNode.id]);

      makeNode(runtimeNode, true);
      makeEdge(parentId, runtimeNode.id, true);
      setSelected(runtimeNode.id);
      persistGraph();
    };

    const spawnMultipleNodes = (
      parentId: number,
      ideas: Array<{ description: string; label: string }>,
    ) => {
      const parent = nodeMap.get(parentId);
      if (!parent || ideas.length === 0) {
        return;
      }

      let siblingCount = edges.filter(([from]) => from === parentId).length;
      const spawnedIds: number[] = [];

      for (const idea of ideas) {
        const node = createSpawnedNode(
          idea.label,
          nextId,
          parent,
          siblingCount,
          nodes,
        );
        node.description = idea.description;

        const runtimeNode: RuntimeNode = {
          ...node,
          bornAt: performance.now() + spawnedIds.length * 80,
        };

        nextId += 1;
        siblingCount += 1;
        nodes.push(runtimeNode);
        nodeMap.set(runtimeNode.id, runtimeNode);
        edges.push([parentId, runtimeNode.id]);
        makeNode(runtimeNode, true);
        makeEdge(parentId, runtimeNode.id, true);
        spawnedIds.push(runtimeNode.id);
      }

      if (spawnedIds[0] !== undefined) {
        setSelected(spawnedIds[0]);
      }

      persistGraph();
    };

    const updateNode = (
      id: number,
      patch: Pick<GraphNode, "description" | "label">,
    ) => {
      const node = nodeMap.get(id);

      if (!node) {
        return;
      }

      node.label = patch.label;
      node.description = patch.description;
      syncReactState(id);
      persistGraph();
    };

    const deleteSelectedNode = () => {
      const id = selectedId.current;

      if (id === seed.rootId) {
        return;
      }

      const parentEdge = edges.find(([, to]) => to === id);
      const parentId = parentEdge ? parentEdge[0] : seed.rootId;

      const idsToDelete = new Set<number>([id]);

      let expanded = true;

      while (expanded) {
        expanded = false;

        for (const [from, to] of edges) {
          if (idsToDelete.has(from) && !idsToDelete.has(to)) {
            idsToDelete.add(to);
            expanded = true;
          }
        }
      }

      if (idsToDelete.size === 0) {
        return;
      }

      idsToDelete.forEach((nodeId) => {
        const runtime = nodeRuntimes.get(nodeId);

        if (!runtime) {
          return;
        }

        graphGroup.remove(runtime.group);
        disposeNodeRuntime(runtime);
        nodeRuntimes.delete(nodeId);
        nodeMap.delete(nodeId);
      });

      for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex -= 1) {
        if (idsToDelete.has(nodes[nodeIndex]?.id ?? -1)) {
          nodes.splice(nodeIndex, 1);
        }
      }

      for (let edgeIndex = edges.length - 1; edgeIndex >= 0; edgeIndex -= 1) {
        const [from, to] = edges[edgeIndex];

        if (idsToDelete.has(from) || idsToDelete.has(to)) {
          removeEdgeRuntime(`${from}-${to}`);
          edges.splice(edgeIndex, 1);
        }
      }

      setSelected(parentId);
      persistGraph();
    };

    nodes.forEach((node) => makeNode(node, node.born > 0));
    edges.forEach(([fromId, toId]) => {
      const childNode = nodeMap.get(toId);
      makeEdge(fromId, toId, Boolean(childNode && childNode.born > 0));
    });

    const resize = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const createLabelBackdrop = (
      width: number,
      height: number,
      x: number,
      y: number,
      selected: boolean,
    ) => {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", `${x - width / 2}`);
      rect.setAttribute("y", `${y - height / 2}`);
      rect.setAttribute("width", `${width}`);
      rect.setAttribute("height", `${height}`);
      rect.setAttribute("rx", `${height / 2}`);
      rect.setAttribute("fill", "#faf8f3");
      rect.setAttribute(
        "stroke",
        selected ? "rgba(139,108,66,0.52)" : "rgba(232,213,184,0.82)",
      );
      rect.setAttribute("stroke-width", selected ? "1.25" : "1");
      return rect;
    };

    const createAddButton = (x: number, y: number, selected: boolean, nodeId: number) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("data-add-node-id", `${nodeId}`);
      group.style.cursor = "pointer";

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", `${x}`);
      circle.setAttribute("cy", `${y}`);
      circle.setAttribute("r", selected ? "10.5" : "9.5");
      circle.setAttribute("fill", "#faf8f3");
      circle.setAttribute(
        "stroke",
        selected ? "rgba(139,108,66,0.82)" : "rgba(196,168,130,0.88)",
      );
      circle.setAttribute("stroke-width", selected ? "1.35" : "1.1");
      group.appendChild(circle);

      const horizontal = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      horizontal.setAttribute("x1", `${x - 3.4}`);
      horizontal.setAttribute("x2", `${x + 3.4}`);
      horizontal.setAttribute("y1", `${y}`);
      horizontal.setAttribute("y2", `${y}`);
      horizontal.setAttribute("stroke", "#8b6c42");
      horizontal.setAttribute("stroke-width", "1.2");
      horizontal.setAttribute("stroke-linecap", "round");
      group.appendChild(horizontal);

      const vertical = document.createElementNS("http://www.w3.org/2000/svg", "line");
      vertical.setAttribute("x1", `${x}`);
      vertical.setAttribute("x2", `${x}`);
      vertical.setAttribute("y1", `${y - 3.4}`);
      vertical.setAttribute("y2", `${y + 3.4}`);
      vertical.setAttribute("stroke", "#8b6c42");
      vertical.setAttribute("stroke-width", "1.2");
      vertical.setAttribute("stroke-linecap", "round");
      group.appendChild(vertical);

      return group;
    };

    const updateLabels = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      const now = performance.now();

      labels.setAttribute("viewBox", `0 0 ${width} ${height}`);
      labels.innerHTML = "";

      nodes.forEach((node) => {
        const runtime = nodeRuntimes.get(node.id);

        if (!runtime || runtime.opacity < 0.25 || now < node.bornAt) {
          return;
        }

        const isSelected = node.id === selectedId.current;
        const palette = getPaletteForLevel(node.level);
        const projected = new THREE.Vector3(node.x, node.y, node.z);

        graphGroup.localToWorld(projected);
        projected.project(camera);

        if (projected.z > 1) {
          return;
        }

        const sx = (projected.x * 0.5 + 0.5) * width;
        const sy = (-projected.y * 0.5 + 0.5) * height;
        const fontSize =
          node.level === 0
            ? isSelected
              ? 20
              : 17
            : node.level === 1
              ? isSelected
                ? 17
                : 13
              : isSelected
                ? 15
                : 11;
        const fontWeight = isSelected ? 600 : node.level === 0 ? 500 : 430;

        if (labelMeasureContext) {
          labelMeasureContext.font = `${fontWeight} ${fontSize}px ${displayFont}`;
        }

        const labelWidth = labelMeasureContext
          ? labelMeasureContext.measureText(node.label).width
          : fontSize * node.label.length;
        const pillWidth = labelWidth + (node.level === 0 ? 28 : 22);
        const pillHeight = fontSize + (node.level === 0 ? 14 : 11);
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("data-select-node-id", `${node.id}`);
        group.style.cursor = "pointer";

        group.appendChild(
          createLabelBackdrop(pillWidth, pillHeight, sx, sy, isSelected),
        );

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", `${sx}`);
        text.setAttribute("y", `${sy}`);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", `${fontSize}`);
        text.setAttribute("font-weight", `${fontWeight}`);
        text.setAttribute("font-style", node.level === 0 ? "normal" : "italic");
        text.setAttribute("fill", isSelected ? "#1a1208" : palette.label);
        text.setAttribute(
          "opacity",
          `${Math.min(1, runtime.opacity * (isSelected ? 1 : 0.76))}`,
        );
        text.setAttribute("letter-spacing", node.level === 0 ? "0.04em" : "0.03em");
        text.setAttribute("stroke", "#faf8f3");
        text.setAttribute("stroke-width", isSelected ? "4.6" : node.level === 0 ? "4" : "3");
        text.setAttribute("stroke-linejoin", "round");
        text.style.fontFamily = displayFont;
        text.style.paintOrder = "stroke";
        text.textContent = node.label;
        group.appendChild(text);

        const addX = sx + pillWidth / 2 + 16;
        group.appendChild(createAddButton(addX, sy, isSelected, node.id));
        labels.appendChild(group);
      });
    };

    const handleLabelPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const addTrigger = target.closest("[data-add-node-id]");

      if (addTrigger) {
        const id = Number(addTrigger.getAttribute("data-add-node-id"));

        if (!Number.isNaN(id)) {
          event.preventDefault();
          spawnNode(id);
        }

        event.stopPropagation();
        return;
      }

      const selectTrigger = target.closest("[data-select-node-id]");

      if (selectTrigger) {
        const id = Number(selectTrigger.getAttribute("data-select-node-id"));

        if (!Number.isNaN(id)) {
          event.preventDefault();
          setSelected(id);
        }
      }
    };

    graphApiRef.current = {
      clearSelection: () => {
        selectedId.current = -1;
        setSelectedNode(null);
      },
      resetCamera: () => {
        const root = nodeMap.get(seed.rootId);
        if (root) {
          focusTarget.set(root.x, root.y, root.z);
        }
        targetRotX = 0.12;
        targetRotY = 0.22;
        targetZoom = 30;
        userPanTarget.set(0, 0, 0);
      },
      spawnMultipleNodes,
      spawnNode,
      selectNode: setSelected,
      updateNode,
      deleteSelectedNode,
    };

    const pickNode = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);

      let closest: RuntimeNode | null = null;
      let minDistance = Number.POSITIVE_INFINITY;

      for (const node of nodes) {
        const runtime = nodeRuntimes.get(node.id);

        if (!runtime || runtime.opacity < 0.3 || performance.now() < node.bornAt) {
          continue;
        }

        const worldPosition = new THREE.Vector3();
        runtime.group.getWorldPosition(worldPosition);
        const distance = raycaster.ray.distanceToPoint(worldPosition);
        const threshold = node.level === 0 ? 1.7 : 1.25;

        if (distance < threshold && distance < minDistance) {
          minDistance = distance;
          closest = node;
        }
      }

      if (closest) {
        setSelected(closest.id);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        (event.target.closest("[data-graph-control]") ||
          event.target.closest("[data-add-node-id]") ||
          event.target.closest("[data-select-node-id]"))
      ) {
        return;
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      drag = true;
      dragMode =
        event.button === 2
          ? "rotate"
          : event.shiftKey
            ? "pan"
            : "select";
      mouse = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!drag) {
        return;
      }

      const deltaX = Math.abs(event.clientX - mouse.x);
      const deltaY = Math.abs(event.clientY - mouse.y);
      const releasedMode = dragMode;
      drag = false;
      dragMode = null;

      if (
        releasedMode === "select" &&
        deltaX < 4 &&
        deltaY < 4 &&
        event.button === 0
      ) {
        pickNode(event);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!drag) {
        return;
      }

      const deltaX = event.clientX - mouse.x;
      const deltaY = event.clientY - mouse.y;

      if (dragMode === "pan") {
        const panScale = zoom * 0.00135;
        userPanTarget.x += deltaX * panScale;
        userPanTarget.y -= deltaY * panScale;
      } else if (dragMode === "rotate") {
        targetRotY += deltaX * 0.007;
        targetRotX += deltaY * 0.007;
        targetRotX = Math.max(-1.1, Math.min(1.1, targetRotX));
      }

      mouse = { x: event.clientX, y: event.clientY };
    };

    const handleWheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-graph-control]")
      ) {
        return;
      }

      targetZoom += event.deltaY * 0.035;
      targetZoom = Math.max(10, Math.min(60, targetZoom));
      event.preventDefault();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-graph-control]")
      ) {
        return;
      }

      lastTouch = event.touches[0] ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-graph-control]")
      ) {
        return;
      }

      if (!lastTouch || !event.touches[0]) {
        return;
      }

      const touch = event.touches[0];
      targetRotY += (touch.clientX - lastTouch.clientX) * 0.009;
      targetRotX += (touch.clientY - lastTouch.clientY) * 0.009;
      lastTouch = touch;
      event.preventDefault();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-graph-control]")
      ) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.code;
      const controllableKeys = new Set([
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ]);

      if (!controllableKeys.has(key)) {
        return;
      }

      pressedKeys.add(key);
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.delete(event.code);
    };

    const handleWindowBlur = () => {
      pressedKeys.clear();
      drag = false;
      dragMode = null;
    };

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      tick += 1;
      const keyboardPanStep = Math.max(0.06, zoom * 0.0065);

      if (pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft")) {
        userPanTarget.x += keyboardPanStep;
      }

      if (pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) {
        userPanTarget.x -= keyboardPanStep;
      }

      if (pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp")) {
        userPanTarget.y -= keyboardPanStep;
      }

      if (pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) {
        userPanTarget.y += keyboardPanStep;
      }

      rotX += (targetRotX - rotX) * 0.055;
      rotY += (targetRotY - rotY) * 0.055;
      zoom += (targetZoom - zoom) * 0.07;
      focusCurrent.lerp(focusTarget, 0.11);
      userPanCurrent.lerp(userPanTarget, 0.16);

      graphGroup.rotation.x = rotX;
      graphGroup.rotation.y = rotY;
      rotatedFocus.copy(focusCurrent).applyEuler(graphGroup.rotation);
      graphGroup.position.x +=
        (-rotatedFocus.x + userPanCurrent.x - graphGroup.position.x) * 0.12;
      graphGroup.position.y +=
        (-rotatedFocus.y + userPanCurrent.y - graphGroup.position.y) * 0.12;
      graphGroup.position.z += (-rotatedFocus.z - graphGroup.position.z) * 0.12;
      camera.position.z = zoom;
      camera.lookAt(0, 0, 0);
      const now = performance.now();


      nodes.forEach((node, index) => {
        const runtime = nodeRuntimes.get(node.id);

        if (!runtime || now < node.bornAt) {
          return;
        }

        const isSelected = node.id === selectedId.current;
        const targetWireOpacity = isSelected ? 0.94 : 0.28;
        const targetFaceOpacity = isSelected ? 0.1 : 0.018;
        const targetScale =
          node.level === 0
            ? isSelected
              ? 1.08
              : 1 + Math.sin(tick * 0.03) * 0.018
            : isSelected
              ? 1.16
              : 1;

        runtime.opacity = Math.min(1, runtime.opacity + 0.03);
        runtime.wireMat.opacity +=
          (targetWireOpacity - runtime.wireMat.opacity) * 0.14;
        runtime.faceMat.opacity +=
          (targetFaceOpacity - runtime.faceMat.opacity) * 0.16;

        const nextScale =
          runtime.visualGroup.scale.x +
          (targetScale - runtime.visualGroup.scale.x) * 0.14;

        runtime.visualGroup.scale.setScalar(nextScale);
        runtime.visualGroup.rotation.y += 0.004 + index * 0.001;
        runtime.visualGroup.rotation.x += (0.004 + index * 0.001) * 0.55;
      });

      edgeRuntimes.forEach((edgeRuntime) => {
        const isSelected =
          edgeRuntime.to === selectedId.current || edgeRuntime.from === selectedId.current;
        const targetOpacity = isSelected ? 0.82 : 0.18;

        edgeRuntime.mat.opacity += (targetOpacity - edgeRuntime.mat.opacity) * 0.14;
        edgeRuntime.mat.color.set(isSelected ? 0x8b6c42 : edgeRuntime.baseColor);
      });

      updateLabels();
      renderer.render(scene, camera);
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("contextmenu", handleContextMenu);
    labels.addEventListener("pointerdown", handleLabelPointerDown);

    animate();

    return () => {
      graphApiRef.current = null;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("contextmenu", handleContextMenu);
      labels.removeEventListener("pointerdown", handleLabelPointerDown);
      labels.innerHTML = "";

      edgeRuntimes.forEach((edgeRuntime) => {
        edgeRuntime.line.geometry.dispose();
        edgeRuntime.mat.dispose();
      });

      nodeRuntimes.forEach((runtime) => disposeNodeRuntime(runtime));
      renderer.dispose();
      graphGroup.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    setAIError(null);
  }, [selectedNodeId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        graphApiRef.current?.clearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auto-clear AI error after 4 seconds
  useEffect(() => {
    if (!aiError) return;
    const t = setTimeout(() => setAIError(null), 4000);
    return () => clearTimeout(t);
  }, [aiError]);

  const handleMemoChange = (value: string) => {
    memoRef.current = value;
    setWorkspaceMemo(value);
    const snapshot: SavedGraph = {
      graphId,
      topic,
      title: graphTitle,
      seed: {
        rootId: seed.rootId,
        nextId: persistStateRef.current.nextId,
        nodes: persistStateRef.current.nodes,
        edges: persistStateRef.current.edges,
      },
      memo: value,
      savedAt: new Date().toISOString(),
    };

    saveGraph(snapshot);
    onGraphPersisted?.(snapshot);
  };

  const handleDeleteNode = () => {
    graphApiRef.current?.deleteSelectedNode();
  };

  const handleMiniMapSelect = (id: number) => {
    graphApiRef.current?.selectNode(id);
  };

  const handleSidebarToggle = () => {
    setProfileOpen(false);
    setSidebarOpen((current) => !current);
  };

  const handleProfileToggle = () => {
    setSidebarOpen(false);
    setProfileOpen((current) => !current);
  };

  const handleHomeClick = () => {
    setProfileOpen(false);
    setSidebarOpen(false);
    onRestart();
  };

  const handleLabelChange = (value: string) => {
    if (!selectedNode) {
      return;
    }

    graphApiRef.current?.updateNode(selectedNode.id, {
      label: value,
      description: selectedNode.description,
    });
  };

  const handleDescriptionChange = (value: string) => {
    if (!selectedNode) {
      return;
    }

    graphApiRef.current?.updateNode(selectedNode.id, {
      label: selectedNode.label,
      description: value,
    });
  };

  const handleAIExpand = async () => {
    if (!selectedNode || aiExpanding) {
      return;
    }

    // Require login before calling API
    const sessionResult = await getSupabaseBrowserClient()?.auth.getSession();
    const token = sessionResult?.data.session?.access_token;

    if (!token) {
      setAIError("로그인이 필요합니다.");
      return;
    }

    const currentNode = selectedNode;
    setAIError(null);
    setAIExpanding(true);

    try {
      const response = await fetch("/api/ai-expand", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nodeLabel: currentNode.label,
          nodeDescription: currentNode.description,
          outlineText: serializeOutlineTree(
            seed.rootId,
            snapshotNodes,
            snapshotEdges,
          ),
          topic,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        ideas?: Array<{ description: string; label: string }>;
      };

      if (response.status === 401) {
        setAIError("로그인이 필요합니다.");
        return;
      }

      if (response.status === 429) {
        setAIError(`사용 횟수를 모두 소진했습니다 (0/${effectiveQuota || 3})`);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "AI 요청에 실패했습니다.");
      }

      const existingLabels = new Set(
        snapshotNodes.map((node) => node.label.trim().toLocaleLowerCase("ko-KR")),
      );
      const seen = new Set<string>();
      const ideas =
        payload.ideas?.filter((idea) => {
          const normalized = idea.label.trim().toLocaleLowerCase("ko-KR");
          if (!normalized || existingLabels.has(normalized) || seen.has(normalized)) {
            return false;
          }

          seen.add(normalized);
          return true;
        }) ?? [];

      if (ideas.length === 0) {
        setAIError("추가 아이디어를 찾지 못했습니다.");
        return;
      }

      graphApiRef.current?.spawnMultipleNodes(currentNode.id, ideas);
      onAIUsageConsumed?.();
    } catch (error) {
      console.error("[AI Expand]", error);
      setAIError(
          error instanceof Error ? error.message : "AI 확장 중 오류가 발생했습니다.",
      );
    } finally {
      setAIExpanding(false);
    }
  };

  if (webglFailed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#faf8f3] text-center">
        <p className="font-display text-[1.8rem] tracking-[0.04em] text-[#1a1208]">
          그래프를 불러올 수 없습니다
        </p>
        <p className="text-[13px] italic tracking-[0.1em] text-[#8b6c42]">
          3D 그래픽을 지원하지 않는 환경입니다.
        </p>
        <button
          onClick={onRestart}
          className="mt-4 border border-[#c4a882] px-8 py-3 text-[13px] italic tracking-[0.12em] text-[#8b6c42]"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 opacity-100 transition-opacity duration-700"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-6 max-w-[min(36rem,calc(100%-10rem))] -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.96)] px-5 py-2.5 shadow-[0_8px_24px_rgba(61,43,18,0.06)] backdrop-blur-md">
            <h2 className="font-display text-[1.15rem] tracking-[0.04em] text-[#1a1208] truncate">
              {rootNode?.label ?? topic}
            </h2>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-[#8b6c42]">
              중심 주제
            </span>
          </div>
        </div>

        <div
          data-graph-control
          className="pointer-events-auto absolute right-6 top-6 z-40 flex gap-2"
        >
          <button
            type="button"
            onClick={() => {
              graphApiRef.current?.resetCamera();
              graphApiRef.current?.selectNode(seed.rootId);
            }}
            className="grid h-[38px] w-[38px] place-items-center rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] text-[#8b6c42] transition-all duration-200 hover:border-[#8b6c42] hover:bg-[#8b6c42] hover:text-[#faf8f3]"
            aria-label="중심으로"
            title="중심으로"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="7.5" cy="7.5" r="5.8" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={handleHomeClick}
            className="grid h-[38px] w-[38px] place-items-center rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] text-[#8b6c42] transition-all duration-200 hover:border-[#8b6c42] hover:bg-[#8b6c42] hover:text-[#faf8f3]"
            aria-label="처음으로"
            title="처음으로"
          >
            <svg width="16" height="15" viewBox="0 0 16 15" fill="none" aria-hidden>
              <path d="M1 7L8 1L15 7V14H10.5V10H5.5V14H1V7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            aria-label="프로필 열기"
            aria-expanded={profileOpen}
            title="프로필 및 AI 사용량"
            onClick={handleProfileToggle}
            className="grid h-[38px] w-[38px] place-items-center rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] text-[#8b6c42] transition-all duration-200 hover:border-[#8b6c42] hover:bg-[#8b6c42] hover:text-[#faf8f3]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3.2 13.1C4.1 10.9 5.8 9.8 8 9.8C10.2 9.8 11.9 10.9 12.8 13.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="사이드바 열기 또는 닫기"
            aria-expanded={sidebarOpen}
            title="아이디어 사이드바"
            onClick={handleSidebarToggle}
            className="grid h-[38px] w-[38px] place-items-center rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] text-[#8b6c42] transition-all duration-200 hover:border-[#8b6c42] hover:bg-[#8b6c42] hover:text-[#faf8f3]"
          >
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden>
              <rect width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="4.75" width="16" height="1.5" rx="0.75" fill="currentColor" />
              <rect y="9.5" width="16" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
        </div>

        {snapshotNodes.length === 1 ? (
          <div className="pointer-events-none absolute inset-x-0 top-[9.5rem] flex justify-center">
            <p className="animate-pulse rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.88)] px-4 py-2 text-[12px] italic tracking-[0.18em] text-[#8b6c42] backdrop-blur-sm">
              노드 이름 옆 <span className="not-italic font-semibold">+</span> 를 눌러 첫 아이디어를 추가해보세요
            </p>
          </div>
        ) : null}

        <div
          className={`pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.96)] px-4 py-1.5 text-[10px] italic tracking-[0.18em] text-[#8b6c42] shadow-sm transition-all duration-300 ${
            savedToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
          }`}
        >
          저장됨
        </div>

        <svg
          ref={labelsRef}
          className="pointer-events-auto absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        />


        <ProfileSidebar
          authEmail={authUser?.email}
          authReady={authReady}
          currentGraphId={graphId}
          graphs={workspaceGraphs}
          onArchiveGraph={onArchiveGraph}
          onClose={() => setProfileOpen(false)}
          onCreateGraph={onCreateGraph}
          onDeleteGraph={onDeleteGraph}
          onSelectGraph={onSelectGraph}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          onToggleFavoriteGraph={onToggleFavoriteGraph}
          onUpgradeClick={onUpgradeClick}
          open={profileOpen}
          profile={workspaceProfile}
          supporterRequest={supporterRequest ?? null}
        />

        <IdeaSidebar
          edges={snapshotEdges}
          memo={workspaceMemo}
          nodes={snapshotNodes}
          onMemoChange={handleMemoChange}
          onSelectNode={handleMiniMapSelect}
          open={sidebarOpen}
          rootId={seed.rootId}
          selectedNodeId={selectedNodeId}
        />

        <NodeInfoPanel
          aiError={aiError}
          aiExpanding={aiExpanding}
          aiQuota={effectiveQuota}
          canDelete={Boolean(selectedNode && selectedNode.id !== seed.rootId)}
          isLoggedIn={Boolean(authUser)}
          node={selectedNode}
          onAIExpand={handleAIExpand}
          onDelete={handleDeleteNode}
          onDescriptionChange={handleDescriptionChange}
          onLabelChange={handleLabelChange}
          onSpawnChild={
            selectedNode
              ? () => graphApiRef.current?.spawnNode(selectedNode.id)
              : undefined
          }
          onUpgradeClick={onUpgradeClick}
          remainingAIUses={remainingAIUses}
          visible={Boolean(selectedNode)}
        />

        <div
          className={`absolute bottom-44 text-right text-[10px] italic leading-7 tracking-[0.15em] text-[#c4a882] transition-all duration-300 ${
            sidebarOpen ? "right-[24.5rem]" : "right-7"
          }`}
        >
          좌클릭: 노드 선택
          <br />
          우클릭 드래그: 시점 조절
          <br />
          Shift+드래그: 이동
          <br />
          휠: 줌
          <br />
          WASD/방향키: 카메라 이동
          <br />
          노드 또는 + 클릭
          <br />
          Esc: 패널 닫기
          <br />
          첫 버튼: 시점 초기화
        </div>
      </div>
    </div>
  );
}
