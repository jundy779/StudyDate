import { createHash, createHmac, randomBytes } from "node:crypto";
import { EVENT_TICKET_PREFIX } from "./constants.ts";

export type EventTicketMaterial = {
  publicId: string;
  rawToken: string;
  tokenHash: string;
};

export function deriveEventTicketToken(secret: Buffer, publicId: string) {
  if (secret.length !== 32 || !/^[0-9a-f]{32}$/.test(publicId)) {
    throw new Error("Konfigurasi tiket Event tidak valid.");
  }
  return `${EVENT_TICKET_PREFIX}${createHmac("sha256", secret)
    .update(`studydate:event-ticket:v1:${publicId}`, "utf8")
    .digest("base64url")}`;
}

export function createEventTicketMaterial(
  secret: Buffer,
  publicId = randomBytes(16).toString("hex"),
): EventTicketMaterial {
  const rawToken = deriveEventTicketToken(secret, publicId);
  return {
    publicId,
    rawToken,
    tokenHash: createHash("sha256").update(rawToken, "utf8").digest("hex"),
  };
}
