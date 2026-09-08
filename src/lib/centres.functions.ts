import { createServerFn } from "@tanstack/react-start";
import type { CentreCandidate } from "@/lib/queue-engine";

export type Centre = {
  id: string;
  centreCode: string;
  centreName: string;
  state: string;
  district: string;
  village: string;
  address: string | null;
  contactPhone: string | null;
  dailyCapacityFarmers: number;
  avgServiceMinutesPerFarmer: number;
  isActive: boolean;
  crops: { crop: string; mspRatePerQuintal: number; season: string | null }[];
};

function mapCentre(row: Record<string, unknown>): Centre {
  const crops = (row["centre_crops"] as Record<string, unknown>[] | null) ?? [];
  return {
    id: row["id"] as string,
    centreCode: row["centre_code"] as string,
    centreName: row["centre_name"] as string,
    state: row["state"] as string,
    district: row["district"] as string,
    village: row["village"] as string,
    address: (row["address"] as string | null) ?? null,
    contactPhone: (row["contact_phone"] as string | null) ?? null,
    dailyCapacityFarmers: row["daily_capacity_farmers"] as number,
    avgServiceMinutesPerFarmer: row["avg_service_minutes_per_farmer"] as number,
    isActive: row["is_active"] as boolean,
    crops: crops.map((c) => ({
      crop: c["crop"] as string,
      mspRatePerQuintal: Number(c["msp_rate_per_quintal"]),
      season: (c["season"] as string | null) ?? null,
    })),
  };
}

const SELECT = "*, centre_crops(crop, msp_rate_per_quintal, season)";

/** List all active centres, optionally filtered by crop and/or district. */
export const listCentres = createServerFn({ method: "POST" })
  .inputValidator((input: { crop?: string; district?: string; state?: string } = {}) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("procurement_centres").select(SELECT).eq("is_active", true);
    if (data.district) query = query.eq("district", data.district);
    if (data.state) query = query.eq("state", data.state);
    const { data: rows, error } = await query;
    if (error) throw error;
    let centres = (rows ?? []).map((r) => mapCentre(r as Record<string, unknown>));
    if (data.crop) {
      centres = centres.filter((c) => c.crops.some((cc) => cc.crop === data.crop));
    }
    return centres;
  });

/**
 * Current waiting-queue load per centre — feeds Smart Allocation (dynamic
 * load balancing) and the admin congestion dashboard.
 */
export const getCentreLoad = createServerFn({ method: "POST" })
  .inputValidator((input: { centreIds: string[] }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabaseAdmin
      .from("queue_tokens")
      .select("centre_id, status")
      .eq("token_date", today)
      .in("centre_id", data.centreIds);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const row = r as { centre_id: string; status: string };
      if (row.status === "waiting" || row.status === "travel_alert_sent") {
        counts.set(row.centre_id, (counts.get(row.centre_id) ?? 0) + 1);
      }
    }
    return Object.fromEntries(counts) as Record<string, number>;
  });

/** Builds CentreCandidate[] (centre + live load) for the allocation engine. */
export const getCentreCandidates = createServerFn({ method: "POST" })
  .inputValidator((input: { crop: string }) => input)
  .handler(async ({ data }): Promise<CentreCandidate[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("procurement_centres")
      .select("id, centre_name, district, state, daily_capacity_farmers, avg_service_minutes_per_farmer, centre_crops!inner(crop)")
      .eq("is_active", true)
      .eq("centre_crops.crop", data.crop);
    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    const ids = (rows ?? []).map((r) => (r as Record<string, unknown>)["id"] as string);
    const { data: tokenRows, error: tokenError } = await supabaseAdmin
      .from("queue_tokens")
      .select("centre_id, status")
      .eq("token_date", today)
      .in("centre_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (tokenError) throw tokenError;

    const waiting = new Map<string, number>();
    for (const t of tokenRows ?? []) {
      const row = t as { centre_id: string; status: string };
      if (row.status === "waiting" || row.status === "travel_alert_sent") {
        waiting.set(row.centre_id, (waiting.get(row.centre_id) ?? 0) + 1);
      }
    }

    return (rows ?? []).map((r) => {
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
  });
