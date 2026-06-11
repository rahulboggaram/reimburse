import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore stray lockfiles in parent folders (e.g. ~/package-lock.json).
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
