import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

function getSupabaseOrigin() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return null;

  try {
    const origin = new URL(value).origin;
    return origin.startsWith("https://") ? origin : null;
  } catch {
    return null;
  }
}

const supabaseOrigin = getSupabaseOrigin();
const supabaseHttpSources = [
  "https://*.supabase.co",
  ...(supabaseOrigin ? [supabaseOrigin] : []),
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    isDevelopment ? " 'unsafe-eval'" : ""
  } https://va.vercel-scripts.com https://cdn.vercel-insights.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseHttpSources}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttpSources} wss://*.supabase.co https://vitals.vercel-insights.com`,
  `media-src 'self' blob: ${supabaseHttpSources}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders: Array<{ key: string; value: string }> = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
