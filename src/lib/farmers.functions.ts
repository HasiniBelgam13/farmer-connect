import { createServerFn } from "@tanstack/react-start";

export type FarmerDetails = {
  farmerName: string;
  farmerId: string;
  aadhaar: string;
  mobile: string;
  surveyNumber: string;
  state: string;
  district: string;
  village: string;
};

export type FarmerSummary = FarmerDetails & {
  id: string;
  createdAt: string;
  crops: { crop: string; otherName: string | null }[];
};

const digits = (v: string) => v.replace(/\D/g, "");

function mapRow(row: Record<string, unknown>): FarmerSummary {
  const crops = (row['farmer_crops'] as { crop: string; other_name: string | null }[] | null) ?? [];
  return {
    id: row['id'] as string,
    createdAt: row['created_at'] as string,
    farmerName: row['farmer_name'] as string,
    farmerId: row['farmer_code'] as string,
    aadhaar: row['aadhaar'] as string,
    mobile: row['mobile'] as string,
    surveyNumber: row['survey_number'] as string,
    state: row['state'] as string,
    district: row['district'] as string,
    village: row['village'] as string,
    crops: crops.map((c) => ({ crop: c.crop, otherName: c.other_name })),
  };
}

const SELECT = "*, farmer_crops(crop, other_name)";

export const registerFarmer = createServerFn({ method: "POST" })
  .inputValidator((input: FarmerDetails) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const aadhaar = digits(data.aadhaar);
    const mobile = digits(data.mobile);

    const { data: existing, error: findError } = await supabaseAdmin
      .from("farmers")
      .select("id, aadhaar, mobile")
      .or(`aadhaar.eq.${aadhaar},mobile.eq.${mobile}`)
      .limit(1);
    if (findError) throw findError;

    if (existing && existing.length > 0) {
      const row = existing[0]!;
      return {
        status: "already_registered" as const,
        matchedOn: row.aadhaar === aadhaar ? ("aadhaar" as const) : ("mobile" as const),
      };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("farmers")
      .insert({
        farmer_name: data.farmerName.trim(),
        farmer_code: data.farmerId.trim(),
        aadhaar,
        mobile,
        survey_number: data.surveyNumber.trim(),
        state: data.state,
        district: data.district.trim(),
        village: data.village.trim(),
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { status: "already_registered" as const, matchedOn: "aadhaar" as const };
    }
    return { status: "created" as const, id: inserted.id };
  });

export const loginFarmer = createServerFn({ method: "POST" })
  .inputValidator((input: { mobile: string; aadhaar: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("farmers")
      .select(SELECT)
      .eq("mobile", digits(data.mobile))
      .eq("aadhaar", digits(data.aadhaar))
      .maybeSingle();
    if (error) throw error;
    if (!row) return { status: "not_found" as const };
    return { status: "ok" as const, farmer: mapRow(row as Record<string, unknown>) };
  });

export const saveCrops = createServerFn({ method: "POST" })
  .inputValidator((input: { farmerId: string; crops: string[]; otherName?: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("farmer_crops").delete().eq("farmer_id", data.farmerId);
    const rows = data.crops.map((crop) => ({
      farmer_id: data.farmerId,
      crop,
      other_name: crop === "Other" ? (data.otherName ?? null) : null,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("farmer_crops").insert(rows);
      if (error) throw error;
    }
    return { ok: true };
  });

export const getFarmer = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("farmers")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row ? mapRow(row as Record<string, unknown>) : null;
  });

export const listFarmers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("farmers")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
});
