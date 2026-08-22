import "server-only";

import {
  createEventTicketMaterial,
  deriveEventTicketToken,
} from "@/lib/events/ticket-crypto-core";

function parseEventTicketSecret(value = process.env.EVENT_TICKET_SECRET) {
  if (!value) throw new Error("Konfigurasi tiket Event belum tersedia.");
  const secret = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (secret.length !== 32) {
    throw new Error("Konfigurasi tiket Event tidak valid.");
  }
  return secret;
}

export function createServerEventTicketMaterial(publicId?: string) {
  return createEventTicketMaterial(parseEventTicketSecret(), publicId);
}

export function deriveServerEventTicketToken(publicId: string) {
  return deriveEventTicketToken(parseEventTicketSecret(), publicId);
}
