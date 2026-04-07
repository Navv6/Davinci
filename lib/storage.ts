import { syncGraphToCloud } from "@/lib/cloudStorage";
import type { GraphSeed } from "@/types/davinci";

const GRAPH_SESSION_PREFIX = "davinci_graph_session_v2:";
const LAST_GRAPH_KEY = "davinci_last_graph_id_v2";
const GUEST_GRAPH_ID = "guest";
const LEGACY_SESSION_KEY = "davinci_graph_session_v1";
const LEGACY_LOCAL_KEY = "davinci_graph_v1";

export type SavedGraph = {
  graphId: string;
  memo: string;
  savedAt: string;
  seed: GraphSeed;
  title: string;
  topic: string;
};

type LegacySavedGraph = Omit<SavedGraph, "graphId" | "title">;

function getGraphSessionKey(graphId: string) {
  return `${GRAPH_SESSION_PREFIX}${graphId}`;
}

function isSavedGraph(value: unknown): value is SavedGraph {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (
    typeof obj.graphId !== "string" ||
    typeof obj.title !== "string" ||
    typeof obj.topic !== "string" ||
    typeof obj.memo !== "string" ||
    typeof obj.savedAt !== "string" ||
    !obj.seed ||
    typeof obj.seed !== "object"
  ) {
    return false;
  }

  const seed = obj.seed as Record<string, unknown>;

  return (
    typeof seed.rootId === "number" &&
    typeof seed.nextId === "number" &&
    Array.isArray(seed.nodes) &&
    Array.isArray(seed.edges)
  );
}

function parseSavedGraph(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSavedGraph(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseLegacySavedGraph(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const obj = parsed as Record<string, unknown>;
    const seed = obj.seed as Record<string, unknown> | undefined;

    if (
      typeof obj.topic !== "string" ||
      typeof obj.memo !== "string" ||
      typeof obj.savedAt !== "string" ||
      !seed ||
      typeof seed.rootId !== "number" ||
      typeof seed.nextId !== "number" ||
      !Array.isArray(seed.nodes) ||
      !Array.isArray(seed.edges)
    ) {
      return null;
    }

    return obj as LegacySavedGraph;
  } catch {
    return null;
  }
}

function removeLegacyGraph() {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Ignore legacy cleanup failures.
  }

  try {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
  } catch {
    // Ignore legacy cleanup failures.
  }
}

function migrateLegacyGuestGraph() {
  const legacySession = parseLegacySavedGraph(
    sessionStorage.getItem(LEGACY_SESSION_KEY),
  );

  if (legacySession) {
    const migrated: SavedGraph = {
      ...legacySession,
      graphId: GUEST_GRAPH_ID,
      title: legacySession.topic,
    };

    try {
      sessionStorage.setItem(
        getGraphSessionKey(GUEST_GRAPH_ID),
        JSON.stringify(migrated),
      );
    } catch {
      // Ignore migration failures.
    }

    removeLegacyGraph();
    return migrated;
  }

  const legacyLocal = parseLegacySavedGraph(localStorage.getItem(LEGACY_LOCAL_KEY));

  if (!legacyLocal) {
    return null;
  }

  const migrated: SavedGraph = {
    ...legacyLocal,
    graphId: GUEST_GRAPH_ID,
    title: legacyLocal.topic,
  };

  try {
    sessionStorage.setItem(
      getGraphSessionKey(GUEST_GRAPH_ID),
      JSON.stringify(migrated),
    );
  } catch {
    // Ignore migration failures.
  }

  removeLegacyGraph();
  return migrated;
}

function writeGraphDraft(data: SavedGraph) {
  try {
    sessionStorage.setItem(getGraphSessionKey(data.graphId), JSON.stringify(data));
  } catch {
    // Ignore session storage failures and keep the current runtime graph alive.
  }

  setLastGraphId(data.graphId);
  removeLegacyGraph();
}

export function saveGraph(data: SavedGraph): void {
  writeGraphDraft(data);

  if (data.graphId === GUEST_GRAPH_ID) {
    return;
  }

  syncGraphToCloud(data);
}

export function saveGuestGraph(
  data: Omit<SavedGraph, "graphId"> & { graphId?: string },
): void {
  writeGraphDraft({
    ...data,
    graphId: GUEST_GRAPH_ID,
  });
}

export function loadGraph(graphId: string): SavedGraph | null {
  try {
    const draft = parseSavedGraph(sessionStorage.getItem(getGraphSessionKey(graphId)));

    if (draft) {
      removeLegacyGraph();
      return draft;
    }

    if (graphId === GUEST_GRAPH_ID) {
      return migrateLegacyGuestGraph();
    }

    return null;
  } catch {
    return null;
  }
}

export function loadGuestGraph() {
  return loadGraph(GUEST_GRAPH_ID);
}

export function clearGraph(graphId: string): void {
  try {
    sessionStorage.removeItem(getGraphSessionKey(graphId));
  } catch {
    // Ignore session storage cleanup failures.
  }

  if (graphId === GUEST_GRAPH_ID) {
    removeLegacyGraph();
  }
}

export function clearGuestGraph(): void {
  clearGraph(GUEST_GRAPH_ID);
}

export function getLastGraphId(): string | null {
  try {
    return sessionStorage.getItem(LAST_GRAPH_KEY);
  } catch {
    return null;
  }
}

export function setLastGraphId(graphId: string) {
  try {
    sessionStorage.setItem(LAST_GRAPH_KEY, graphId);
  } catch {
    // Ignore session storage failures.
  }
}
