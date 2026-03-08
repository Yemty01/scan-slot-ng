export type UserRole = "patient" | "provider_admin" | "provider_staff" | "super_admin" | "support";

export type BookingStatus =
  | "pending"
  | "payment_pending"
  | "confirmed"
  | "provider_confirmed"
  | "in_progress"
  | "completed"
  | "report_ready"
  | "cancelled_patient"
  | "cancelled_provider"
  | "no_show"
  | "disputed"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "refunded"
  | "abandoned";

export type SlotStatus = "available" | "booked" | "blocked" | "cancelled";

export type VerificationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended"
  | "re_submitted";

/** Who can perform a booking status transition */
export type BookingActor = "patient" | "provider" | "admin";

/** Database row: availability_slots */
export interface AvailabilitySlotRow {
  id: string;
  service_id: string;
  provider_id: string;
  branch_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: SlotStatus;
  created_at: string;
}

/** Database row: bookings */
export interface BookingRow {
  id: string;
  booking_ref: string;
  patient_id: string;
  service_id: string;
  slot_id: string;
  provider_id: string;
  branch_id: string;
  status: BookingStatus;
  amount: number;
  currency: string;
  referral_document_url: string | null;
  patient_notes: string | null;
  provider_notes: string | null;
  cancelled_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Database row: payments */
export interface PaymentRow {
  id: string;
  booking_id: string;
  patient_id: string;
  paystack_reference: string;
  paystack_transaction_id: string | null;
  amount: number;
  currency: string;
  channel: string | null;
  status: PaymentStatus;
  gateway_response: string | null;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  refunded_at: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
}

/** Input to create a booking (slot must pass validation first) */
export interface CreateBookingInput {
  slot_id: string;
  service_id: string;
  provider_id: string;
  branch_id: string;
  patient_id: string;
  amount: number;
  currency?: string;
  referral_document_url?: string | null;
  patient_notes?: string | null;
  /** If true, booking is created as payment_pending; otherwise pending */
  awaiting_payment?: boolean;
}
