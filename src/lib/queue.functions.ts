import { createServerFn } from "@tanstack/react-start";
import { buildTravelAlertMessage, computeEtaMinutes, distanceKm, minutesFromNow } from "@/lib/queue-engine";

const TRAVEL_ALERT_THRESHOLD_POSITION = 3;

/** Methodology step 4: put an allocated booking into the live virtual queue. */
export const joinQueue = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string; language?: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, farmer_id, centre_id, status, procurement_centres(centre_name, avg_service_minutes_per_farmer)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking || !booking.centre_id) return { status: "not_allocated" as const };

    const centre = booking.procurement_centres as unknown as {
      centre_name: string;
      avg_service_minutes_per_farmer: number;
    };
    const today = new Date().toISOString().slice(0, 10);

    const { count } = await supabaseAdmin
      .from("queue_tokens")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", booking.centre_id)
      .eq("token_date", today);

    const tokenNumber = (count ?? 0) + 1;
    const queuePosition = tokenNumber; // FIFO: position === token order for the day
    const etaMinutes = computeEtaMinutes(queuePosition, centre.avg_service_minutes_per_farmer);

    const { data: token, error: tokenError } = await supabaseAdmin
      .from("queue_tokens")
      .insert({
        booking_id: data.bookingId,
        centre_id: booking.centre_id,
        token_date: today,
        token_number: tokenNumber,
        queue_position: queuePosition,
        estimated_wait_minutes: etaMinutes,
        estimated_arrival_time: minutesFromNow(etaMinutes),
        status: "waiting",
      })
      .select("id, token_number, queue_position, estimated_wait_minutes, estimated_arrival_time")
      .single();
    if (tokenError) throw tokenError;

    await supabaseAdmin.from("bookings").update({ status: "queued" }).eq("id", data.bookingId);
    await supabaseAdmin
      .from("booking_status_history")
      .insert({ booking_id: data.bookingId, old_status: "allocated", new_status: "queued" });

    const language = data.language ?? "en";
    const message = buildTravelAlertMessage(language, centre.centre_name, tokenNumber, etaMinutes);
    await supabaseAdmin.from("notifications").insert({
      farmer_id: booking.farmer_id,
      booking_id: data.bookingId,
      channel: "sms",
      language,
      message: `Token issued. ${message}`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return { status: "queued" as const, ...token };
  });

/** Live queue position + ETA, recomputed on every poll (drives the tracker screen). */
export const getQueueStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: token, error } = await supabaseAdmin
      .from("queue_tokens")
      .select("id, centre_id, token_date, token_number, status, issued_at, procurement_centres(avg_service_minutes_per_farmer, centre_name)")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!token) return { status: "not_in_queue" as const };

    if (token.status === "served" || token.status === "expired" || token.status === "cancelled") {
      return {
        status: token.status as "served" | "expired" | "cancelled",
        tokenNumber: token.token_number as number,
      };
    }

    const { count: aheadCount } = await supabaseAdmin
      .from("queue_tokens")
      .select("id", { count: "exact", head: true })
      .eq("centre_id", token.centre_id)
      .eq("token_date", token.token_date)
      .in("status", ["waiting", "travel_alert_sent"])
      .lt("issued_at", token.issued_at as string);

    const centre = token.procurement_centres as unknown as { avg_service_minutes_per_farmer: number; centre_name: string };
    const queuePosition = (aheadCount ?? 0) + 1;
    const etaMinutes = computeEtaMinutes(queuePosition, centre.avg_service_minutes_per_farmer);

    let newStatus = token.status as string;
    if (queuePosition <= TRAVEL_ALERT_THRESHOLD_POSITION && token.status === "waiting") {
      newStatus = "travel_alert_sent";
    }

    await supabaseAdmin
      .from("queue_tokens")
      .update({
        queue_position: queuePosition,
        estimated_wait_minutes: etaMinutes,
        estimated_arrival_time: minutesFromNow(etaMinutes),
        status: newStatus,
      })
      .eq("id", token.id);

    return {
      status: "in_queue" as const,
      tokenNumber: token.token_number as number,
      queuePosition,
      estimatedWaitMinutes: etaMinutes,
      centreName: centre.centre_name,
      travelAlertSent: newStatus === "travel_alert_sent",
    };
  });

/** Methodology step 5: farmer's device reports GPS, we log distance + arrival time. */
export const markArrived = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string; latitude?: number; longitude?: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("centre_id, procurement_centres(latitude, longitude)")
      .eq("id", data.bookingId)
      .maybeSingle();

    let distance: number | null = null;
    const centre = booking?.procurement_centres as unknown as { latitude: number | null; longitude: number | null } | null;
    if (data.latitude != null && data.longitude != null && centre?.latitude != null && centre?.longitude != null) {
      distance = distanceKm(data.latitude, data.longitude, centre.latitude, centre.longitude);
    }

    await supabaseAdmin.from("arrivals").upsert(
      {
        booking_id: data.bookingId,
        arrival_time: new Date().toISOString(),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        distance_from_centre_km: distance,
      },
      { onConflict: "booking_id" },
    );

    await supabaseAdmin.from("bookings").update({ status: "arrived" }).eq("id", data.bookingId);
    await supabaseAdmin
      .from("queue_tokens")
      .update({ status: "called", called_at: new Date().toISOString() })
      .eq("booking_id", data.bookingId);
    await supabaseAdmin
      .from("booking_status_history")
      .insert({ booking_id: data.bookingId, new_status: "arrived" });

    return { ok: true, distanceKm: distance };
  });

/** Methodology step 6: QR scan at the centre gate confirms physical check-in. */
export const qrCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("arrivals")
      .upsert({ booking_id: data.bookingId, qr_checkin_time: new Date().toISOString() }, { onConflict: "booking_id" });
    await supabaseAdmin.from("bookings").update({ status: "checked_in" }).eq("id", data.bookingId);
    await supabaseAdmin.from("queue_tokens").update({ status: "served" }).eq("booking_id", data.bookingId);
    await supabaseAdmin
      .from("booking_status_history")
      .insert({ booking_id: data.bookingId, new_status: "checked_in" });

    return { ok: true };
  });
