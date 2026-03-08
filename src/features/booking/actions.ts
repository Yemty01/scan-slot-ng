"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createBooking,
  getSlot,
  getBooking,
  transitionBookingStatus,
  actorFromRole,
  canActorTransitionBooking,
  validateSlotForBooking,
} from "@/lib/booking";
import type { CreateBookingInput, BookingStatus } from "@/types";
import type { BookingRow } from "@/types";

export type CreateBookingResult =
  | { success: true; booking: BookingRow }
  | { success: false; error: string; code?: string };

export async function createBookingAction(
  input: Omit<CreateBookingInput, "patient_id">
): Promise<CreateBookingResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const fullInput: CreateBookingInput = {
      ...input,
      patient_id: user.id,
    };
    const booking = await createBooking(supabase, fullInput);
    return { success: true, booking };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create booking";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : undefined;
    return { success: false, error: message, code };
  }
}

export type ValidateSlotResult =
  | { valid: true }
  | { valid: false; error: string; code?: string };

export async function validateSlotAction(
  slotId: string,
  context: { service_id: string; branch_id: string; provider_id?: string }
): Promise<ValidateSlotResult> {
  const supabase = await createClient();
  try {
    const slot = await getSlot(supabase, slotId);
    validateSlotForBooking(slot, {
      slot_id: slotId,
      service_id: context.service_id,
      branch_id: context.branch_id,
      provider_id: context.provider_id,
    });
    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Slot unavailable";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : undefined;
    return { valid: false, error: message, code };
  }
}

export type TransitionStatusResult =
  | { success: true; booking: BookingRow }
  | { success: false; error: string; code?: string };

export async function transitionBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatus,
  reason?: string | null
): Promise<TransitionStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  const booking = await getBooking(supabase, bookingId);
  if (!booking) {
    return { success: false, error: "Booking not found", code: "BOOKING_NOT_FOUND" };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (userRow?.role as string) ?? "patient";
  const actor = actorFromRole(role);

  const { allowed, error: checkError } = canActorTransitionBooking(
    booking,
    newStatus,
    actor,
    user.id
  );

  if (!allowed) {
    return {
      success: false,
      error: checkError ?? "Transition not allowed",
      code: "INVALID_TRANSITION",
    };
  }

  try {
    const updated = await transitionBookingStatus(supabase, {
      booking_id: bookingId,
      new_status: newStatus,
      actor,
      actor_id: user.id,
      reason,
    });
    return { success: true, booking: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update status";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : undefined;
    return { success: false, error: message, code };
  }
}
