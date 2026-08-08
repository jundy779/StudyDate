import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/lib/notifications/service";
import { notificationCursorSchema } from "@/lib/notifications/validation";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const [profile, staff] = await Promise.all([
      getPrivateProfile(user.id),
      getCurrentStaffAccess(user),
    ]);
    if (staff || !profile?.onboarding_completed_at) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const search = request.nextUrl.searchParams;
    const parsed = notificationCursorSchema.safeParse({
      beforeCreatedAt: search.get("beforeCreatedAt") ?? undefined,
      beforePublicId: search.get("beforePublicId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
    }

    const [rows, unreadCount] = await Promise.all([
      listNotifications({
        limit: 21,
        beforeCreatedAt: parsed.data.beforeCreatedAt,
        beforePublicId: parsed.data.beforePublicId,
      }),
      countUnreadNotifications(),
    ]);
    const hasMore = rows.length > 20;

    return NextResponse.json({
      unreadCount,
      notifications: rows.slice(0, 20),
      nextCursor: hasMore
        ? {
            beforeCreatedAt: rows[19].createdAt,
            beforePublicId: rows[19].publicId,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
