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

export function createContentSecurityPolicy(nonce: string) {
  const supabaseOrigin = getSupabaseOrigin();
  const supabaseHttpSources = [
    "https://*.supabase.co",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://cdn.vercel-insights.com`,
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
}
