# KisanSaarthi Backend — Procurement Platform (SIH26032)

Built on **Supabase (Postgres)**, matching the stack your frontend already
uses (`@supabase/supabase-js`, TanStack Start server functions,
`src/integrations/supabase/client.server.ts`). No new services introduced —
just extended the same database and added the missing server functions.

## What was already there
- `farmers`, `farmer_crops` — registration + crop selection (methodology step 1).
- `src/lib/farmers.functions.ts` — register/login/list farmers.

## What was added

### 1. Database — `supabase/migrations/20260908060000_procurement_platform_schema.sql`
| Table | Purpose | Maps to methodology step |
|---|---|---|
| `procurement_centres` | Physical procurement/mandi centres: location, capacity, operating hours | — |
| `centre_crops` | Crops each centre buys + MSP rate | 2, 3 |
| `procurement_slots` | Per-centre/crop/day booking windows + capacity | 2. Slot Booking |
| `bookings` | One row per farmer journey; `status` walks the whole flow | 1–9 (core record) |
| `booking_status_history` | Full audit trail of every status change | admin/govt transparency |
| `queue_tokens` | Live token number, queue position, ETA | 4. Smart Queue |
| `centre_load_snapshots` | Rolling load history, feeds congestion prediction | Dynamic Centre Load Balancing |
| `arrivals` | GPS arrival + QR check-in timestamps | 5. Arrival Alert, 6. QR Check-in |
| `procurement_transactions` | Quantity, grade, rate, auto-computed total | 7. Procurement |
| `payments` | Payment mode/status/reference | 8. Payment |
| `notifications` | Multilingual SMS/IVR/app alert log | 9. Status Notification |

A seed migration (`20260908060100_seed_demo_centres.sql`) adds five demo
centres (Telangana, MP, WB, Haryana) with MSP rates for Paddy/Wheat/Cotton/
Soybean so the app has real data to allocate against immediately.

**Security**: every new table follows the exact convention already used by
`farmers`/`farmer_crops` — RLS is enabled with no public policies, and only
`service_role` is granted access. All reads/writes go through server
functions using `supabaseAdmin`, never straight from the browser.

### 2. Business logic — `src/lib/`
| File | Responsibility |
|---|---|
| `queue-engine.ts` | Pure, dependency-free rule-based intelligence: `pickBestCentre` (Smart Allocation / load balancing), `computeEtaMinutes` (ETA+), `distanceKm` (haversine), `buildTravelAlertMessage` (en/hi/te templates for the IVR feature) |
| `centres.functions.ts` | `listCentres`, `getCentreLoad`, `getCentreCandidates` |
| `booking.functions.ts` | `createBooking` (register + smart-allocate in one call), `getBooking`, `listBookingsForFarmer`, `cancelBooking` |
| `queue.functions.ts` | `joinQueue`, `getQueueStatus` (live position/ETA, auto-fires the travel alert once a farmer is within 3 places of the front), `markArrived`, `qrCheckIn` |
| `procurement.functions.ts` | `recordProcurement`, `initiatePayment`, `completePayment`, `getBookingJourney` (single call for the full timeline) |
| `notifications.functions.ts` | `sendNotification`, `listNotificationsForFarmer` |

### End-to-end call sequence (matches the Technical Approach slide)
```
registerFarmer            (existing)
saveCrops                 (existing)
createBooking        -->  1 Register + 2 Slot Booking + 3 Smart Allocation
joinQueue             -->  4 Smart Queue (token + ETA, notifies farmer)
getQueueStatus (poll) -->  live position; auto travel-alert near front
markArrived           -->  5 Arrival Alert / GPS logging
qrCheckIn             -->  6 QR Check-in
recordProcurement     -->  7 Procurement (weight, grade, rate)
initiatePayment /
completePayment       -->  8 Payment
sendNotification      -->  9 Status Notification (also auto-fired at each step)
```

## Apply it
```bash
# from the kisansetu/ folder, with the Supabase CLI linked to your project
supabase db push
# or paste the two files in supabase/migrations/ into the Supabase SQL editor

# regenerate typed client bindings so src/integrations/supabase/types.ts
# knows about the new tables (this repo currently only has farmers/farmer_crops typed)
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

The new `*.functions.ts` files intentionally read/write via loose
`Record<string, unknown>` casts (same pattern as the existing
`farmers.functions.ts`), so they work today even before you regenerate
`types.ts` — but regenerating gives you full autocomplete/type-safety.

## Suggested next UI hooks
- `routes/dashboard.tsx`: after a crop card, add a "Book procurement slot"
  button calling `createBooking`, then `joinQueue`.
- New `routes/track.$bookingId.tsx`: poll `getQueueStatus` every ~15s to show
  live token position + ETA (this is your "Intelligent Virtual Queue" demo screen).
- `routes/admin.tsx`: add a centre-load panel using `getCentreLoad` /
  `centre_load_snapshots` for the judges to see "Dynamic Centre Load
  Balancing" in action.
