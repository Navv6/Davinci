"use client";

import dynamic from "next/dynamic";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SequenceStage } from "@/types/davinci";

const MobileIdeaSpace = dynamic(
  () =>
    import("@/components/mobile/IdeaSpace").then((m) => m.MobileIdeaSpace),
  { ssr: false },
);

type DavinciExperienceProps = {
  initialTopic: string;
};

export function DavinciExperience({ initialTopic }: DavinciExperienceProps) {
  const [topicInput, setTopicInput] = useState(initialTopic);
  const [topic, setTopic] = useState(initialTopic);
  const [stage, setStage] = useState<SequenceStage>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const isGraph = stage === "graph";

  useEffect(() => {
    if (stage === "idle") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stage]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTopic = topicInput.trim();
    if (!nextTopic || stage !== "idle") return;

    startTransition(() => {
      setTopic(nextTopic);
      setStage("graph");
    });
  };

  const handleRestart = useCallback(() => {
    setStage("idle");
    setTopicInput(topic);
  }, [topic]);

  if (isGraph) {
    return <MobileIdeaSpace topic={topic} onRestart={handleRestart} />;
  }

  return (
    <section className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#faf8f3] px-6 text-[#1a1208]">
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
          다빈치{" "}
          <em className="font-light italic text-[#8b6c42]">노트</em>
        </h1>

        <p className="mt-4 text-[13px] italic tracking-[0.16em] text-[#c4a882]">
          생각의 형태를 찾는 곳
        </p>

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
            placeholder="첫 번째 주제를 입력해보세요"
            className="w-full border border-[#c4a882] bg-[rgba(255,252,245,0.92)] px-5 py-4 text-[17px] font-light tracking-[0.04em] text-[#1a1208] outline-none placeholder:italic placeholder:text-[#d4b896]"
          />

          <button
            type="submit"
            disabled={!topicInput.trim()}
            className="w-full bg-[#8b6c42] py-4 text-[15px] italic tracking-[0.1em] text-[#faf8f3] transition-colors duration-200 active:bg-[#6b4f2f] disabled:opacity-40"
          >
            시작하기
          </button>
        </form>
      </div>
    </section>
  );
}
