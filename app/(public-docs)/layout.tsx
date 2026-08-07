import { PublicDocShell } from "@/components/marketing/public-doc-shell";

export default function PublicDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicDocShell>{children}</PublicDocShell>;
}
