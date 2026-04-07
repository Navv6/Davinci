import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_KR } from "next/font/google";
import { PostHogInit } from "@/components/shared/PostHogInit";
import "./globals.css";

const bodyFont = Noto_Serif_KR({
  variable: "--font-serif-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const displayFont = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "다빈치 노트 — 생각의 형태를 찾는 곳",
  description:
    "3D 아이디어 그래프로 생각을 펼쳐보세요. AI가 아이디어를 확장해 드립니다.",
  openGraph: {
    title: "다빈치 노트",
    description: "3D 아이디어 그래프로 생각을 펼쳐보세요.",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "다빈치 노트",
    description: "3D 아이디어 그래프로 생각을 펼쳐보세요.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
      style={
        {
          "--font-body-family": bodyFont.style.fontFamily,
          "--font-display-family": displayFont.style.fontFamily,
        } as CSSProperties
      }
    >
      <body className="flex min-h-full flex-col">
        <PostHogInit />
        {children}
        <footer
          className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 flex justify-center gap-6 text-[10px] italic tracking-[0.16em] text-[#c4a882]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <a
            href="/privacy"
            className="pointer-events-auto transition-colors hover:text-[#8b6c42]"
          >
            개인정보처리방침
          </a>
          <a
            href="/terms"
            className="pointer-events-auto transition-colors hover:text-[#8b6c42]"
          >
            이용약관
          </a>
          <a
            href="mailto:bwme43@gmail.com"
            className="pointer-events-auto transition-colors hover:text-[#8b6c42]"
          >
            문의
          </a>
        </footer>
      </body>
    </html>
  );
}
