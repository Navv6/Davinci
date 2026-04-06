import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_KR } from "next/font/google";
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
  title: "Davinci Note",
  description:
    "Dusting intro, reform sequence, and white 3D idea graph for Davinci Note.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        {children}
        <footer className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 flex justify-center gap-6 pb-3 text-[10px] italic tracking-[0.16em] text-[#c4a882]">
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
        </footer>
      </body>
    </html>
  );
}
