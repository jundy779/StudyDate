import {
  EVENT_TIMEZONES,
  EVENT_VENUE_CATEGORIES,
  type EventTimezone,
  type EventVenueCategory,
} from "../events/constants.ts";

export const MEETING_TIMEZONES = EVENT_TIMEZONES;
export const MEETING_VENUE_CATEGORIES = EVENT_VENUE_CATEGORIES;

export type MeetingTimezone = EventTimezone;
export type MeetingVenueCategory = EventVenueCategory;
export type MeetingPlanStatus =
  | "pending_confirmation"
  | "confirmed"
  | "cancelled";

export type MeetingPlanState = {
  eligible: boolean;
  planPublicId: string | null;
  status: MeetingPlanStatus | null;
  createdByMe: boolean;
  selectedByMe: boolean;
  venueCategory: MeetingVenueCategory | null;
  venueName: string | null;
  venueArea: string | null;
  city: string | null;
  startsAt: string | null;
  expectedEndAt: string | null;
  timezone: MeetingTimezone | null;
  precheckAcknowledgedAt: string | null;
  postcheckStatus: "safe" | "report_started" | null;
  postcheckAt: string | null;
};

export const EMPTY_MEETING_PLAN_STATE: MeetingPlanState = {
  eligible: false,
  planPublicId: null,
  status: null,
  createdByMe: false,
  selectedByMe: false,
  venueCategory: null,
  venueName: null,
  venueArea: null,
  city: null,
  startsAt: null,
  expectedEndAt: null,
  timezone: null,
  precheckAcknowledgedAt: null,
  postcheckStatus: null,
  postcheckAt: null,
};
