import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { loginFarmer } from "@/lib/farmers.functions";
import { setCurrentFarmerId } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Farmer Login | KisanSaarthi" },
      {
        name: "description",
        content:
          "Already registered? Log in to KisanSaarthi with your mobile number and Aadhaar ID to open your crop dashboard.",
      },
      { property: "og:title", content: "Farmer Login | KisanSaarthi" },
      {
        property: "og:description",
        content: "Log in with your mobile number and Aadhaar ID to view your crops.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const labelCls = "block text-sm font-medium text-foreground";
const fieldCls =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground/70 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";
const errCls = "mt-1.5 text-sm text-destructive";

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginFarmer);
  const [mobile, setMobile] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string | undefined; aadhaar?: string | undefined }>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: { mobile?: string | undefined; aadhaar?: string | undefined } = {};
    if (!mobile.trim()) next.mobile = "This field is required";
    else if (!/^[6-9]\d{9}$/.test(mobile.replace(/\s/g, "")))
      next.mobile = "Enter a valid 10-digit mobile number.";
    if (!aadhaar.trim()) next.aadhaar = "This field is required";
    else if (!/^\d{12}$/.test(aadhaar.replace(/\s/g, "")))
      next.aadhaar = "Aadhaar must be exactly 12 digits.";
    setErrors(next);
    setFailed(false);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await login({ data: { mobile, aadhaar } });
      if (res.status === "ok") {
        setCurrentFarmerId(res.farmer.id);
        navigate({ to: "/dashboard" });
      } else {
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            KisanSaarthi
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Farmer Login
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the mobile number and Aadhaar ID you registered with.
          </p>
        </header>

        {failed && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-foreground"
          >
            No registration found for that mobile number and Aadhaar ID combination.
          </div>
        )}

        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7"
        >
          <div>
            <label htmlFor="loginMobile" className={labelCls}>
              Mobile Number
            </label>
            <input
              id="loginMobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
              className={fieldCls}
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setErrors((p) => ({ ...p, mobile: undefined }));
              }}
              aria-invalid={errors.mobile ? true : undefined}
              aria-describedby={errors.mobile ? "loginMobile-error" : undefined}
            />
            {errors.mobile && (
              <p id="loginMobile-error" className={errCls}>
                {errors.mobile}
              </p>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="loginAadhaar" className={labelCls}>
              Aadhaar ID
            </label>
            <input
              id="loginAadhaar"
              type="text"
              inputMode="numeric"
              maxLength={12}
              placeholder="12-digit number"
              className={fieldCls}
              value={aadhaar}
              onChange={(e) => {
                setAadhaar(e.target.value);
                setErrors((p) => ({ ...p, aadhaar: undefined }));
              }}
              aria-invalid={errors.aadhaar ? true : undefined}
              aria-describedby={errors.aadhaar ? "loginAadhaar-error" : undefined}
            />
            {errors.aadhaar && (
              <p id="loginAadhaar-error" className={errCls}>
                {errors.aadhaar}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-8 w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Log In"}
          </button>
          <p className="mt-3 text-center text-sm">
            <Link to="/" className="underline underline-offset-2">
              New farmer? Register here
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
