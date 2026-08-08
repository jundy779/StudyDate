export type CircleModelUser = {
  id: string;
  alias: string;
  campus: string;
  onboarded?: boolean;
  activeStaff?: boolean;
  discoverable?: boolean;
};

type MembershipState = "active" | "left" | "removed";

type ModelMembership = {
  userId: string;
  role: "owner" | "member";
  state: MembershipState;
};

type ModelMessage = {
  publicId: string;
  authorId: string;
  body: string;
};

type ModelCircle = {
  slug: string;
  ownerId: string;
  name: string;
  scope: "open" | "campus";
  campus: string | null;
  limit: number;
  archived: boolean;
  memberships: ModelMembership[];
  messages: ModelMessage[];
};

export class CircleBehaviorModel {
  private users = new Map<string, CircleModelUser>();
  private circles = new Map<string, ModelCircle>();
  private blocks = new Set<string>();
  private reportEvidence: { circleSlug: string; excerpt: string | null }[] = [];
  private sequence = 0;

  addUser(user: CircleModelUser) {
    this.users.set(user.id, {
      onboarded: true,
      activeStaff: false,
      discoverable: true,
      ...user,
    });
  }

  block(blockerId: string, blockedId: string) {
    this.blocks.add(`${blockerId}:${blockedId}`);
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
      ownerId?: string;
      name: string;
      scope: "open" | "campus";
      limit?: number;
    },
  ) {
    if (!this.eligible(actorId)) throw new Error("student access required");
    if (input.ownerId && input.ownerId !== actorId) {
      throw new Error("owner is derived from actor");
    }
    const owned = [...this.circles.values()].filter(
      (circle) => circle.ownerId === actorId && !circle.archived,
    ).length;
    if (owned >= 3) throw new Error("ownership limit reached");
    const user = this.users.get(actorId)!;
    const slug = `circle-${String(++this.sequence).padStart(24, "0")}`;
    this.circles.set(slug, {
      slug,
      ownerId: actorId,
      name: input.name,
      scope: input.scope,
      campus: input.scope === "campus" ? user.campus : null,
      limit: input.limit ?? 12,
      archived: false,
      memberships: [{ userId: actorId, role: "owner", state: "active" }],
      messages: [],
    });
    return slug;
  }

  get(slug: string) {
    const circle = this.circles.get(slug);
    if (!circle) throw new Error("circle unavailable");
    return circle;
  }

  join(actorId: string, slug: string) {
    if (!this.eligible(actorId)) throw new Error("student access required");
    const circle = this.get(slug);
    if (circle.archived) throw new Error("circle archived");
    const actor = this.users.get(actorId)!;
    if (circle.scope === "campus" && circle.campus !== actor.campus) {
      throw new Error("circle unavailable");
    }
    if (this.blocked(actorId, circle.ownerId)) throw new Error("blocked");
    const existing = circle.memberships.find((row) => row.userId === actorId);
    if (existing?.state === "active") return false;
    if (existing?.state === "removed") throw new Error("removed");
    if (
      circle.memberships.filter((row) => row.state === "active").length >=
      circle.limit
    ) {
      throw new Error("circle full");
    }
    const activeMemberships = [...this.circles.values()].filter((candidate) =>
      candidate.memberships.some(
        (row) => row.userId === actorId && row.state === "active",
      ),
    ).length;
    if (activeMemberships >= 10) throw new Error("membership limit reached");
    if (existing) existing.state = "active";
    else {
      circle.memberships.push({
        userId: actorId,
        role: "member",
        state: "active",
      });
    }
    return true;
  }

  leave(actorId: string, slug: string) {
    const circle = this.get(slug);
    const membership = circle.memberships.find(
      (row) => row.userId === actorId && row.state === "active",
    );
    if (!membership || membership.role === "owner") return false;
    membership.state = "left";
    return true;
  }

  remove(actorId: string, slug: string, targetId: string) {
    const circle = this.get(slug);
    if (circle.ownerId !== actorId) throw new Error("owner required");
    const membership = circle.memberships.find(
      (row) =>
        row.userId === targetId &&
        row.role === "member" &&
        row.state === "active",
    );
    if (!membership) throw new Error("member unavailable");
    membership.state = "removed";
  }

  archive(actorId: string, slug: string) {
    const circle = this.get(slug);
    if (circle.ownerId !== actorId) throw new Error("owner required");
    circle.archived = true;
  }

  listMembers(actorId: string, slug: string) {
    const circle = this.get(slug);
    if (
      !circle.memberships.some(
        (row) => row.userId === actorId && row.state === "active",
      )
    ) {
      throw new Error("membership required");
    }
    return circle.memberships
      .filter((row) => row.state === "active")
      .map((row) => {
        const user = this.users.get(row.userId)!;
        return {
          public_alias: user.alias,
          campus: user.campus,
          circle_role: row.role,
        };
      });
  }

  post(actorId: string, slug: string, body: string) {
    const circle = this.get(slug);
    if (circle.archived) throw new Error("circle archived");
    if (
      !circle.memberships.some(
        (row) => row.userId === actorId && row.state === "active",
      )
    ) {
      throw new Error("membership required");
    }
    if (!body.trim() || body.trim().length > 800) {
      throw new Error("invalid message");
    }
    if (
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:wa|whatsapp|telegram|instagram)\s*[:@]/i.test(
        body,
      )
    ) {
      throw new Error("contact disclosure blocked");
    }
    const message: ModelMessage = {
      publicId: String(++this.sequence).padStart(32, "0"),
      authorId: actorId,
      body: body.trim(),
    };
    circle.messages.push(message);
    return message.publicId;
  }

  listMessages(actorId: string, slug: string) {
    const circle = this.get(slug);
    if (
      !circle.memberships.some(
        (row) => row.userId === actorId && row.state === "active",
      )
    ) {
      throw new Error("membership required");
    }
    return circle.messages.map((message) => ({
      message_public_id: message.publicId,
      author_alias: this.users.get(message.authorId)!.alias,
      body: message.body,
    }));
  }

  canIntroduce(actorId: string, targetId: string) {
    const target = this.users.get(targetId);
    return (
      actorId !== targetId &&
      this.eligible(actorId) &&
      this.eligible(targetId) &&
      Boolean(target?.discoverable) &&
      !this.blocked(actorId, targetId)
    );
  }

  reportMessage(actorId: string, slug: string, messagePublicId: string) {
    const circle = this.get(slug);
    if (
      !circle.memberships.some(
        (row) => row.userId === actorId && row.state === "active",
      )
    ) {
      throw new Error("membership required");
    }
    const message = circle.messages.find(
      (row) => row.publicId === messagePublicId,
    );
    if (!message || message.authorId === actorId) {
      throw new Error("message unavailable");
    }
    this.reportEvidence.push({
      circleSlug: slug,
      excerpt: message.body.slice(0, 280),
    });
  }

  latestReportEvidence() {
    return this.reportEvidence.at(-1) ?? null;
  }

  privateConnectionCount() {
    return 0;
  }

  revealCount() {
    return 0;
  }
}
