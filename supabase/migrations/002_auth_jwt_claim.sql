-- ============================================================
-- ScanSlot NG — JWT custom claim: app_role
-- Optional: inject user role into JWT so client can read role without extra query
-- Requires Supabase Auth hook (Dashboard: Auth > Hooks > Customize JWT)
-- ============================================================

CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims JSONB;
  u_role user_role;
BEGIN
  SELECT role INTO u_role FROM public.users WHERE id = (event->>'user_id')::UUID;
  claims := event->'claims';
  IF u_role IS NOT NULL THEN
    claims := jsonb_set(COALESCE(claims, '{}'), '{app_role}', to_jsonb(u_role::TEXT));
  END IF;
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant to auth (run as superuser / in Supabase this may already be granted)
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if role or permission not available
END $$;
