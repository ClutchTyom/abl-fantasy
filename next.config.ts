import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fs.mtgame.ru",
      },
    ],
  },
};

export default nextConfig;
