"use client";

import {
  PrivacyFieldGrid,
  type PrivacyField,
} from "@/components/people/privacy-field-grid";
import type {
  ContactRevealChannel,
  ContactRevealCompletedChannel,
  ContactRevealState,
} from "@/lib/contact-reveal/constants";
import type { IdentityRevealCompleted } from "@/lib/identity-reveal/constants";

type CounterpartPrivacyCardProps = {
  mutual: boolean;
  identityCompleted: IdentityRevealCompleted | null;
  contactReveal: ContactRevealState;
  contactCompleted: Partial<
    Record<ContactRevealChannel, ContactRevealCompletedChannel | null>
  >;
};

export function CounterpartPrivacyCard({
  mutual,
  identityCompleted,
  contactReveal,
  contactCompleted,
}: CounterpartPrivacyCardProps) {
  if (!mutual) {
    return (
      <section className="rounded-[22px] border border-brand-border bg-white p-4 sm:p-5">
        <h2 className="font-heading text-lg font-semibold text-brand-navy">
          Identitas & kontak
        </h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Kalian belum sama-sama tertarik untuk kenal lebih jauh. Nama,
          LinkedIn, dan Instagram masih terkunci. NIM tidak pernah dibagikan.
        </p>
        <div className="mt-4">
          <PrivacyFieldGrid
            fields={[
              {
                id: "name",
                label: "Nama depan",
                state: "locked",
                lockedHint: "Terkunci sampai kalian setuju berbagi nama dan foto",
              },
              {
                id: "linkedin",
                label: "LinkedIn",
                state: "locked",
                lockedHint: "Terkunci sampai kalian setuju berbagi LinkedIn",
              },
              {
                id: "instagram",
                label: "Instagram",
                state: "locked",
                lockedHint: "Terkunci sampai kalian setuju berbagi Instagram",
              },
              { id: "nim", label: "NIM", state: "never" },
            ]}
          />
        </div>
      </section>
    );
  }

  const linkedinCompleted = Boolean(
    contactReveal.channels.find((c) => c.channel === "linkedin")?.completed,
  );
  const instagramCompleted = Boolean(
    contactReveal.channels.find((c) => c.channel === "instagram")?.completed,
  );
  const nameUnlocked = Boolean(identityCompleted?.completed);
  const linkedinValue =
    contactCompleted.linkedin?.counterpartDisplay ??
    contactCompleted.linkedin?.counterpartHref ??
    null;
  const instagramValue =
    contactCompleted.instagram?.counterpartDisplay ?? null;

  const fields: PrivacyField[] = [
    {
      id: "name",
      label: "Nama depan",
      state: nameUnlocked ? "unlocked" : "locked",
      value: identityCompleted?.counterpartFirstName,
      lockedHint: "Kalian berdua perlu setuju berbagi nama dan foto",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      state: linkedinCompleted ? "unlocked" : "locked",
      value: linkedinValue,
      lockedHint: "Kalian berdua perlu setuju berbagi LinkedIn",
    },
    {
      id: "instagram",
      label: "Instagram",
      state: instagramCompleted ? "unlocked" : "locked",
      value: instagramValue,
      lockedHint: "Kalian berdua perlu setuju berbagi Instagram",
    },
    { id: "nim", label: "NIM", state: "never" },
  ];

  return (
    <section className="rounded-[22px] border border-brand-border bg-white p-4 sm:p-5">
      <h2 className="font-heading text-lg font-semibold text-brand-navy">
        Identitas & kontak
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        Kalian sama-sama ingin kenal lebih jauh. Nama, foto, LinkedIn, dan
        Instagram hanya terbuka jika kalian berdua menyetujuinya.
      </p>
      <div className="mt-4">
        <PrivacyFieldGrid fields={fields} />
      </div>
    </section>
  );
}
