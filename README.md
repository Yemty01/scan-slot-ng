# ScanSlot NG

Healthcare booking marketplace (MVP) — Nigeria. Next.js 15, TypeScript, TailwindCSS, shadcn/ui, Supabase, Paystack.

## Setup

1. Copy env and fill in values:
   ```bash
   cp .env.example .env.local
   ```
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `src/app/(public)/` — Home, search, providers, service detail
- `src/app/(patient)/dashboard/` — Patient dashboard, bookings, profile
- `src/app/(provider)/provider/dashboard/` — Provider profile, branches, services, availability, bookings, reports
- `src/app/(admin)/admin/` — Admin: providers approval, bookings, payments, reviews, audit logs
- `src/app/api/` — API routes (health, webhooks, AI search, etc.)
- `src/components/` — UI components (incl. shadcn)
- `src/features/` — Feature modules (auth, booking, …)
- `src/lib/` — Supabase client, utils
- `src/hooks/` — Shared hooks
- `src/types/` — Shared TypeScript types

## Build spec

See `build.md` for full MVP requirements (roles, booking flow, Paystack, notifications, AI search, audit logs).
