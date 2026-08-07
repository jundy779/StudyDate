/**
 * Faithful in-memory behavior model for Contact Reveal v1 authorization.
 * Mirrors migration 202608060006 conversation-scoped, per-channel rules for
 * local tests without requiring the remote StudyDate database.
 */

import {
  CONTACT_REVEAL_CHANNELS,
  type ContactRevealChannel,
  type ContactRevealChannelState,
  type ContactRevealState,
} from "./constants.ts";

export type ConversationStatus =
  | "awaiting_chat"
  | "active"
  | "ended"
  | "blocked";

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

export type ContactVersion = {
  id: string;
  conversationId: string;
  ownerUserId: string;
  channel: ContactRevealChannel;
  versionNumber: number;
  contactValue: string;
  supersededAt: string | null;
};

export type Consent = {
  conversationId: string;
  participantId: string;
  channel: ContactRevealChannel;
  contactVersionId: string;
  withdrawnAt: string | null;
};

export type RevealSnapshot = {
  conversationId: string;
  channel: ContactRevealChannel;
  senderContactVersionId: string;
  recipientContactVersionId: string;
  revealedAt: string;
};

export type CompletedProjection = {
  channel: ContactRevealChannel;
  completed: boolean;
  completedAt: string | null;
  mineDisplay: string | null;
  counterpartDisplay: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function counterpartId(shell: Shell, userId: string) {
  if (userId === shell.participantSenderId) return shell.participantRecipientId;
  if (userId === shell.participantRecipientId) return shell.participantSenderId;
  return null;
}

function emptyChannel(channel: ContactRevealChannel): ContactRevealChannelState {
  return {
    channel,
    eligible: false,
    hasContact: false,
    selectedByMe: false,
    completed: false,
    completedAt: null,
    canWithdraw: false,
  };
}

function emptyState(): ContactRevealState {
  return {
    channels: CONTACT_REVEAL_CHANNELS.map((channel) => emptyChannel(channel)),
  };
}

export class ContactRevealBehaviorModel {
  shells = new Map<string, Shell>();
  byPublicId = new Map<string, string>();
  staff = new Set<string>();
  onboarded = new Set<string>();
  blocks = new Set<string>();
  versions: ContactVersion[] = [];
  consents: Consent[] = [];
  snapshots = new Map<string, RevealSnapshot>();
  events: Array<{ conversationId: string; type: string; channel?: string }> =
    [];
  idSeq = 1;

  private nextId(prefix: string) {
    this.idSeq += 1;
    return `${prefix}-${this.idSeq}`;
  }

  private snapshotKey(conversationId: string, channel: ContactRevealChannel) {
    return `${conversationId}:${channel}`;
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
    identityRevealed?: boolean;
  }) {
    const id = this.nextId("shell");
    const shell: Shell = {
      id,
      publicId: input.publicId,
      status: input.status ?? "active",
      participantSenderId: input.senderId,
      participantRecipientId: input.recipientId,
      mutualInterestAt: input.mutual ? nowIso() : null,
      identityRevealedAt: input.identityRevealed ? nowIso() : null,
      introductionRequestId: this.nextId("intro"),
    };
    this.shells.set(id, shell);
    this.byPublicId.set(input.publicId, id);
    return shell;
  }

  getShellByPublicId(publicId: string) {
    const id = this.byPublicId.get(publicId);
    return id ? (this.shells.get(id) ?? null) : null;
  }

  isEligibleForContactReveal(shell: Shell, userId: string) {
    if (!this.isEligibleStudent(userId)) return false;
    if (shell.status !== "active") return false;
    if (!shell.introductionRequestId) return false;
    if (!shell.mutualInterestAt) return false;
    if (!shell.identityRevealedAt) return false;
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

  private isChannelCompleted(shell: Shell, channel: ContactRevealChannel) {
    return this.snapshots.has(this.snapshotKey(shell.id, channel));
  }

  projectChannel(
    shell: Shell,
    userId: string,
    channel: ContactRevealChannel,
  ): ContactRevealChannelState {
    if (
      userId !== shell.participantSenderId &&
      userId !== shell.participantRecipientId
    ) {
      return emptyChannel(channel);
    }

    const snap = this.snapshots.get(this.snapshotKey(shell.id, channel));
    const completed = Boolean(snap);
    const eligible =
      this.isEligibleForContactReveal(shell, userId) && !completed;
    const hasContact = this.versions.some(
      (v) =>
        v.conversationId === shell.id &&
        v.ownerUserId === userId &&
        v.channel === channel &&
        !v.supersededAt,
    );
    const selectedByMe = this.consents.some(
      (c) =>
        c.conversationId === shell.id &&
        c.participantId === userId &&
        c.channel === channel &&
        !c.withdrawnAt,
    );

    return {
      channel,
      eligible,
      hasContact,
      selectedByMe,
      completed,
      completedAt: snap?.revealedAt ?? null,
      canWithdraw: eligible && selectedByMe && !completed,
    };
  }

  projectState(shell: Shell, userId: string): ContactRevealState {
    return {
      channels: CONTACT_REVEAL_CHANNELS.map((channel) =>
        this.projectChannel(shell, userId, channel),
      ),
    };
  }

  getState(actorId: string | null, publicId: string): ContactRevealState {
    if (!actorId || !this.isEligibleStudent(actorId)) {
      throw new Error("auth");
    }
    const shell = this.getShellByPublicId(publicId);
    if (!shell) return emptyState();
    return this.projectState(shell, actorId);
  }

  createContactAsAuthenticated(input: {
    actorId: string | null;
    publicId: string;
    channel: ContactRevealChannel;
    claimedOwnerUserId?: string;
    value: string;
  }) {
    if (!input.actorId || !this.isEligibleStudent(input.actorId)) {
      throw new Error("auth");
    }
    const ownerUserId = input.actorId;
    void input.claimedOwnerUserId;
    return this.registerVersion({
      actorRole: "service_role",
      publicId: input.publicId,
      ownerUserId,
      channel: input.channel,
      value: input.value,
    });
  }

  registerVersion(input: {
    actorRole: "service_role" | "authenticated" | "anon";
    publicId: string;
    ownerUserId: string;
    channel: ContactRevealChannel;
    value: string;
  }) {
    if (input.actorRole !== "service_role") {
      throw new Error("service role required");
    }
    const shell = this.getShellByPublicId(input.publicId);
    if (!shell) throw new Error("contact reveal unavailable");
    if (
      input.ownerUserId !== shell.participantSenderId &&
      input.ownerUserId !== shell.participantRecipientId
    ) {
      throw new Error("contact reveal unavailable");
    }
    if (this.isChannelCompleted(shell, input.channel)) {
      throw new Error("contact reveal unavailable");
    }
    if (shell.status === "ended" || shell.status === "blocked") {
      throw new Error("conversation closed");
    }
    if (!this.isEligibleForContactReveal(shell, input.ownerUserId)) {
      throw new Error("contact reveal unavailable");
    }

    for (const version of this.versions) {
      if (
        version.conversationId === shell.id &&
        version.ownerUserId === input.ownerUserId &&
        version.channel === input.channel &&
        !version.supersededAt
      ) {
        version.supersededAt = nowIso();
      }
    }

    for (const consent of this.consents) {
      if (
        consent.conversationId === shell.id &&
        consent.participantId === input.ownerUserId &&
        consent.channel === input.channel &&
        !consent.withdrawnAt &&
        !this.isChannelCompleted(shell, input.channel)
      ) {
        consent.withdrawnAt = nowIso();
      }
    }

    const versionNumber =
      this.versions.filter(
        (v) =>
          v.conversationId === shell.id &&
          v.ownerUserId === input.ownerUserId &&
          v.channel === input.channel,
      ).length + 1;

    const version: ContactVersion = {
      id: this.nextId("cver"),
      conversationId: shell.id,
      ownerUserId: input.ownerUserId,
      channel: input.channel,
      versionNumber,
      contactValue: input.value,
      supersededAt: null,
    };
    this.versions.push(version);
    return version;
  }

  select(
    actorId: string | null,
    publicId: string,
    channel: ContactRevealChannel,
    contactVersionId: string,
  ) {
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
    if (this.isChannelCompleted(shell, channel)) {
      return this.projectState(shell, actorId);
    }
    if (!this.isEligibleForContactReveal(shell, actorId)) {
      throw new Error("contact reveal unavailable");
    }

    const version = this.versions.find((v) => v.id === contactVersionId);
    if (
      !version ||
      version.ownerUserId !== actorId ||
      version.conversationId !== shell.id ||
      version.channel !== channel ||
      version.supersededAt
    ) {
      throw new Error("contact reveal unavailable");
    }

    const existing = this.consents.find(
      (c) =>
        c.conversationId === shell.id &&
        c.participantId === actorId &&
        c.channel === channel,
    );
    if (existing) {
      existing.contactVersionId = version.id;
      existing.withdrawnAt = null;
    } else {
      this.consents.push({
        conversationId: shell.id,
        participantId: actorId,
        channel,
        contactVersionId: version.id,
        withdrawnAt: null,
      });
    }

    const active = this.consents.filter(
      (c) =>
        c.conversationId === shell.id &&
        c.channel === channel &&
        !c.withdrawnAt &&
        (c.participantId === shell.participantSenderId ||
          c.participantId === shell.participantRecipientId),
    );

    if (active.length >= 2 && !this.isChannelCompleted(shell, channel)) {
      const sender = active.find(
        (c) => c.participantId === shell.participantSenderId,
      )!;
      const recipient = active.find(
        (c) => c.participantId === shell.participantRecipientId,
      )!;
      const revealedAt = nowIso();
      const key = this.snapshotKey(shell.id, channel);
      if (!this.snapshots.has(key)) {
        this.snapshots.set(key, {
          conversationId: shell.id,
          channel,
          senderContactVersionId: sender.contactVersionId,
          recipientContactVersionId: recipient.contactVersionId,
          revealedAt,
        });
      }
      if (
        !this.events.some(
          (e) =>
            e.conversationId === shell.id &&
            e.type === "contact_revealed" &&
            e.channel === channel,
        )
      ) {
        this.events.push({
          conversationId: shell.id,
          type: "contact_revealed",
          channel,
        });
      }
    }

    return this.projectState(shell, actorId);
  }

  withdraw(
    actorId: string | null,
    publicId: string,
    channel: ContactRevealChannel,
  ) {
    if (!actorId || !this.isEligibleStudent(actorId)) throw new Error("auth");
    const shell = this.getShellByPublicId(publicId);
    if (!shell) throw new Error("conversation unavailable");
    if (this.isChannelCompleted(shell, channel)) {
      return this.projectState(shell, actorId);
    }
    if (shell.status === "ended" || shell.status === "blocked") {
      throw new Error("conversation closed");
    }
    for (const consent of this.consents) {
      if (
        consent.conversationId === shell.id &&
        consent.participantId === actorId &&
        consent.channel === channel &&
        !consent.withdrawnAt
      ) {
        consent.withdrawnAt = nowIso();
      }
    }
    return this.projectState(shell, actorId);
  }

  getCompleted(
    actorId: string | null,
    publicId: string,
    channel: ContactRevealChannel,
  ): CompletedProjection {
    const empty: CompletedProjection = {
      channel,
      completed: false,
      completedAt: null,
      mineDisplay: null,
      counterpartDisplay: null,
    };
    if (!actorId || !this.isEligibleStudent(actorId)) throw new Error("auth");
    const shell = this.getShellByPublicId(publicId);
    if (!shell) return empty;
    const snap = this.snapshots.get(this.snapshotKey(shell.id, channel));
    if (!snap) return empty;
    if (
      actorId !== shell.participantSenderId &&
      actorId !== shell.participantRecipientId
    ) {
      return empty;
    }
    const mineVerId =
      actorId === shell.participantSenderId
        ? snap.senderContactVersionId
        : snap.recipientContactVersionId;
    const otherVerId =
      actorId === shell.participantSenderId
        ? snap.recipientContactVersionId
        : snap.senderContactVersionId;
    const mine = this.versions.find((v) => v.id === mineVerId)!;
    const other = this.versions.find((v) => v.id === otherVerId)!;
    const otherUser = counterpartId(shell, actorId)!;
    const hideCounterpart =
      shell.status === "blocked" || this.usersAreBlocked(actorId, otherUser);
    return {
      channel,
      completed: true,
      completedAt: snap.revealedAt,
      mineDisplay: mine.contactValue,
      counterpartDisplay: hideCounterpart ? null : other.contactValue,
    };
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
