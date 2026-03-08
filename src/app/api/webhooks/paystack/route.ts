import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  verifyPaystackSignature,
  parseWebhookBody,
  PAYSTACK_EVENT_CHARGE_SUCCESS,
} from "@/lib/paystack";

/**
 * Paystack webhook handler.
 * - Uses raw body for signature verification (do not parse before verify).
 * - Always returns 200 to acknowledge receipt (Paystack requirement).
 * - Only processes charge.success; updates payment and lets DB trigger set booking confirmed.
 */
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const event = parseWebhookBody(rawBody);
  if (!event?.event || !event?.data) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (event.event !== PAYSTACK_EVENT_CHARGE_SUCCESS) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const reference = event.data.reference as string | undefined;
  if (!reference) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const supabase = createServiceRoleClient();

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, status")
    .eq("paystack_reference", reference)
    .single();

  if (fetchError || !payment) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (payment.status === "success") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const channel = event.data.channel as string | undefined;
  const gatewayResponse =
    typeof event.data.gateway_response === "string"
      ? event.data.gateway_response
      : JSON.stringify(event.data.gateway_response ?? {});

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "success",
      paid_at: new Date().toISOString(),
      channel: channel ?? null,
      paystack_transaction_id: String(event.data.id ?? "").trim() || null,
      gateway_response: gatewayResponse,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateError) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
