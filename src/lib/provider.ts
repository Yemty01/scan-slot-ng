import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProviderMembership {
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  role: string;
  branch_id: string | null;
}

/**
 * Get the current user's provider membership (first active one).
 * Use in server components / server actions after getUser().
 */
export async function getProviderForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderMembership | null> {
  const { data, error } = await supabase
    .from("provider_users")
    .select(
      `
      provider_id,
      role,
      branch_id,
      providers (
        id,
        name,
        slug
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const raw = data.providers as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  const providers = Array.isArray(raw) ? raw[0] : raw;
  if (!providers) return null;

  return {
    provider_id: data.provider_id,
    provider_name: providers.name,
    provider_slug: providers.slug,
    role: data.role,
    branch_id: data.branch_id,
  };
}
