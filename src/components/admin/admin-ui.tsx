"use client";

import { useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/button-link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTurnstile } from "@/lib/turnstile";

export const inputClass =
  "h-11 w-full rounded-xl border-[1.5px] border-line-input bg-surface px-3 text-[15px] aria-[invalid=true]:border-error-inline";
export const labelClass = "text-sm font-semibold";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await getSupabaseBrowserClient().auth.signOut();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the server sees the new session
        window.location.assign("/admin/login");
      }}
      className="min-h-11 text-[15px] font-semibold text-green"
    >
      Sign out
    </button>
  );
}

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { containerRef: captchaRef, enabled: captchaEnabled, getToken: getCaptchaToken } = useTurnstile("admin_login");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    let captchaToken: string | undefined;
    if (captchaEnabled) {
      const token = await getCaptchaToken();
      if (!token) {
        setBusy(false);
        setError("The security check didn't complete. If a check box appeared, tick it, then sign in again.");
        return;
      }
      captchaToken = token;
    }
    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "That email and password don't match an account." : signInError.message);
      return;
    }
    // Full load: the server must see the new session cookie. (router.push + refresh raced: the
    // refresh re-fetched the login page and cancelled the navigation in production builds.)
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the server sees the new session
    window.location.assign("/admin");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-email" className={labelClass}>
          Email
        </label>
        <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className={labelClass}>
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {captchaEnabled ? <div ref={captchaRef} className="flex justify-center" /> : null}
      {error ? (
        <p role="alert" className="text-[15px] font-medium text-error-inline">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`${buttonVariants.primary} h-12 text-base disabled:opacity-70`}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-muted">
        Signing in here replaces any guest session in this browser, so guest trips made here won&apos;t open while you&apos;re
        signed in.
      </p>
    </form>
  );
}
