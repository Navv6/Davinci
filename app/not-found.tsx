import Link from "next/link";

export const metadata = {
  title: "페이지를 찾을 수 없습니다 | 다빈치 노트",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f3] px-6 text-center text-[#1a1208]">
      <p className="text-[11px] italic uppercase tracking-[0.42em] text-[#8b6c42]">
        404
      </p>

      <div className="mx-auto my-4 h-10 w-px bg-gradient-to-b from-transparent via-[#c4a882] to-transparent" />

      <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] font-light tracking-[0.04em]">
        페이지를 찾을 수 없습니다
      </h1>

      <p className="mt-4 text-[13px] italic tracking-[0.14em] text-[#c4a882]">
        요청하신 페이지가 존재하지 않거나 이동되었습니다
      </p>

      <Link
        href="/"
        className="mt-10 border border-[#c4a882] px-8 py-3 text-[13px] italic tracking-[0.12em] text-[#8b6c42] transition-colors hover:bg-[#f0ebe2]"
      >
        다빈치 노트로 돌아가기
      </Link>
    </main>
  );
}
