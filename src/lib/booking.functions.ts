import { createServerFn } from "@tanstack/react-start";
import { pickBestCentre, type CentreCandidate } from "@/lib/queue-engine";

export type BookingStatus =
  | "registered"
  | "allocated"
  | "queued"
  | "travel_alert_sent"
  | "arrived"
  | "checked_in"
  | "procurement_in_progress"
  | "procured"
  | "paid"
  | "completed"
  | "cancelled"
  | "no_show";

export type BookingDetails = {
  id: string;
  farmerId: string;
  crop: string;
  expectedQuantityQuintals: number;
  status: BookingStatus;
  createdAt: string;
  centre: { id: string; centreName: string; district: string; state: string; contactPhone: string | null } | null;
};

async function logStatus(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  bookingId: string,
  oldStatus: string | null,
  newStatus: string,
  note?: string,
) {
  await supabaseAdmin
    .from("booking_status_history")
    .insert({ booking_id: bookingId, old_status: oldStatus, new_status: newStatus, note: note ?? null });
}

/**
 * Methodology steps 1 + 2 + 3: Register the booking and immediately run
 * Smart Allocation to pick the least-congested centre offering the crop.
 */
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { farmerId: string; crop: string; expectedQuantityQuintals: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: farmer, error: farmerError } = await supabaseAdmin
      .from("farmers")
      .select("id, district, state")
      .eq("id", data.farmerId)
      .maybeSingle();
    if (farmerError) throw farmerError;
    if (!farmer) return { status: "farmer_not_found" as const };

    const { data: centreRows, error: centreError } = await supabaseAdmin
      .from("procurement_centres")
      .select(
        "id, centre_name, district, state, daily_capacity_farmers, avg_service_minutes_per_farmer, contact_phone, centre_crops!inner(crop)",
      )
      .eq("is_active", true)
      .eq("centre_crops.crop", data.crop);
    if (centreError) throw centreError;

    if (!centreRows || centreRows.length === 0) {
      return { status: "no_centre_available" as const };
    }

    const today = new Date().toISOString().slice(0, 10);
    const ids = centreRows.map((r) => (r as Record<string, unknown>)["id"] as string);
    const { data: tokenRows, error: tokenError } = await supabaseAdmin
      .from("queue_tokens")
      .select("centre_id, status")
      .eq("token_date", today)
      .in("centre_id", ids);
    if (tokenError) throw tokenError;

    const waiting = new Map<string, number>();
    for (const t of tokenRows ?? []) {
      const row = t as { centre_id: string; status: string };
      if (row.status === "waiting" || row.status === "travel_alert_sent") {
        waiting.set(row.centre_id, (waiting.get(row.centre_id) ?? 0) + 1);
      }
    }

    const candidates: CentreCandidate[] = centreRows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row["id"] as string,
        centreName: row["centre_name"] as string,
        district: row["district"] as string,
        state: row["state"] as string,
        dailyCapacityFarmers: row["daily_capacity_farmers"] as number,
        avgServiceMinutesPerFarmer: row["avg_service_minutes_per_farmer"] as number,
        waitingCount: waiting.get(row["id"] as string) ?? 0,
      };
    });

    const best = pickBestCentre(candidates, farmer.district, farmer.state);
    if (!best) return { status: "no_centre_available" as const };

    // Reuse (or create) today's slot for this centre + crop.
    const { data: existingSlot } = await supabaseAdmin
      .from("procurement_slots")
      .select("id, booked_farmers, capacity_farmers")
      .eq("centre_id", best.id)
      .eq("crop", data.crop)
      .eq("slot_date", today)
      .maybeSingle();

    let slotId: string;
    if (existingSlot) {
      slotId = existingSlot.id as string;
      await supabaseAdmin
        .from("procurement_slots")
        .update({ booked_farmers: (existingSlot.booked_farmers as number) + 1 })
        .eq("id", slotId);
    } else {
      const { data: newSlot, error: slotError } = await supabaseAdmin
        .from("procurement_slots")
        .insert({
          centre_id: best.id,
          crop: data.crop,
          slot_date: today,
          slot_start: "09:00",
          slot_end: "18:00",
          capacity_farmers: 40,
          booked_farmers: 1,
        })
        .select("id")
        .single();
      if (slotError) throw slotError;
      slotId = newSlot.id as string;
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        farmer_id: data.farmerId,
        crop: data.crop,
        expected_quantity_quintals: data.expectedQuantityQuintals,
        centre_id: best.id,
        slot_id: slotId,
        status: "allocated",
      })
      .select("id, created_at")
      .single();
    if (bookingError) throw bookingError;

    await logStatus(supabaseAdmin, booking.id as string, null, "registered", "Farmer registered");
    await logStatus(
      supabaseAdmin,
      booking.id as string,
      "registered",
      "allocated",
      `Smart-allocated to ${best.centreName}`,
    );

    return {
      status: "allocated" as const,
      bookingId: booking.id as string,
      centre: { id: best.id, centreName: best.centreName, district: best.district, state: best.state },
    };
  });

function mapBooking(row: Record<string, unknown>): BookingDetails {
  const centre = row["procurement_centres"] as Record<string, unknown> | null;
  return {
    id: row["id"] as string,
    farmerId: row["farmer_id"] as string,
    crop: row["crop"] as string,
    expectedQuantityQuintals: Number(row["expected_quantity_quintals"]),
    status: row["status"] as BookingStatus,
    createdAt: row["created_at"] as string,
    centre: centre
      ? {
          id: centre["id"] as string,
          centreName: centre["centre_name"] as string,
          district: centre["district"] as string,
          state: centre["state"] as string,
          contactPhone: (centre["contact_phone"] as string | null) ?? null,
        }
      : null,
  };
}

const BOOKING_SELECT = "*, procurement_centres(id, centre_name, district, state, contact_phone)";

export const getBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw error;
    return row ? mapBooking(row as Record<string, unknown>) : null;
  });

export const listBookingsForFarmer = createServerFn({ method: "POST" })
  .inputValidator((input: { farmerId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("farmer_id", data.farmerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []).map((r) => mapBooking(r as Record<string, unknown>));
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string; note?: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("status")
      .eq("id", data.bookingId)
      .maybeSingle();
    await supabaseAdmin.from("bookings").update({ status: "cancelled" }).eq("id", data.bookingId);
    await logStatus(supabaseAdmin, data.bookingId, (existing?.status as string) ?? null, "cancelled", data.note);
    return { ok: true };
  });
