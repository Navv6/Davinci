"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SideDrawer } from "@/components/mobile/SideDrawer";
import { createGraphSeed, createSpawnedNode, getPaletteForLevel } from "@/lib/graphData";
import type { GraphEdge, GraphNode } from "@/types/davinci";

type MobileIdeaSpaceProps = {
  onRestart: () => void;
  topic: string;
};

type RuntimeNode = GraphNode & { bornAt: number };

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
  deleteSelectedNode: () => void;
  selectNode: (id: number) => void;
  spawnNode: (parentId: number) => void;
  updateNode: (id: number, patch: Pick<GraphNode, "description" | "label">) => void;
};

function getNodeSize(level: number) {
  if (level === 0) return 0.28;
  if (level === 1) return 0.2;
  if (level === 2) return 0.16;
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

function disposeNodeRuntime(runtime: NodeRuntime) {
  runtime.group.traverse((child) => {
    const meshChild = child as THREE.Mesh & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    meshChild.geometry?.dispose();
    if (Array.isArray(meshChild.material)) {
      meshChild.material.forEach((m) => m.dispose());
    } else {
      meshChild.material?.dispose();
    }
  });
}

const CATEGORY_LABEL = {
  topic: "중심 주제",
  idea: "아이디어 가지",
  keyword: "키워드",
  task: "실행 항목",
  reference: "레퍼런스",
} as const;

export function MobileIdeaSpace({ onRestart, topic }: MobileIdeaSpaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<SVGSVGElement>(null);
  const graphApiRef = useRef<GraphApi | null>(null);
  const labelFocusedNodes = useRef(new Set<number>());
  const descFocusedNodes = useRef(new Set<number>());
  const seed = useMemo(() => createGraphSeed(topic), [topic]);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(
    seed.nodes[seed.rootId] ?? null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number>(seed.rootId);
  const [rootNode, setRootNode] = useState<GraphNode | null>(
    seed.nodes[seed.rootId] ?? null,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snapshotNodes, setSnapshotNodes] = useState<GraphNode[]>(seed.nodes);
  const [snapshotEdges, setSnapshotEdges] = useState<GraphEdge[]>(seed.edges);
  const [workspaceMemo, setWorkspaceMemo] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;

    if (!container || !canvas || !labels) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    camera.position.set(0, 0, 30);

    const displayFont =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-display-family")
        .trim() || '"Cormorant Garamond", serif';

    const labelMeasureCanvas = document.createElement("canvas");
    const labelMeasureContext = labelMeasureCanvas.getContext("2d");

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas });
    renderer.setClearColor(0xfaf8f3, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const seededAt = performance.now();
    const nodes: RuntimeNode[] = seed.nodes.map((node) => ({
      ...node,
      bornAt: seededAt + node.born,
    }));
    const nodeMap = new Map<number, RuntimeNode>(nodes.map((n) => [n.id, n]));
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

    let rotX = 0.12;
    let rotY = 0.22;
    let targetRotX = 0.12;
    let targetRotY = 0.22;
    let zoom = 30;
    let targetZoom = 30;
    let tick = 0;
    let animationFrame = 0;

    // Touch state
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastPinchDist = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

    const syncReactState = (id: number) => {
      const node = nodeMap.get(id);
      const root = nodeMap.get(seed.rootId);
      setSelectedNode(node ? stripRuntimeNode(node) : null);
      setSelectedNodeId(id);
      setRootNode(root ? stripRuntimeNode(root) : null);
      setSnapshotNodes(nodes.map((n) => stripRuntimeNode(n)));
      setSnapshotEdges([...edges]);
    };

    const setSelected = (id: number) => {
      selectedId.current = id;
      const node = nodeMap.get(id);
      if (node) focusTarget.set(node.x, node.y, node.z);
      syncReactState(id);
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
      nodeRuntimes.set(node.id, { group, visualGroup, wireMat, faceMat, opacity: animated ? 0 : 1 });
    };

    const makeEdge = (fromId: number, toId: number, animated: boolean) => {
      const from = nodeMap.get(fromId);
      const to = nodeMap.get(toId);
      if (!from || !to) return;

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
      edgeRuntimes.set(`${fromId}-${toId}`, { from: fromId, to: toId, line, mat: material, baseColor: palette.edge });
    };

    const removeEdgeRuntime = (key: string) => {
      const runtime = edgeRuntimes.get(key);
      if (!runtime) return;
      graphGroup.remove(runtime.line);
      runtime.line.geometry.dispose();
      runtime.mat.dispose();
      edgeRuntimes.delete(key);
    };

    const spawnNode = (parentId: number) => {
      const parent = nodeMap.get(parentId);
      if (!parent) return;

      const siblingCount = edges.filter(([from]) => from === parentId).length;
      const node = createSpawnedNode("New", nextId, parent, siblingCount);
      const runtimeNode: RuntimeNode = { ...node, bornAt: performance.now() };

      nextId += 1;
      nodes.push(runtimeNode);
      nodeMap.set(runtimeNode.id, runtimeNode);
      edges.push([parentId, runtimeNode.id]);

      makeNode(runtimeNode, true);
      makeEdge(parentId, runtimeNode.id, true);
      setSelected(runtimeNode.id);
      setPanelOpen(true);
    };

    const updateNode = (id: number, patch: Pick<GraphNode, "description" | "label">) => {
      const node = nodeMap.get(id);
      if (!node) return;
      node.label = patch.label;
      node.description = patch.description;
      syncReactState(id);
    };

    const deleteSelectedNode = () => {
      const id = selectedId.current;
      if (id === seed.rootId) return;

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

      idsToDelete.forEach((nodeId) => {
        const runtime = nodeRuntimes.get(nodeId);
        if (!runtime) return;
        graphGroup.remove(runtime.group);
        disposeNodeRuntime(runtime);
        nodeRuntimes.delete(nodeId);
        nodeMap.delete(nodeId);
      });

      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        if (idsToDelete.has(nodes[i]?.id ?? -1)) nodes.splice(i, 1);
      }

      for (let i = edges.length - 1; i >= 0; i -= 1) {
        const [from, to] = edges[i];
        if (idsToDelete.has(from) || idsToDelete.has(to)) {
          removeEdgeRuntime(`${from}-${to}`);
          edges.splice(i, 1);
        }
      }

      setSelected(parentId);
    };

    nodes.forEach((node) => makeNode(node, node.born > 0));

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

    const createLabelBackdrop = (width: number, height: number, x: number, y: number, selected: boolean) => {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", `${x - width / 2}`);
      rect.setAttribute("y", `${y - height / 2}`);
      rect.setAttribute("width", `${width}`);
      rect.setAttribute("height", `${height}`);
      rect.setAttribute("rx", `${height / 2}`);
      rect.setAttribute("fill", "#faf8f3");
      rect.setAttribute("stroke", selected ? "rgba(139,108,66,0.52)" : "rgba(232,213,184,0.82)");
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
      circle.setAttribute("r", selected ? "14" : "12");
      circle.setAttribute("fill", "#faf8f3");
      circle.setAttribute("stroke", selected ? "rgba(139,108,66,0.82)" : "rgba(196,168,130,0.88)");
      circle.setAttribute("stroke-width", selected ? "1.35" : "1.1");
      group.appendChild(circle);

      const h = document.createElementNS("http://www.w3.org/2000/svg", "line");
      h.setAttribute("x1", `${x - 4}`);
      h.setAttribute("x2", `${x + 4}`);
      h.setAttribute("y1", `${y}`);
      h.setAttribute("y2", `${y}`);
      h.setAttribute("stroke", "#8b6c42");
      h.setAttribute("stroke-width", "1.4");
      h.setAttribute("stroke-linecap", "round");
      group.appendChild(h);

      const v = document.createElementNS("http://www.w3.org/2000/svg", "line");
      v.setAttribute("x1", `${x}`);
      v.setAttribute("x2", `${x}`);
      v.setAttribute("y1", `${y - 4}`);
      v.setAttribute("y2", `${y + 4}`);
      v.setAttribute("stroke", "#8b6c42");
      v.setAttribute("stroke-width", "1.4");
      v.setAttribute("stroke-linecap", "round");
      group.appendChild(v);

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
        if (!runtime || runtime.opacity < 0.25 || now < node.bornAt) return;

        const isSelected = node.id === selectedId.current;
        const palette = getPaletteForLevel(node.level);
        const projected = new THREE.Vector3(node.x, node.y, node.z);

        graphGroup.localToWorld(projected);
        projected.project(camera);

        if (projected.z > 1) return;

        const sx = (projected.x * 0.5 + 0.5) * width;
        const sy = (-projected.y * 0.5 + 0.5) * height;

        // Larger font for mobile touch targets
        const fontSize =
          node.level === 0 ? (isSelected ? 22 : 18) :
          node.level === 1 ? (isSelected ? 18 : 14) :
          isSelected ? 16 : 12;
        const fontWeight = isSelected ? 600 : node.level === 0 ? 500 : 430;

        if (labelMeasureContext) {
          labelMeasureContext.font = `${fontWeight} ${fontSize}px ${displayFont}`;
        }

        const labelWidth = labelMeasureContext
          ? labelMeasureContext.measureText(node.label).width
          : fontSize * node.label.length;
        const pillWidth = labelWidth + (node.level === 0 ? 32 : 26);
        const pillHeight = fontSize + (node.level === 0 ? 18 : 14);

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("data-select-node-id", `${node.id}`);
        group.style.cursor = "pointer";

        group.appendChild(createLabelBackdrop(pillWidth, pillHeight, sx, sy, isSelected));

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", `${sx}`);
        text.setAttribute("y", `${sy}`);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", `${fontSize}`);
        text.setAttribute("font-weight", `${fontWeight}`);
        text.setAttribute("font-style", node.level === 0 ? "normal" : "italic");
        text.setAttribute("fill", isSelected ? "#1a1208" : palette.label);
        text.setAttribute("opacity", `${Math.min(1, runtime.opacity * (isSelected ? 1 : 0.76))}`);
        text.setAttribute("letter-spacing", node.level === 0 ? "0.04em" : "0.03em");
        text.setAttribute("stroke", "#faf8f3");
        text.setAttribute("stroke-width", isSelected ? "4.6" : node.level === 0 ? "4" : "3");
        text.setAttribute("stroke-linejoin", "round");
        text.style.fontFamily = displayFont;
        text.style.paintOrder = "stroke";
        text.textContent = node.label;
        group.appendChild(text);

        const addX = sx + pillWidth / 2 + 20;
        group.appendChild(createAddButton(addX, sy, isSelected, node.id));
        labels.appendChild(group);
      });
    };

    const handleLabelPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

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
          setPanelOpen(true);
        }
      }
    };

    graphApiRef.current = { spawnNode, selectNode: setSelected, updateNode, deleteSelectedNode };

    // Touch controls: single finger = rotate, pinch = zoom, tap = select
    const handleTouchStart = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-graph-control]")) return;

      if (event.touches.length === 1) {
        const t = event.touches[0]!;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchMoved = false;
      } else if (event.touches.length === 2) {
        const t0 = event.touches[0]!;
        const t1 = event.touches[1]!;
        lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-graph-control]")) return;

      if (event.touches.length === 1) {
        const t = event.touches[0]!;
        const dx = t.clientX - lastTouchX;
        const dy = t.clientY - lastTouchY;

        if (Math.abs(t.clientX - touchStartX) > 6 || Math.abs(t.clientY - touchStartY) > 6) {
          touchMoved = true;
        }

        targetRotY += dx * 0.009;
        targetRotX += dy * 0.009;
        targetRotX = Math.max(-1.1, Math.min(1.1, targetRotX));
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        event.preventDefault();
      } else if (event.touches.length === 2) {
        const t0 = event.touches[0]!;
        const t1 = event.touches[1]!;
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const delta = lastPinchDist - dist;
        targetZoom += delta * 0.08;
        targetZoom = Math.max(10, Math.min(60, targetZoom));
        lastPinchDist = dist;
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-graph-control]")) return;
      // Tap to pick node (no movement)
      if (!touchMoved && event.changedTouches[0]) {
        const t = event.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((t.clientX - rect.left) / rect.width) * 2 - 1,
          -((t.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);

        let closest: RuntimeNode | null = null;
        let minDist = Number.POSITIVE_INFINITY;

        for (const node of nodes) {
          const runtime = nodeRuntimes.get(node.id);
          if (!runtime || runtime.opacity < 0.3 || performance.now() < node.bornAt) continue;

          const worldPos = new THREE.Vector3();
          runtime.group.getWorldPosition(worldPos);
          const dist = raycaster.ray.distanceToPoint(worldPos);
          const threshold = node.level === 0 ? 2.2 : 1.8;

          if (dist < threshold && dist < minDist) {
            minDist = dist;
            closest = node;
          }
        }

        if (closest) {
          setSelected(closest.id);
          setPanelOpen(true);
        }
      }
    };

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      tick += 1;

      rotX += (targetRotX - rotX) * 0.055;
      rotY += (targetRotY - rotY) * 0.055;
      zoom += (targetZoom - zoom) * 0.07;
      focusCurrent.lerp(focusTarget, 0.11);

      graphGroup.rotation.x = rotX;
      graphGroup.rotation.y = rotY;
      rotatedFocus.copy(focusCurrent).applyEuler(graphGroup.rotation);
      graphGroup.position.x += (-rotatedFocus.x - graphGroup.position.x) * 0.12;
      graphGroup.position.y += (-rotatedFocus.y - graphGroup.position.y) * 0.12;
      graphGroup.position.z += (-rotatedFocus.z - graphGroup.position.z) * 0.12;
      camera.position.z = zoom;
      camera.lookAt(0, 0, 0);

      nodes.forEach((node, index) => {
        const runtime = nodeRuntimes.get(node.id);
        if (!runtime || performance.now() < node.bornAt) return;

        const isSelected = node.id === selectedId.current;
        const targetWireOpacity = isSelected ? 0.94 : 0.28;
        const targetFaceOpacity = isSelected ? 0.1 : 0.018;
        const targetScale =
          node.level === 0
            ? isSelected ? 1.08 : 1 + Math.sin(tick * 0.03) * 0.018
            : isSelected ? 1.16 : 1;

        runtime.opacity = Math.min(1, runtime.opacity + 0.03);
        runtime.wireMat.opacity += (targetWireOpacity - runtime.wireMat.opacity) * 0.14;
        runtime.faceMat.opacity += (targetFaceOpacity - runtime.faceMat.opacity) * 0.16;

        const nextScale = runtime.visualGroup.scale.x + (targetScale - runtime.visualGroup.scale.x) * 0.14;
        runtime.visualGroup.scale.setScalar(nextScale);
        runtime.visualGroup.rotation.y += 0.004 + index * 0.001;
        runtime.visualGroup.rotation.x += (0.004 + index * 0.001) * 0.55;
      });

      edgeRuntimes.forEach((edgeRuntime) => {
        const isSelected = edgeRuntime.to === selectedId.current || edgeRuntime.from === selectedId.current;
        const targetOpacity = isSelected ? 0.82 : 0.18;
        edgeRuntime.mat.opacity += (targetOpacity - edgeRuntime.mat.opacity) * 0.14;
        edgeRuntime.mat.color.set(isSelected ? 0x8b6c42 : edgeRuntime.baseColor);
      });

      updateLabels();
      renderer.render(scene, camera);
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    labels.addEventListener("pointerdown", handleLabelPointerDown);

    animate();

    return () => {
      graphApiRef.current = null;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      labels.removeEventListener("pointerdown", handleLabelPointerDown);
      labels.innerHTML = "";
      edgeRuntimes.forEach((r) => { r.line.geometry.dispose(); r.mat.dispose(); });
      nodeRuntimes.forEach((r) => disposeNodeRuntime(r));
      renderer.dispose();
      graphGroup.clear();
    };
  }, [seed]);

  const handleLabelChange = (value: string) => {
    if (!selectedNode) return;
    graphApiRef.current?.updateNode(selectedNode.id, { label: value, description: selectedNode.description });
  };

  const handleDescriptionChange = (value: string) => {
    if (!selectedNode) return;
    graphApiRef.current?.updateNode(selectedNode.id, { label: selectedNode.label, description: value });
  };

  const handleDelete = () => {
    graphApiRef.current?.deleteSelectedNode();
    setPanelOpen(false);
  };

  const category = selectedNode?.category ?? "idea";
  const canDelete = Boolean(selectedNode && selectedNode.id !== seed.rootId);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#faf8f3]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Top bar */}
      <div
        data-graph-control
        className="pointer-events-auto fixed left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(to bottom, rgba(250,248,243,0.95) 70%, transparent)" }}
      >
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] px-4 py-2 text-[12px] italic tracking-[0.12em] text-[#8b6c42]"
        >
          처음으로
        </button>

        <span className="font-display text-[1.1rem] tracking-[0.04em] text-[#1a1208]">
          {rootNode?.label ?? topic}
        </span>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          data-graph-control
          className="grid h-9 w-9 place-items-center rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] text-[#8b6c42]"
        >
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
            <rect width="14" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="4.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="8.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* SVG labels */}
      <svg
        ref={labelsRef}
        className="pointer-events-auto absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      />

      {/* Bottom panel */}
      <div
        data-graph-control
        className={`pointer-events-auto fixed bottom-0 left-0 right-0 z-30 rounded-t-[1.75rem] border-t border-[#e8d5b8] bg-[rgba(250,248,243,0.98)] px-5 pb-8 pt-5 shadow-[0_-12px_32px_rgba(61,43,18,0.08)] backdrop-blur-md transition-transform duration-300 ${
          panelOpen && selectedNode ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e8d5b8]" />

        {selectedNode ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.26em] text-[#c4a882]">
                {CATEGORY_LABEL[category]}
              </span>
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-[12px] italic tracking-[0.1em] text-[#c4a882]"
                >
                  삭제
                </button>
              ) : null}
            </div>

            <input
              value={selectedNode.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              onFocus={(e) => {
                if (!labelFocusedNodes.current.has(selectedNode.id)) {
                  labelFocusedNodes.current.add(selectedNode.id);
                  e.target.select();
                }
              }}
              maxLength={28}
              style={{ caretColor: "#1a1208" }}
              className="w-full border-b border-[#e8d5b8] bg-transparent pb-2 font-display text-[1.3rem] tracking-[0.03em] text-[#1a1208] outline-none placeholder:text-[#d4b896] focus:border-[#8b6c42]"
              placeholder="제목"
            />

            <textarea
              value={selectedNode.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onFocus={(e) => {
                if (!descFocusedNodes.current.has(selectedNode.id)) {
                  descFocusedNodes.current.add(selectedNode.id);
                  e.target.select();
                }
              }}
              rows={3}
              style={{ caretColor: "#3d2b12" }}
              className="mt-3 w-full resize-none bg-transparent text-[13px] leading-6 tracking-[0.02em] text-[#5d4528] outline-none placeholder:text-[#d4b896]"
              placeholder="내용을 입력하세요"
            />
          </>
        ) : null}
      </div>

      {/* Side drawer */}
      <SideDrawer
        edges={snapshotEdges}
        memo={workspaceMemo}
        nodes={snapshotNodes}
        onClose={() => setDrawerOpen(false)}
        onMemoChange={setWorkspaceMemo}
        onSelectNode={(id) => {
          graphApiRef.current?.selectNode(id);
          setDrawerOpen(false);
          setPanelOpen(true);
        }}
        open={drawerOpen}
        rootId={seed.rootId}
        selectedNodeId={selectedNodeId}
      />
    </div>
  );
}
