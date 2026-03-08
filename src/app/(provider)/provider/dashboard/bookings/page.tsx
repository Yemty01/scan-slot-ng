import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingsFilterAndActions, BookingsRowActionsClient } from "./bookings-client";

export default async function ProviderBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;
  if (!membership) return null;

  const { status } = await searchParams;
  let query = supabase
    .from("bookings")
    .select(
      `
      id,
      booking_ref,
      status,
      amount,
      currency,
      created_at,
      confirmed_at,
      patient_id,
      service_id,
      branch_id,
      services ( name ),
      provider_branches ( name )
    `
    )
    .eq("provider_id", membership.provider_id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: bookings } = await query;

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" }) : "—";

  const statusVariant = (s: string) => {
    if (["confirmed", "provider_confirmed", "completed", "report_ready"].includes(s)) return "success";
    if (["cancelled_patient", "cancelled_provider", "no_show", "refunded"].includes(s)) return "destructive";
    if (["pending", "payment_pending"].includes(s)) return "warning";
    return "secondary";
  };

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <p className="text-muted-foreground mt-1">View and manage patient bookings.</p>

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All bookings</CardTitle>
          <BookingsFilterAndActions currentStatus={status} />
        </CardHeader>
        <CardContent>
          {!bookings?.length ? (
            <p className="text-muted-foreground py-8 text-center">No bookings match your filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b: {
                  id: string;
                  booking_ref: string;
                  status: string;
                  amount: number;
                  currency: string;
                  created_at: string;
                  patient_id: string;
                  services: { name: string } | { name: string }[] | null;
                  provider_branches: { name: string } | { name: string }[] | null;
                }) => {
                  const serviceName = Array.isArray(b.services) ? b.services[0]?.name : (b.services as { name: string } | null)?.name;
                  const branchName = Array.isArray(b.provider_branches) ? b.provider_branches[0]?.name : (b.provider_branches as { name: string } | null)?.name;
                  return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.booking_ref}</TableCell>
                    <TableCell className="text-muted-foreground">Patient</TableCell>
                    <TableCell>{serviceName ?? "—"}</TableCell>
                    <TableCell>{branchName ?? "—"}</TableCell>
                    <TableCell>{b.currency} {Number(b.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(b.status) as "success" | "destructive" | "warning" | "secondary"}>
                        {b.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(b.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/provider/dashboard/bookings/${b.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      <BookingsRowActionsClient bookingId={b.id} status={b.status} />
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

