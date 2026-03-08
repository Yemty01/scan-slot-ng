import type { CreateBookingInput, BookingRow, BookingStatus, BookingActor } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canTransition,
  CANCELLATION_STATUSES,
  BOOKING_TERMINAL_STATUSES,
} from "./constants";
import { validateSlotForBooking } from "./slot-validation";
import { InvalidTransitionError, BookingNotFoundError } from "./errors";
import type { AvailabilitySlotRow } from "@/types";

const BOOKINGS = "bookings";
const AVAILABILITY_SLOTS = "availability_slots";

/** Fetch a single slot by id */
export async function getSlot(
  supabase: SupabaseClient,
  slotId: string
): Promise<AvailabilitySlotRow | null> {
  const { data, error } = await supabase
    .from(AVAILABILITY_SLOTS)
    .select("*")
    .eq("id", slotId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as AvailabilitySlotRow | null;
}

/** Create a booking after validating the slot. Does not confirm; payment flow confirms. */
export async function createBooking(
  supabase: SupabaseClient,
  input: CreateBookingInput
): Promise<BookingRow> {
  const slot = await getSlot(supabase, input.slot_id);
  validateSlotForBooking(slot, {
    slot_id: input.slot_id,
    service_id: input.service_id,
    branch_id: input.branch_id,
    provider_id: input.provider_id,
  });

  const status: BookingStatus = input.awaiting_payment ? "payment_pending" : "pending";
  const { data, error } = await supabase
    .from(BOOKINGS)
    .insert({
      patient_id: input.patient_id,
      service_id: input.service_id,
      slot_id: input.slot_id,
      provider_id: input.provider_id,
      branch_id: input.branch_id,
      status,
      amount: input.amount,
      currency: input.currency ?? "NGN",
      referral_document_url: input.referral_document_url ?? null,
      patient_notes: input.patient_notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BookingRow;
}

export interface TransitionBookingStatusInput {
  booking_id: string;
  new_status: BookingStatus;
  actor: BookingActor;
  actor_id: string;
  /** Required when new_status is cancelled_* or no_show */
  reason?: string | null;
}

/** Get booking by id */
export async function getBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<BookingRow | null> {
  const { data, error } = await supabase
    .from(BOOKINGS)
    .select("*")
    .eq("id", bookingId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as BookingRow | null;
}

/**
 * Transition booking to a new status with validation.
 * Enforces allowed transitions per actor and sets cancelled_at/cancelled_by/reason when applicable.
 */
export async function transitionBookingStatus(
  supabase: SupabaseClient,
  input: TransitionBookingStatusInput
): Promise<BookingRow> {
  const booking = await getBooking(supabase, input.booking_id);
  if (!booking) {
    throw new BookingNotFoundError(input.booking_id);
  }

  if (BOOKING_TERMINAL_STATUSES.includes(booking.status)) {
    throw new InvalidTransitionError(
      booking.status,
      input.new_status,
      input.actor
    );
  }

  if (!canTransition(booking.status, input.new_status, input.actor)) {
    throw new InvalidTransitionError(
      booking.status,
      input.new_status,
      input.actor
    );
  }

  const isCancellation = CANCELLATION_STATUSES.includes(input.new_status);
  const updates: Record<string, unknown> = {
    status: input.new_status,
    updated_at: new Date().toISOString(),
  };

  if (isCancellation) {
    updates.cancelled_at = new Date().toISOString();
    updates.cancelled_by = input.actor_id;
    if (input.reason != null) updates.cancelled_reason = input.reason;
  }

  if (input.new_status === "provider_confirmed") {
    updates.confirmed_at = booking.confirmed_at ?? new Date().toISOString();
  }

  if (input.new_status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(BOOKINGS)
    .update(updates)
    .eq("id", input.booking_id)
    .select()
    .single();

  if (error) throw error;
  return data as BookingRow;
}

/**
 * Resolve actor from role string for use in transitionBookingStatus.
 */
export function actorFromRole(role: string): BookingActor {
  if (role === "patient") return "patient";
  if (role === "super_admin" || role === "support") return "admin";
  if (role === "provider_admin" || role === "provider_staff") return "provider";
  return "patient";
}

/**
 * Check if the current user can perform the status transition on this booking.
 * Caller must pass the booking and the current user's role and id.
 */
export function canActorTransitionBooking(
  booking: BookingRow,
  newStatus: BookingStatus,
  actor: BookingActor,
  userId: string
): { allowed: boolean; error?: string } {
  if (booking.patient_id !== userId && actor === "patient") {
    return { allowed: false, error: "Not your booking" };
  }
  if (BOOKING_TERMINAL_STATUSES.includes(booking.status)) {
    return { allowed: false, error: "Booking is in a terminal status" };
  }
  if (!canTransition(booking.status, newStatus, actor)) {
    return {
      allowed: false,
      error: `Transition from ${booking.status} to ${newStatus} not allowed for ${actor}`,
    };
  }
  return { allowed: true };
}
