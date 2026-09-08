import { createServerFn } from "@tanstack/react-start";

/** Methodology step 7: weigh, grade and purchase the produce at the counter. */
export const recordProcurement = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      bookingId: string;
      quantityProcuredQuintals: number;
      qualityGrade?: string;
      ratePerQuintal: number;
      procuredBy?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: txn, error } = await supabaseAdmin
      .from("procurement_transactions")
      .insert({
        booking_id: data.bookingId,
        quantity_procured_quintals: data.quantityProcuredQuintals,
        quality_grade: data.qualityGrade ?? null,
        rate_per_quintal: data.ratePerQuintal,
        procured_by: data.procuredBy ?? null,
      })
      .select("id, total_amount")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("bookings").update({ status: "procured" }).eq("id", data.bookingId);
    await supabaseAdmin
      .from("booking_status_history")
      .insert({ booking_id: data.bookingId, new_status: "procured" });

    return { transactionId: txn.id as string, totalAmount: Number(txn.total_amount) };
  });

/** Methodology step 8 (part 1): initiate payment against a completed transaction. */
export const initiatePayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { transactionId: string; farmerId: string; amount: number; paymentMode?: "bank_transfer" | "upi" | "cash" }) =>
      input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        transaction_id: data.transactionId,
        farmer_id: data.farmerId,
        amount: data.amount,
        payment_mode: data.paymentMode ?? "bank_transfer",
        payment_status: "processing",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { paymentId: payment.id as string };
  });

/** Methodology step 8 (part 2): mark a payment settled and close out the booking. */
export const completePayment = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string; referenceNumber?: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .update({
        payment_status: "completed",
        reference_number: data.referenceNumber ?? null,
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.paymentId)
      .select("id, farmer_id, amount, transaction_id, procurement_transactions(booking_id)")
      .single();
    if (error) throw error;

    const bookingId = (payment.procurement_transactions as unknown as { booking_id: string }).booking_id;
    await supabaseAdmin.from("bookings").update({ status: "completed" }).eq("id", bookingId);
    await supabaseAdmin.from("booking_status_history").insert([
      { booking_id: bookingId, new_status: "paid" },
      { booking_id: bookingId, new_status: "completed" },
    ]);
    await supabaseAdmin.from("notifications").insert({
      farmer_id: payment.farmer_id,
      booking_id: bookingId,
      channel: "sms",
      language: "en",
      message: `KisanSaarthi: Payment of Rs.${payment.amount} has been credited. Ref: ${data.referenceNumber ?? "N/A"}.`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return { ok: true };
  });

/** Full journey view for a single booking — used by farmer status screen & admin. */
export const getBookingJourney = createServerFn({ method: "POST" })
  .inputValidator((input: { bookingId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: booking }, { data: token }, { data: arrival }, { data: txn }, { data: history }] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("*, procurement_centres(centre_name, district, state, contact_phone)")
        .eq("id", data.bookingId)
        .maybeSingle(),
      supabaseAdmin.from("queue_tokens").select("*").eq("booking_id", data.bookingId).maybeSingle(),
      supabaseAdmin.from("arrivals").select("*").eq("booking_id", data.bookingId).maybeSingle(),
      supabaseAdmin
        .from("procurement_transactions")
        .select("*, payments(*)")
        .eq("booking_id", data.bookingId)
        .maybeSingle(),
      supabaseAdmin
        .from("booking_status_history")
        .select("*")
        .eq("booking_id", data.bookingId)
        .order("changed_at", { ascending: true }),
    ]);

    return { booking, token, arrival, transaction: txn, history: history ?? [] };
  });
