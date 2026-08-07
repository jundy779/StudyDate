"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  CHAT_CONTACT_MESSAGE,
  GENERIC_CHAT_ERROR,
} from "@/lib/messages/constants";
import {
  endConversation,
  markConversationMessagesRead,
  reportConversation,
  sendAnonymousMessage,
} from "@/lib/messages/service";
import {
  conversationPublicIdSchema,
  reportConversationSchema,
  sendChatMessageSchema,
} from "@/lib/messages/validation";
import { blockStudentByAlias } from "@/lib/introductions/service";
import {
  selectMutualInterest,
  withdrawMutualInterest,
} from "@/lib/mutual-interest/service";
import { mutualInterestActionSchema } from "@/lib/mutual-interest/validation";
import {
  selectIdentityReveal,
  withdrawIdentityReveal,
} from "@/lib/identity-reveal/service";
import {
  identityRevealConsentSchema,
  identityRevealWithdrawSchema,
} from "@/lib/identity-reveal/validation";
import {
  selectContactReveal,
  withdrawContactReveal,
} from "@/lib/contact-reveal/service";
import {
  contactRevealConsentSchema,
  contactRevealWithdrawSchema,
} from "@/lib/contact-reveal/validation";
import { peopleAliasSchema } from "@/lib/people/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireOnboardedStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return { user, profile };
}

function revalidateMessages(publicId?: string) {
  revalidatePath("/app/messages");
  if (publicId) {
    revalidatePath(`/app/messages/${publicId}`);
  }
}

export async function submitChatMessage(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = sendChatMessageSchema.safeParse({
    publicId: formData.get("publicId"),
    body: formData.get("body"),
    idempotencyKey: formData.get("idempotencyKey") || undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? CHAT_CONTACT_MESSAGE;
    const publicId = String(formData.get("publicId") ?? "");
    redirect(
      `/app/messages/${publicId}?notice=${encodeURIComponent(message)}`,
    );
  }

  try {
    await sendAnonymousMessage(
      parsed.data.publicId,
      parsed.data.body,
      parsed.data.idempotencyKey,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : GENERIC_CHAT_ERROR;
    redirect(
      `/app/messages/${parsed.data.publicId}?notice=${encodeURIComponent(message)}`,
    );
  }

  revalidateMessages(parsed.data.publicId);
  redirect(`/app/messages/${parsed.data.publicId}`);
}

export async function markMessagesReadAction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = conversationPublicIdSchema.safeParse(formData.get("publicId"));
  if (!parsed.success) return;

  try {
    await markConversationMessagesRead(parsed.data);
  } catch {
    return;
  }

  revalidateMessages(parsed.data);
}

export async function endConversationAction(formData: FormData) {
  await requireOnboardedStudent();
  const parsed = conversationPublicIdSchema.safeParse(formData.get("publicId"));
  if (!parsed.success) {
    redirect("/app/messages?state=error");
  }

  try {
    await endConversation(parsed.data);
  } catch {
    redirect(`/app/messages/${parsed.data}?state=error`);
  }

  revalidateMessages(parsed.data);
  redirect(`/app/messages/${parsed.data}?state=ended`);
}

export async function blockFromConversation(formData: FormData) {
  await requireOnboardedStudent();
  const publicId = conversationPublicIdSchema.safeParse(
    formData.get("publicId"),
  );
  const alias = peopleAliasSchema.safeParse(formData.get("alias"));

  if (!publicId.success || !alias.success) {
    redirect("/app/messages?state=error");
  }

  try {
    await blockStudentByAlias(alias.data);
  } catch {
    redirect(`/app/messages/${publicId.data}?state=error`);
  }

  revalidateMessages(publicId.data);
  redirect(`/app/messages/${publicId.data}?state=blocked`);
}

export async function reportFromConversation(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = reportConversationSchema.safeParse({
    publicId: formData.get("publicId"),
    reasonCode: formData.get("reasonCode"),
    details: formData.get("details"),
    messageId: formData.get("messageId") || undefined,
  });

  if (!parsed.success) {
    redirect("/app/messages?state=error");
  }

  try {
    await reportConversation(parsed.data);
  } catch {
    redirect(`/app/messages/${parsed.data.publicId}?state=error`);
  }

  revalidateMessages(parsed.data.publicId);
  redirect(`/app/messages/${parsed.data.publicId}?state=reported`);
}

export async function selectMutualInterestAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = mutualInterestActionSchema.safeParse({
    publicId: formData.get("publicId"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await selectMutualInterest(parsed.data.publicId);
  revalidateMessages(parsed.data.publicId);
  return next;
}

export async function withdrawMutualInterestAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = mutualInterestActionSchema.safeParse({
    publicId: formData.get("publicId"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await withdrawMutualInterest(parsed.data.publicId);
  revalidateMessages(parsed.data.publicId);
  return next;
}

export async function selectIdentityRevealAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = identityRevealConsentSchema.safeParse({
    publicId: formData.get("publicId"),
    profileVersionId: formData.get("profileVersionId"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await selectIdentityReveal(
    parsed.data.publicId,
    parsed.data.profileVersionId,
  );
  revalidateMessages(parsed.data.publicId);
  return next;
}

export async function withdrawIdentityRevealAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = identityRevealWithdrawSchema.safeParse({
    publicId: formData.get("publicId"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await withdrawIdentityReveal(parsed.data.publicId);
  revalidateMessages(parsed.data.publicId);
  return next;
}

export async function selectContactRevealAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = contactRevealConsentSchema.safeParse({
    publicId: formData.get("publicId"),
    channel: formData.get("channel"),
    contactVersionId: formData.get("contactVersionId"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await selectContactReveal(
    parsed.data.publicId,
    parsed.data.channel,
    parsed.data.contactVersionId,
  );
  revalidateMessages(parsed.data.publicId);
  return next;
}

export async function withdrawContactRevealAction(formData: FormData) {
  await requireOnboardedStudent();

  const parsed = contactRevealWithdrawSchema.safeParse({
    publicId: formData.get("publicId"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) {
    throw new Error(GENERIC_CHAT_ERROR);
  }

  const next = await withdrawContactReveal(
    parsed.data.publicId,
    parsed.data.channel,
  );
  revalidateMessages(parsed.data.publicId);
  return next;
}
