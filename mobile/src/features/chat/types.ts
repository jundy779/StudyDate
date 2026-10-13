export type ConversationStatus =
  | "awaiting_chat"
  | "active"
  | "ended"
  | "blocked";

export type ConversationListItem = {
  public_id: string;
  status: ConversationStatus;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  preview_body: string | null;
  last_activity_at: string;
  unread_count: number;
  created_at: string;
};

export type ConversationDetail = {
  public_id: string;
  status: ConversationStatus;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  created_at: string;
  activated_at: string | null;
  ended_at: string | null;
  unread_count: number;
  can_send: boolean;
};

export type ChatMessageType =
  | "text"
  | "sticker"
  | "circle_invite"
  | "event_invite";

export type ChatReactionValue =
  | "like"
  | "love"
  | "laugh"
  | "support"
  | "celebrate";

export type ChatReactionSummary = {
  reaction: ChatReactionValue;
  count: number;
  reacted_by_me: boolean;
};

export type ChatStickerId =
  | "studydate_hello"
  | "studydate_study"
  | "studydate_chat"
  | "studydate_ready";

export type ChatShareKind = "circle" | "event";

export type ChatShareableItem = {
  share_kind: ChatShareKind;
  public_slug: string;
  title: string;
  description: string;
  meta: string;
  starts_at: string | null;
  timezone_name: string | null;
};

export type ChatMessage = {
  message_id: string;
  body: string;
  message_type: ChatMessageType;
  sticker_id: string | null;
  share_kind: ChatShareKind | null;
  share_public_slug: string | null;
  share_title: string | null;
  share_description: string | null;
  is_mine: boolean;
  created_at: string;
  read_at: string | null;
  moderation_status: "visible" | "removed";
  reply_message_id: string | null;
  reply_body: string | null;
  reply_is_mine: boolean;
  reactions: ChatReactionSummary[];
};

export type ConversationView = "all" | "unread" | "active" | "ended";

export type ReportReasonCode =
  | "harassment"
  | "spam"
  | "contact_pressure"
  | "fake_or_misleading"
  | "other";
