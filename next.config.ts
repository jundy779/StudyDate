import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
