"use client";

import type { AuthUser } from "@/lib/auth";

type AuthStatusProps = {
  authReady: boolean;
  authUser: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
};

export function AuthStatus({
  authReady,
  authUser,
  onSignIn,
  onSignOut,
}: AuthStatusProps) {
  if (!authReady) {
    return (
      <div className="rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.94)] px-4 py-2 text-[11px] tracking-[0.12em] text-[#c4a882] shadow-[0_10px_24px_rgba(61,43,18,0.06)]">
        계정 확인 중
      </div>
    );
  }

  if (!authUser) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-full border border-[#c4a882] bg-[rgba(250,248,243,0.96)] px-4 py-2 text-[11px] tracking-[0.14em] text-[#8b6c42] shadow-[0_10px_24px_rgba(61,43,18,0.06)] transition-colors duration-200 hover:border-[#8b6c42] hover:text-[#3d2b12]"
      >
        Google 로그인
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#e8d5b8] bg-[rgba(250,248,243,0.96)] px-3 py-2 shadow-[0_10px_24px_rgba(61,43,18,0.06)]">
      <span className="max-w-[12rem] truncate text-[11px] tracking-[0.12em] text-[#8b6c42]">
        {authUser.email ?? "Google 연결됨"}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-full border border-[#e8d5b8] px-2.5 py-1 text-[10px] tracking-[0.12em] text-[#c4a882] transition-colors duration-200 hover:border-[#8b6c42] hover:text-[#8b6c42]"
      >
        로그아웃
      </button>
    </div>
  );
}
