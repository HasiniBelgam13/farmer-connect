import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFarmer, type FarmerSummary } from "@/lib/farmers.functions";
import { cropFromSlug, getCurrentFarmerId } from "@/lib/session";

export const Route = createFileRoute("/crop/$cropSlug")({
  head: ({ params }) => {
    const crop = cropFromSlug(params.cropSlug) ?? "Crop";
    return {
      meta: [
        { title: `${crop} — Crop Guide | KisanSaarthi` },
        {
          name: "description",
          content: `Crop page for ${crop}: sowing calendar, advisory notes, market prices, and scheme information for KisanSaarthi farmers.`,
        },
        { property: "og:title", content: `${crop} — Crop Guide | KisanSaarthi` },
        {
          property: "og:description",
          content: `Sowing calendar, advisory, market prices and schemes for ${crop}.`,
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CropPage,
});

const SECTIONS = [
  {
    title: "Sowing & season calendar",
    body: "Recommended sowing window, seed rate and spacing for this crop will appear here once the agronomy calendar is connected.",
  },
  {
    title: "Advisory & pest alerts",
    body: "Stage-wise irrigation, nutrient and pest management advisories for your district will be published here.",
  },
  {
    title: "Market prices",
    body: "Latest mandi prices and price trends for this crop near your district will be shown here.",
  },
  {
    title: "Schemes & subsidies",
    body: "Government schemes, insurance and input subsidies applicable to this crop will be listed here.",
  },
];

function CropPage() {
  const { cropSlug: slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchFarmer = useServerFn(getFarmer);
  const [farmer, setFarmer] = useState<FarmerSummary | null>(null);
  const crop = cropFromSlug(slug);

  useEffect(() => {
    const id = getCurrentFarmerId();
    if (!id) {
      navigate({ to: "/login" });
      return;
    }
    fetchFarmer({ data: { id } }).then(setFarmer);
  }, [fetchFarmer, navigate]);

  const entry = farmer?.crops.find((c) => c.crop === crop);
  const title = entry && entry.crop === "Other" && entry.otherName ? entry.otherName : crop;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/dashboard" className="text-sm underline underline-offset-2">
          ← Back to dashboard
        </Link>
        <header className="mt-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Crop page
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title ?? "Crop not found"}
          </h1>
          {farmer && (
            <p className="mt-2 text-sm text-muted-foreground">
              For {farmer.farmerName} · {farmer.village}, {farmer.district}
            </p>
          )}
        </header>

        {!crop ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              We don't have a page for that crop. Go back and pick one of your crops.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map((s) => (
              <section
                key={s.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              >
                <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-3 inline-block rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Coming soon
                </p>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
