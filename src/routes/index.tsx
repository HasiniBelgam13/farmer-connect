import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Farmer Registration | AgriConnect" },
      {
        name: "description",
        content:
          "Register farmer details including Farmer ID, Aadhaar, mobile number, survey number and location for agricultural scheme enrollment.",
      },
      { property: "og:title", content: "Farmer Registration | AgriConnect" },
      {
        property: "og:description",
        content:
          "A simple, mobile-friendly form to register farmer details for agricultural scheme enrollment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FarmerRegistration,
});

const STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

type Values = {
  farmerName: string;
  farmerId: string;
  aadhaar: string;
  mobile: string;
  surveyNumber: string;
  state: string;
  district: string;
  village: string;
};

const EMPTY: Values = {
  farmerName: "",
  farmerId: "",
  aadhaar: "",
  mobile: "",
  surveyNumber: "",
  state: "",
  district: "",
  village: "",
};

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  const REQUIRED = "This field is required";
  (Object.keys(EMPTY) as (keyof Values)[]).forEach((k) => {
    if (!v[k].trim()) e[k] = REQUIRED;
  });
  if (!e.farmerName && v.farmerName.trim().length < 2)
    e.farmerName = "Enter the farmer's full name.";
  if (!e.farmerId && !/^[A-Za-z0-9-]{4,20}$/.test(v.farmerId.trim()))
    e.farmerId = "Use 4–20 letters, numbers or hyphens.";
  if (!e.aadhaar && !/^\d{12}$/.test(v.aadhaar.replace(/\s/g, "")))
    e.aadhaar = "Aadhaar must be exactly 12 digits.";
  if (!e.mobile && !/^[6-9]\d{9}$/.test(v.mobile.replace(/\s/g, "")))
    e.mobile = "Enter a valid 10-digit mobile number.";
  if (!e.district && v.district.trim().length < 2) e.district = "Enter a valid district.";
  if (!e.village && v.village.trim().length < 2) e.village = "Enter a valid village.";
  return e;
}


const labelCls = "block text-sm font-medium text-foreground";
const fieldCls =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/70 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";
const errCls = "mt-1.5 text-sm text-destructive";

function FarmerRegistration() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.keys(next).length === 0) {
      addRegistration(values);
      setSubmitted(true);
      setValues(EMPTY);
      setTimeout(() => navigate({ to: "/crops" }), 1200);
    } else {
      setSubmitted(false);
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
    }
  };


  const err = (key: keyof Values) => errors[key];
  const aria = (key: keyof Values) =>
    ({
      "aria-invalid": err(key) ? true : undefined,
      "aria-describedby": err(key) ? `${key}-error` : undefined,
    }) as const;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            AgriConnect
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Farmer Registration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fill in the details below to enroll a farmer. All fields are required.
          </p>
        </header>

        {submitted && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground"
          >
            Registration submitted successfully.
          </div>
        )}

        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
        >
          <fieldset className="border-0 p-0">
            <legend className="text-sm font-semibold text-foreground">Farmer details</legend>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="farmerName" className={labelCls}>
                  Farmer Name
                </label>
                <input
                  id="farmerName"
                  name="farmerName"
                  type="text"
                  autoComplete="name"
                  inputMode="text"
                  placeholder="e.g. Ramesh Kumar"
                  className={fieldCls}
                  value={values.farmerName}
                  onChange={set("farmerName")}
                  {...aria("farmerName")}
                />
                {err("farmerName") && (
                  <p id="farmerName-error" className={errCls}>
                    {err("farmerName")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="farmerId" className={labelCls}>
                  Farmer ID
                </label>
                <input
                  id="farmerId"
                  name="farmerId"
                  type="text"
                  placeholder="e.g. FRM-10245"
                  className={fieldCls}
                  value={values.farmerId}
                  onChange={set("farmerId")}
                  {...aria("farmerId")}
                />
                {err("farmerId") && (
                  <p id="farmerId-error" className={errCls}>
                    {err("farmerId")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="aadhaar" className={labelCls}>
                  Aadhaar ID
                </label>
                <input
                  id="aadhaar"
                  name="aadhaar"
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12-digit number"
                  className={fieldCls}
                  value={values.aadhaar}
                  onChange={set("aadhaar")}
                  {...aria("aadhaar")}
                />
                {err("aadhaar") && (
                  <p id="aadhaar-error" className={errCls}>
                    {err("aadhaar")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mobile" className={labelCls}>
                  Mobile Number
                </label>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  className={fieldCls}
                  value={values.mobile}
                  onChange={set("mobile")}
                  {...aria("mobile")}
                />
                {err("mobile") && (
                  <p id="mobile-error" className={errCls}>
                    {err("mobile")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="surveyNumber" className={labelCls}>
                  Survey Number
                </label>
                <input
                  id="surveyNumber"
                  name="surveyNumber"
                  type="text"
                  placeholder="e.g. 142/3B"
                  className={fieldCls}
                  value={values.surveyNumber}
                  onChange={set("surveyNumber")}
                  {...aria("surveyNumber")}
                />
                {err("surveyNumber") && (
                  <p id="surveyNumber-error" className={errCls}>
                    {err("surveyNumber")}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="mt-7 border-0 p-0">
            <legend className="text-sm font-semibold text-foreground">Location</legend>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="state" className={labelCls}>
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  className={fieldCls}
                  value={values.state}
                  onChange={set("state")}
                  {...aria("state")}
                >
                  <option value="">Select state</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {err("state") && (
                  <p id="state-error" className={errCls}>
                    {err("state")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="district" className={labelCls}>
                  District
                </label>
                <input
                  id="district"
                  name="district"
                  type="text"
                  placeholder="e.g. Warangal"
                  className={fieldCls}
                  value={values.district}
                  onChange={set("district")}
                  {...aria("district")}
                />
                {err("district") && (
                  <p id="district-error" className={errCls}>
                    {err("district")}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="village" className={labelCls}>
                  Village
                </label>
                <input
                  id="village"
                  name="village"
                  type="text"
                  placeholder="e.g. Kothapally"
                  className={fieldCls}
                  value={values.village}
                  onChange={set("village")}
                  {...aria("village")}
                />
                {err("village") && (
                  <p id="village-error" className={errCls}>
                    {err("village")}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Register Farmer
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Details are used only for scheme enrollment verification.
          </p>
        </form>
      </div>
    </main>
  );
}
