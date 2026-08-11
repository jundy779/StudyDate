import { notFound } from "next/navigation";
import type { TelegramSafeState } from "@/lib/telegram/constants";
import { TelegramCompanionPanel } from "@/components/messages/telegram-companion-panel";

const states: TelegramSafeState["state"][] = [
  "unavailable",
  "not_connected",
  "link_created",
  "telegram_pending",
  "connected",
  "switch_required",
];

async function TelegramCompanionAuditContent({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const requested = (await searchParams).state;
  const state = states.includes(requested as TelegramSafeState["state"])
    ? (requested as TelegramSafeState["state"])
    : "not_connected";

  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-[22px] border border-brand-border bg-white p-5 sm:p-7">
        <p className="section-label">Local UI audit</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold text-brand-navy">
          Anonymous Chat
        </h1>
        <div className="mt-6">
          <TelegramCompanionPanel
            publicId={"0".repeat(32)}
            initialState={{
              state,
              linkSessionPublicId:
                state === "link_created" || state === "telegram_pending"
                  ? "1".repeat(32)
                  : null,
              expiresAt: "2099-01-01T00:10:00.000Z",
              connected: state === "connected" || state === "switch_required",
              activeOnThisConversation: state === "connected",
              activeOnAnotherConversation: state === "switch_required",
            }}
          />
        </div>
      </div>
    </main>
  );
}

export default function TelegramCompanionAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  return <TelegramCompanionAuditContent searchParams={searchParams} />;
}

export const instant = false;
