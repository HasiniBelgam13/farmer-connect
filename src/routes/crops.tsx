import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFarmer, saveCrops } from "@/lib/farmers.functions";
import { CROPS, getCurrentFarmerId } from "@/lib/session";

export const Route = createFileRoute("/crops")({
  head: () => ({
    meta: [
      { title: "Crop Selection | KisanSaarthi" },
      {
        name: "description",
        content:
          "Select the crops cultivated by the registered farmer, including paddy, wheat, maize, pulses, cotton, sugarcane and more.",
      },
      { property: "og:title", content: "Crop Selection | KisanSaarthi" },
      {
        property: "og:description",
        content: "Choose the crops grown by a registered farmer to complete enrollment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CropSelection,
});

function CropSelection() {
  const navigate = useNavigate();
  const fetchFarmer = useServerFn(getFarmer);
  const persist = useServerFn(saveCrops);
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState<string>("");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = getCurrentFarmerId();
    if (!id) {
      navigate({ to: "/login" });
      return;
    }
    setFarmerId(id);
    fetchFarmer({ data: { id } }).then((res) => {
      if (!res) {
        navigate({ to: "/login" });
        return;
      }
      setFarmerName(res.farmerName);
      setSelected(res.crops.map((c) => c.crop));
      const otherEntry = res.crops.find((c) => c.crop === "Other");
      if (otherEntry?.otherName) setOther(otherEntry.otherName);
    });
  }, [fetchFarmer, navigate]);

  const toggle = (crop: string) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let bad = false;
    if (selected.length === 0) {
      setError("This field is required");
      bad = true;
    }
    if (selected.includes("Other") && other.trim().length < 2) {
      setOtherError("This field is required");
      bad = true;
    }
    if (bad || !farmerId) return;

    setBusy(true);
    try {
      await persist({
        data: { farmerId, crops: selected, otherName: other.trim() || undefined },
      });
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            KisanSaarthi · Step 2 of 2
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Crop Selection
          </h1>
          {farmerName && <p className="mt-2 text-sm text-muted-foreground">For {farmerName}</p>}
        </header>

        {done ? (
          <div
            role="status"
            className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center"
          >
            <p className="text-base font-semibold text-foreground">
              Crops saved. Enrollment complete.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Opening your dashboard…</p>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
          >
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-semibold text-foreground">
                Select the crops cultivated
              </legend>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {CROPS.map((crop) => {
                  const checked = selected.includes(crop);
                  return (
                    <label
                      key={crop}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition ${
                        checked
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input bg-background text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() => toggle(crop)}
                      />
                      {crop}
                    </label>
                  );
                })}
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </fieldset>

            {selected.includes("Other") && (
              <div className="mt-5">
                <label htmlFor="otherCrop" className="block text-sm font-medium text-foreground">
                  Other crop
                </label>
                <input
                  id="otherCrop"
                  type="text"
                  placeholder="Name the crop"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/70 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setOtherError(null);
                  }}
                  aria-invalid={otherError ? true : undefined}
                  aria-describedby={otherError ? "otherCrop-error" : undefined}
                />
                {otherError && (
                  <p id="otherCrop-error" className="mt-1.5 text-sm text-destructive">
                    {otherError}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save Crops"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link to="/dashboard" className="underline underline-offset-2">
                Go to my dashboard
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
