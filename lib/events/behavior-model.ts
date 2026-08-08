export type EventModelUser = {
  id: string;
  alias: string;
  campus: string;
  onboarded?: boolean;
  activeStaff?: boolean;
  verified?: boolean;
};

type ModelRsvp = {
  userId: string;
  status: "going" | "cancelled";
  rsvpedAt: number;
};

type ModelEvent = {
  slug: string;
  organizerId: string;
  title: string;
  description: string;
  scope: "open" | "campus";
  campus: string | null;
  startsAt: number;
  endsAt: number;
  capacity: number;
  status: "scheduled" | "cancelled" | "archived";
  rsvps: ModelRsvp[];
};

export class CampusEventBehaviorModel {
  private users = new Map<string, EventModelUser>();
  private events = new Map<string, ModelEvent>();
  private blocks = new Set<string>();
  private reports: {
    kind: "event" | "event_organizer";
    title: string;
    descriptionExcerpt: string;
  }[] = [];
  private sequence = 0;
  private now: number;

  constructor(now = Date.now()) {
    this.now = now;
  }

  addUser(user: EventModelUser) {
    this.users.set(user.id, {
      onboarded: true,
      activeStaff: false,
      verified: false,
      ...user,
    });
  }

  setNow(value: number) {
    this.now = value;
  }

  block(a: string, b: string) {
    this.blocks.add(`${a}:${b}`);
  }

  private blocked(a: string, b: string) {
    return this.blocks.has(`${a}:${b}`) || this.blocks.has(`${b}:${a}`);
  }

  private eligible(userId: string) {
    const user = this.users.get(userId);
    return Boolean(user?.onboarded && !user.activeStaff);
  }

  create(
    actorId: string,
    input: {
      organizerId?: string;
      title: string;
      description?: string;
      scope: "open" | "campus";
      startsAt: number;
      endsAt: number;
      capacity?: number;
    },
  ) {
    if (!this.eligible(actorId)) throw new Error("student access required");
    if (input.organizerId && input.organizerId !== actorId) {
      throw new Error("organizer derived from actor");
    }
    if (input.startsAt < this.now + 2 * 60 * 60 * 1000) {
      throw new Error("start too soon");
    }
    if (input.startsAt > this.now + 180 * 24 * 60 * 60 * 1000) {
      throw new Error("start too far");
    }
    const duration = input.endsAt - input.startsAt;
    if (duration < 30 * 60 * 1000 || duration > 12 * 60 * 60 * 1000) {
      throw new Error("invalid duration");
    }
    const organized = [...this.events.values()].filter(
      (event) =>
        event.organizerId === actorId &&
        event.status === "scheduled" &&
        event.startsAt > this.now,
    ).length;
    if (organized >= 5) throw new Error("organizer limit reached");

    const organizer = this.users.get(actorId)!;
    const slug = `event-${String(++this.sequence).padStart(24, "0")}`;
    this.events.set(slug, {
      slug,
      organizerId: actorId,
      title: input.title,
      description: input.description ?? "Deskripsi event yang aman dan cukup panjang.",
      scope: input.scope,
      campus: input.scope === "campus" ? organizer.campus : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity ?? 10,
      status: "scheduled",
      rsvps: [{ userId: actorId, status: "going", rsvpedAt: this.now }],
    });
    return slug;
  }

  get(slug: string) {
    const event = this.events.get(slug);
    if (!event) throw new Error("event unavailable");
    return event;
  }

  discover(actorId: string) {
    const actor = this.users.get(actorId)!;
    return [...this.events.values()].filter(
      (event) =>
        event.status === "scheduled" &&
        event.startsAt > this.now &&
        (event.scope === "open" || event.campus === actor.campus) &&
        !this.blocked(actorId, event.organizerId),
    );
  }

  detail(actorId: string, slug: string) {
    const event = this.get(slug);
    const history = event.rsvps.some((row) => row.userId === actorId);
    if (
      event.status === "archived" &&
      event.organizerId !== actorId &&
      !history
    ) {
      throw new Error("event unavailable");
    }
    if (
      event.scope === "campus" &&
      event.campus !== this.users.get(actorId)?.campus &&
      event.organizerId !== actorId &&
      !history
    ) {
      throw new Error("event unavailable");
    }
    return {
      slug: event.slug,
      status: event.status,
      isPast: event.endsAt <= this.now,
      attendeeCount: event.rsvps.filter((row) => row.status === "going").length,
    };
  }

  update(
    actorId: string,
    slug: string,
    input: { startsAt: number; endsAt: number; capacity: number },
  ) {
    const event = this.get(slug);
    if (
      event.organizerId !== actorId ||
      event.status !== "scheduled" ||
      event.startsAt <= this.now + 2 * 60 * 60 * 1000
    ) {
      throw new Error("event unavailable");
    }
    if (
      input.startsAt < this.now + 2 * 60 * 60 * 1000 ||
      input.startsAt > this.now + 180 * 24 * 60 * 60 * 1000
    ) {
      throw new Error("invalid start");
    }
    const going = event.rsvps.filter((row) => row.status === "going").length;
    if (input.capacity < going) throw new Error("capacity below attendees");
    if (
      going > 1 &&
      (input.startsAt !== event.startsAt || input.endsAt !== event.endsAt)
    ) {
      throw new Error("schedule venue locked after rsvp");
    }
    event.startsAt = input.startsAt;
    event.endsAt = input.endsAt;
    event.capacity = input.capacity;
  }

  rsvp(actorId: string, slug: string) {
    if (!this.eligible(actorId)) throw new Error("student access required");
    const event = this.get(slug);
    const actor = this.users.get(actorId)!;
    if (
      event.status !== "scheduled" ||
      event.startsAt <= this.now ||
      event.organizerId === actorId ||
      this.blocked(actorId, event.organizerId) ||
      (event.scope === "campus" && event.campus !== actor.campus)
    ) {
      throw new Error("event unavailable");
    }
    const existing = event.rsvps.find((row) => row.userId === actorId);
    if (existing?.status === "going") return false;
    const active = [...this.events.values()].filter(
      (candidate) =>
        candidate.status === "scheduled" &&
        candidate.startsAt > this.now &&
        candidate.rsvps.some(
          (row) => row.userId === actorId && row.status === "going",
        ),
    ).length;
    if (active >= 10) throw new Error("rsvp limit reached");
    if (
      event.rsvps.filter((row) => row.status === "going").length >=
      event.capacity
    ) {
      throw new Error("event full");
    }
    if (existing) {
      existing.status = "going";
      existing.rsvpedAt = this.now;
    } else {
      event.rsvps.push({
        userId: actorId,
        status: "going",
        rsvpedAt: this.now,
      });
    }
    return true;
  }

  finalSlotAttempts(slug: string, actorIds: string[]) {
    const accepted: string[] = [];
    for (const actorId of actorIds) {
      try {
        if (this.rsvp(actorId, slug)) accepted.push(actorId);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "event full") throw error;
      }
    }
    return accepted;
  }

  async concurrentFinalSlotAttempts(slug: string, actorIds: string[]) {
    const results = await Promise.allSettled(
      actorIds.map(async (actorId) => {
        await Promise.resolve();
        return this.rsvp(actorId, slug) ? actorId : null;
      }),
    );
    return results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    );
  }

  cancelRsvp(actorId: string, slug: string) {
    const event = this.get(slug);
    if (event.status !== "scheduled" || event.startsAt <= this.now) {
      throw new Error("event unavailable");
    }
    if (event.organizerId === actorId) throw new Error("organizer rsvp required");
    const row = event.rsvps.find(
      (candidate) =>
        candidate.userId === actorId && candidate.status === "going",
    );
    if (!row) return false;
    row.status = "cancelled";
    return true;
  }

  cancelEvent(actorId: string, slug: string) {
    const event = this.get(slug);
    if (
      event.organizerId !== actorId ||
      event.status !== "scheduled" ||
      event.startsAt <= this.now
    ) {
      throw new Error("event unavailable");
    }
    event.status = "cancelled";
  }

  archive(actorId: string, slug: string) {
    const event = this.get(slug);
    if (
      event.organizerId !== actorId ||
      (event.status !== "cancelled" && event.endsAt > this.now)
    ) {
      throw new Error("event unavailable");
    }
    event.status = "archived";
  }

  listAttendees(actorId: string, slug: string) {
    const event = this.get(slug);
    const callerGoing = event.rsvps.some(
      (row) => row.userId === actorId && row.status === "going",
    );
    if (event.organizerId !== actorId && !callerGoing) {
      throw new Error("rsvp required");
    }
    return event.rsvps
      .filter(
        (row) =>
          row.status === "going" &&
          !this.blocked(actorId, row.userId),
      )
      .map((row) => {
        const user = this.users.get(row.userId)!;
        return {
          public_alias: user.alias,
          campus: user.campus,
          is_verified: Boolean(user.verified),
          is_organizer: row.userId === event.organizerId,
          rsvped_at: row.rsvpedAt,
        };
      });
  }

  report(
    actorId: string,
    slug: string,
    kind: "event" | "event_organizer",
  ) {
    const event = this.get(slug);
    if (event.organizerId === actorId) throw new Error("self report");
    this.reports.push({
      kind,
      title: event.title,
      descriptionExcerpt: event.description.slice(0, 280),
    });
  }

  latestReport() {
    return this.reports.at(-1) ?? null;
  }

  privateFlowWrites() {
    return 0;
  }
}
