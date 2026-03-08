import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingsRowActionsClient } from "../bookings-client";

export default async function ProviderBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;
  if (!membership) return null;

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_ref,
      status,
      amount,
      currency,
      patient_notes,
      provider_notes,
      referral_document_url,
      created_at,
      confirmed_at,
      completed_at,
      services ( name, duration_minutes ),
      provider_branches ( name, address, city, state ),
      availability_slots ( start_time, end_time )
    `
    )
    .eq("id", id)
    .eq("provider_id", membership.provider_id)
    .single();

  if (error || !booking) notFound();

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

  const relName = (r: unknown): string | null => {
    if (Array.isArray(r)) return r[0]?.name ?? null;
    return (r as { name?: string } | null)?.name ?? null;
  };
  const slot = booking.availability_slots as { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
  const slotSingle = Array.isArray(slot) ? slot[0] : slot;

  return (
    <div className="p-6 md:p-8">
      <Link href="/provider/dashboard/bookings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to bookings
      </Link>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Booking {booking.booking_ref}</h1>
          <Badge className="mt-2">{booking.status.replace(/_/g, " ")}</Badge>
        </div>
        <BookingsRowActionsClient bookingId={id} status={booking.status} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Service:</span> {relName(booking.services) ?? "—"}</p>
            <p><span className="text-muted-foreground">Branch:</span> {relName(booking.provider_branches) ?? "—"}</p>
            <p><span className="text-muted-foreground">Amount:</span> {booking.currency} {Number(booking.amount).toLocaleString()}</p>
            <p><span className="text-muted-foreground">Slot:</span> {slotSingle ? `${formatDate(slotSingle.start_time)} – ${formatDate(slotSingle.end_time)}` : "—"}</p>
            <p><span className="text-muted-foreground">Created:</span> {formatDate(booking.created_at)}</p>
            {booking.confirmed_at && <p><span className="text-muted-foreground">Confirmed:</span> {formatDate(booking.confirmed_at)}</p>}
            {booking.completed_at && <p><span className="text-muted-foreground">Completed:</span> {formatDate(booking.completed_at)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {booking.patient_notes ? (
              <p><span className="text-muted-foreground">Patient:</span> {booking.patient_notes}</p>
            ) : null}
            {booking.provider_notes ? (
              <p><span className="text-muted-foreground">Provider:</span> {booking.provider_notes}</p>
            ) : null}
            {!booking.patient_notes && !booking.provider_notes && <p className="text-muted-foreground">No notes.</p>}
            {booking.referral_document_url && (
              <a href={booking.referral_document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View referral document
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
