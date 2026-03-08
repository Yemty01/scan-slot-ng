import type { BookingStatus, BookingActor } from "@/types";

/**
 * Allowed booking status transitions by actor.
 * Key: current status → Set of (next status, allowed actors).
 */
export const BOOKING_STATUS_TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<BookingStatus, BookingActor[]>>
> = {
  pending: {
    payment_pending: ["patient"],
    cancelled_patient: ["patient"],
  },
  payment_pending: {
    confirmed: ["admin"], // payment webhook / admin
    cancelled_patient: ["patient"],
  },
  confirmed: {
    provider_confirmed: ["provider", "admin"],
    cancelled_patient: ["patient"],
    cancelled_provider: ["provider", "admin"],
    no_show: ["provider", "admin"],
  },
  provider_confirmed: {
    in_progress: ["provider", "admin"],
    cancelled_patient: ["patient"],
    cancelled_provider: ["provider", "admin"],
    no_show: ["provider", "admin"],
  },
  in_progress: {
    completed: ["provider", "admin"],
  },
  completed: {
    report_ready: ["provider", "admin"], // or via report upload trigger
  },
  report_ready: {
    disputed: ["patient", "provider", "admin"],
  },
  cancelled_patient: {},
  cancelled_provider: {},
  no_show: {},
  disputed: {
    refunded: ["admin"],
    cancelled_patient: ["admin"],
    cancelled_provider: ["admin"],
  },
  refunded: {},
};

/** Terminal statuses: no further transitions allowed */
export const BOOKING_TERMINAL_STATUSES: BookingStatus[] = [
  "cancelled_patient",
  "cancelled_provider",
  "no_show",
  "refunded",
];

/** Statuses that require cancellation metadata when transitioning to a cancelled/no_show state */
export const CANCELLATION_STATUSES: BookingStatus[] = [
  "cancelled_patient",
  "cancelled_provider",
  "no_show",
];

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor
): boolean {
  if (from === to) return false;
  const allowed = BOOKING_STATUS_TRANSITIONS[from]?.[to];
  if (!allowed?.length) return false;
  return allowed.includes(actor);
}

/** Returns list of statuses the actor can transition to from the current status */
export function getAllowedNextStatuses(
  currentStatus: BookingStatus,
  actor: BookingActor
): BookingStatus[] {
  if (BOOKING_TERMINAL_STATUSES.includes(currentStatus)) return [];
  const transitions = BOOKING_STATUS_TRANSITIONS[currentStatus];
  if (!transitions) return [];
  return (Object.entries(transitions) as [BookingStatus, BookingActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([status]) => status);
}
