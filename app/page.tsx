"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { SupporterRequestDialog } from "@/components/shared/SupporterRequestDialog";
import {
  identifyClientUser,
  resetClientTelemetry,
  trackClientEvent,
} from "@/lib/observability/posthog-client";
import {
  archiveGraphInCloud,
  createGraphInCloud,
  deleteGraphInCloud,
  ensureProfileInCloud,
  listGraphsFromCloud,
  loadLatestSupporterRequestInCloud,
  loadGraphFromCloud,
  sortWorkspaceGraphs,
  toggleFavoriteGraphInCloud,
  toWorkspaceGraphSummary,
  type CloudGraph,
  type SupporterRequest,
  type WorkspaceGraphSummary,
  type WorkspaceProfile,
} from "@/lib/cloudStorage";
import {
  getCurrentAuthUser,
  getAccessToken,
  signInWithGoogle,
  signOut,
  subscribeToAuthState,
  type AuthUser,
} from "@/lib/auth";
import { createGraphSeed } from "@/lib/graphData";
import {
  clearGraph,
  clearGuestGraph,
  getLastGraphId,
  loadGraph,
  loadGuestGraph,
  setLastGraphId,
  type SavedGraph,
} from "@/lib/storage";

const DesktopExperience = dynamic(
  () =>
    import("@/components/desktop/DavinciExperience").then(
      (m) => m.DavinciExperience,
    ),
  { ssr: false },
);

const MobileExperience = dynamic(
  () =>
    import("@/components/mobile/DavinciExperience").then(
      (m) => m.DavinciExperience,
    ),
  { ssr: false },
);

function sortAndSetGraphs(graphs: WorkspaceGraphSummary[]) {
  return sortWorkspaceGraphs(graphs);
}

function getDefaultNoteTitle(existing: WorkspaceGraphSummary[]) {
  const count = existing.filter((graph) => !graph.archived_at).length + 1;
  return `새 노트 ${count}`;
}

function applyDraftToSummary(
  graph: WorkspaceGraphSummary,
  draft: SavedGraph,
): WorkspaceGraphSummary {
  return {
    ...graph,
    saved_at: draft.savedAt,
    title: draft.title,
    topic: draft.topic,
    updated_at: draft.savedAt,
  };
}

function mergeGraphWithDraft(
  summary: WorkspaceGraphSummary,
  draft: SavedGraph,
): CloudGraph {
  return {
    ...summary,
    memo: draft.memo,
    seed: draft.seed,
  };
}

type StatusBanner = {
  kind: "info" | "success";
  message: string;
};

export default function Home() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceProfile, setWorkspaceProfile] = useState<WorkspaceProfile | null>(
    null,
  );
  const [supporterRequest, setSupporterRequest] = useState<SupporterRequest | null>(
    null,
  );
  const [supporterDialogOpen, setSupporterDialogOpen] = useState(false);
  const [supporterSubmitting, setSupporterSubmitting] = useState(false);
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);
  const [workspaceGraphs, setWorkspaceGraphs] = useState<WorkspaceGraphSummary[]>(
    [],
  );
  const [activeGraph, setActiveGraph] = useState<CloudGraph | null>(null);

  const updateLocalGraphSnapshot = useCallback((snapshot: SavedGraph) => {
    setLastGraphId(snapshot.graphId);
    setActiveGraph((current) =>
      current && current.id === snapshot.graphId
        ? {
            ...current,
            memo: snapshot.memo,
            saved_at: snapshot.savedAt,
            seed: snapshot.seed,
            title: snapshot.title,
            topic: snapshot.topic,
            updated_at: snapshot.savedAt,
          }
        : current,
    );
    setWorkspaceGraphs((current) =>
      sortAndSetGraphs(
        current.map((graph) =>
          graph.id === snapshot.graphId ? applyDraftToSummary(graph, snapshot) : graph,
        ),
      ),
    );
  }, []);

  const loadActiveGraph = useCallback(
    async (graphId: string, summaries: WorkspaceGraphSummary[]) => {
      const summary = summaries.find((graph) => graph.id === graphId);
      const draft = loadGraph(graphId);

      if (summary && draft) {
        setActiveGraph(mergeGraphWithDraft(summary, draft));
        setLastGraphId(graphId);
        setWorkspaceGraphs(
          sortAndSetGraphs(
            summaries.map((graph) =>
              graph.id === graphId ? applyDraftToSummary(graph, draft) : graph,
            ),
          ),
        );
        return;
      }

      const cloudGraph = await loadGraphFromCloud(graphId);

      if (!cloudGraph) {
        return;
      }

      setActiveGraph(cloudGraph);
      setLastGraphId(graphId);
    },
    [],
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") {
      setStatusBanner({ kind: "success", message: "Pro 전환이 완료되었습니다! AI 사용량이 업데이트되었습니다." });
      const next = new URL(window.location.href);
      next.searchParams.delete("upgrade");
      window.history.replaceState({}, "", next.toString());
    }
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (authUser) {
      identifyClientUser(authUser.id, {
        email: authUser.email ?? undefined,
      });
      return;
    }

    resetClientTelemetry();
  }, [authReady, authUser]);

  useEffect(() => {
    if (!statusBanner) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatusBanner(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [statusBanner]);

  useEffect(() => {
    let cancelled = false;

    const hydrateAuth = async () => {
      const user = await getCurrentAuthUser();

      if (cancelled) {
        return;
      }

      setAuthUser(user);
      setAuthReady(true);
    };

    void hydrateAuth();

    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateWorkspace = async () => {
      if (!authReady) {
        return;
      }

      if (!authUser) {
        if (!cancelled) {
          setWorkspaceProfile(null);
          setSupporterRequest(null);
          setWorkspaceGraphs([]);
          setActiveGraph(null);
          setWorkspaceReady(true);
        }
        return;
      }

      if (!cancelled) {
        setWorkspaceReady(false);
      }

      const [profile, latestSupporterRequest] = await Promise.all([
        ensureProfileInCloud(),
        loadLatestSupporterRequestInCloud(),
      ]);
      let graphs = await listGraphsFromCloud();
      const guestDraft = loadGuestGraph();

      if (!graphs.length) {
        const defaultTitle = guestDraft?.title || guestDraft?.topic || "새 노트";
        const createdGraph = await createGraphInCloud({
          memo: guestDraft?.memo ?? "",
          seed: guestDraft?.seed ?? createGraphSeed(defaultTitle),
          title: defaultTitle,
          topic: guestDraft?.topic ?? defaultTitle,
        });

        if (createdGraph) {
          graphs = [toWorkspaceGraphSummary(createdGraph)];
          clearGuestGraph();
        }
      }

      const nextGraphs = sortAndSetGraphs(graphs);
      const rememberedGraphId = getLastGraphId();
      const preferredGraphId =
        nextGraphs.find(
          (graph) => graph.id === rememberedGraphId && graph.archived_at === null,
        )?.id ??
        nextGraphs.find((graph) => graph.archived_at === null)?.id ??
        nextGraphs[0]?.id ??
        null;

      if (cancelled) {
        return;
      }

      setWorkspaceProfile(profile);
      setSupporterRequest(latestSupporterRequest);
      setWorkspaceGraphs(nextGraphs);

      if (!preferredGraphId) {
        setActiveGraph(null);
        setWorkspaceReady(true);
        return;
      }

      await loadActiveGraph(preferredGraphId, nextGraphs);

      if (!cancelled) {
        setWorkspaceReady(true);
      }
    };

    void hydrateWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser, loadActiveGraph]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("[Google Sign In]", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setAuthUser(null);
      setWorkspaceProfile(null);
      setSupporterRequest(null);
      setWorkspaceGraphs([]);
      setActiveGraph(null);
    } catch (error) {
      console.error("[Google Sign Out]", error);
    }
  };

  const handleCreateGraph = useCallback(async () => {
    const title = getDefaultNoteTitle(workspaceGraphs);
    const createdGraph = await createGraphInCloud({
      memo: "",
      seed: createGraphSeed(title),
      title,
      topic: title,
    });

    if (!createdGraph) {
      return;
    }

    setWorkspaceGraphs((current) =>
      sortAndSetGraphs([toWorkspaceGraphSummary(createdGraph), ...current]),
    );
    setActiveGraph(createdGraph);
    setLastGraphId(createdGraph.id);
  }, [workspaceGraphs]);

  const handleSelectGraph = useCallback(
    async (graphId: string) => {
      await loadActiveGraph(graphId, workspaceGraphs);
    },
    [loadActiveGraph, workspaceGraphs],
  );

  const handleArchiveGraph = useCallback(
    async (graphId: string) => {
      const archived = await archiveGraphInCloud(graphId);

      if (!archived) {
        return;
      }

      const nextGraphs = sortAndSetGraphs(
        workspaceGraphs.map((graph) =>
          graph.id === graphId
            ? {
                ...graph,
                archived_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : graph,
        ),
      );

      setWorkspaceGraphs(nextGraphs);

      if (activeGraph?.id !== graphId) {
        return;
      }

      const nextActive =
        nextGraphs.find((graph) => graph.archived_at === null)?.id ?? null;

      if (nextActive) {
        await loadActiveGraph(nextActive, nextGraphs);
        return;
      }

      const fallbackTitle = "새 노트";
      const createdGraph = await createGraphInCloud({
        memo: "",
        seed: createGraphSeed(fallbackTitle),
        title: fallbackTitle,
        topic: fallbackTitle,
      });

      if (!createdGraph) {
        setActiveGraph(null);
        return;
      }

      setWorkspaceGraphs((current) =>
        sortAndSetGraphs([toWorkspaceGraphSummary(createdGraph), ...current]),
      );
      setActiveGraph(createdGraph);
      setLastGraphId(createdGraph.id);
    },
    [activeGraph?.id, loadActiveGraph, workspaceGraphs],
  );

  const handleDeleteGraph = useCallback(
    async (graphId: string) => {
      const deleted = await deleteGraphInCloud(graphId);

      if (!deleted) {
        return;
      }

      clearGraph(graphId);

      const nextGraphs = sortAndSetGraphs(
        workspaceGraphs.filter((graph) => graph.id !== graphId),
      );

      setWorkspaceGraphs(nextGraphs);

      if (activeGraph?.id !== graphId) {
        return;
      }

      const nextActive = nextGraphs[0]?.id ?? null;

      if (nextActive) {
        await loadActiveGraph(nextActive, nextGraphs);
        return;
      }

      const fallbackTitle = "새 노트";
      const createdGraph = await createGraphInCloud({
        memo: "",
        seed: createGraphSeed(fallbackTitle),
        title: fallbackTitle,
        topic: fallbackTitle,
      });

      if (!createdGraph) {
        setActiveGraph(null);
        return;
      }

      setWorkspaceGraphs((current) =>
        sortAndSetGraphs([toWorkspaceGraphSummary(createdGraph), ...current]),
      );
      setActiveGraph(createdGraph);
      setLastGraphId(createdGraph.id);
    },
    [activeGraph?.id, loadActiveGraph, workspaceGraphs],
  );

  const handleToggleFavorite = useCallback(
    async (graphId: string, value: boolean) => {
      const updated = await toggleFavoriteGraphInCloud(graphId, value);

      if (!updated) {
        return;
      }

      setWorkspaceGraphs((current) =>
        sortAndSetGraphs(
          current.map((graph) =>
            graph.id === graphId
              ? {
                  ...graph,
                  is_favorite: value,
                  updated_at: new Date().toISOString(),
                }
              : graph,
          ),
        ),
      );
      setActiveGraph((current) =>
        current && current.id === graphId
          ? { ...current, is_favorite: value, updated_at: new Date().toISOString() }
          : current,
      );
    },
    [],
  );

  const handleUpgradeClick = useCallback(async () => {
    if (!authUser) {
      return;
    }

    trackClientEvent("supporter_request_opened", {
      location: "workspace",
      plan: workspaceProfile?.plan ?? "free",
      request_status: supporterRequest?.status ?? "none",
    });
    setSupporterDialogOpen(true);
  }, [authUser, supporterRequest?.status, workspaceProfile?.plan]);

  const handleSupporterSubmit = useCallback(
    async (payload: {
      depositorName: string;
      memo: string;
      supportAmount: number;
      supporterName: string;
    }) => {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      try {
        setSupporterSubmitting(true);

        const response = await fetch("/api/supporter-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          error?: string;
          request?: SupporterRequest;
        };

        if (!response.ok || !data.request) {
          throw new Error(data.error ?? "Failed to save supporter request.");
        }

        setSupporterRequest(data.request);
        setStatusBanner({
          kind: "success",
          message: "후원 신청이 저장되었습니다. 입금 후 운영자가 확인하면 Pro 체험이 열립니다.",
        });

        trackClientEvent("supporter_request_submitted", {
          location: "workspace",
          request_status: data.request.status,
          support_amount: data.request.support_amount,
        });
      } catch (error) {
        console.error("[Supporter Request]", error);
        setStatusBanner({
          kind: "info",
          message: "후원 신청 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        });
      } finally {
        setSupporterSubmitting(false);
      }
    },
    [],
  );

  const handleAIUsageConsumed = useCallback(() => {
    setWorkspaceProfile((current) =>
      current
        ? {
            ...current,
            ai_used: current.ai_used + 1,
            updated_at: new Date().toISOString(),
          }
        : current,
    );
  }, []);

  if (isMobile === null) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#faf8f3]">
        <p className="animate-pulse text-[11px] italic tracking-[0.28em] text-[#d4b896]">
          다빈치노트
        </p>
      </main>
    );
  }

  const sharedProps = {
    activeGraph,
    authReady,
    authUser,
    initialTopic: "",
    onAIUsageConsumed: handleAIUsageConsumed,
    onArchiveGraph: handleArchiveGraph,
    onCreateGraph: handleCreateGraph,
    onDeleteGraph: handleDeleteGraph,
    onGraphPersisted: updateLocalGraphSnapshot,
    onSelectGraph: handleSelectGraph,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
    onToggleFavoriteGraph: handleToggleFavorite,
    onUpgradeClick: handleUpgradeClick,
    supporterRequest,
    workspaceGraphs,
    workspaceProfile,
    workspaceReady,
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#faf8f3]">
      {statusBanner ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-[11px] tracking-[0.12em] shadow-[0_10px_30px_rgba(61,43,18,0.12)] backdrop-blur-md ${
              statusBanner.kind === "success"
                ? "border-[#8b6c42] bg-[rgba(245,237,224,0.96)] text-[#6b4f2a]"
                : "border-[#d9c4a4] bg-[rgba(250,248,243,0.96)] text-[#8b6c42]"
            }`}
          >
            <span>{statusBanner.message}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="rounded-full border border-current px-2 py-0.5 text-[10px] tracking-[0.14em]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      <SupporterRequestDialog
        authEmail={authUser?.email}
        onClose={() => setSupporterDialogOpen(false)}
        onSubmit={handleSupporterSubmit}
        open={supporterDialogOpen}
        profile={workspaceProfile}
        request={supporterRequest}
        submitting={supporterSubmitting}
      />
      {isMobile ? (
        <MobileExperience {...sharedProps} />
      ) : (
        <DesktopExperience {...sharedProps} />
      )}
    </main>
  );
}
