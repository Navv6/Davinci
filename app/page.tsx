"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DesktopExperience = dynamic(
  () =>
    import("@/components/desktop/DavinciExperience").then(
      (m) => m.DavinciExperience,
    ),
  { ssr: false },
);

const MobileExperience = dynamic(
  () =>
    import("@/components/mobile/DavinciExperience").then(
      (m) => m.DavinciExperience,
    ),
  { ssr: false },
);

export default function Home() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile === null) {
    return <main className="h-screen w-screen bg-[#faf8f3]" />;
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#faf8f3]">
      {isMobile ? (
        <MobileExperience initialTopic="" />
      ) : (
        <DesktopExperience initialTopic="" />
      )}
    </main>
  );
}
