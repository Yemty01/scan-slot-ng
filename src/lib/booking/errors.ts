export class BookingError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export class SlotUnavailableError extends BookingError {
  constructor(reason: string) {
    super(reason, "SLOT_UNAVAILABLE");
    this.name = "SlotUnavailableError";
  }
}

export class SlotNotFoundError extends BookingError {
  constructor(slotId: string) {
    super(`Slot not found: ${slotId}`, "SLOT_NOT_FOUND");
    this.name = "SlotNotFoundError";
  }
}

export class InvalidTransitionError extends BookingError {
  constructor(from: string, to: string, actor: string) {
    super(
      `Invalid status transition: ${from} → ${to} (actor: ${actor})`,
      "INVALID_TRANSITION"
    );
    this.name = "InvalidTransitionError";
  }
}

export class BookingNotFoundError extends BookingError {
  constructor(bookingId: string) {
    super(`Booking not found: ${bookingId}`, "BOOKING_NOT_FOUND");
    this.name = "BookingNotFoundError";
  }
}

export class UnauthorizedBookingActionError extends BookingError {
  constructor() {
    super("You are not allowed to perform this action on this booking", "UNAUTHORIZED");
    this.name = "UnauthorizedBookingActionError";
  }
}
