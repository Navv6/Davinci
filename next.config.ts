import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Davinci",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
