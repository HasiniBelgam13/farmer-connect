-- Demo seed data so Smart Allocation / Virtual Queue have something to work
-- with immediately after migrating. Safe to delete in production.

INSERT INTO public.procurement_centres
  (centre_code, centre_name, state, district, village, address, daily_capacity_quintals, daily_capacity_farmers, avg_service_minutes_per_farmer, contact_phone)
VALUES
  ('PC-TS-HYD-01', 'Ranga Reddy APMC Yard',      'Telangana',      'Ranga Reddy', 'Shamshabad',   'APMC Yard Rd, Shamshabad',   2000, 60, 8,  '18001801551'),
  ('PC-TS-HYD-02', 'Medchal Procurement Centre',  'Telangana',      'Medchal',     'Medchal',      'Grain Market, Medchal',      1500, 45, 10, '18001801551'),
  ('PC-MP-BPL-01', 'Bhopal e-Uparjan Kendra',      'Madhya Pradesh', 'Bhopal',      'Kolar',        'Krishi Upaj Mandi, Kolar',    2500, 70, 9,  '18002337529'),
  ('PC-WB-HGH-01', 'Hooghly Paddy Centre',         'West Bengal',    'Hooghly',     'Chinsurah',    'Block Office Rd, Chinsurah',  1800, 50, 10, '18003453343'),
  ('PC-HR-KKR-01', 'Karnal eKharid Kendra',        'Haryana',        'Karnal',      'Karnal',       'New Grain Market, Karnal',    2200, 65, 8,  '18001802060')
ON CONFLICT (centre_code) DO NOTHING;

INSERT INTO public.centre_crops (centre_id, crop, msp_rate_per_quintal, season)
SELECT c.id, x.crop, x.rate, x.season
FROM public.procurement_centres c
JOIN (VALUES
  ('PC-TS-HYD-01', 'Paddy',  2320.00, 'Kharif 2026'),
  ('PC-TS-HYD-01', 'Cotton', 7710.00, 'Kharif 2026'),
  ('PC-TS-HYD-02', 'Paddy',  2320.00, 'Kharif 2026'),
  ('PC-MP-BPL-01', 'Wheat',  2425.00, 'Rabi 2026'),
  ('PC-MP-BPL-01', 'Soybean', 4892.00, 'Kharif 2026'),
  ('PC-WB-HGH-01', 'Paddy',  2320.00, 'Kharif 2026'),
  ('PC-HR-KKR-01', 'Wheat',  2425.00, 'Rabi 2026'),
  ('PC-HR-KKR-01', 'Paddy',  2320.00, 'Kharif 2026')
) AS x(centre_code, crop, rate, season) ON x.centre_code = c.centre_code
ON CONFLICT (centre_id, crop, season) DO NOTHING;
