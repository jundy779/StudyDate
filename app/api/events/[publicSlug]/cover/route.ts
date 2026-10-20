import { getMyStudentAccess } from "@/lib/account/student-access";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import { EVENT_COVER_BUCKET, EVENT_COVER_MAX_BYTES } from "@/lib/events/constants";
import { EVENT_COVER_ERROR, processEventCover } from "@/lib/events/cover";
import { setCampusEventCoverPath } from "@/lib/events/media";
import { getCampusEvent } from "@/lib/events/service";
import { eventSlugSchema } from "@/lib/events/validation";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type CoverRouteContext = { params: Promise<{ publicSlug: string }> };

const MAX_FORM_BYTES = EVENT_COVER_MAX_BYTES + 64 * 1024;
const GENERIC_ERROR = "Foto sampul belum dapat disimpan. Coba lagi sebentar.";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Penyelenggara atau cohost dari acara yang masih terjadwal. */
async function authorize(rawSlug: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: fail("Masuk dulu untuk mengubah sampul.", 401) };
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    return { error: fail("Selesaikan pendaftaran akun dulu.", 403) };
  }
  const access = await getMyStudentAccess();
  if (access && !access.eventsAllowed) {
    return { error: fail("Akunmu belum bisa mengelola acara.", 403) };
  }
  const slug = eventSlugSchema.safeParse(rawSlug);
  if (!slug.success) return { error: fail("Acara tidak ditemukan.", 404) };
  const event = await getCampusEvent(slug.data).catch(() => null);
  if (
    !event ||
    event.status !== "scheduled" ||
    !(event.is_organizer || event.can_manage_team || event.can_manage_registrations)
  ) {
    return { error: fail("Kamu tidak bisa mengubah sampul acara ini.", 403) };
  }
  return { slug: slug.data };
}

function revalidateEvent(slug: string) {
  revalidatePath(`/app/events/${slug}`);
  revalidatePath(`/app/events/${slug}/manage/settings`);
  revalidatePath("/app/events");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/events");
}

export async function POST(request: Request, context: CoverRouteContext) {
  try {
    const { publicSlug } = await context.params;
    const authorized = await authorize(publicSlug);
    if ("error" in authorized) return authorized.error;

    const contentLength = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_FORM_BYTES) {
      return fail(EVENT_COVER_ERROR, 413);
    }

    const formData = await request.formData();
    const photo = formData.get("cover");
    if (!(photo instanceof File) || photo.size <= 0 || photo.size > EVENT_COVER_MAX_BYTES) {
      return fail(EVENT_COVER_ERROR, 400);
    }

    const admin = createServerAdminClient();
    if (!admin) return fail(GENERIC_ERROR, 503);

    const processed = await processEventCover(
      Buffer.from(await photo.arrayBuffer()),
      authorized.slug,
    );
    const { error: uploadError } = await admin.storage
      .from(EVENT_COVER_BUCKET)
      .upload(processed.path, processed.buffer, {
        contentType: processed.contentType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (uploadError) return fail(GENERIC_ERROR, 502);

    let previous: string | null;
    try {
      previous = await setCampusEventCoverPath(authorized.slug, processed.path);
    } catch (error) {
      await admin.storage.from(EVENT_COVER_BUCKET).remove([processed.path]);
      return fail(error instanceof Error ? error.message : GENERIC_ERROR, 400);
    }
    if (previous && previous !== processed.path) {
      await admin.storage.from(EVENT_COVER_BUCKET).remove([previous]);
    }
    revalidateEvent(authorized.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === EVENT_COVER_ERROR
        ? EVENT_COVER_ERROR
        : GENERIC_ERROR;
    return fail(message, 400);
  }
}

export async function DELETE(_request: Request, context: CoverRouteContext) {
  try {
    const { publicSlug } = await context.params;
    const authorized = await authorize(publicSlug);
    if ("error" in authorized) return authorized.error;
    const previous = await setCampusEventCoverPath(authorized.slug, null);
    const admin = createServerAdminClient();
    if (previous && admin) {
      await admin.storage.from(EVENT_COVER_BUCKET).remove([previous]);
    }
    revalidateEvent(authorized.slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : GENERIC_ERROR, 400);
  }
}
