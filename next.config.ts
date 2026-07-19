import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.FLASHBETS_NEXT_DIST_DIR?.trim() || ".next",
  transpilePackages: [
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-solflare",
    "@solana/wallet-adapter-base",
  ],
};

export default nextConfig;
