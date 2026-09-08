import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFarmer, type FarmerSummary } from "@/lib/farmers.functions";
import { clearCurrentFarmerId, cropSlug, getCurrentFarmerId } from "@/lib/session";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Crop Dashboard | KisanSaarthi" },
      {
        name: "description",
        content:
          "Your KisanSaarthi dashboard with one card per registered crop, linking to crop-specific guidance pages.",
      },
      { property: "og:title", content: "My Crop Dashboard | KisanSaarthi" },
      {
        property: "og:description",
        content: "Open a page for each crop you registered with KisanSaarthi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard;
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchFarmer = useServerFn(getFarmer);
  const [farmer, setFarmer] = useState<FarmerSummary | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = getCurrentFarmerId();
    if (!id) {
      navigate({ to: "/login" });
      return;
    }
    fetchFarmer({ data: { id } }).then((res) => {
      if (!res) {
        clearCurrentFarmerId();
        navigate({ to: "/login" });
        return;
      }
      setFarmer(res);
      setReady(true);
    });
  }, [fetchFarmer, navigate]);

  if (!ready || !farmer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            KisanSaarthi
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Namaste, {farmer.farmerName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {farmer.village}, {farmer.district}, {farmer.state} · Farmer ID {farmer.farmerId}
          </p>
        </header>

        <h2 className="text-sm font-semibold text-foreground">
          Your crops ({farmer.crops.length})
        </h2>

        {farmer.crops.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">You haven't selected any crops yet.</p>
            <Link
              to="/crops"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Select crops
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {farmer.crops.map((c) => {
              const title = c.crop === "Other" && c.otherName ? c.otherName : c.crop;
              return (
                <li key={c.crop}>
                  <Link
                    to="/crop/$cropSlug"
                    params={{ cropSlug: cropSlug(c.crop) }}
                    className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary hover:bg-primary/5"
                  >
                    <p className="text-base font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Advisory, prices and schemes
                    </p>
                    <span className="mt-3 inline-block text-sm font-medium text-primary">
                      Open →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <Link to="/crops" className="underline underline-offset-2">
            Update crops
          </Link>
          <button
            type="button"
            onClick={() => {
              clearCurrentFarmerId();
              navigate({ to: "/login" });
            }}
            className="underline underline-offset-2"
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}
