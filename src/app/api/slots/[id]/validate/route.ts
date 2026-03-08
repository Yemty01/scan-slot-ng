import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlot } from "@/lib/booking";
import { validateSlotForBooking } from "@/lib/booking";
import { BookingError } from "@/lib/booking";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: slotId } = await params;
    const supabase = await createClient();

    const slot = await getSlot(supabase, slotId);
    const searchParams = await _request.nextUrl.searchParams;
    const serviceId = searchParams.get("service_id");
    const branchId = searchParams.get("branch_id");
    const providerId = searchParams.get("provider_id") ?? undefined;

    if (!serviceId || !branchId) {
      return NextResponse.json(
        { error: "service_id and branch_id are required" },
        { status: 400 }
      );
    }

    validateSlotForBooking(slot, {
      slot_id: slotId,
      service_id: serviceId,
      branch_id: branchId,
      provider_id: providerId,
    });

    return NextResponse.json({
      valid: true,
      slot_id: slotId,
      message: "Slot is available for booking",
    });
  } catch (err) {
    if (err instanceof BookingError) {
      const status = err.code === "SLOT_NOT_FOUND" ? 404 : 422;
      return NextResponse.json(
        { error: err.message, code: err.code, valid: false },
        { status }
      );
    }
    throw err;
  }
}
