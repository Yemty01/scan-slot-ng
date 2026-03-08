# Supabase migrations

Apply migrations in order (by filename):

1. **001_scan_slot_ng_init.sql** — Extensions, enums, all tables, indexes, triggers, RLS, search function, realtime publication.
2. **002_auth_jwt_claim.sql** — Optional: JWT hook to add `app_role` to the access token.

## Apply

- **Supabase CLI (local):** `supabase db reset` or `supabase db push`
- **Supabase Dashboard:** SQL Editor → paste and run each migration in order.
- **Linked project:** `supabase db push` from the project root.

## Realtime

Migration 001 creates a `supabase_realtime` publication for `notifications`, `bookings`, and `availability_slots`. On Supabase Cloud, if the publication already exists, add these tables in Dashboard → Database → Realtime instead of re-running the publication block.

## Tables and relationships

- **users** ← auth.users (1:1)
- **patient_profiles** → users (1:1)
- **providers** → users (verified_by)
- **provider_branches** → providers
- **provider_users** → providers, users, provider_branches
- **categories** (standalone, seeded)
- **services** → providers, provider_branches, categories
- **availability_slots** → services, providers, provider_branches
- **bookings** → users (patient), services, availability_slots, providers, provider_branches
- **payments** → bookings, users (patient)
- **reports** → bookings, providers, users (patient, uploaded_by)
- **reviews** → bookings, users (patient), providers
- **notifications** → users
- **audit_logs** → users (actor_id)
