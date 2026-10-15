import type { NextConfig } from "next";

const securityHeaders: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  });
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
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
