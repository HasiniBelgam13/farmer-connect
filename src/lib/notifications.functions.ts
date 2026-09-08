import { createServerFn } from "@tanstack/react-start";

export type NotificationChannel = "sms" | "ivr" | "app_push";

/**
 * Sends (simulated) a multilingual alert and logs it. Swap the body of this
 * function for a real SMS/IVR gateway call (e.g. MSG91, Exotel, Twilio) —
 * the `notifications` table already tracks per-message delivery status.
 */
export const sendNotification = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      farmerId: string;
      bookingId?: string;
      channel: NotificationChannel;
      language?: string;
      message: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        farmer_id: data.farmerId,
        booking_id: data.bookingId ?? null,
        channel: data.channel,
        language: data.language ?? "en",
        message: data.message,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { notificationId: row.id as string };
  });

export const listNotificationsForFarmer = createServerFn({ method: "POST" })
  .inputValidator((input: { farmerId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("farmer_id", data.farmerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return rows ?? [];
  });
