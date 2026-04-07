"use client";

import { useState } from "react";
import { isPro } from "@/lib/aiUsage";
import type { SupporterRequest, WorkspaceProfile } from "@/lib/cloudStorage";

type SupporterRequestForm = {
  depositorName: string;
  memo: string;
  supportAmount: number;
  supporterName: string;
};

type SupporterRequestDialogProps = {
  authEmail?: string | null;
  onClose: () => void;
  onSubmit: (payload: SupporterRequestForm) => Promise<void>;
  open: boolean;
  profile: WorkspaceProfile | null;
  request: SupporterRequest | null;
  submitting: boolean;
};

const SUPPORT_BANK_NAME =
  process.env.NEXT_PUBLIC_SUPPORT_BANK_NAME ?? "은행명을 설정하세요";
const SUPPORT_ACCOUNT_NUMBER =
  process.env.NEXT_PUBLIC_SUPPORT_ACCOUNT_NUMBER ?? "계좌번호를 설정하세요";
const SUPPORT_ACCOUNT_HOLDER =
  process.env.NEXT_PUBLIC_SUPPORT_ACCOUNT_HOLDER ?? "예금주를 설정하세요";
const SUPPORT_CONTACT =
  process.env.NEXT_PUBLIC_SUPPORT_CONTACT ?? "support@davinci-note.com";

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "KRW",
  }).format(value);
}

function getStatusContent(
  profile: WorkspaceProfile | null,
  request: SupporterRequest | null,
) {
  if (request?.status === "pending") {
    return {
      description:
        "후원 신청이 접수되었습니다. 계좌이체 후 운영자가 입금명을 확인하면 Pro 체험을 열어드립니다.",
      tone: "info" as const,
      title: "후원 신청 접수됨",
    };
  }

  if (request?.status === "verified" || isPro(profile)) {
    return {
      description:
        "현재 Pro 권한이 활성화되어 있습니다. 연장 문의나 입금 확인 문의는 안내 메일로 남겨주세요.",
      tone: "success" as const,
      title: "Pro 상태 활성화됨",
    };
  }

  if (request?.status === "expired") {
    return {
      description:
        "이전 Pro 기간이 만료되었습니다. 다시 후원 신청을 남기면 운영자가 확인 후 재활성화합니다.",
      tone: "warning" as const,
      title: "Pro 기간 만료",
    };
  }

  if (request?.status === "rejected") {
    return {
      description:
        "이전 신청은 확인되지 않았습니다. 입금자명과 메모를 다시 적어 새 신청을 남겨주세요.",
      tone: "warning" as const,
      title: "후원 신청 재확인 필요",
    };
  }

  return {
    description:
      "웹에서는 결제를 직접 받지 않습니다. 후원 신청을 남긴 뒤 계좌이체를 완료하면 운영자가 수동으로 Pro 체험을 열어드립니다.",
    tone: "info" as const,
    title: "후원하고 Pro 체험하기",
  };
}

export function SupporterRequestDialog({
  authEmail,
  onClose,
  onSubmit,
  open,
  profile,
  request,
  submitting,
}: SupporterRequestDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <SupporterRequestDialogBody
      key={`${request?.id ?? "new"}:${request?.updated_at ?? "fresh"}:${profile?.user_id ?? "guest"}`}
      authEmail={authEmail}
      onClose={onClose}
      onSubmit={onSubmit}
      profile={profile}
      request={request}
      submitting={submitting}
    />
  );
}

function SupporterRequestDialogBody({
  authEmail,
  onClose,
  onSubmit,
  profile,
  request,
  submitting,
}: Omit<SupporterRequestDialogProps, "open">) {
  const [supporterName, setSupporterName] = useState(
    request?.supporter_name ?? "",
  );
  const [supportAmount, setSupportAmount] = useState(
    String(
      request?.support_amount && request.support_amount > 0
        ? request.support_amount
        : 9900,
    ),
  );
  const [depositorName, setDepositorName] = useState(
    request?.depositor_name ?? "",
  );
  const [memo, setMemo] = useState(request?.memo ?? "");

  const status = getStatusContent(profile, request);
  const canSubmit = request?.status !== "verified" && !isPro(profile);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(26,18,8,0.36)] px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#e8d5b8] bg-[#faf8f3] shadow-[0_30px_80px_rgba(61,43,18,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#ecdcc4] px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#8b6c42]">
              Supporter Flow
            </p>
            <h2 className="mt-2 font-display text-[1.7rem] tracking-[0.03em] text-[#1a1208]">
              {status.title}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 tracking-[0.02em] text-[#6b4f2a]">
              {status.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d9c4a4] px-3 py-1 text-[11px] tracking-[0.16em] text-[#8b6c42]"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.4rem] border border-[#ecdcc4] bg-white/60 px-5 py-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8b6c42]">
              신청 정보
            </p>

            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-[11px] tracking-[0.14em] text-[#8b6c42]">
                  후원자 이름
                </span>
                <input
                  value={supporterName}
                  onChange={(event) => setSupporterName(event.target.value)}
                  disabled={!canSubmit || submitting}
                  className="mt-1.5 w-full rounded-[1rem] border border-[#e8d5b8] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-[14px] text-[#1a1208] outline-none focus:border-[#8b6c42]"
                  placeholder="신청자 이름"
                />
              </label>

              <label className="block">
                <span className="text-[11px] tracking-[0.14em] text-[#8b6c42]">
                  로그인 이메일
                </span>
                <div className="mt-1.5 rounded-[1rem] border border-[#ecdcc4] bg-[rgba(250,248,243,0.88)] px-4 py-3 text-[14px] text-[#6b4f2a]">
                  {authEmail ?? "로그인 정보 없음"}
                </div>
              </label>

              <label className="block">
                <span className="text-[11px] tracking-[0.14em] text-[#8b6c42]">
                  후원 의향 금액
                </span>
                <input
                  value={supportAmount}
                  onChange={(event) =>
                    setSupportAmount(event.target.value.replace(/[^0-9]/g, ""))
                  }
                  disabled={!canSubmit || submitting}
                  className="mt-1.5 w-full rounded-[1rem] border border-[#e8d5b8] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-[14px] text-[#1a1208] outline-none focus:border-[#8b6c42]"
                  inputMode="numeric"
                  placeholder="9900"
                />
              </label>

              <label className="block">
                <span className="text-[11px] tracking-[0.14em] text-[#8b6c42]">
                  입금자명
                </span>
                <input
                  value={depositorName}
                  onChange={(event) => setDepositorName(event.target.value)}
                  disabled={!canSubmit || submitting}
                  className="mt-1.5 w-full rounded-[1rem] border border-[#e8d5b8] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-[14px] text-[#1a1208] outline-none focus:border-[#8b6c42]"
                  placeholder="실제 입금자명"
                />
              </label>

              <label className="block">
                <span className="text-[11px] tracking-[0.14em] text-[#8b6c42]">
                  메모
                </span>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  disabled={!canSubmit || submitting}
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-[1rem] border border-[#e8d5b8] bg-[rgba(255,255,255,0.8)] px-4 py-3 text-[14px] leading-6 text-[#1a1208] outline-none focus:border-[#8b6c42]"
                  placeholder="희망 시작일, 문의사항, 입금 예정 시간 등을 남겨주세요."
                />
              </label>
            </div>

            {canSubmit ? (
              <button
                type="button"
                disabled={
                  submitting ||
                  !supporterName.trim() ||
                  !depositorName.trim() ||
                  Number(supportAmount || "0") < 1000
                }
                onClick={() =>
                  void onSubmit({
                    depositorName,
                    memo,
                    supportAmount: Number(supportAmount || "0"),
                    supporterName,
                  })
                }
                className="mt-5 w-full rounded-full border border-[#8b6c42] bg-[#f5ede0] px-4 py-3 text-[12px] tracking-[0.18em] text-[#6b4f2a] transition-colors hover:bg-[#ecdcc4] disabled:opacity-50"
              >
                {submitting ? "신청 저장 중..." : request?.status === "pending" ? "신청 내용 수정하기" : "후원 신청 저장하기"}
              </button>
            ) : (
              <div className="mt-5 rounded-[1rem] border border-[#ecdcc4] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-[12px] leading-6 text-[#8b6c42]">
                현재 상태에서는 새 신청을 다시 저장할 필요가 없습니다. 문의가 있으면 아래 연락처로 남겨주세요.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div
              className={`rounded-[1.4rem] border px-5 py-5 ${
                status.tone === "success"
                  ? "border-[#c4a882] bg-[#f5ede0]"
                  : "border-[#ecdcc4] bg-white/60"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8b6c42]">
                입금 안내
              </p>
              <div className="mt-4 space-y-3 text-[13px] tracking-[0.03em] text-[#6b4f2a]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c4a882]">
                    은행
                  </p>
                  <p className="mt-1">{SUPPORT_BANK_NAME}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c4a882]">
                    계좌번호
                  </p>
                  <p className="mt-1">{SUPPORT_ACCOUNT_NUMBER}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c4a882]">
                    예금주
                  </p>
                  <p className="mt-1">{SUPPORT_ACCOUNT_HOLDER}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#c4a882]">
                    권장 금액
                  </p>
                  <p className="mt-1">
                    {formatKrw(Number(supportAmount || "9900") || 9900)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[#ecdcc4] bg-white/60 px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8b6c42]">
                운영 메모
              </p>
              <ul className="mt-4 space-y-2 text-[12px] leading-6 tracking-[0.02em] text-[#6b4f2a]">
                <li>입금 후 운영자가 `supporter_requests`를 확인해 수동으로 Pro를 부여합니다.</li>
                <li>입금자명과 신청서의 입금자명이 같아야 빠르게 확인됩니다.</li>
                <li>문의 메일: {SUPPORT_CONTACT}</li>
              </ul>
            </div>

            {request ? (
              <div className="rounded-[1.4rem] border border-[#ecdcc4] bg-white/60 px-5 py-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#8b6c42]">
                  최근 신청 상태
                </p>
                <div className="mt-4 space-y-2 text-[12px] leading-6 tracking-[0.02em] text-[#6b4f2a]">
                  <p>상태: {request.status}</p>
                  <p>신청일: {new Date(request.created_at).toLocaleString("ko-KR")}</p>
                  <p>입금자명: {request.depositor_name}</p>
                  <p>신청 금액: {formatKrw(request.support_amount)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
