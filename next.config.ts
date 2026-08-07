import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return [
      { source: "/privasi", destination: "/privacy", permanent: true },
      { source: "/ketentuan", destination: "/terms", permanent: true },
      {
        source: "/pedoman-komunitas",
        destination: "/community-guidelines",
        permanent: true,
      },
      { source: "/bantuan", destination: "/help", permanent: true },
      { source: "/keamanan", destination: "/safety", permanent: true },
    ];
  },
};

export default nextConfig;
