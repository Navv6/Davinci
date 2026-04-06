"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#faf8f3] px-6 text-center text-[#1a1208]">
      <div className="mx-auto h-10 w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />
      <h1 className="font-display text-[2.5rem] font-light tracking-[0.04em]">
        오류가 발생했습니다
      </h1>
      <p className="text-[13px] italic tracking-[0.1em] text-[#8b6c42]">
        {error.message || "알 수 없는 오류입니다"}
      </p>
      <button
        onClick={reset}
        className="mt-2 border border-[#c4a882] px-8 py-3 text-[13px] italic tracking-[0.1em] text-[#8b6c42] transition-colors hover:bg-[#8b6c42] hover:text-[#faf8f3]"
      >
        다시 시도
      </button>
    </main>
  );
}
