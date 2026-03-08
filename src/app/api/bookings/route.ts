import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBooking } from "@/lib/booking";
import type { CreateBookingInput } from "@/types";
import { BookingError } from "@/lib/booking";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      slot_id,
      service_id,
      provider_id,
      branch_id,
      amount,
      currency,
      referral_document_url,
      patient_notes,
      awaiting_payment,
    } = body as Partial<CreateBookingInput> & { awaiting_payment?: boolean };

    if (
      !slot_id ||
      !service_id ||
      !provider_id ||
      !branch_id ||
      amount == null ||
      amount < 0
    ) {
      return NextResponse.json(
        { error: "slot_id, service_id, provider_id, branch_id, and amount are required" },
        { status: 400 }
      );
    }

    const input: CreateBookingInput = {
      slot_id,
      service_id,
      provider_id,
      branch_id,
      patient_id: user.id,
      amount: Number(amount),
      currency: currency ?? "NGN",
      referral_document_url: referral_document_url ?? null,
      patient_notes: patient_notes ?? null,
      awaiting_payment: Boolean(awaiting_payment),
    };

    const booking = await createBooking(supabase, input);
    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      const status =
        err.code === "SLOT_NOT_FOUND"
          ? 404
          : err.code === "SLOT_UNAVAILABLE"
            ? 409
            : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
