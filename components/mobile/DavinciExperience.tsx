"use client";

import dynamic from "next/dynamic";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

const MobileIdeaSpace = dynamic(
  () =>
    import("@/components/mobile/IdeaSpace").then((m) => m.MobileIdeaSpace),
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

const TEMPLATES = ["브랜드 구조", "실행 계획", "프로젝트"] as const;

export function DavinciExperience({
  activeGraph,
  authReady,
  authUser,
  initialTopic,
  onAIUsageConsumed,
  onArchiveGraph,
  onCreateGraph,
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
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [topic, setTopic] = useState(initialTopic);
  const [stage, setStage] = useState<SequenceStage>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const [savedGraph, setSavedGraph] = useState<SavedGraph | null>(loadGuestGraph);
  const [initialSeed, setInitialSeed] = useState<GraphSeed | undefined>();
  const [initialMemo, setInitialMemo] = useState<string | undefined>();
  const [workspaceHomeOpen, setWorkspaceHomeOpen] = useState(false);

  const isGraph = stage === "graph";
  const showRecovery = savedGraph !== null && !isGraph;

  useEffect(() => {
    if (stage === "idle") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stage]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTopic = topicInput.trim();

    if (!nextTopic || stage !== "idle") {
      return;
    }

    startTransition(() => {
      setTopic(nextTopic);
      setStage("graph");
    });
  };

  const handleRestart = useCallback(() => {
    if (authUser) {
      setWorkspaceHomeOpen(true);
      return;
    }

    setInitialSeed(undefined);
    setInitialMemo(undefined);
    setStage("idle");
    setTopicInput(topic);
  }, [authUser, topic]);

  const handleWorkspaceResume = useCallback(() => {
    setWorkspaceHomeOpen(false);
  }, []);

  const handleWorkspaceCreateGraph = useCallback(async () => {
    await onCreateGraph();
    setWorkspaceHomeOpen(false);
  }, [onCreateGraph]);

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
    if (stage !== "idle") {
      return;
    }

    startTransition(() => {
      setTopicInput(template);
      setTopic(template);
      setStage("graph");
    });
  };

  if (authUser) {
    return (
      <section className="relative h-screen w-screen overflow-hidden bg-[#faf8f3]">
        {!workspaceReady || !activeGraph ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[12px] italic tracking-[0.2em] text-[#c4a882]">
              워크스페이스 불러오는 중
            </p>
          </div>
        ) : workspaceHomeOpen ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="w-full max-w-sm text-center">
              <p className="mb-3 text-[10px] italic uppercase tracking-[0.42em] text-[#8b6c42]">
                Workspace Home
              </p>
              <div className="mx-auto mb-3 h-10 w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />
              <h1 className="font-display text-[3.4rem] font-light leading-none tracking-[0.05em] text-[#1a1208]">
                다빈치<em className="font-light italic text-[#8b6c42]">노트</em>
              </h1>
              <p className="mt-4 text-[13px] italic tracking-[0.16em] text-[#c4a882]">
                메인 화면입니다. 현재 노트를 이어가거나 새 노트를 시작하세요.
              </p>

              <div className="mt-8 rounded-[1.7rem] border border-[#e8d5b8] bg-[rgba(255,252,245,0.94)] px-5 py-5 text-left shadow-[0_16px_34px_rgba(61,43,18,0.08)]">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#8b6c42]">
                  현재 노트
                </p>
                <p className="mt-2 truncate font-display text-[1.5rem] tracking-[0.03em] text-[#1a1208]">
                  {activeGraph.title}
                </p>
                <p className="mt-2 text-[11px] tracking-[0.08em] text-[#c4a882]">
                  총 {workspaceGraphs.length}개의 노트가 있습니다.
                </p>

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleWorkspaceResume}
                    className="w-full rounded-full bg-[#8b6c42] px-5 py-3 text-[13px] italic tracking-[0.08em] text-[#faf8f3]"
                  >
                    현재 노트 계속하기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleWorkspaceCreateGraph()}
                    className="w-full rounded-full border border-[#c4a882] px-5 py-3 text-[13px] italic tracking-[0.08em] text-[#8b6c42]"
                  >
                    새 노트 만들기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <MobileIdeaSpace
            authReady={authReady}
            authUser={authUser}
            graphId={activeGraph.id}
            graphTitle={activeGraph.title}
            initialMemo={activeGraph.memo}
            initialSeed={activeGraph.seed}
            onAIUsageConsumed={onAIUsageConsumed}
            onArchiveGraph={onArchiveGraph}
            onCreateGraph={onCreateGraph}
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

  if (isGraph) {
    return (
      <section className="relative h-screen w-screen overflow-hidden bg-[#faf8f3]">
        <MobileIdeaSpace
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
      </section>
    );
  }

  return (
    <section className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#faf8f3] px-6 text-[#1a1208]">
      <div className="absolute left-4 top-4 z-30">
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

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <p className="mb-3 text-[10px] italic uppercase tracking-[0.42em] text-[#8b6c42]">
          Leonardo / Da Vinci
        </p>

        <div className="mx-auto mb-3 h-10 w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />

        <h1 className="font-display text-[3.6rem] font-light leading-none tracking-[0.05em]">
          다빈치<em className="font-light italic text-[#8b6c42]">노트</em>
        </h1>

        <p className="mt-4 text-[13px] italic tracking-[0.16em] text-[#c4a882]">
          생각의 입체를 찾는 곳
        </p>

        {showRecovery && savedGraph ? (
          <div className="mt-8 w-full border border-[#c4a882] bg-[rgba(255,252,245,0.95)] px-5 py-5">
            <p className="text-[10px] italic uppercase tracking-[0.3em] text-[#8b6c42]">
              이전 작업
            </p>
            <p className="mt-2 font-display text-[1.3rem] tracking-[0.04em] text-[#1a1208]">
              {savedGraph.topic}
            </p>
            <p className="mt-1 text-[10px] tracking-[0.08em] text-[#c4a882]">
              {new Date(savedGraph.savedAt).toLocaleString("ko-KR")} 저장
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleResume}
                className="flex-1 bg-[#8b6c42] py-3 text-[13px] italic tracking-[0.08em] text-[#faf8f3]"
              >
                이어하기
              </button>
              <button
                onClick={handleFreshStart}
                className="flex-1 border border-[#c4a882] py-3 text-[13px] italic tracking-[0.08em] text-[#8b6c42]"
              >
                새로 시작
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 flex w-full flex-col gap-3"
          >
            <input
              ref={inputRef}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              maxLength={20}
              autoComplete="off"
              placeholder="첫 번째 주제를 입력해 보세요"
              className="w-full border border-[#c4a882] bg-[rgba(255,252,245,0.92)] px-5 py-4 text-[17px] font-light tracking-[0.04em] text-[#1a1208] outline-none placeholder:italic placeholder:text-[#d4b896]"
            />

            <button
              type="submit"
              disabled={!topicInput.trim()}
              className="w-full bg-[#8b6c42] py-4 text-[15px] italic tracking-[0.1em] text-[#faf8f3] transition-colors duration-200 active:bg-[#6b4f2f] disabled:opacity-40"
            >
              시작하기
            </button>

            <div className="flex justify-center gap-2 pt-1">
              {TEMPLATES.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className="border border-[#e8d5b8] px-3 py-1.5 text-[11px] italic tracking-[0.1em] text-[#c4a882] active:text-[#8b6c42]"
                >
                  {template}
                </button>
              ))}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
