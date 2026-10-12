export type StudyStatus =
  | "study_friend"
  | "discussion_friend"
  | "project_friend";

export type DiscoveryProfile = {
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  city_region: string | null;
  short_intro: string | null;
  interests: string[];
  connection_goals: string[];
  is_verified: boolean;
  study_status: StudyStatus | null;
  study_status_expires_at: string | null;
};

export type IntroductionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type IntroductionListItem = {
  request_id: string;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  opening_message: string;
  status: IntroductionStatus;
  created_at: string;
  responded_at: string | null;
};

export type IntroductionEligibilityState =
  | "ok"
  | "self"
  | "unavailable"
  | "pending"
  | "cooldown"
  | "rate_limited"
  | "quota_reached"
  | "blocked";

export type IntroductionEligibility = {
  can_send: boolean;
  state_code: IntroductionEligibilityState;
};
