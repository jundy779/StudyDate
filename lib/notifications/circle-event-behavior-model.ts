import type {
  NotificationItem,
  NotificationType,
} from "@/lib/notifications/constants";

type MembershipState = "active" | "left" | "removed";
type MembershipRole = "owner" | "member";
type EventStatus = "scheduled" | "cancelled" | "archived";
type RsvpStatus = "going" | "cancelled";

type StoredNotification = NotificationItem & {
  recipientId: string;
  dedupeKey: string;
};

type CircleRecord = {
  id: string;
  slug: string;
  ownerId: string;
  name: string;
  topic: string;
  description: string;
  memberLimit: number;
  status: "active" | "archived";
};

type MembershipRecord = {
  circleId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipState;
};

type EventRecord = {
  id: string;
  slug: string;
  organizerId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezoneName: string;
  venueCategory: string;
  venueName: string;
  venueArea: string;
  city: string;
  status: EventStatus;
};

type RsvpRecord = {
  eventId: string;
  userId: string;
  status: RsvpStatus;
};

function md5Lite(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export class CircleEventNotificationModel {
  readonly rows: StoredNotification[] = [];
  private readonly students = new Set<string>();
  private readonly staff = new Set<string>();
  private readonly circles = new Map<string, CircleRecord>();
  private readonly memberships: MembershipRecord[] = [];
  private readonly events = new Map<string, EventRecord>();
  private readonly rsvps: RsvpRecord[] = [];
  private sequence = 0;

  seedStudent(userId: string) {
    this.students.add(userId);
  }

  seedStaff(userId: string) {
    this.staff.add(userId);
  }

  private isNotificationStudent(userId: string) {
    return this.students.has(userId) && !this.staff.has(userId);
  }

  private emit(
    recipientId: string,
    type: NotificationType,
    targetPath: string,
    dedupeKey: string,
    extras?: {
      headline?: string | null;
      whenLabel?: string | null;
      venueLabel?: string | null;
    },
  ) {
    if (
      !this.isNotificationStudent(recipientId) ||
      this.rows.some((row) => row.dedupeKey === dedupeKey)
    ) {
      return;
    }

    this.sequence += 1;
    this.rows.push({
      publicId: this.sequence.toString(16).padStart(32, "0"),
      recipientId,
      type,
      targetPath,
      channel: null,
      headline: extras?.headline ?? null,
      whenLabel: extras?.whenLabel ?? null,
      venueLabel: extras?.venueLabel ?? null,
      createdAt: new Date(this.sequence * 1000).toISOString(),
      readAt: null,
      dedupeKey,
    });
  }

  private fanoutCircle(
    circle: CircleRecord,
    type: NotificationType,
    dedupePrefix: string,
    excludeUserId: string,
    extras: { headline: string },
  ) {
    for (const membership of this.memberships) {
      if (
        membership.circleId !== circle.id ||
        membership.status !== "active" ||
        membership.userId === excludeUserId
      ) {
        continue;
      }
      this.emit(
        membership.userId,
        type,
        `/app/circles/${circle.slug}`,
        `${dedupePrefix}:${membership.userId}`,
        extras,
      );
    }
  }

  private fanoutGoing(
    event: EventRecord,
    type: NotificationType,
    dedupePrefix: string,
    extras: {
      headline: string;
      whenLabel?: string | null;
      venueLabel?: string | null;
    },
  ) {
    for (const rsvp of this.rsvps) {
      if (
        rsvp.eventId !== event.id ||
        rsvp.status !== "going" ||
        rsvp.userId === event.organizerId
      ) {
        continue;
      }
      this.emit(
        rsvp.userId,
        type,
        `/app/events/${event.slug}`,
        `${dedupePrefix}:${rsvp.userId}`,
        extras,
      );
    }
  }

  createCircle(
    ownerId: string,
    input: { slug: string; name: string; topic?: string },
  ) {
    const id = `circle-${this.circles.size + 1}`;
    const circle: CircleRecord = {
      id,
      slug: input.slug,
      ownerId,
      name: input.name,
      topic: input.topic ?? "coding",
      description: "Deskripsi Circle untuk belajar bersama di kampus.",
      memberLimit: 10,
      status: "active",
    };
    this.circles.set(id, circle);
    this.memberships.push({
      circleId: id,
      userId: ownerId,
      role: "owner",
      status: "active",
    });
    return circle;
  }

  joinCircle(actorId: string, circleId: string) {
    const circle = this.circles.get(circleId);
    if (!circle || circle.status !== "active" || circle.ownerId === actorId) {
      throw new Error("circle unavailable");
    }
    const existing = this.memberships.find(
      (row) => row.circleId === circleId && row.userId === actorId,
    );
    if (existing?.status === "active") return false;
    if (existing?.status === "removed") throw new Error("circle unavailable");
    if (existing) {
      existing.status = "active";
    } else {
      this.memberships.push({
        circleId,
        userId: actorId,
        role: "member",
        status: "active",
      });
    }
    this.emit(
      circle.ownerId,
      "CIRCLE_MEMBER_JOINED",
      `/app/circles/${circle.slug}`,
      `circle_member_joined:${circle.id}:${actorId}`,
      { headline: circle.name },
    );
    return true;
  }

  leaveCircle(actorId: string, circleId: string) {
    const membership = this.memberships.find(
      (row) =>
        row.circleId === circleId &&
        row.userId === actorId &&
        row.role === "member" &&
        row.status === "active",
    );
    if (!membership) return false;
    membership.status = "left";
    return true;
  }

  removeMember(actorId: string, circleId: string, memberId: string) {
    const circle = this.circles.get(circleId);
    if (!circle || circle.ownerId !== actorId) {
      throw new Error("circle unavailable");
    }
    const membership = this.memberships.find(
      (row) =>
        row.circleId === circleId &&
        row.userId === memberId &&
        row.role === "member" &&
        row.status === "active",
    );
    if (!membership) throw new Error("circle member unavailable");
    membership.status = "removed";
    this.emit(
      memberId,
      "CIRCLE_MEMBER_REMOVED",
      `/app/circles/${circle.slug}`,
      `circle_member_removed:${circle.id}:${memberId}`,
      { headline: circle.name },
    );
    return true;
  }

  updateCircle(
    actorId: string,
    circleId: string,
    patch: Partial<Pick<CircleRecord, "name" | "topic" | "description" | "memberLimit">>,
  ) {
    const circle = this.circles.get(circleId);
    if (!circle || circle.ownerId !== actorId || circle.status !== "active") {
      throw new Error("circle unavailable");
    }
    const nextName = patch.name ?? circle.name;
    const nextTopic = patch.topic ?? circle.topic;
    const nameOrTopicChanged =
      nextName !== circle.name || nextTopic !== circle.topic;
    circle.name = nextName;
    circle.topic = nextTopic;
    circle.description = patch.description ?? circle.description;
    circle.memberLimit = patch.memberLimit ?? circle.memberLimit;
    if (!nameOrTopicChanged) return;
    this.fanoutCircle(
      circle,
      "CIRCLE_UPDATED",
      `circle_updated:${circle.id}:${md5Lite(`${circle.name}\u001f${circle.topic}`)}`,
      circle.ownerId,
      { headline: circle.name },
    );
  }

  archiveCircle(actorId: string, circleId: string) {
    const circle = this.circles.get(circleId);
    if (!circle || circle.ownerId !== actorId) {
      throw new Error("circle unavailable");
    }
    if (circle.status === "archived") return false;
    circle.status = "archived";
    this.fanoutCircle(
      circle,
      "CIRCLE_ARCHIVED",
      `circle_archived:${circle.id}`,
      circle.ownerId,
      { headline: circle.name },
    );
    return true;
  }

  createEvent(
    organizerId: string,
    input: {
      slug: string;
      title: string;
      startsAt: string;
      endsAt: string;
      venueName: string;
      venueArea?: string;
      city: string;
    },
  ) {
    const id = `event-${this.events.size + 1}`;
    const event: EventRecord = {
      id,
      slug: input.slug,
      organizerId,
      title: input.title,
      description: "Deskripsi event belajar di tempat publik kampus.",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezoneName: "Asia/Jakarta",
      venueCategory: "campus_public_area",
      venueName: input.venueName,
      venueArea: input.venueArea ?? "Lantai 1 perpustakaan kampus",
      city: input.city,
      status: "scheduled",
    };
    this.events.set(id, event);
    this.rsvps.push({ eventId: id, userId: organizerId, status: "going" });
    return event;
  }

  rsvpEvent(actorId: string, eventId: string) {
    const event = this.events.get(eventId);
    if (
      !event ||
      event.status !== "scheduled" ||
      event.organizerId === actorId
    ) {
      throw new Error("event unavailable");
    }
    const existing = this.rsvps.find(
      (row) => row.eventId === eventId && row.userId === actorId,
    );
    if (existing?.status === "going") return false;
    if (existing) existing.status = "going";
    else this.rsvps.push({ eventId, userId: actorId, status: "going" });
    this.emit(
      actorId,
      "EVENT_REGISTERED",
      `/app/events/${event.slug}`,
      `event_registered:${event.id}:${actorId}`,
      { headline: event.title },
    );
    return true;
  }

  cancelRsvp(actorId: string, eventId: string) {
    const event = this.events.get(eventId);
    if (!event || event.organizerId === actorId) {
      throw new Error("event unavailable");
    }
    const existing = this.rsvps.find(
      (row) =>
        row.eventId === eventId &&
        row.userId === actorId &&
        row.status === "going",
    );
    if (!existing) return false;
    existing.status = "cancelled";
    return true;
  }

  updateEvent(
    actorId: string,
    eventId: string,
    patch: Partial<
      Pick<
        EventRecord,
        | "title"
        | "description"
        | "startsAt"
        | "endsAt"
        | "timezoneName"
        | "venueName"
        | "venueArea"
        | "city"
        | "venueCategory"
      >
    >,
  ) {
    const event = this.events.get(eventId);
    if (
      !event ||
      event.organizerId !== actorId ||
      event.status !== "scheduled"
    ) {
      throw new Error("event unavailable");
    }
    const next = { ...event, ...patch };
    const scheduleChanged =
      next.startsAt !== event.startsAt ||
      next.endsAt !== event.endsAt ||
      next.timezoneName !== event.timezoneName;
    const locationChanged =
      next.venueName !== event.venueName ||
      next.venueArea !== event.venueArea ||
      next.city !== event.city ||
      next.venueCategory !== event.venueCategory;
    Object.assign(event, next);
    if (scheduleChanged) {
      const whenLabel = `${event.startsAt.slice(0, 16).replace("T", " ")} WIB`;
      this.fanoutGoing(
        event,
        "EVENT_SCHEDULE_CHANGED",
        `event_schedule_changed:${event.id}:${event.startsAt}:${event.endsAt}:${event.timezoneName}`,
        { headline: event.title, whenLabel },
      );
    }
    if (locationChanged) {
      const venueLabel = `${event.venueName} · ${event.city}`;
      this.fanoutGoing(
        event,
        "EVENT_LOCATION_CHANGED",
        `event_location_changed:${event.id}:${md5Lite(
          `${event.venueCategory}\u001f${event.venueName}\u001f${event.venueArea}\u001f${event.city}`,
        )}`,
        { headline: event.title, venueLabel },
      );
    }
  }

  cancelEvent(actorId: string, eventId: string) {
    const event = this.events.get(eventId);
    if (
      !event ||
      event.organizerId !== actorId ||
      event.status !== "scheduled"
    ) {
      throw new Error("event unavailable");
    }
    event.status = "cancelled";
    this.fanoutGoing(
      event,
      "EVENT_CANCELLED",
      `event_cancelled:${event.id}`,
      { headline: event.title },
    );
    return true;
  }

  list(actorId: string | null) {
    if (!actorId || !this.isNotificationStudent(actorId)) {
      throw new Error("student access required");
    }
    return this.rows
      .filter((row) => row.recipientId === actorId)
      .map((row) => ({
        publicId: row.publicId,
        type: row.type,
        targetPath: row.targetPath,
        channel: row.channel,
        headline: row.headline,
        whenLabel: row.whenLabel,
        venueLabel: row.venueLabel,
        createdAt: row.createdAt,
        readAt: row.readAt,
      }));
  }

  unreadCount(actorId: string | null) {
    return this.list(actorId).filter((row) => row.readAt === null).length;
  }

  markRead(actorId: string | null, publicId: string) {
    if (!actorId || !this.isNotificationStudent(actorId)) {
      throw new Error("student access required");
    }
    const row = this.rows.find(
      (candidate) =>
        candidate.publicId === publicId && candidate.recipientId === actorId,
    );
    if (!row) return false;
    row.readAt ??= new Date().toISOString();
    return true;
  }
}
