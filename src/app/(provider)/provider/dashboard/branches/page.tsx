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
import { createBranchAction } from "@/features/provider/actions";

export default async function ProviderBranchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;
  if (!membership) return null;

  const { data: branches } = await supabase
    .from("provider_branches")
    .select("id, name, address, city, state, phone, is_active, created_at")
    .eq("provider_id", membership.provider_id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Branches</h1>
      <p className="text-muted-foreground mt-1">Manage your clinic or lab branches.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add branch</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createBranchAction} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Branch name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Ikeja Branch" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" name="address" required placeholder="Full address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" name="city" required placeholder="e.g. Lagos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input id="state" name="state" required placeholder="e.g. Lagos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+234..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" placeholder="branch@example.com" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add branch</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All branches</CardTitle>
        </CardHeader>
        <CardContent>
          {!branches?.length ? (
            <p className="text-muted-foreground py-8 text-center">No branches yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City / State</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{b.address}</TableCell>
                    <TableCell>{b.city}, {b.state}</TableCell>
                    <TableCell>{b.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "success" : "secondary"}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
