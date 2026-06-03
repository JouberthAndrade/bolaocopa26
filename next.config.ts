import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Bandeiras via flagcdn.com
      { protocol: "https", hostname: "flagcdn.com" },
      // Crests/escudos da Football-Data
      { protocol: "https", hostname: "crests.football-data.org" },
      // Avatares Google
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
