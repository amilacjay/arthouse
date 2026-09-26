import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root; a stray lockfile in the home directory above
    // this project makes Turbopack guess wrong otherwise.
    root: __dirname,
  },
};

export default nextConfig;
