import Link from "next/link";

export const metadata = {
  title: "이용약관 | 다빈치노트",
};

const TERMS_TEXT = `[이용약관]

제1조 (목적)
본 약관은 모듀라(이하 "회사")가 제공하는 서비스의 이용 조건 및 절차를 규정합니다.

제2조 (서비스의 제공)
회사는 AI 기반 데이터 분석 및 정보 제공 서비스를 제공합니다.

제3조 (서비스 이용)
이용자는 본 약관에 동의함으로써 서비스를 이용할 수 있습니다.

제4조 (서비스 변경 및 중단)
회사는 서비스의 내용, 기능 등을 변경하거나 중단할 수 있습니다.

제5조 (이용자의 의무)
이용자는 서비스를 불법적인 목적으로 사용해서는 안 됩니다.

제6조 (AI 서비스의 특성 및 책임)
회사가 제공하는 AI 기반 정보 및 분석 결과는 참고용으로 제공되며,
그 정확성이나 완전성을 보장하지 않습니다.
이용자는 이를 기반으로 한 판단 및 의사결정에 대해 스스로 책임을 집니다.

제7조 (책임의 제한)
회사는 서비스 이용 과정에서 발생한 손해에 대해 책임을 지지 않습니다.
단, 회사의 고의 또는 중대한 과실이 있는 경우는 제외합니다.

제8조 (개인정보 보호)
회사는 관련 법령에 따라 이용자의 개인정보를 보호합니다.

제9조 (약관 변경)
회사는 필요 시 본 약관을 변경할 수 있으며, 변경 시 공지합니다.

부칙
본 약관은 2026년 4월 6일부터 시행됩니다.`;

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#1a1208]">
      <Link
        href="/"
        className="mb-10 block text-[11px] italic tracking-[0.2em] text-[#8b6c42] hover:underline"
      >
        ← 다빈치 노트로 돌아가기
      </Link>
      <h1 className="font-display text-[2.5rem] font-light tracking-[0.04em]">
        이용약관
      </h1>
      <pre className="mt-8 whitespace-pre-wrap text-[13px] leading-7 tracking-[0.02em] text-[#3d2b12]">
        {TERMS_TEXT}
      </pre>
    </main>
  );
}
