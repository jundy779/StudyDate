"use client";

import { createClient } from "@/lib/supabase/client";

/** Nama event jendela yang dipakai komponen lain untuk mendengar sinyal pribadi. */
export const STUDYDATE_SIGNAL_EVENT = "studydate:signal";

export type StudyDateSignal = { type: string };

type Options = {
  topic: string;
  events: string[];
  onSignal: (event: string, payload: Record<string, unknown>) => void;
  onStatus?: (connected: boolean) => void;
};

/**
 * Berlangganan channel Broadcast privat. Izin masuk dicek database lewat RLS
 * realtime.messages, dan isi sinyal tidak pernah memuat data pribadi.
 * Mengembalikan fungsi untuk berhenti berlangganan.
 */
export function subscribePrivateChannel({ topic, events, onSignal, onStatus }: Options) {
  const client = createClient();
  let cancelled = false;
  let channel = client.channel(topic, {
    config: { private: true, broadcast: { self: false, ack: false } },
  });
  for (const event of events) {
    channel = channel.on("broadcast", { event }, ({ payload }) => {
      if (!cancelled) onSignal(event, (payload ?? {}) as Record<string, unknown>);
    });
  }

  void client.realtime
    .setAuth()
    .then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (!cancelled) onStatus?.(status === "SUBSCRIBED");
      });
    })
    .catch(() => {
      if (!cancelled) onStatus?.(false);
    });

  return () => {
    cancelled = true;
    void client.removeChannel(channel);
  };
}

let topicPromise: Promise<string | null> | null = null;

/** Topik pribadi pengguna (kunci acak, bukan ID akun). null kalau fitur belum terpasang. */
export function getMyRealtimeTopic() {
  if (!topicPromise) {
    topicPromise = (async () => {
      try {
        const { data, error } = await createClient().rpc("get_my_realtime_topic");
        if (error || typeof data !== "string" || !/^user:[0-9a-f]{32}$/.test(data)) return null;
        return data;
      } catch {
        return null;
      }
    })();
    // Gagal tidak disimpan, supaya bisa dicoba lagi di halaman berikutnya.
    void topicPromise.then((topic) => {
      if (!topic) topicPromise = null;
    });
  }
  return topicPromise;
}
