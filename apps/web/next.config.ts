import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ["192.168.1.183"],
  ...(isGitHubPages && {
    output: "export",
    basePath: "/rulebound",
    images: { unoptimized: true },
  }),
};

export default nextConfig;
