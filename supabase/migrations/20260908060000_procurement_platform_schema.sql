CREATE TABLE public.procurement_centres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_code TEXT NOT NULL UNIQUE,
  centre_name TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  village TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_phone TEXT,
  daily_capacity_quintals NUMERIC(10, 2) NOT NULL DEFAULT 0,
  daily_capacity_farmers INTEGER NOT NULL DEFAULT 40,
  operating_start_time TIME NOT NULL DEFAULT '09:00',
  operating_end_time TIME NOT NULL DEFAULT '18:00',
  avg_service_minutes_per_farmer INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX procurement_centres_state_district_idx
  ON public.procurement_centres (state, district);

-- Crops each centre procures, with MSP rate (mirrors e-Uparjan / eKharid style)
CREATE TABLE public.centre_crops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES public.procurement_centres (id) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  msp_rate_per_quintal NUMERIC(10, 2) NOT NULL,
  season TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (centre_id, crop, season)
);

CREATE INDEX centre_crops_crop_idx ON public.centre_crops (crop);

-- ---------------------------------------------------------------------
-- 2. SLOT BOOKING
-- ---------------------------------------------------------------------
CREATE TABLE public.procurement_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES public.procurement_centres (id) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  slot_date DATE NOT NULL,
  slot_start TIME NOT NULL,
  slot_end TIME NOT NULL,
  capacity_farmers INTEGER NOT NULL DEFAULT 20,
  booked_farmers INTEGER NOT NULL DEFAULT 0,
  capacity_quintals NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (centre_id, crop, slot_date, slot_start)
);

CREATE INDEX procurement_slots_centre_date_idx
  ON public.procurement_slots (centre_id, slot_date);

-- ---------------------------------------------------------------------
-- 3/4. BOOKINGS — one row per farmer's procurement journey.
-- Status walks through the full methodology.
-- ---------------------------------------------------------------------
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL REFERENCES public.farmers (id) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  expected_quantity_quintals NUMERIC(10, 2) NOT NULL,
  centre_id UUID REFERENCES public.procurement_centres (id),
  slot_id UUID REFERENCES public.procurement_slots (id),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (
    status IN (
      'registered', 'allocated', 'queued', 'travel_alert_sent', 'arrived',
      'checked_in', 'procurement_in_progress', 'procured', 'paid',
      'completed', 'cancelled', 'no_show'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bookings_farmer_idx ON public.bookings (farmer_id);
CREATE INDEX bookings_centre_status_idx ON public.bookings (centre_id, status);
CREATE INDEX bookings_slot_idx ON public.bookings (slot_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Full audit trail of every status transition (for admin + govt visibility)
CREATE TABLE public.booking_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_status_history_booking_idx
  ON public.booking_status_history (booking_id);

-- ---------------------------------------------------------------------
-- 4. SMART / VIRTUAL QUEUE — live token + ETA
-- ---------------------------------------------------------------------
CREATE TABLE public.queue_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  centre_id UUID NOT NULL REFERENCES public.procurement_centres (id),
  token_date DATE NOT NULL,
  token_number INTEGER NOT NULL,
  queue_position INTEGER NOT NULL,
  estimated_wait_minutes INTEGER NOT NULL DEFAULT 0,
  estimated_arrival_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'travel_alert_sent', 'called', 'served', 'expired', 'cancelled')
  ),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  UNIQUE (centre_id, token_date, token_number)
);

CREATE INDEX queue_tokens_centre_date_status_idx
  ON public.queue_tokens (centre_id, token_date, status);

-- Rolling load snapshots, feed the rule-based ETA+ / congestion prediction
-- and the dynamic centre load-balancing feature.
CREATE TABLE public.centre_load_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id UUID NOT NULL REFERENCES public.procurement_centres (id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  waiting_count INTEGER NOT NULL DEFAULT 0,
  avg_wait_minutes INTEGER NOT NULL DEFAULT 0,
  capacity_utilization_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
);

CREATE INDEX centre_load_snapshots_centre_idx
  ON public.centre_load_snapshots (centre_id, snapshot_at DESC);

-- ---------------------------------------------------------------------
-- 5/6. ARRIVAL ALERT + QR CHECK-IN
-- ---------------------------------------------------------------------
CREATE TABLE public.arrivals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  arrival_time TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_from_centre_km NUMERIC(6, 2),
  qr_checkin_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. PROCUREMENT TRANSACTION (weighing, grading, purchase)
-- ---------------------------------------------------------------------
CREATE TABLE public.procurement_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  quantity_procured_quintals NUMERIC(10, 2) NOT NULL,
  quality_grade TEXT,
  rate_per_quintal NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(12, 2) GENERATED ALWAYS AS
    (quantity_procured_quintals * rate_per_quintal) STORED,
  procured_by TEXT,
  procured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. PAYMENT
-- ---------------------------------------------------------------------
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.procurement_transactions (id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers (id),
  amount NUMERIC(12, 2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (
    payment_mode IN ('bank_transfer', 'upi', 'cash')
  ),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'processing', 'completed', 'failed')
  ),
  reference_number TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_farmer_idx ON public.payments (farmer_id);

-- ---------------------------------------------------------------------
-- 9. STATUS NOTIFICATION — multilingual SMS / IVR / app alerts
-- ---------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL REFERENCES public.farmers (id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings (id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'ivr', 'app_push')),
  language TEXT NOT NULL DEFAULT 'en',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'delivered', 'failed')
  ),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_farmer_idx ON public.notifications (farmer_id);
CREATE INDEX notifications_booking_idx ON public.notifications (booking_id);

-- =========================================================================
-- Grants + RLS — same convention as the farmers/farmer_crops tables:
-- all access goes through server functions using the service_role key.
-- =========================================================================
GRANT ALL ON public.procurement_centres TO service_role;
GRANT ALL ON public.centre_crops TO service_role;
GRANT ALL ON public.procurement_slots TO service_role;
GRANT ALL ON public.bookings TO service_role;
GRANT ALL ON public.booking_status_history TO service_role;
GRANT ALL ON public.queue_tokens TO service_role;
GRANT ALL ON public.centre_load_snapshots TO service_role;
GRANT ALL ON public.arrivals TO service_role;
GRANT ALL ON public.procurement_transactions TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.procurement_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centre_crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centre_load_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
