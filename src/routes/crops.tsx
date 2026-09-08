import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  clearPendingId,
  getPendingId,
  listRegistrations,
  updateCrops,
} from "@/lib/registrations";

export const Route = createFileRoute("/crops")({
  head: () => ({
    meta: [
      { title: "Crop Selection | AgriConnect" },
      {
        name: "description",
        content:
          "Select the crops cultivated by the registered farmer, including paddy, wheat, maize, pulses, cotton, sugarcane and more.",
      },
      { property: "og:title", content: "Crop Selection | AgriConnect" },
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

const CROPS = [
  "Paddy",
  "Wheat",
  "Maize",
  "Pulses",
  "Grains",
  "Oilseeds",
  "Cotton",
  "Jute",
  "Sugarcane",
  "Groundnut",
  "Mirchi",
  "Tea",
  "Other",
];

function CropSelection() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState<string>("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = getPendingId();
    const record = listRegistrations().find((r) => r.id === id);
    if (record) setFarmerName(record.farmerName);
  }, []);

  const toggle = (crop: string) => {
    setError(null);
    setSelected((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop],
    );
  };

  const onSubmit = (e: React.FormEvent) => {
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
    if (bad) return;

    const id = getPendingId();
    if (id) updateCrops(id, selected, other.trim() || undefined);
    clearPendingId();
    setDone(true);
    setTimeout(() => navigate({ to: "/admin" }), 1200);
  };

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Step 2 of 2
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Crop Selection
          </h1>
          {farmerName && (
            <p className="mt-2 text-sm text-muted-foreground">For {farmerName}</p>
          )}
        </header>

        {done ? (
          <div
            role="status"
            className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center"
          >
            <p className="text-base font-semibold text-foreground">
              Crops saved. Enrollment complete.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Opening the records view…</p>
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
              className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Save Crops
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link to="/" className="underline underline-offset-2">
                Back to farmer details
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
