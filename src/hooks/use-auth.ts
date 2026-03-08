"use client";

// Placeholder: use Supabase auth state and role from profile
export function useAuth() {
  return {
    user: null as { id: string; email?: string } | null,
    role: null as string | null,
    isLoading: false,
    signOut: async () => {},
  };
}
