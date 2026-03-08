import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ProviderDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;

  if (!membership) return null;

  const providerId = membership.provider_id;

  const [
    { count: branchesCount },
    { count: servicesCount },
    { count: slotsCount },
    { count: bookingsCount },
  ] = await Promise.all([
    supabase.from("provider_branches").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
    supabase.from("availability_slots").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("provider_id", providerId),
  ]);

  const stats = [
    { label: "Branches", value: branchesCount ?? 0, href: "/provider/dashboard/branches" },
    { label: "Services", value: servicesCount ?? 0, href: "/provider/dashboard/services" },
    { label: "Availability slots", value: slotsCount ?? 0, href: "/provider/dashboard/availability" },
    { label: "Bookings", value: bookingsCount ?? 0, href: "/provider/dashboard/bookings" },
  ];

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-1">Manage your branches, services, slots and bookings.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{s.value}</p>
                <Button variant="link" className="h-auto p-0 mt-1 text-primary" asChild>
                  <span>View →</span>
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
