import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listFarmers, type FarmerSummary } from "@/lib/farmers.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Submitted Registrations | KisanSaarthi" },
      {
        name: "description",
        content:
          "Admin view listing every submitted farmer registration with contact, land and crop details.",
      },
      { property: "og:title", content: "Admin — Submitted Registrations | KisanSaarthi" },
      {
        property: "og:description",
        content: "Review all farmer registrations submitted for scheme enrollment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminRegistrations,
});

function AdminRegistrations() {
  const fetchAll = useServerFn(listFarmers);
  const [records, setRecords] = useState<FarmerSummary[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchAll().then((rows) => {
      setRecords(rows);
      setReady(true);
    });
  }, [fetchAll]);

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            KisanSaarthi · Admin
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Submitted Registrations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready ? `${records.length} registration${records.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </header>

        {ready && records.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">No registrations yet.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Register a farmer
            </Link>
          </div>
        )}

        <ul className="space-y-4">
          {records.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">{r.farmerName}</h2>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Row label="Farmer ID" value={r.farmerId} />
                <Row label="Aadhaar ID" value={r.aadhaar} />
                <Row label="Mobile" value={r.mobile} />
                <Row label="Survey Number" value={r.surveyNumber} />
                <Row label="State" value={r.state} />
                <Row label="District" value={r.district} />
                <Row label="Village" value={r.village} />
                <Row
                  label="Crops"
                  value={
                    r.crops.length
                      ? r.crops
                          .map((c) =>
                            c.crop === "Other" && c.otherName ? `Other (${c.otherName})` : c.crop,
                          )
                          .join(", ")
                      : "Not selected"
                  }
                />
              </dl>
            </li>
          ))}
        </ul>

        {ready && records.length > 0 && (
          <p className="mt-6 text-center text-sm">
            <Link to="/" className="underline underline-offset-2">
              Register another farmer
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
