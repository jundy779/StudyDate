import { setEventFeatureSwitchAction } from "@/app/owner/events/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { HelpTip, Notice, Panel, StatusChip, staffButton } from "@/components/staff/ui";
import { Check, X } from "lucide-react";

export type EventFeatureReadiness = {
  switchesAvailable: boolean;
  blastOn: boolean;
  emailOn: boolean;
  blastPermitted: boolean;
  emailEnvPermitted: boolean;
  emailServiceReady: boolean;
  serviceRoleReady: boolean;
};

type Requirement = { label: string; ok: boolean };

function Requirements({ items }: { items: Requirement[] }) {
  return (
    <ul className="mt-3 grid gap-1.5 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2">
          {item.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#157F3B]" aria-hidden="true" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0 text-brand-error" aria-hidden="true" />
          )}
          <span className={item.ok ? "text-brand-muted" : "font-semibold text-brand-navy"}>
            {item.label}
            <span className="sr-only">{item.ok ? " (siap)" : " (belum siap)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function SwitchRow({
  featureKey,
  title,
  description,
  on,
  requirements,
  offWarning,
}: {
  featureKey: "event_blast_enabled" | "event_email_enabled";
  title: string;
  description: string;
  on: boolean;
  requirements: Requirement[];
  offWarning: string;
}) {
  const ready = requirements.every((item) => item.ok);
  // Saklar nyala tetapi syarat teknis hilang (misal env dimatikan): fitur sebenarnya mati.
  const effectiveOn = on && ready;
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-lg font-semibold text-brand-navy">{title}</h3>
          <StatusChip tone={effectiveOn ? "go" : on ? "warn" : "muted"}>
            {effectiveOn ? "Aktif" : on ? "Menyala, tapi belum siap" : "Mati"}
          </StatusChip>
        </div>
        <p className="mt-1 text-sm leading-6 text-brand-muted">{description}</p>
        <Requirements items={requirements} />
      </div>
      <form action={setEventFeatureSwitchAction} className="flex flex-wrap gap-2 lg:justify-end">
        <input type="hidden" name="key" value={featureKey} />
        {on ? (
          <ConfirmSubmitButton
            triggerLabel="Matikan"
            title={`Matikan ${title.toLowerCase()}?`}
            description={offWarning}
            confirmLabel="Ya, matikan"
            name="enabled"
            value="false"
            className={staffButton.dangerQuiet}
          />
        ) : (
          <button
            name="enabled"
            value="true"
            disabled={!ready}
            className={`${staffButton.primary} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Nyalakan
          </button>
        )}
      </form>
    </li>
  );
}

export function OwnerEventFeatureSwitches({ readiness }: { readiness: EventFeatureReadiness }) {
  const r = readiness;
  const blastRequirements: Requirement[] = [
    { label: "Database sudah diperbarui (migration 202610300002)", ok: r.switchesAvailable },
    { label: "Izin teknis EVENT_BLAST_ENABLED di Vercel", ok: r.blastPermitted },
  ];
  const emailRequirements: Requirement[] = [
    { label: "Pengumuman ke peserta sudah aktif", ok: r.switchesAvailable && r.blastPermitted && r.blastOn },
    { label: "Izin teknis EVENT_EMAIL_ENABLED di Vercel", ok: r.emailEnvPermitted },
    { label: "Layanan email StudyDate (Resend atau SMTP) terpasang", ok: r.emailServiceReady },
    { label: "Kunci server Supabase (service role) terpasang", ok: r.serviceRoleReady },
  ];

  return (
    <Panel
      id="fitur-acara"
      title="Fitur pengumuman acara"
      description="Nyalakan atau matikan kapan saja. Tombol Nyalakan baru bisa dipakai kalau semua syarat di bawahnya sudah tercentang. Setiap perubahan tercatat di Riwayat."
    >
      {!r.switchesAvailable ? (
        <Notice tone="warn">
          Saklar ini butuh pembaruan database dulu. Sampai itu terpasang, kedua fitur dianggap mati.
        </Notice>
      ) : null}
      <ul className="divide-y divide-brand-border">
        <SwitchRow
          featureKey="event_blast_enabled"
          title="Pengumuman ke peserta"
          description="Penyelenggara bisa mengirim kabar ke peserta yang sudah diterima, muncul sebagai notifikasi di aplikasi. Maksimal 5 per hari per penyelenggara."
          on={r.blastOn}
          requirements={blastRequirements}
          offWarning="Form pengumuman hilang dari halaman kelola acara. Email pengumuman ikut dimatikan. Pengumuman lama tetap tersimpan."
        />
        <SwitchRow
          featureKey="event_email_enabled"
          title="Email pengumuman"
          description="Penyelenggara bisa mencentang Kirim juga lewat email. Maksimal 2 per hari, alamat peserta tidak pernah terlihat penyelenggara, dan peserta bisa berhenti kapan saja."
          on={r.emailOn}
          requirements={emailRequirements}
          offWarning="Pengumuman tetap jalan di aplikasi, tapi tidak lagi dikirim lewat email."
        />
      </ul>
      <div className="mt-2">
        <HelpTip label="Kenapa masih ada syarat di Vercel?">
          Pengaturan di Vercel adalah izin teknis yang diisi sekali saat semuanya siap, sekaligus pemutus darurat
          kalau ada masalah. Saklar di halaman ini yang dipakai untuk menyalakan dan mematikan sehari-hari.
        </HelpTip>
      </div>
    </Panel>
  );
}
