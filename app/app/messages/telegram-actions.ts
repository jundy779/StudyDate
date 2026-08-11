"use server";

import { requireActiveStudentAppAccess } from "@/lib/account/guard";
import { conversationPublicIdSchema } from "@/lib/messages/validation";
import {
  cancelMyTelegramLink,
  confirmMyTelegramBinding,
  createMyTelegramLink,
  getMyTelegramCompanionState,
  switchMyTelegramRelay,
  unlinkMyTelegramCompanion,
} from "@/lib/telegram/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const linkSessionPublicIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

function validatePublicId(publicId: string) {
  const parsed = conversationPublicIdSchema.safeParse(publicId);
  if (!parsed.success) throw new Error("Percakapan tidak tersedia.");
  return parsed.data;
}

function validateLinkSessionPublicId(value: string) {
  const parsed = linkSessionPublicIdSchema.safeParse(value);
  if (!parsed.success) throw new Error("Koneksi Telegram tidak tersedia.");
  return parsed.data;
}

export async function createTelegramLinkAction(publicId: string) {
  await requireActiveStudentAppAccess();
  const validPublicId = validatePublicId(publicId);
  const link = await createMyTelegramLink(validPublicId);
  revalidatePath(`/app/messages/${validPublicId}`);
  return {
    ...link,
    state: await getMyTelegramCompanionState(validPublicId),
  };
}

export async function confirmTelegramBindingAction(
  publicId: string,
  linkSessionPublicId: string,
  confirmSwitch: boolean,
) {
  await requireActiveStudentAppAccess();
  const validPublicId = validatePublicId(publicId);
  await confirmMyTelegramBinding(
    validateLinkSessionPublicId(linkSessionPublicId),
    confirmSwitch === true,
  );
  revalidatePath(`/app/messages/${validPublicId}`);
  return getMyTelegramCompanionState(validPublicId);
}

export async function cancelTelegramLinkAction(
  publicId: string,
  linkSessionPublicId: string,
) {
  await requireActiveStudentAppAccess();
  const validPublicId = validatePublicId(publicId);
  await cancelMyTelegramLink(validateLinkSessionPublicId(linkSessionPublicId));
  revalidatePath(`/app/messages/${validPublicId}`);
  return getMyTelegramCompanionState(validPublicId);
}

export async function unlinkTelegramCompanionAction(publicId: string) {
  await requireActiveStudentAppAccess();
  const validPublicId = validatePublicId(publicId);
  await unlinkMyTelegramCompanion();
  revalidatePath(`/app/messages/${validPublicId}`);
  revalidatePath("/app/settings");
  return getMyTelegramCompanionState(validPublicId);
}

export async function switchTelegramRelayAction(publicId: string) {
  await requireActiveStudentAppAccess();
  const validPublicId = validatePublicId(publicId);
  await switchMyTelegramRelay(validPublicId);
  revalidatePath(`/app/messages/${validPublicId}`);
  return getMyTelegramCompanionState(validPublicId);
}
