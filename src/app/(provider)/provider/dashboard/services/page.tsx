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
import { createServiceAction } from "@/features/provider/actions";

export default async function ProviderServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const membership = user ? await getProviderForUser(supabase, user.id) : null;
  if (!membership) return null;

  const { data: services } = await supabase
    .from("services")
    .select(
      `
      id,
      name,
      description,
      duration_minutes,
      price,
      currency,
      is_active,
      requires_referral,
      category_id,
      categories ( name ),
      branch_id,
      provider_branches ( name )
    `
    )
    .eq("provider_id", membership.provider_id)
    .order("created_at", { ascending: false });

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  const { data: branches } = await supabase
    .from("provider_branches")
    .select("id, name")
    .eq("provider_id", membership.provider_id)
    .eq("is_active", true);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold">Services</h1>
      <p className="text-muted-foreground mt-1">List and add services offered at your branches.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add service</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createServiceAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="e.g. Full Blood Count" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category_id">Category *</Label>
              <Select id="category_id" name="category_id" required>
                <option value="">Select category</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch (optional)</Label>
              <Select id="branch_id" name="branch_id">
                <option value="">All branches</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (NGN) *</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" required placeholder="5000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input id="duration_minutes" name="duration_minutes" type="number" min="1" defaultValue="30" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requires_referral" className="rounded border-input" />
                Requires referral
              </label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" placeholder="Brief description" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="preparation_notes">Preparation notes (optional)</Label>
              <Input id="preparation_notes" name="preparation_notes" placeholder="e.g. Fast for 8 hours" />
            </div>
            <div>
              <Button type="submit">Add service</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All services</CardTitle>
        </CardHeader>
        <CardContent>
          {!services?.length ? (
            <p className="text-muted-foreground py-8 text-center">No services yet. Add one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s: {
                  id: string;
                  name: string;
                  duration_minutes: number;
                  price: number;
                  currency: string;
                  is_active: boolean;
                  categories: { name: string } | { name: string }[] | null;
                  provider_branches: { name: string } | { name: string }[] | null;
                }) => {
                  const catName = Array.isArray(s.categories) ? s.categories[0]?.name : (s.categories as { name: string } | null)?.name;
                  const branchName = Array.isArray(s.provider_branches) ? s.provider_branches[0]?.name : (s.provider_branches as { name: string } | null)?.name;
                  return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{catName ?? "—"}</TableCell>
                    <TableCell>{branchName ?? "All"}</TableCell>
                    <TableCell>{s.currency} {Number(s.price).toLocaleString()}</TableCell>
                    <TableCell>{s.duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "success" : "secondary"}>
                        {s.is_active ? "Active" : "Inactive"}
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
