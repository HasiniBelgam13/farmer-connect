CREATE TABLE public.farmers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_name TEXT NOT NULL,
  farmer_code TEXT NOT NULL,
  aadhaar TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  survey_number TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  village TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.farmer_crops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  other_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (farmer_id, crop)
);

CREATE INDEX farmer_crops_farmer_id_idx ON public.farmer_crops(farmer_id);

GRANT ALL ON public.farmers TO service_role;
GRANT ALL ON public.farmer_crops TO service_role;

ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_crops ENABLE ROW LEVEL SECURITY;