import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "다빈치 노트",
    short_name: "다빈치노트",
    description: "3D 아이디어 그래프로 생각을 펼쳐보세요",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#8b6c42",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
