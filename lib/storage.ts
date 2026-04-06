import type { GraphSeed } from "@/types/davinci";

const KEY = "davinci_graph_v1";

export type SavedGraph = {
  topic: string;
  seed: GraphSeed;
  memo: string;
  savedAt: string;
};

export function saveGraph(data: SavedGraph): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 실패 시 무시 (quota 초과 등)
  }
}

export function loadGraph(): SavedGraph | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const obj = parsed as Record<string, unknown>;

    if (
      typeof obj.topic !== "string" ||
      typeof obj.memo !== "string" ||
      typeof obj.savedAt !== "string" ||
      !obj.seed ||
      typeof obj.seed !== "object"
    ) {
      return null;
    }

    const seed = obj.seed as Record<string, unknown>;
    if (
      typeof seed.rootId !== "number" ||
      typeof seed.nextId !== "number" ||
      !Array.isArray(seed.nodes) ||
      !Array.isArray(seed.edges)
    ) {
      return null;
    }

    return obj as unknown as SavedGraph;
  } catch {
    return null;
  }
}

export function clearGraph(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
