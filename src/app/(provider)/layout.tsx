import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProviderForUser } from "@/lib/provider";
import { ProviderDashboardShell } from "@/components/provider-dashboard/shell";

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  const membership = await getProviderForUser(supabase, user.id);
  if (!membership) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold">Not a provider</h1>
          <p className="text-muted-foreground mt-2">
            Your account is not linked to a provider. Contact support or go to the main site.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            ← Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProviderDashboardShell providerName={membership.provider_name}>
      {children}
    </ProviderDashboardShell>
  );
}
