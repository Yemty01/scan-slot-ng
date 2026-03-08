import type { AvailabilitySlotRow } from "@/types";
import { SlotUnavailableError, SlotNotFoundError } from "./errors";

export interface SlotValidationContext {
  slot_id: string;
  service_id: string;
  branch_id: string;
  provider_id?: string;
}

/**
 * Validates that a slot exists and is bookable.
 * - Slot must exist and match service_id, branch_id (and optionally provider_id).
 * - status must be 'available'.
 * - start_time must be in the future.
 * - booked_count < capacity.
 */
export function validateSlotForBooking(
  slot: AvailabilitySlotRow | null,
  context: SlotValidationContext
): asserts slot is AvailabilitySlotRow {
  if (!slot) {
    throw new SlotNotFoundError(context.slot_id);
  }

  if (slot.service_id !== context.service_id) {
    throw new SlotUnavailableError(
      "Slot does not belong to the selected service"
    );
  }

  if (slot.branch_id !== context.branch_id) {
    throw new SlotUnavailableError(
      "Slot does not belong to the selected branch"
    );
  }

  if (context.provider_id != null && slot.provider_id !== context.provider_id) {
    throw new SlotUnavailableError(
      "Slot does not belong to the selected provider"
    );
  }

  if (slot.status !== "available") {
    throw new SlotUnavailableError(
      `Slot is not available (status: ${slot.status})`
    );
  }

  const now = new Date().toISOString();
  if (slot.start_time <= now) {
    throw new SlotUnavailableError("Slot has already passed");
  }

  if (slot.booked_count >= slot.capacity) {
    throw new SlotUnavailableError("Slot is fully booked");
  }
}

/**
 * Checks if a slot is available (no throw). Useful for UI.
 */
export function isSlotAvailable(
  slot: AvailabilitySlotRow | null,
  context: SlotValidationContext
): boolean {
  if (!slot) return false;
  try {
    validateSlotForBooking(slot, context);
    return true;
  } catch {
    return false;
  }
}
