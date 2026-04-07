"use client";

import dynamic from "next/dynamic";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IntroParticles } from "@/components/desktop/IntroParticles";
import { AuthStatus } from "@/components/shared/AuthStatus";
import type { AuthUser } from "@/lib/auth";
import type {
  CloudGraph,
  SupporterRequest,
  WorkspaceGraphSummary,
  WorkspaceProfile,
} from "@/lib/cloudStorage";
import { clearGuestGraph, loadGuestGraph, type SavedGraph } from "@/lib/storage";
import type { GraphSeed, SequenceStage } from "@/types/davinci";

const IdeaSpace = dynamic(
  () =>
    import("@/components/desktop/IdeaSpace").then(
      (module) => module.IdeaSpace,
    ),
  { ssr: false },
);

type DavinciExperienceProps = {
  activeGraph: CloudGraph | null;
  authReady: boolean;
  authUser: AuthUser | null;
  initialTopic: string;
  onAIUsageConsumed: () => void;
  onArchiveGraph: (graphId: string) => Promise<void>;
  onCreateGraph: () => Promise<void>;
  onDeleteGraph: (graphId: string) => Promise<void>;
  onGraphPersisted: (graph: SavedGraph) => void;
  onSelectGraph: (graphId: string) => Promise<void>;
  onSignIn: () => void;
  onSignOut: () => void;
  onToggleFavoriteGraph: (graphId: string, value: boolean) => Promise<void>;
  onUpgradeClick: () => void;
  supporterRequest: SupporterRequest | null;
  workspaceGraphs: WorkspaceGraphSummary[];
  workspaceProfile: WorkspaceProfile | null;
  workspaceReady: boolean;
};

const PHASE_LABEL: Partial<Record<SequenceStage, string>> = {
  dusting: "아이디어 정리 중",
};

const TEMPLATES = ["브랜드 구조", "실행 계획", "프로젝트"] as const;

export function DavinciExperience({
  activeGraph,
  authReady,
  authUser,
  initialTopic,
  onAIUsageConsumed,
  onArchiveGraph,
  onCreateGraph,
  onDeleteGraph,
  onGraphPersisted,
  onSelectGraph,
  onSignIn,
  onSignOut,
  onToggleFavoriteGraph,
  onUpgradeClick,
  supporterRequest,
  workspaceGraphs,
  workspaceProfile,
  workspaceReady,
}: DavinciExperienceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [topic, setTopic] = useState(initialTopic);
  const [stage, setStage] = useState<SequenceStage>("idle");
  const [runKey, setRunKey] = useState(0);
  const [savedGraph, setSavedGraph] = useState<SavedGraph | null>(loadGuestGraph);
  const [initialSeed, setInitialSeed] = useState<GraphSeed | undefined>();
  const [initialMemo, setInitialMemo] = useState<string | undefined>();
  const [workspaceHomeOpen, setWorkspaceHomeOpen] = useState(false);

  const phaseLabel = useMemo(() => PHASE_LABEL[stage] ?? "", [stage]);
  const isGraph = stage === "graph";
  const isRunning = stage !== "idle" && !isGraph;
  const showRecovery = savedGraph !== null && !isGraph;

  const handleIntroComplete = useCallback(() => {
    setStage("graph");
  }, []);

  useEffect(() => {
    if (stage === "idle" && pageRef.current) {
      pageRef.current.style.visibility = "visible";
      pageRef.current.style.opacity = "1";
    }
  }, [stage]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTopic = topicInput.trim();

    if (!nextTopic || isRunning) {
      return;
    }

    if (pageRef.current) {
      pageRef.current.style.visibility = "visible";
      pageRef.current.style.opacity = "1";
    }

    startTransition(() => {
      setTopic(nextTopic);
      setRunKey((current) => current + 1);
      setStage("dusting");
    });
  };

  const handleRestart = () => {
    if (authUser) {
      setWorkspaceHomeOpen(true);
      return;
    }

    if (pageRef.current) {
      pageRef.current.style.visibility = "visible";
      pageRef.current.style.opacity = "1";
    }

    setInitialSeed(undefined);
    setInitialMemo(undefined);
    setStage("idle");
    setTopicInput(topic);
  };

  const handleWorkspaceResume = () => {
    setWorkspaceHomeOpen(false);
  };

  const handleWorkspaceCreateGraph = async () => {
    await onCreateGraph();
    setWorkspaceHomeOpen(false);
  };

  const handleResume = () => {
    if (!savedGraph) {
      return;
    }

    setSavedGraph(null);
    startTransition(() => {
      setTopic(savedGraph.topic);
      setTopicInput(savedGraph.topic);
      setInitialSeed(savedGraph.seed);
      setInitialMemo(savedGraph.memo);
      setStage("graph");
    });
  };

  const handleFreshStart = () => {
    clearGuestGraph();
    setSavedGraph(null);
  };

  const handleTemplateSelect = (template: string) => {
    if (isRunning) {
      return;
    }

    if (pageRef.current) {
      pageRef.current.style.visibility = "visible";
      pageRef.current.style.opacity = "1";
    }

    startTransition(() => {
      setTopicInput(template);
      setTopic(template);
      setRunKey((current) => current + 1);
      setStage("dusting");
    });
  };

  if (authUser) {
    return (
      <section className="relative h-screen w-screen overflow-hidden bg-[#faf8f3] text-[#1a1208]">
        {!workspaceReady || !activeGraph ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[12px] italic tracking-[0.24em] text-[#c4a882]">
              워크스페이스 불러오는 중
            </p>
          </div>
        ) : workspaceHomeOpen ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="w-full max-w-3xl text-center">
              <p className="mb-2 text-[11px] italic uppercase tracking-[0.42em] text-[#8b6c42]">
                Workspace Home
              </p>
              <div className="mx-auto mb-2 h-[46px] w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />
              <h1 className="font-display text-[clamp(3.6rem,9vw,5.6rem)] font-light leading-none tracking-[0.05em]">
                다빈치<em className="font-light italic text-[#8b6c42]">노트</em>
              </h1>
              <p className="mt-4 text-[14px] italic tracking-[0.16em] text-[#c4a882]">
                메인 화면입니다. 현재 노트를 이어가거나 새 노트를 시작하세요.
              </p>

              <div className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-[#e8d5b8] bg-[rgba(255,252,245,0.94)] px-7 py-7 text-left shadow-[0_18px_40px_rgba(61,43,18,0.08)]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b6c42]">
                  현재 노트
                </p>
                <p className="mt-2 truncate font-display text-[1.8rem] tracking-[0.03em] text-[#1a1208]">
                  {activeGraph.title}
                </p>
                <p className="mt-2 text-[12px] tracking-[0.08em] text-[#c4a882]">
                  총 {workspaceGraphs.length}개의 노트가 워크스페이스에 있습니다.
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={handleWorkspaceResume}
                    className="flex-1 rounded-full bg-[#8b6c42] px-5 py-3 text-[13px] italic tracking-[0.08em] text-[#faf8f3] transition-colors hover:bg-[#6b4f2f]"
                  >
                    현재 노트 계속하기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleWorkspaceCreateGraph()}
                    className="flex-1 rounded-full border border-[#c4a882] px-5 py-3 text-[13px] italic tracking-[0.08em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
                  >
                    새 노트 만들기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <IdeaSpace
            key={activeGraph.id}
            authReady={authReady}
            authUser={authUser}
            graphId={activeGraph.id}
            graphTitle={activeGraph.title}
            initialMemo={activeGraph.memo}
            initialSeed={activeGraph.seed}
            onAIUsageConsumed={onAIUsageConsumed}
            onArchiveGraph={onArchiveGraph}
            onCreateGraph={onCreateGraph}
            onDeleteGraph={onDeleteGraph}
            onGraphPersisted={onGraphPersisted}
            onRestart={handleRestart}
            onSelectGraph={onSelectGraph}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
            supporterRequest={supporterRequest}
            onToggleFavoriteGraph={onToggleFavoriteGraph}
            onUpgradeClick={onUpgradeClick}
            topic={activeGraph.topic}
            workspaceGraphs={workspaceGraphs}
            workspaceProfile={workspaceProfile}
          />
        )}
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      className="relative h-screen w-screen overflow-hidden bg-[#faf8f3] text-[#1a1208]"
    >
      <div className="absolute left-6 top-6 z-50">
        <AuthStatus
          authReady={authReady}
          authUser={authUser}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
        }}
      />

      {isGraph ? (
        <IdeaSpace
          key={`guest-${topic}`}
          authReady={authReady}
          graphId="guest"
          graphTitle={topic}
          initialMemo={initialMemo}
          initialSeed={initialSeed}
          onGraphPersisted={onGraphPersisted}
          onRestart={handleRestart}
          onSignIn={onSignIn}
          topic={topic}
        />
      ) : null}

      <div
        className={`absolute left-1/2 top-5 z-40 -translate-x-1/2 text-[11px] italic tracking-[0.22em] text-[#c4a882] transition-opacity duration-300 ${
          phaseLabel ? "opacity-100" : "opacity-0"
        }`}
      >
        {phaseLabel}
      </div>

      <div
        ref={pageRef}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
        style={
          isGraph
            ? {
                opacity: 0,
                pointerEvents: "none",
                visibility: "hidden",
              }
            : undefined
        }
      >
        <div className="w-full max-w-4xl">
          <p className="mb-2 text-[11px] italic uppercase tracking-[0.42em] text-[#8b6c42]">
            Leonardo / Da Vinci
          </p>

          <div className="mx-auto mb-2 h-[46px] w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />

          <h1 className="font-display text-[clamp(4rem,10vw,6.5rem)] font-light leading-none tracking-[0.05em]">
            다빈치<em className="font-light italic text-[#8b6c42]">노트</em>
          </h1>

          <p className="mt-4 text-[14px] italic tracking-[0.16em] text-[#c4a882]">
            생각의 입체를 찾는 곳
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-11 flex w-full max-w-[34rem] overflow-hidden border border-[#c4a882] bg-[rgba(255,252,245,0.92)]"
          >
            <input
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              maxLength={20}
              autoComplete="off"
              disabled={stage !== "idle"}
              placeholder="첫 번째 주제를 입력해 보세요"
              className="min-w-0 flex-1 bg-transparent px-5 py-[14px] text-[18px] font-light tracking-[0.05em] text-[#1a1208] outline-none placeholder:italic placeholder:text-[#d4b896] disabled:cursor-default"
            />

            <button
              type="submit"
              disabled={!topicInput.trim() || stage !== "idle"}
              className="border-l border-[#c4a882] bg-[#8b6c42] px-7 text-[14px] italic tracking-[0.08em] text-[#faf8f3] transition-colors duration-200 hover:bg-[#6b4f2f] disabled:cursor-default disabled:opacity-40"
            >
              시작하기
            </button>
          </form>

          <p className="mt-4 text-[11px] italic tracking-[0.2em] text-[#d4b896]">
            Enter로 바로 시작할 수 있어요
          </p>

          <div className="mt-6 flex justify-center gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                disabled={stage !== "idle"}
                onClick={() => handleTemplateSelect(template)}
                className="border border-[#e8d5b8] px-3.5 py-1.5 text-[11px] italic tracking-[0.12em] text-[#c4a882] transition-colors duration-200 hover:border-[#c4a882] hover:text-[#8b6c42] disabled:cursor-default disabled:opacity-40"
              >
                {template}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isRunning ? (
        <IntroParticles
          key={`${topic}-${runKey}`}
          rootRef={rootRef}
          pageRef={pageRef}
          topic={topic}
          onStageChange={setStage}
          onComplete={handleIntroComplete}
        />
      ) : null}

      {showRecovery && savedGraph && !isGraph ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(250,248,243,0.88)] backdrop-blur-sm">
          <div className="mx-6 w-full max-w-md border border-[#c4a882] bg-[#faf8f3] px-8 py-7 shadow-lg">
            <p className="mb-1 text-[11px] italic uppercase tracking-[0.3em] text-[#8b6c42]">
              이전 작업
            </p>
            <p className="mt-2 font-display text-[1.6rem] tracking-[0.04em] text-[#1a1208]">
              {savedGraph.topic}
            </p>
            <p className="mt-1 text-[11px] tracking-[0.1em] text-[#c4a882]">
              {new Date(savedGraph.savedAt).toLocaleString("ko-KR")} 저장
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleResume}
                className="flex-1 bg-[#8b6c42] py-3 text-[14px] italic tracking-[0.08em] text-[#faf8f3] transition-colors hover:bg-[#6b4f2f]"
              >
                이어하기
              </button>
              <button
                onClick={handleFreshStart}
                className="flex-1 border border-[#c4a882] py-3 text-[14px] italic tracking-[0.08em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
              >
                새로 시작
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
