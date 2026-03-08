import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/slots?service_id=...&branch_id=...&from=ISO&to=ISO
 * Returns availability_slots that are available, for the given service and branch, within [from, to].
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;
  const serviceId = searchParams.get("service_id");
  const branchId = searchParams.get("branch_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!serviceId || !branchId) {
    return NextResponse.json(
      { error: "service_id and branch_id are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  let query = supabase
    .from("availability_slots")
    .select("*")
    .eq("service_id", serviceId)
    .eq("branch_id", branchId)
    .eq("status", "available")
    .gt("start_time", now);

  if (from) query = query.gte("start_time", from);
  if (to) query = query.lte("end_time", to);

  query = query.order("start_time", { ascending: true }).limit(100);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    data?.filter(
      (row: { booked_count: number; capacity: number }) =>
        row.booked_count < row.capacity
    ) ?? []
  );
}
