-- ============================================================
-- ScanSlot NG — Supabase PostgreSQL Migrations
-- Target: Supabase PostgreSQL 15
-- Run order: execute top to bottom (e.g. supabase db push)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. EXTENSIONS (btree_gist before availability_slots)
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ────────────────────────────────────────────────────────────
-- 1. ENUM TYPES
-- ────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'patient',
  'provider_admin',
  'provider_staff',
  'super_admin',
  'support'
);

CREATE TYPE gender_enum AS ENUM (
  'male',
  'female',
  'other',
  'prefer_not_to_say'
);

CREATE TYPE verification_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended',
  're_submitted'
);

CREATE TYPE booking_status AS ENUM (
  'pending',
  'payment_pending',
  'confirmed',
  'provider_confirmed',
  'in_progress',
  'completed',
  'report_ready',
  'cancelled_patient',
  'cancelled_provider',
  'no_show',
  'disputed',
  'refunded'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'success',
  'failed',
  'refunded',
  'abandoned'
);

CREATE TYPE slot_status AS ENUM (
  'available',
  'booked',
  'blocked',
  'cancelled'
);

CREATE TYPE notification_type AS ENUM (
  'booking_confirmed',
  'booking_cancelled',
  'result_ready',
  'payment_received',
  'payment_failed',
  'dispute_raised',
  'dispute_resolved',
  'review_published',
  'provider_approved',
  'provider_rejected',
  'system'
);

-- ────────────────────────────────────────────────────────────
-- 2. HELPER: update_updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- 3. USERS (extends auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT        NOT NULL,
  phone       TEXT,
  role        user_role   NOT NULL DEFAULT 'patient',
  avatar_url  TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 4. PATIENT PROFILES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.patient_profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  date_of_birth           DATE,
  gender                  gender_enum,
  blood_group             TEXT        CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  genotype                TEXT        CHECK (genotype IN ('AA','AS','SS','AC','SC')),
  address                 TEXT,
  state                   TEXT,
  lga                     TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_profiles_user ON public.patient_profiles(user_id);

CREATE TRIGGER patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION create_patient_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'patient' THEN
    INSERT INTO public.patient_profiles (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_patient_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_patient_profile();

-- ────────────────────────────────────────────────────────────
-- 5. PROVIDERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.providers (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT                NOT NULL,
  slug                TEXT                NOT NULL UNIQUE,
  description         TEXT,
  category            TEXT                NOT NULL,
  cac_number          TEXT,
  logo_url            TEXT,
  website             TEXT,
  email               TEXT                NOT NULL,
  phone               TEXT                NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_at         TIMESTAMPTZ,
  verified_by         UUID                REFERENCES public.users(id),
  rejection_reason    TEXT,
  is_active           BOOLEAN             NOT NULL DEFAULT FALSE,
  avg_rating          NUMERIC(3,2)        NOT NULL DEFAULT 0.00 CHECK (avg_rating BETWEEN 0 AND 5),
  total_reviews       INTEGER             NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_providers_verification ON public.providers(verification_status);
CREATE INDEX idx_providers_active ON public.providers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_providers_slug ON public.providers(slug);
CREATE INDEX idx_providers_category ON public.providers(category);

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 6. PROVIDER BRANCHES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.provider_branches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID        NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  address       TEXT        NOT NULL,
  city          TEXT        NOT NULL,
  state         TEXT        NOT NULL,
  lga           TEXT,
  latitude      NUMERIC(10,7),
  longitude     NUMERIC(10,7),
  phone         TEXT,
  email         TEXT,
  opening_hours  JSONB      DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_branches_provider ON public.provider_branches(provider_id);
CREATE INDEX idx_provider_branches_state ON public.provider_branches(state);
CREATE INDEX idx_provider_branches_city ON public.provider_branches(city);

CREATE TRIGGER provider_branches_updated_at
  BEFORE UPDATE ON public.provider_branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 7. PROVIDER USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.provider_users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id   UUID        REFERENCES public.provider_branches(id),
  role        TEXT        NOT NULL CHECK (role IN ('admin','staff','receptionist','radiologist','lab_technician')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at   TIMESTAMPTZ,
  UNIQUE (provider_id, user_id)
);

CREATE INDEX idx_provider_users_provider ON public.provider_users(provider_id);
CREATE INDEX idx_provider_users_user ON public.provider_users(user_id);
CREATE INDEX idx_provider_users_branch ON public.provider_users(branch_id);

-- ────────────────────────────────────────────────────────────
-- 8. CATEGORIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_active ON public.categories(is_active) WHERE is_active = TRUE;

INSERT INTO public.categories (name, slug, description, icon, sort_order) VALUES
  ('Blood Tests',       'blood-tests',       'Full blood count, malaria, HIV, hepatitis, diabetes panels and more', 'droplets', 1),
  ('Imaging & Scans',   'imaging-scans',     'X-Ray, Ultrasound, CT Scan, MRI, Mammography', 'scan', 2),
  ('Consultations',     'consultations',     'General practitioner and specialist consultations', 'stethoscope', 3),
  ('Cancer Screening',  'cancer-screening',  'PSA, PAP smear, breast examination, colonoscopy', 'shield', 4),
  ('Cardiac Tests',     'cardiac-tests',     'ECG, Echocardiogram, Stress test, Holter monitoring', 'heart-pulse', 5),
  ('Fertility Tests',   'fertility-tests',   'Semen analysis, hormonal panel, HSG', 'baby', 6),
  ('Eye Tests',         'eye-tests',         'Visual acuity, refraction, tonometry, fundoscopy', 'eye', 7),
  ('Dental Services',   'dental-services',   'Dental checkup, X-Ray, scaling and polishing', 'smile', 8);

-- ────────────────────────────────────────────────────────────
-- 9. SERVICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.services (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID          NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  branch_id         UUID          REFERENCES public.provider_branches(id),
  category_id       UUID          NOT NULL REFERENCES public.categories(id),
  name              TEXT          NOT NULL,
  description       TEXT,
  preparation_notes TEXT,
  duration_minutes  INTEGER       NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency          TEXT          NOT NULL DEFAULT 'NGN',
  requires_referral BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  search_vector     TSVECTOR      GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
  ) STORED,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_provider ON public.services(provider_id);
CREATE INDEX idx_services_branch ON public.services(branch_id);
CREATE INDEX idx_services_category ON public.services(category_id);
CREATE INDEX idx_services_active ON public.services(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_services_search ON public.services USING GIN(search_vector);
CREATE INDEX idx_services_price ON public.services(price);
CREATE INDEX idx_services_name_trgm ON public.services USING GIN(name gin_trgm_ops);

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 10. AVAILABILITY SLOTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.availability_slots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   UUID        NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id  UUID        NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  branch_id    UUID        NOT NULL REFERENCES public.provider_branches(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  capacity     INTEGER     NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INTEGER     NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status       slot_status NOT NULL DEFAULT 'available',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_overlapping_slots EXCLUDE USING gist (
    service_id WITH =,
    branch_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('blocked', 'cancelled')),
  CONSTRAINT slot_time_order CHECK (end_time > start_time),
  CONSTRAINT booked_not_exceed_capacity CHECK (booked_count <= capacity)
);

CREATE INDEX idx_availability_slots_service_time ON public.availability_slots(service_id, start_time);
CREATE INDEX idx_availability_slots_branch_time ON public.availability_slots(branch_id, start_time);
CREATE INDEX idx_availability_slots_provider ON public.availability_slots(provider_id);
CREATE INDEX idx_availability_slots_status ON public.availability_slots(status);
CREATE INDEX idx_availability_slots_available ON public.availability_slots(start_time) WHERE status = 'available';

-- ────────────────────────────────────────────────────────────
-- 11. BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.bookings (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref           TEXT           NOT NULL UNIQUE,
  patient_id            UUID           NOT NULL REFERENCES public.users(id),
  service_id            UUID           NOT NULL REFERENCES public.services(id),
  slot_id               UUID           NOT NULL REFERENCES public.availability_slots(id),
  provider_id           UUID           NOT NULL REFERENCES public.providers(id),
  branch_id             UUID           NOT NULL REFERENCES public.provider_branches(id),
  status                booking_status NOT NULL DEFAULT 'pending',
  amount                NUMERIC(12,2)  NOT NULL CHECK (amount >= 0),
  currency              TEXT           NOT NULL DEFAULT 'NGN',
  referral_document_url TEXT,
  patient_notes         TEXT,
  provider_notes        TEXT,
  cancelled_reason      TEXT,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID           REFERENCES public.users(id),
  confirmed_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX idx_bookings_provider ON public.bookings(provider_id);
CREATE INDEX idx_bookings_service ON public.bookings(service_id);
CREATE INDEX idx_bookings_slot ON public.bookings(slot_id);
CREATE INDEX idx_bookings_branch ON public.bookings(branch_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_created ON public.bookings(created_at DESC);
CREATE UNIQUE INDEX idx_bookings_booking_ref ON public.bookings(booking_ref);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION generate_booking_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_ref IS NULL OR NEW.booking_ref = '' THEN
    NEW.booking_ref := 'BK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::TEXT, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_ref
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION generate_booking_ref();

-- ────────────────────────────────────────────────────────────
-- 12. PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.payments (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id              UUID           NOT NULL REFERENCES public.bookings(id),
  patient_id              UUID           NOT NULL REFERENCES public.users(id),
  paystack_reference      TEXT           NOT NULL UNIQUE,
  paystack_transaction_id TEXT,
  amount                  NUMERIC(12,2)  NOT NULL CHECK (amount > 0),
  currency                TEXT           NOT NULL DEFAULT 'NGN',
  channel                 TEXT,
  status                  payment_status NOT NULL DEFAULT 'pending',
  gateway_response        TEXT,
  metadata                JSONB          DEFAULT '{}',
  paid_at                 TIMESTAMPTZ,
  refunded_at             TIMESTAMPTZ,
  refund_amount           NUMERIC(12,2)  CHECK (refund_amount >= 0),
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking ON public.payments(booking_id);
CREATE INDEX idx_payments_patient ON public.payments(patient_id);
CREATE INDEX idx_payments_paystack_ref ON public.payments(paystack_reference);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_created ON public.payments(created_at DESC);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 13. REPORTS (diagnostic results)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id           UUID        NOT NULL REFERENCES public.providers(id),
  patient_id            UUID        NOT NULL REFERENCES public.users(id),
  file_url              TEXT        NOT NULL,
  file_name             TEXT        NOT NULL,
  file_size_bytes       INTEGER,
  mime_type             TEXT,
  uploaded_by           UUID        NOT NULL REFERENCES public.users(id),
  is_visible_to_patient BOOLEAN     NOT NULL DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_booking ON public.reports(booking_id);
CREATE INDEX idx_reports_provider ON public.reports(provider_id);
CREATE INDEX idx_reports_patient ON public.reports(patient_id);

-- ────────────────────────────────────────────────────────────
-- 14. REVIEWS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        NOT NULL UNIQUE REFERENCES public.bookings(id),
  patient_id   UUID        NOT NULL REFERENCES public.users(id),
  provider_id  UUID        NOT NULL REFERENCES public.providers(id),
  rating       INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  is_moderated BOOLEAN     NOT NULL DEFAULT FALSE,
  is_published BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_provider ON public.reviews(provider_id);
CREATE INDEX idx_reviews_patient ON public.reviews(patient_id);
CREATE INDEX idx_reviews_booking ON public.reviews(booking_id);
CREATE INDEX idx_reviews_published ON public.reviews(is_published) WHERE is_published = TRUE;

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 15. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT              NOT NULL,
  body       TEXT              NOT NULL,
  data       JSONB             DEFAULT '{}',
  is_read    BOOLEAN           NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ────────────────────────────────────────────────────────────
-- 16. AUDIT LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES public.users(id),
  actor_role  TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 17. TRIGGERS: booking ↔ slot count, payment → confirmed, report → report_ready, review → rating
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'provider_confirmed', 'in_progress', 'completed', 'report_ready')) THEN
    UPDATE public.availability_slots
    SET booked_count = booked_count + 1
    WHERE id = NEW.slot_id AND booked_count < capacity;

    UPDATE public.availability_slots
    SET status = 'booked'
    WHERE id = NEW.slot_id AND booked_count >= capacity;
  END IF;

  IF NEW.status IN ('cancelled_patient', 'cancelled_provider', 'no_show', 'refunded')
     AND OLD.status = 'confirmed' THEN
    UPDATE public.availability_slots
    SET booked_count = GREATEST(booked_count - 1, 0),
        status = CASE WHEN (booked_count - 1) < capacity THEN 'available' ELSE 'booked' END
    WHERE id = NEW.slot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_status_change
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_status_change();

CREATE OR REPLACE FUNCTION handle_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    UPDATE public.bookings
    SET status = 'confirmed', confirmed_at = now()
    WHERE id = NEW.booking_id AND status IN ('pending', 'payment_pending');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_success
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION handle_payment_success();

CREATE OR REPLACE FUNCTION handle_report_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_visible_to_patient = TRUE THEN
    UPDATE public.bookings
    SET status = 'report_ready'
    WHERE id = NEW.booking_id AND status IN ('completed', 'provider_confirmed');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_report_upload
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION handle_report_upload();

CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
DECLARE
  p_id UUID;
  avg_r NUMERIC(3,2);
  cnt INTEGER;
BEGIN
  p_id := COALESCE(NEW.provider_id, OLD.provider_id);
  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*) INTO avg_r, cnt
  FROM public.reviews WHERE provider_id = p_id AND is_published = TRUE;
  UPDATE public.providers
  SET avg_rating = COALESCE(avg_r, 0.00), total_reviews = COALESCE(cnt, 0)
  WHERE id = p_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating();

-- ────────────────────────────────────────────────────────────
-- 18. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_branches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_provider_member(p_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_users
    WHERE provider_id = p_id AND user_id = auth.uid() AND is_active = TRUE
  );
$$;

-- users
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_admin_select" ON public.users FOR SELECT USING (current_user_role() = 'super_admin');

-- patient_profiles
CREATE POLICY "patient_profiles_own" ON public.patient_profiles FOR ALL USING (auth.uid() = user_id);

-- providers
CREATE POLICY "providers_public_read" ON public.providers FOR SELECT USING (is_active = TRUE AND verification_status = 'approved');
CREATE POLICY "providers_member_read" ON public.providers FOR SELECT USING (is_provider_member(id));
CREATE POLICY "providers_member_update" ON public.providers FOR UPDATE USING (is_provider_member(id));
CREATE POLICY "providers_insert_authenticated" ON public.providers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "providers_admin_all" ON public.providers FOR ALL USING (current_user_role() = 'super_admin');

-- provider_branches
CREATE POLICY "provider_branches_public_read" ON public.provider_branches FOR SELECT USING (
  is_active = TRUE AND EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.is_active AND p.verification_status = 'approved')
);
CREATE POLICY "provider_branches_member_all" ON public.provider_branches FOR ALL USING (is_provider_member(provider_id));
CREATE POLICY "provider_branches_admin_all" ON public.provider_branches FOR ALL USING (current_user_role() = 'super_admin');

-- provider_users
CREATE POLICY "provider_users_member_read" ON public.provider_users FOR SELECT USING (is_provider_member(provider_id) OR auth.uid() = user_id);
CREATE POLICY "provider_users_self_insert" ON public.provider_users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "provider_users_admin_all" ON public.provider_users FOR ALL USING (current_user_role() = 'super_admin');

-- categories
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL USING (current_user_role() = 'super_admin');

-- services
CREATE POLICY "services_public_read" ON public.services FOR SELECT USING (
  is_active = TRUE AND EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.is_active AND p.verification_status = 'approved')
);
CREATE POLICY "services_member_all" ON public.services FOR ALL USING (is_provider_member(provider_id));
CREATE POLICY "services_admin_all" ON public.services FOR ALL USING (current_user_role() = 'super_admin');

-- availability_slots
CREATE POLICY "availability_slots_public_read" ON public.availability_slots FOR SELECT USING (status = 'available' AND start_time > now());
CREATE POLICY "availability_slots_member_all" ON public.availability_slots FOR ALL USING (is_provider_member(provider_id));
CREATE POLICY "availability_slots_admin_all" ON public.availability_slots FOR ALL USING (current_user_role() = 'super_admin');

-- bookings
CREATE POLICY "bookings_patient_own" ON public.bookings FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY "bookings_provider_select" ON public.bookings FOR SELECT USING (is_provider_member(provider_id));
CREATE POLICY "bookings_provider_update" ON public.bookings FOR UPDATE USING (is_provider_member(provider_id));
CREATE POLICY "bookings_admin_all" ON public.bookings FOR ALL USING (current_user_role() = 'super_admin');

-- payments
CREATE POLICY "payments_patient_own" ON public.payments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "payments_provider_select" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND is_provider_member(b.provider_id))
);
CREATE POLICY "payments_admin_all" ON public.payments FOR ALL USING (current_user_role() = 'super_admin');

-- reports
CREATE POLICY "reports_patient_read" ON public.reports FOR SELECT USING (auth.uid() = patient_id AND is_visible_to_patient = TRUE);
CREATE POLICY "reports_provider_all" ON public.reports FOR ALL USING (is_provider_member(provider_id));
CREATE POLICY "reports_admin_all" ON public.reports FOR ALL USING (current_user_role() = 'super_admin');

-- reviews
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (is_published = TRUE);
CREATE POLICY "reviews_patient_insert" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "reviews_patient_update" ON public.reviews FOR UPDATE USING (auth.uid() = patient_id);
CREATE POLICY "reviews_admin_all" ON public.reviews FOR ALL USING (current_user_role() = 'super_admin');

-- notifications
CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- audit_logs
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs FOR SELECT USING (current_user_role() IN ('super_admin', 'support'));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 19. SEARCH FUNCTION
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_services(
  p_query       TEXT    DEFAULT NULL,
  p_category_id UUID    DEFAULT NULL,
  p_state       TEXT    DEFAULT NULL,
  p_min_price   NUMERIC DEFAULT NULL,
  p_max_price   NUMERIC DEFAULT NULL,
  p_limit       INTEGER DEFAULT 20,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  service_id      UUID,
  service_name    TEXT,
  service_price   NUMERIC,
  provider_id     UUID,
  provider_name   TEXT,
  provider_slug   TEXT,
  provider_logo   TEXT,
  provider_rating NUMERIC,
  branch_id       UUID,
  branch_name     TEXT,
  branch_city     TEXT,
  branch_state    TEXT,
  category_name   TEXT,
  rank            REAL
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id, s.name, s.price,
    pr.id, pr.name, pr.slug, pr.logo_url, pr.avg_rating,
    b.id, b.name, b.city, b.state,
    c.name,
    CASE WHEN p_query IS NOT NULL
      THEN ts_rank(s.search_vector, plainto_tsquery('english', p_query))
      ELSE 1.0
    END AS rank
  FROM public.services s
  JOIN public.providers pr ON pr.id = s.provider_id
  LEFT JOIN public.provider_branches b ON b.id = s.branch_id
  JOIN public.categories c ON c.id = s.category_id
  WHERE
    s.is_active = TRUE
    AND pr.is_active = TRUE
    AND pr.verification_status = 'approved'
    AND (p_query IS NULL OR s.search_vector @@ plainto_tsquery('english', p_query) OR s.name ILIKE '%' || p_query || '%')
    AND (p_category_id IS NULL OR s.category_id = p_category_id)
    AND (p_state IS NULL OR b.state ILIKE p_state)
    AND (p_min_price IS NULL OR s.price >= p_min_price)
    AND (p_max_price IS NULL OR s.price <= p_max_price)
  ORDER BY rank DESC, pr.avg_rating DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ────────────────────────────────────────────────────────────
-- 20. REALTIME
-- ────────────────────────────────────────────────────────────
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.notifications,
  public.bookings,
  public.availability_slots;
