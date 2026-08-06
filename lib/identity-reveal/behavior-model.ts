/**
 * Faithful in-memory behavior model for Identity Reveal v1 authorization.
 * Mirrors migration 202608060005 conversation-scoped rules for local tests
 * without requiring the remote StudyDate database.
 */

export type ConversationStatus = "awaiting_chat" | "active" | "ended" | "blocked";

export type Shell = {
  id: string;
  publicId: string;
  status: ConversationStatus;
  participantSenderId: string;
  participantRecipientId: string;
  mutualInterestAt: string | null;
  identityRevealedAt: string | null;
  introductionRequestId: string | null;
};

export type ProfileVersion = {
  id: string;
  conversationId: string;
  ownerUserId: string;
  versionNumber: number;
  firstName: string;
  photoObjectKey: string;
  supersededAt: string | null;
};

export type Consent = {
  conversationId: string;
  participantId: string;
  profileVersionId: string;
  withdrawnAt: string | null;
};

export type RevealSnapshot = {
  conversationId: string;
  senderProfileVersionId: string;
  recipientProfileVersionId: string;
  revealedAt: string;
};

export type SafeState = {
  eligible: boolean;
  hasProfile: boolean;
  selectedByMe: boolean;
  completed: boolean;
  completedAt: string | null;
  canWithdraw: boolean;
};

export type CompletedProjection = {
  completed: boolean;
  completedAt: string | null;
  mineFirstName: string | null;
  counterpartFirstName: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function counterpartId(shell: Shell, userId: string) {
  if (userId === shell.participantSenderId) return shell.participantRecipientId;
  if (userId === shell.participantRecipientId) return shell.participantSenderId;
  return null;
}

export class IdentityRevealBehaviorModel {
  shells = new Map<string, Shell>();
  byPublicId = new Map<string, string>();
  staff = new Set<string>();
  onboarded = new Set<string>();
  blocks = new Set<string>();
  profiles: ProfileVersion[] = [];
  consents: Consent[] = [];
  snapshots = new Map<string, RevealSnapshot>();
  events: Array<{ conversationId: string; type: string }> = [];
  storageKeys = new Set<string>();
  idSeq = 1;

  private nextId(prefix: string) {
    this.idSeq += 1;
    return `${prefix}-${this.idSeq}`;
  }

  private blockKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  seedStudent(userId: string) {
    this.onboarded.add(userId);
  }

  seedStaff(userId: string) {
    this.staff.add(userId);
    this.onboarded.add(userId);
  }

  seedBlock(a: string, b: string) {
    this.blocks.add(this.blockKey(a, b));
  }

  usersAreBlocked(a: string, b: string) {
    return this.blocks.has(this.blockKey(a, b));
  }

  isEligibleStudent(userId: string) {
    return this.onboarded.has(userId) && !this.staff.has(userId);
  }

  seedConversation(input: {
    publicId: string;
    senderId: string;
    recipientId: string;
    status?: ConversationStatus;
    mutual?: boolean;
    revealed?: boolean;
  }) {
    const id = this.nextId("shell");
    const shell: Shell = {
      id,
      publicId: input.publicId,
      status: input.status ?? "active",
      participantSenderId: input.senderId,
      participantRecipientId: input.recipientId,
      mutualInterestAt: input.mutual ? nowIso() : null,
      identityRevealedAt: input.revealed ? nowIso() : null,
      introductionRequestId: this.nextId("intro"),
    };
    this.shells.set(id, shell);
    this.byPublicId.set(input.publicId, id);
    return shell;
  }

  getShellByPublicId(publicId: string) {
    const id = this.byPublicId.get(publicId);
    return id ? this.shells.get(id) ?? null : null;
  }

  isEligibleForIdentityReveal(shell: Shell, userId: string) {
    if (!this.isEligibleStudent(userId)) return false;
    if (shell.status !== "active") return false;
    if (!shell.introductionRequestId) return false;
    if (!shell.mutualInterestAt) return false;
    if (shell.identityRevealedAt) return false;
    if (
      userId !== shell.participantSenderId &&
      userId !== shell.participantRecipientId
    ) {
      return false;
    }
    const other = counterpartId(shell, userId);
    if (!other || !this.isEligibleStudent(other)) return false;
    if (this.usersAreBlocked(userId, other)) return false;
    return true;
  }

  projectState(shell: Shell, userId: string): SafeState {
    if (
      userId !== shell.participantSenderId &&
      userId !== shell.participantRecipientId
    ) {
      return {
        eligible: false,
        hasProfile: false,
        selectedByMe: false,
        completed: false,
        completedAt: null,
        canWithdraw: false,
      };
    }
    const completed = Boolean(shell.identityRevealedAt);
    const eligible = this.isEligibleForIdentityReveal(shell, userId);
    const hasProfile = this.profiles.some(
      (p) =>
        p.conversationId === shell.id &&
        p.ownerUserId === userId &&
        !p.supersededAt,
    );
    const selectedByMe = this.consents.some(
      (c) =>
        c.conversationId === shell.id &&
        c.participantId === userId &&
        !c.withdrawnAt,
    );
    return {
      eligible: eligible && !completed,
      hasProfile,
      selectedByMe,
      completed,
      completedAt: completed ? shell.identityRevealedAt : null,
      canWithdraw: eligible && selectedByMe && !completed,
    };
  }

  getState(actorId: string | null, publicId: string): SafeState {
    if (!actorId || !this.isEligibleStudent(actorId)) {
      throw new Error("auth");
    }
    const shell = this.getShellByPublicId(publicId);
    if (!shell) {
      return {
        eligible: false,
        hasProfile: false,
        selectedByMe: false,
        completed: false,
        completedAt: null,
        canWithdraw: false,
      };
    }
    return this.projectState(shell, actorId);
  }

  /**
   * Mirrors the Next API + service_role register path:
   * authenticated actor is always the owner; client cannot supply another owner.
   */
  createProfileAsAuthenticated(input: {
    actorId: string | null;
    publicId: string;
    claimedOwnerUserId?: string;
    firstName: string;
    photoObjectKey: string;
  }) {
    if (!input.actorId || !this.isEligibleStudent(input.actorId)) {
      throw new Error("auth");
    }
    // Client-supplied owner is ignored; auth subject wins (same as profile route).
    const ownerUserId = input.actorId;
    void input.claimedOwnerUserId;
    return this.registerProfile({
      actorRole: "service_role",
      publicId: input.publicId,
      ownerUserId,
      firstName: input.firstName,
      photoObjectKey: input.photoObjectKey,
    });
  }

  registerProfile(input: {
    actorRole: "service_role" | "authenticated" | "anon";
    publicId: string;
    ownerUserId: string;
    firstName: string;
    photoObjectKey: string;
  }) {
    if (input.actorRole !== "service_role") throw new Error("service role required");
    const shell = this.getShellByPublicId(input.publicId);
    if (!shell) throw new Error("identity reveal unavailable");
    if (!this.isEligibleForIdentityReveal(shell, input.ownerUserId)) {
      throw new Error("identity reveal unavailable");
    }
    if (
      input.ownerUserId !== shell.participantSenderId &&
      input.ownerUserId !== shell.participantRecipientId
    ) {
      throw new Error("identity reveal unavailable");
    }
    if (shell.identityRevealedAt) throw new Error("identity reveal unavailable");
    if (shell.status === "ended" || shell.status === "blocked") {
      throw new Error("conversation closed");
    }

    for (const profile of this.profiles) {
      if (
        profile.conversationId === shell.id &&
        profile.ownerUserId === input.ownerUserId &&
        !profile.supersededAt
      ) {
        profile.supersededAt = nowIso();
      }
    }

    for (const consent of this.consents) {
      if (
        consent.conversationId === shell.id &&
        consent.participantId === input.ownerUserId &&
        !consent.withdrawnAt &&
        !shell.identityRevealedAt
      ) {
        consent.withdrawnAt = nowIso();
      }
    }

    const versionNumber =
      this.profiles.filter(
        (p) =>
          p.conversationId === shell.id && p.ownerUserId === input.ownerUserId,
      ).length + 1;

    const version: ProfileVersion = {
      id: this.nextId("ver"),
      conversationId: shell.id,
      ownerUserId: input.ownerUserId,
      versionNumber,
      firstName: input.firstName,
      photoObjectKey: input.photoObjectKey,
      supersededAt: null,
    };
    this.profiles.push(version);
    this.storageKeys.add(input.photoObjectKey);
    return version;
  }

  select(actorId: string | null, publicId: string, profileVersionId: string) {
    if (!actorId || !this.isEligibleStudent(actorId)) throw new Error("auth");
    const shell = this.getShellByPublicId(publicId);
    if (!shell) throw new Error("conversation unavailable");
    if (
      actorId !== shell.participantSenderId &&
      actorId !== shell.participantRecipientId
    ) {
      throw new Error("conversation unavailable");
    }
    if (shell.status === "ended" || shell.status === "blocked") {
      throw new Error("conversation closed");
    }
    const other = counterpartId(shell, actorId)!;
    if (this.usersAreBlocked(actorId, other)) {
      shell.status = "blocked";
      throw new Error("conversation closed");
    }
    if (shell.identityRevealedAt) return this.projectState(shell, actorId);
    if (!this.isEligibleForIdentityReveal(shell, actorId)) {
      throw new Error("identity reveal unavailable");
    }

    const profile = this.profiles.find((p) => p.id === profileVersionId);
    if (
      !profile ||
      profile.ownerUserId !== actorId ||
      profile.conversationId !== shell.id ||
      profile.supersededAt
    ) {
      throw new Error("identity reveal unavailable");
    }

    const existing = this.consents.find(
      (c) => c.conversationId === shell.id && c.participantId === actorId,
    );
    if (existing) {
      existing.profileVersionId = profile.id;
      existing.withdrawnAt = null;
    } else {
      this.consents.push({
        conversationId: shell.id,
        participantId: actorId,
        profileVersionId: profile.id,
        withdrawnAt: null,
      });
    }

    const active = this.consents.filter(
      (c) =>
        c.conversationId === shell.id &&
        !c.withdrawnAt &&
        (c.participantId === shell.participantSenderId ||
          c.participantId === shell.participantRecipientId),
    );
    if (active.length >= 2 && !shell.identityRevealedAt) {
      const sender = active.find(
        (c) => c.participantId === shell.participantSenderId,
      )!;
      const recipient = active.find(
        (c) => c.participantId === shell.participantRecipientId,
      )!;
      const revealedAt = nowIso();
      if (!this.snapshots.has(shell.id)) {
        this.snapshots.set(shell.id, {
          conversationId: shell.id,
          senderProfileVersionId: sender.profileVersionId,
          recipientProfileVersionId: recipient.profileVersionId,
          revealedAt,
        });
      }
      shell.identityRevealedAt = revealedAt;
      if (
        !this.events.some(
          (e) => e.conversationId === shell.id && e.type === "identity_revealed",
        )
      ) {
        this.events.push({ conversationId: shell.id, type: "identity_revealed" });
      }
    }
    return this.projectState(shell, actorId);
  }

  withdraw(actorId: string | null, publicId: string) {
    if (!actorId || !this.isEligibleStudent(actorId)) throw new Error("auth");
    const shell = this.getShellByPublicId(publicId);
    if (!shell) throw new Error("conversation unavailable");
    if (shell.identityRevealedAt) return this.projectState(shell, actorId);
    if (shell.status === "ended" || shell.status === "blocked") {
      throw new Error("conversation closed");
    }
    for (const consent of this.consents) {
      if (
        consent.conversationId === shell.id &&
        consent.participantId === actorId &&
        !consent.withdrawnAt
      ) {
        consent.withdrawnAt = nowIso();
      }
    }
    return this.projectState(shell, actorId);
  }

  getCompleted(actorId: string | null, publicId: string): CompletedProjection {
    const empty = {
      completed: false,
      completedAt: null,
      mineFirstName: null,
      counterpartFirstName: null,
    };
    if (!actorId || !this.isEligibleStudent(actorId)) throw new Error("auth");
    const shell = this.getShellByPublicId(publicId);
    if (!shell?.identityRevealedAt) return empty;
    if (
      actorId !== shell.participantSenderId &&
      actorId !== shell.participantRecipientId
    ) {
      return empty;
    }
    const snap = this.snapshots.get(shell.id);
    if (!snap) return empty;
    const mineVerId =
      actorId === shell.participantSenderId
        ? snap.senderProfileVersionId
        : snap.recipientProfileVersionId;
    const otherVerId =
      actorId === shell.participantSenderId
        ? snap.recipientProfileVersionId
        : snap.senderProfileVersionId;
    const mine = this.profiles.find((p) => p.id === mineVerId)!;
    const other = this.profiles.find((p) => p.id === otherVerId)!;
    const otherUser = counterpartId(shell, actorId)!;
    const hideCounterpart =
      shell.status === "blocked" || this.usersAreBlocked(actorId, otherUser);
    return {
      completed: true,
      completedAt: shell.identityRevealedAt,
      mineFirstName: mine.firstName,
      counterpartFirstName: hideCounterpart ? null : other.firstName,
    };
  }

  resolvePhoto(
    actorRole: "service_role" | "authenticated" | "anon",
    publicId: string,
    viewerId: string,
    which: "mine" | "counterpart",
  ) {
    if (actorRole !== "service_role") return null;
    const shell = this.getShellByPublicId(publicId);
    if (!shell?.identityRevealedAt) return null;
    if (
      viewerId !== shell.participantSenderId &&
      viewerId !== shell.participantRecipientId
    ) {
      return null;
    }
    const other = counterpartId(shell, viewerId)!;
    const hideCounterpart =
      shell.status === "blocked" || this.usersAreBlocked(viewerId, other);
    if (which === "counterpart" && hideCounterpart) return null;
    const snap = this.snapshots.get(shell.id);
    if (!snap) return null;
    const versionId =
      which === "mine"
        ? viewerId === shell.participantSenderId
          ? snap.senderProfileVersionId
          : snap.recipientProfileVersionId
        : viewerId === shell.participantSenderId
          ? snap.recipientProfileVersionId
          : snap.senderProfileVersionId;
    const version = this.profiles.find((p) => p.id === versionId);
    return version?.photoObjectKey ?? null;
  }

  resolvePreviewPhoto(
    actorRole: "service_role" | "authenticated" | "anon",
    publicId: string,
    ownerId: string,
  ) {
    if (actorRole !== "service_role") return null;
    const shell = this.getShellByPublicId(publicId);
    if (!shell) return null;
    if (!this.isEligibleForIdentityReveal(shell, ownerId)) return null;
    const version = this.profiles.find(
      (p) =>
        p.conversationId === shell.id &&
        p.ownerUserId === ownerId &&
        !p.supersededAt,
    );
    return version?.photoObjectKey ?? null;
  }

  listStorageAs(role: "anon" | "authenticated") {
    void role;
    return [] as string[];
  }

  endConversation(publicId: string) {
    const shell = this.getShellByPublicId(publicId);
    if (shell) shell.status = "ended";
  }

  blockConversation(publicId: string, a: string, b: string) {
    const shell = this.getShellByPublicId(publicId);
    if (shell) shell.status = "blocked";
    this.seedBlock(a, b);
  }
}
