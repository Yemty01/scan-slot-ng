import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { createSlotsAction } from "@/features/provider/actions";

export default async function ProviderAvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;
  if (!membership) return null;

  const { data: slots } = await supabase
    .from("availability_slots")
    .select(
      `
      id,
      start_time,
      end_time,
      capacity,
      booked_count,
      status,
      service_id,
      branch_id,
      services ( name ),
      provider_branches ( name )
    `
    )
    .eq("provider_id", membership.provider_id)
    .order("start_time", { ascending: false })
    .limit(100);

  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("provider_id", membership.provider_id)
    .eq("is_active", true);

  const { data: branches } = await supabase
    .from("provider_branches")
    .select("id, name")
    .eq("provider_id", membership.provider_id)
    .eq("is_active", true);

  const formatSlotTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-NG", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Availability</h1>
      <p className="text-muted-foreground mt-1">Manage time slots for services at each branch.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add slot</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSlotsAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="service_id">Service *</Label>
              <Select id="service_id" name="service_id" required>
                <option value="">Select service</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch *</Label>
              <Select id="branch_id" name="branch_id" required>
                <option value="">Select branch</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min="1" defaultValue="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start time *</Label>
              <Input id="start_time" name="start_time" type="time" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End time *</Label>
              <Input id="end_time" name="end_time" type="time" required />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <Button type="submit">Add slot</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent slots</CardTitle>
        </CardHeader>
        <CardContent>
          {!slots?.length ? (
            <p className="text-muted-foreground py-8 text-center">No slots yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot: {
                  id: string;
                  start_time: string;
                  end_time: string;
                  capacity: number;
                  booked_count: number;
                  status: string;
                  services: { name: string } | { name: string }[] | null;
                  provider_branches: { name: string } | { name: string }[] | null;
                }) => {
                  const serviceName = Array.isArray(slot.services) ? slot.services[0]?.name : (slot.services as { name: string } | null)?.name;
                  const branchName = Array.isArray(slot.provider_branches) ? slot.provider_branches[0]?.name : (slot.provider_branches as { name: string } | null)?.name;
                  return (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">{serviceName ?? "—"}</TableCell>
                    <TableCell>{branchName ?? "—"}</TableCell>
                    <TableCell>{formatSlotTime(slot.start_time)}</TableCell>
                    <TableCell>{formatSlotTime(slot.end_time)}</TableCell>
                    <TableCell>{slot.booked_count} / {slot.capacity}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          slot.status === "available"
                            ? "success"
                            : slot.status === "booked"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {slot.status}
                      </Badge>
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
