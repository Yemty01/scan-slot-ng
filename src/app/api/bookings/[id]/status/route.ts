import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getBooking,
  transitionBookingStatus,
  actorFromRole,
  canActorTransitionBooking,
} from "@/lib/booking";
import type { BookingStatus } from "@/types";
import { BookingError } from "@/lib/booking";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status: newStatus, reason } = body as {
      status: BookingStatus;
      reason?: string | null;
    };

    if (!newStatus) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const booking = await getBooking(supabase, bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
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
      return NextResponse.json(
        { error: checkError ?? "Transition not allowed" },
        { status: 403 }
      );
    }

    const updated = await transitionBookingStatus(supabase, {
      booking_id: bookingId,
      new_status: newStatus,
      actor,
      actor_id: user.id,
      reason,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof BookingError) {
      const status =
        err.code === "BOOKING_NOT_FOUND"
          ? 404
          : err.code === "INVALID_TRANSITION"
            ? 422
            : 403;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
