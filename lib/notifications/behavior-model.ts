import type {
  NotificationChannel,
  NotificationItem,
  NotificationType,
} from "@/lib/notifications/constants";

type StoredNotification = NotificationItem & {
  recipientId: string;
  dedupeKey: string;
};

type Conversation = {
  publicId: string;
  participants: [string, string];
  status: "active" | "ended" | "blocked";
  mutual: Set<string>;
  identity: Set<string>;
  contacts: Map<NotificationChannel, Set<string>>;
};

export class NotificationBehaviorModel {
  readonly rows: StoredNotification[] = [];
  private readonly students = new Set<string>();
  private readonly staff = new Set<string>();
  private readonly blockedPairs = new Set<string>();
  private readonly acceptedIntroductions = new Set<string>();
  private readonly messageKeys = new Map<string, string>();
  private readonly conversations = new Map<string, Conversation>();
  private sequence = 0;

  seedStudent(userId: string) {
    this.students.add(userId);
  }

  seedStaff(userId: string) {
    this.staff.add(userId);
  }

  seedConversation(publicId: string, a: string, b: string) {
    this.conversations.set(publicId, {
      publicId,
      participants: [a, b],
      status: "active",
      mutual: new Set(),
      identity: new Set(),
      contacts: new Map(),
    });
  }

  private requireStudent(actorId: string | null) {
    if (
      !actorId ||
      !this.students.has(actorId) ||
      this.staff.has(actorId)
    ) {
      throw new Error("student access required");
    }
  }

  private pairKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  private emit(
    recipientId: string,
    type: NotificationType,
    targetPath: string,
    dedupeKey: string,
    channel: NotificationChannel | null = null,
  ) {
    if (
      !this.students.has(recipientId) ||
      this.staff.has(recipientId) ||
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
      channel,
      createdAt: new Date(this.sequence * 1000).toISOString(),
      readAt: null,
      dedupeKey,
    });
  }

  sendIntroduction(actorId: string, recipientId: string, requestId: string) {
    this.requireStudent(actorId);
    this.requireStudent(recipientId);
    if (this.blockedPairs.has(this.pairKey(actorId, recipientId))) {
      throw new Error("interaction unavailable");
    }
    this.emit(
      recipientId,
      "INTRODUCTION_RECEIVED",
      "/app/introductions",
      `introduction_received:${requestId}`,
    );
  }

  acceptIntroduction(
    actorId: string,
    senderId: string,
    requestId: string,
  ) {
    this.requireStudent(actorId);
    this.requireStudent(senderId);
    if (this.acceptedIntroductions.has(requestId)) return;
    this.acceptedIntroductions.add(requestId);
    this.emit(
      senderId,
      "INTRODUCTION_ACCEPTED",
      "/app/introductions",
      `introduction_accepted:${requestId}`,
    );
  }

  sendMessage(
    actorId: string,
    publicId: string,
    messageId: string,
    idempotencyKey: string,
  ) {
    this.requireStudent(actorId);
    const conversation = this.requireConversation(actorId, publicId);
    const existingMessage = this.messageKeys.get(`${actorId}:${idempotencyKey}`);
    if (existingMessage) return existingMessage;
    this.messageKeys.set(`${actorId}:${idempotencyKey}`, messageId);

    const recipientId = conversation.participants.find(
      (participant) => participant !== actorId,
    );
    if (!recipientId) throw new Error("conversation unavailable");
    this.emit(
      recipientId,
      "MESSAGE_RECEIVED",
      `/app/messages/${publicId}`,
      `message_received:${messageId}`,
    );
    return messageId;
  }

  selectMutual(actorId: string, publicId: string) {
    const conversation = this.requireConversation(actorId, publicId);
    conversation.mutual.add(actorId);
    if (conversation.mutual.size !== 2) return;
    for (const recipientId of conversation.participants) {
      this.emit(
        recipientId,
        "MUTUAL_INTEREST_COMPLETED",
        `/app/messages/${publicId}`,
        `mutual_completed:${publicId}:${recipientId}`,
      );
    }
  }

  withdrawMutual(actorId: string, publicId: string) {
    const conversation = this.requireConversation(actorId, publicId);
    if (conversation.mutual.size < 2) conversation.mutual.delete(actorId);
  }

  prepareIdentity(actorId: string, publicId: string) {
    this.requireConversation(actorId, publicId);
  }

  selectIdentity(actorId: string, publicId: string) {
    const conversation = this.requireConversation(actorId, publicId);
    conversation.identity.add(actorId);
    if (conversation.identity.size !== 2) return;
    for (const recipientId of conversation.participants) {
      this.emit(
        recipientId,
        "IDENTITY_REVEAL_COMPLETED",
        `/app/messages/${publicId}`,
        `identity_completed:${publicId}:${recipientId}`,
      );
    }
  }

  withdrawIdentity(actorId: string, publicId: string) {
    const conversation = this.requireConversation(actorId, publicId);
    if (conversation.identity.size < 2) conversation.identity.delete(actorId);
  }

  prepareContact(
    actorId: string,
    publicId: string,
    channel: NotificationChannel,
  ) {
    if (!["telegram", "instagram", "linkedin"].includes(channel)) {
      throw new Error("invalid channel");
    }
    this.requireConversation(actorId, publicId);
  }

  selectContact(
    actorId: string,
    publicId: string,
    channel: NotificationChannel,
  ) {
    const conversation = this.requireConversation(actorId, publicId);
    const selected = conversation.contacts.get(channel) ?? new Set<string>();
    selected.add(actorId);
    conversation.contacts.set(channel, selected);
    if (selected.size !== 2) return;
    for (const recipientId of conversation.participants) {
      this.emit(
        recipientId,
        "CONTACT_REVEAL_COMPLETED",
        `/app/messages/${publicId}`,
        `contact_completed:${publicId}:${channel}:${recipientId}`,
        channel,
      );
    }
  }

  withdrawContact(
    actorId: string,
    publicId: string,
    channel: NotificationChannel,
  ) {
    const conversation = this.requireConversation(actorId, publicId);
    const selected = conversation.contacts.get(channel);
    if (selected && selected.size < 2) selected.delete(actorId);
  }

  block(a: string, b: string, publicId?: string) {
    this.blockedPairs.add(this.pairKey(a, b));
    if (publicId) {
      const conversation = this.conversations.get(publicId);
      if (conversation) conversation.status = "blocked";
    }
  }

  end(publicId: string) {
    const conversation = this.conversations.get(publicId);
    if (conversation) conversation.status = "ended";
  }

  list(actorId: string | null) {
    this.requireStudent(actorId);
    return this.rows
      .filter((row) => row.recipientId === actorId)
      .map((row) => ({
        publicId: row.publicId,
        type: row.type,
        targetPath: row.targetPath,
        channel: row.channel,
        createdAt: row.createdAt,
        readAt: row.readAt,
      }));
  }

  unreadCount(actorId: string | null) {
    return this.list(actorId).filter((row) => row.readAt === null).length;
  }

  markRead(actorId: string | null, publicId: string) {
    this.requireStudent(actorId);
    const row = this.rows.find(
      (candidate) =>
        candidate.publicId === publicId && candidate.recipientId === actorId,
    );
    if (!row) return false;
    row.readAt ??= new Date().toISOString();
    return true;
  }

  markAllRead(actorId: string | null) {
    this.requireStudent(actorId);
    let count = 0;
    for (const row of this.rows) {
      if (row.recipientId === actorId && row.readAt === null) {
        row.readAt = new Date().toISOString();
        count += 1;
      }
    }
    return count;
  }

  private requireConversation(actorId: string, publicId: string) {
    this.requireStudent(actorId);
    const conversation = this.conversations.get(publicId);
    if (
      !conversation ||
      !conversation.participants.includes(actorId) ||
      conversation.status !== "active" ||
      this.blockedPairs.has(
        this.pairKey(
          conversation.participants[0],
          conversation.participants[1],
        ),
      )
    ) {
      throw new Error("conversation unavailable");
    }
    return conversation;
  }
}
