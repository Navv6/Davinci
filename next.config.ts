import type { NextConfig } from "next";

const isProd = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  ...(isProd && { output: "export", basePath: "/Davinci" }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
