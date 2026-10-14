export type CircleTopic = "coding" | "data_science" | "design" | "mathematics" | "languages" | "thesis" | "exam_prep" | "general" | "other";
export type CommunityScope = "open" | "campus";

export type CircleSummary = {
  public_slug: string;
  name: string;
  description: string;
  topic: CircleTopic;
  scope: CommunityScope;
  campus_scope: string | null;
  member_limit: number;
  member_count: number;
  membership_state: "active" | "left" | "removed" | null;
  is_owner: boolean;
  created_at: string;
};

export type CircleDetail = CircleSummary & {
  status: "active" | "archived";
  can_join: boolean;
  can_leave: boolean;
  archived_at: string | null;
};

export type EventCategory = "study_together" | "coding_tech" | "design" | "languages" | "thesis" | "exam_prep" | "workshop" | "discussion" | "networking" | "community" | "seminar" | "meetup" | "hackathon" | "other";
export type EventRegistrationStatus = "pending" | "going" | "waitlisted" | "declined" | "cancelled";

export type EventSummary = {
  public_slug: string;
  title: string;
  description: string;
  category: EventCategory;
  scope: CommunityScope;
  campus_scope: string | null;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  venue_category: string;
  venue_name: string;
  venue_area: string;
  city: string;
  capacity: number;
  attendee_count: number;
  rsvp_status: EventRegistrationStatus | null;
  is_organizer: boolean;
};

export type EventDetail = EventSummary & {
  organizer_alias: string;
  organizer_is_verified: boolean;
  status: "scheduled" | "cancelled" | "archived";
  is_past: boolean;
  can_rsvp: boolean;
  can_cancel_rsvp: boolean;
  is_official: boolean;
  registration_mode: "instant" | "approval";
  waitlist_enabled: boolean;
  registration_closes_at: string | null;
};

export type EventQuestion = {
  question_public_id: string;
  question_type: "short_text" | "single_select" | "multi_select" | "checkbox";
  prompt: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
};
