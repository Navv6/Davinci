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
import type { SequenceStage } from "@/types/davinci";

const IdeaSpace = dynamic(
  () =>
    import("@/components/desktop/IdeaSpace").then(
      (module) => module.IdeaSpace,
    ),
  { ssr: false },
);

type DavinciExperienceProps = {
  initialTopic: string;
};

const PHASE_LABEL: Partial<Record<SequenceStage, string>> = {
  dusting: "분해 중",
};

export function DavinciExperience({ initialTopic }: DavinciExperienceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [topic, setTopic] = useState(initialTopic);
  const [stage, setStage] = useState<SequenceStage>("idle");
  const [runKey, setRunKey] = useState(0);

  const phaseLabel = useMemo(() => PHASE_LABEL[stage] ?? "", [stage]);
  const isGraph = stage === "graph";
  const isRunning = stage !== "idle" && !isGraph;

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
    if (pageRef.current) {
      pageRef.current.style.visibility = "visible";
      pageRef.current.style.opacity = "1";
    }

    setStage("idle");
    setTopicInput(topic);
  };

  return (
    <section
      ref={rootRef}
      className="relative h-screen w-screen overflow-hidden bg-[#faf8f3] text-[#1a1208]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
        }}
      />

      {isGraph ? <IdeaSpace key={topic} topic={topic} onRestart={handleRestart} /> : null}

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
      >
        <div className="w-full max-w-4xl">
          <p
            id="el0"
            data-dust-id="brand"
            className="mb-2 text-[11px] italic uppercase tracking-[0.42em] text-[#8b6c42]"
          >
            Leonardo / Da Vinci
          </p>

          <div
            id="el1"
            data-dust-id="divider"
            className="mx-auto mb-2 h-[46px] w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent"
          />

          <h1
            id="el2"
            data-dust-id="title"
            className="font-display text-[clamp(4rem,10vw,6.5rem)] font-light leading-none tracking-[0.05em]"
          >
            다빈치 <em className="font-light italic text-[#8b6c42]">노트</em>
          </h1>

          <p
            id="el3"
            data-dust-id="tagline"
            className="mt-4 text-[14px] italic tracking-[0.16em] text-[#c4a882]"
          >
            생각의 형태를 찾는 곳
          </p>

          <form
            id="el4"
            data-dust-id="form"
            onSubmit={handleSubmit}
            className="mx-auto mt-11 flex w-full max-w-[34rem] overflow-hidden border border-[#c4a882] bg-[rgba(255,252,245,0.92)]"
          >
            <input
              id="pinp"
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              maxLength={20}
              autoComplete="off"
              disabled={stage !== "idle"}
              placeholder="첫 번째 주제를 입력해보세요"
              className="min-w-0 flex-1 bg-transparent px-5 py-[14px] text-[18px] font-light tracking-[0.05em] text-[#1a1208] outline-none placeholder:italic placeholder:text-[#d4b896] disabled:cursor-default"
            />

            <button
              id="pbtn"
              type="submit"
              disabled={!topicInput.trim() || stage !== "idle"}
              className="border-l border-[#c4a882] bg-[#8b6c42] px-7 text-[14px] italic tracking-[0.08em] text-[#faf8f3] transition-colors duration-200 hover:bg-[#6b4f2f] disabled:cursor-default disabled:opacity-40"
            >
              시작하기
            </button>
          </form>

          <p
            id="el5"
            data-dust-id="hint"
            className="mt-4 text-[11px] italic tracking-[0.2em] text-[#d4b896]"
          >
            Enter로 바로 시작할 수 있어요
          </p>
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
    </section>
  );
}
