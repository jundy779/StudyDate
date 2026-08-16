import { PublicDocShell } from "@/components/marketing/public-doc-shell";
import { Analytics } from "@vercel/analytics/next";

export default function PublicDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicDocShell>{children}</PublicDocShell>
      <Analytics />
    </>
  );
}
