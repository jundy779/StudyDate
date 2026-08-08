"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  archiveCircle,
  createCircle,
  joinCircle,
  leaveCircle,
  removeCircleMember,
  reportCircle,
  sendCircleMessage,
  updateCircle,
} from "@/lib/circles/service";
import {
  circleFormSchema,
  circleMemberActionSchema,
  circleMessageSchema,
  circleReportSchema,
  circleSlugSchema,
} from "@/lib/circles/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireCircleStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  if (profile.deactivated_at) redirect("/account-deactivated");
}

function detailPath(publicSlug: string, query = "") {
  return `/app/circles/${publicSlug}${query}`;
}

function firstIssueMessage(
  result: { success: false; error: { issues: { message: string }[] } },
  fallback: string,
) {
  return result.error.issues[0]?.message ?? fallback;
}

export async function createCircleAction(formData: FormData) {
  await requireCircleStudent();
  const parsed = circleFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    topic: formData.get("topic"),
    scope: formData.get("scope"),
    memberLimit: formData.get("memberLimit"),
  });
  if (!parsed.success) {
    redirect(
      `/app/circles/create?state=invalid&notice=${encodeURIComponent(firstIssueMessage(parsed, "Periksa kembali data Circle."))}`,
    );
  }

  let publicSlug: string;
  try {
    publicSlug = await createCircle(parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Circle belum dapat dibuat.";
    redirect(
      `/app/circles/create?state=error&notice=${encodeURIComponent(message)}`,
    );
  }
  revalidatePath("/app/circles");
  redirect(detailPath(publicSlug, "?state=created"));
}

export async function updateCircleAction(formData: FormData) {
  await requireCircleStudent();
  const slug = circleSlugSchema.safeParse(formData.get("publicSlug"));
  const parsed = circleFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    topic: formData.get("topic"),
    scope: formData.get("scope"),
    memberLimit: formData.get("memberLimit"),
  });
  if (!slug.success || !parsed.success) {
    redirect("/app/circles?state=error");
  }
  try {
    await updateCircle(slug.data, parsed.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Circle belum dapat diperbarui.";
    redirect(
      detailPath(
        slug.data,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/circles");
  redirect(detailPath(slug.data, "?state=updated"));
}

async function membershipAction(
  formData: FormData,
  action: "join" | "leave",
) {
  await requireCircleStudent();
  const slug = circleSlugSchema.safeParse(formData.get("publicSlug"));
  if (!slug.success) redirect("/app/circles?state=error");
  try {
    if (action === "join") await joinCircle(slug.data);
    else await leaveCircle(slug.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tindakan belum dapat diproses.";
    redirect(
      detailPath(
        slug.data,
        `?state=error&notice=${encodeURIComponent(message)}`,
      ),
    );
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/circles");
  redirect(detailPath(slug.data, `?state=${action === "join" ? "joined" : "left"}`));
}

export async function joinCircleAction(formData: FormData) {
  return membershipAction(formData, "join");
}

export async function leaveCircleAction(formData: FormData) {
  return membershipAction(formData, "leave");
}

export async function removeCircleMemberAction(formData: FormData) {
  await requireCircleStudent();
  const parsed = circleMemberActionSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    memberAlias: formData.get("memberAlias"),
  });
  if (!parsed.success) redirect("/app/circles?state=error");
  try {
    await removeCircleMember(
      parsed.data.publicSlug,
      parsed.data.memberAlias,
    );
  } catch {
    redirect(detailPath(parsed.data.publicSlug, "?state=error"));
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=member-removed"));
}

export async function archiveCircleAction(formData: FormData) {
  await requireCircleStudent();
  const slug = circleSlugSchema.safeParse(formData.get("publicSlug"));
  if (!slug.success) redirect("/app/circles?state=error");
  try {
    await archiveCircle(slug.data);
  } catch {
    redirect(detailPath(slug.data, "?state=error"));
  }
  revalidatePath(detailPath(slug.data));
  revalidatePath("/app/circles");
  redirect(detailPath(slug.data, "?state=archived"));
}

export async function sendCircleMessageAction(formData: FormData) {
  await requireCircleStudent();
  const parsed = circleMessageSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    body: formData.get("body"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    const rawSlug = circleSlugSchema.safeParse(formData.get("publicSlug"));
    redirect(
      rawSlug.success
        ? detailPath(
            rawSlug.data,
            `?state=invalid&notice=${encodeURIComponent(firstIssueMessage(parsed, "Pesan tidak valid."))}#diskusi`,
          )
        : "/app/circles?state=error",
    );
  }
  try {
    await sendCircleMessage(
      parsed.data.publicSlug,
      parsed.data.body,
      parsed.data.idempotencyKey,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pesan belum dapat dikirim.";
    redirect(
      detailPath(
        parsed.data.publicSlug,
        `?state=error&notice=${encodeURIComponent(message)}#diskusi`,
      ),
    );
  }
  revalidatePath(detailPath(parsed.data.publicSlug));
  redirect(detailPath(parsed.data.publicSlug, "?state=message-sent#diskusi"));
}

export async function reportCircleAction(formData: FormData) {
  await requireCircleStudent();
  const rawMemberAlias = formData.get("memberAlias");
  const rawMessagePublicId = formData.get("messagePublicId");
  const parsed = circleReportSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    memberAlias:
      typeof rawMemberAlias === "string" && rawMemberAlias
        ? rawMemberAlias
        : undefined,
    messagePublicId:
      typeof rawMessagePublicId === "string" && rawMessagePublicId
        ? rawMessagePublicId
        : undefined,
    reasonCode: formData.get("reasonCode"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) redirect("/app/circles?state=error");
  try {
    await reportCircle(parsed.data);
  } catch {
    redirect(detailPath(parsed.data.publicSlug, "?state=error"));
  }
  redirect(detailPath(parsed.data.publicSlug, "?state=reported"));
}
