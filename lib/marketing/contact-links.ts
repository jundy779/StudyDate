import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CONTACT_LINK_KINDS,
  type ContactLink,
  type ContactLinkKind,
} from "@/lib/marketing/contact-links-config";

function isKind(value: string): value is ContactLinkKind {
  return (CONTACT_LINK_KINDS as readonly string[]).includes(value);
}

function sortLinks<T extends { kind: ContactLinkKind }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => CONTACT_LINK_KINDS.indexOf(a.kind) - CONTACT_LINK_KINDS.indexOf(b.kind),
  );
}

/** Tautan resmi yang aktif, untuk footer publik. Kosong bila belum diisi. */
export async function getPublicContactLinks(): Promise<ContactLink[]> {
  const admin = createServerAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("public_contact_links")
    .select("kind, url")
    .eq("is_visible", true);
  if (error || !data) return [];
  return sortLinks(
    data.filter((row): row is ContactLink => isKind(row.kind) && typeof row.url === "string"),
  );
}

export type OwnerContactLink = {
  kind: ContactLinkKind;
  url: string;
  isVisible: boolean;
  updatedAt: string | null;
};

/** null berarti migration 202610200002 belum terpasang. */
export async function ownerListContactLinks(): Promise<OwnerContactLink[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_list_contact_links");
  if (error) return null;
  return sortLinks(
    ((data ?? []) as { kind: string; url: string; is_visible: boolean; updated_at: string }[])
      .filter((row) => isKind(row.kind))
      .map((row) => ({
        kind: row.kind as ContactLinkKind,
        url: row.url,
        isVisible: row.is_visible,
        updatedAt: row.updated_at,
      })),
  );
}

export async function ownerSaveContactLink(kind: ContactLinkKind, url: string, isVisible: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_save_contact_link", {
    p_kind: kind,
    p_url: url,
    p_is_visible: isVisible,
  });
  return !error;
}
