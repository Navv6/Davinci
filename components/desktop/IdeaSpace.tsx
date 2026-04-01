"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { IdeaSidebar } from "@/components/desktop/IdeaSidebar";
import { MiniMapPanel } from "@/components/desktop/MiniMapPanel";
import { NodeInfoPanel } from "@/components/desktop/NodeInfoPanel";
import { createGraphSeed, createSpawnedNode, getPaletteForLevel } from "@/lib/graphData";
import type { GraphEdge, GraphNode } from "@/types/davinci";

type IdeaSpaceProps = {
  onRestart: () => void;
  topic: string;
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
  deleteSelectedNode: () => void;
  selectNode: (id: number) => void;
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

export function IdeaSpace({ onRestart, topic }: IdeaSpaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<SVGSVGElement>(null);
  const graphApiRef = useRef<GraphApi | null>(null);
  const seed = useMemo(() => createGraphSeed(topic), [topic]);

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
  const [workspaceMemo, setWorkspaceMemo] = useState("");
  const [miniMapView, setMiniMapView] = useState({
    focusX: seed.nodes[seed.rootId]?.x ?? 0,
    focusY: seed.nodes[seed.rootId]?.y ?? 0,
    focusZ: seed.nodes[seed.rootId]?.z ?? 0,
    rotX: 0.12,
    rotY: 0.22,
  });

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

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
    });
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
    let lastMiniMapSync = 0;
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

    const syncReactState = (id: number) => {
      const node = nodeMap.get(id);
      const root = nodeMap.get(seed.rootId);

      setSelectedNode(node ? stripRuntimeNode(node) : null);
      setSelectedNodeId(id);
      setRootNode(root ? stripRuntimeNode(root) : null);
      setSnapshotNodes(stripRuntimeNodes(nodes));
      setSnapshotEdges([...edges]);
    };

    const setSelected = (id: number) => {
      selectedId.current = id;
      const node = nodeMap.get(id);

      if (node) {
        focusTarget.set(node.x, node.y, node.z);
      }

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
      const node = createSpawnedNode("New", nextId, parent, siblingCount);
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

      if (now - lastMiniMapSync > 70) {
        lastMiniMapSync = now;
        setMiniMapView({
          focusX: focusCurrent.x,
          focusY: focusCurrent.y,
          focusZ: focusCurrent.z,
          rotX,
          rotY,
        });
      }

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
  }, [seed]);

  const handleDeleteNode = () => {
    graphApiRef.current?.deleteSelectedNode();
  };

  const handleMiniMapSelect = (id: number) => {
    graphApiRef.current?.selectNode(id);
  };

  const handleSidebarToggle = () => {
    setSidebarOpen((current) => !current);
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 opacity-100 transition-opacity duration-700"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-6 w-[min(50rem,calc(100%-2rem))] -translate-x-1/2">
          <div className="rounded-[2.15rem] border border-[#e8d5b8] bg-[rgba(250,248,243,0.96)] px-6 py-5 shadow-[0_18px_40px_rgba(61,43,18,0.07)] backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-center gap-3 text-center">
              <h2 className="font-display text-[clamp(1.85rem,2.6vw,2.35rem)] tracking-[0.04em] text-[#1a1208]">
                {rootNode?.label ?? topic}
              </h2>
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#8b6c42]">
                중심 주제
              </span>
            </div>

          </div>
        </div>

        <div
          data-graph-control
          className="pointer-events-auto absolute right-6 top-6 z-40 flex gap-2"
        >
          <button
            type="button"
            onClick={onRestart}
            className="rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.92)] px-4 py-2 text-[11px] italic tracking-[0.15em] text-[#8b6c42] transition-all duration-200 hover:border-[#8b6c42] hover:bg-[#8b6c42] hover:text-[#faf8f3]"
          >
            처음으로
          </button>
          <button
            type="button"
            aria-label="사이드바 열기/닫기"
            aria-expanded={sidebarOpen}
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

        <svg
          ref={labelsRef}
          className="pointer-events-auto absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        />

        <MiniMapPanel
          edges={snapshotEdges}
          nodes={snapshotNodes}
          onSelectNode={handleMiniMapSelect}
          rootId={seed.rootId}
          selectedNodeId={selectedNodeId}
          viewState={miniMapView}
        />

        <IdeaSidebar
          edges={snapshotEdges}
          memo={workspaceMemo}
          nodes={snapshotNodes}
          onMemoChange={setWorkspaceMemo}
          onSelectNode={handleMiniMapSelect}
          open={sidebarOpen}
          rootId={seed.rootId}
          selectedNode={selectedNode}
          selectedNodeId={selectedNodeId}
        />

        <NodeInfoPanel
          canDelete={Boolean(selectedNode && selectedNode.id !== seed.rootId)}
          node={selectedNode}
          onDelete={handleDeleteNode}
          onDescriptionChange={handleDescriptionChange}
          onLabelChange={handleLabelChange}
          visible={Boolean(selectedNode)}
        />

        <div
          className={`absolute bottom-44 text-right text-[10px] italic leading-7 tracking-[0.15em] text-[#c4a882] transition-all duration-300 ${
            sidebarOpen ? "right-[24.5rem]" : "right-7"
          }`}
        >
          좌클릭 · 노드 선택
          <br />
          우클릭 드래그 · 시점 조절
          <br />
          Shift+드래그 · 이동
          <br />
          휠 · 줌
          <br />
          WASD/방향키 · 카메라 이동
          <br />
          노드 또는 + 클릭
        </div>
      </div>
    </div>
  );
}
