import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction, generatePaystackReference } from "@/lib/paystack";
import type { PaymentRow } from "@/types";

const PAYMENT_PENDING_STATUSES = ["pending", "payment_pending"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, callback_url: customCallbackUrl } = body as {
      booking_id: string;
      callback_url?: string;
    };

    if (!booking_id) {
      return NextResponse.json(
        { error: "booking_id is required" },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, patient_id, status, amount, currency")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.patient_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!PAYMENT_PENDING_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: "Booking is not awaiting payment" },
        { status: 422 }
      );
    }

    const amount = Number(booking.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid booking amount" }, { status: 422 });
    }

    const reference = generatePaystackReference();

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("booking_id", booking_id)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();

    let payment: PaymentRow;

    if (existingPayment) {
      const { data: updated, error: updateError } = await supabase
        .from("payments")
        .update({
          paystack_reference: reference,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id)
        .select()
        .single();

      if (updateError) throw updateError;
      payment = updated as PaymentRow;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("payments")
        .insert({
          booking_id: booking_id,
          patient_id: user.id,
          paystack_reference: reference,
          amount,
          currency: booking.currency ?? "NGN",
          status: "pending",
          metadata: { booking_id },
        })
        .select()
        .single();

      if (insertError) throw insertError;
      payment = inserted as PaymentRow;
    }

    const origin =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const callbackUrl =
      customCallbackUrl?.startsWith("http") === true
        ? customCallbackUrl
        : `${origin}/dashboard/bookings/${booking_id}?payment=done`;

    const result = await initializeTransaction({
      amount,
      email: user.email,
      reference,
      callback_url: callbackUrl,
      currency: booking.currency ?? "NGN",
      metadata: {
        booking_id,
        payment_id: payment.id,
      },
    });

    return NextResponse.json({
      authorization_url: result.authorization_url,
      access_code: result.access_code,
      reference: result.reference,
      payment_id: payment.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment initialization failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
