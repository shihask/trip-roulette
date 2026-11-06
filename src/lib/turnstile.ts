"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, for the CAPTCHA that Supabase Auth checks on every sign-in (guest and
 * admin). Off unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so the code can ship before CAPTCHA is
 * switched on in Supabase (Authentication → Attack Protection). The widget is invisible unless
 * Cloudflare wants an interaction, and runs only when a token is actually needed.
 * The script and iframe come from challenges.cloudflare.com (allowed in the CSP, next.config.ts).
 */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 120_000; // long enough to answer a visible challenge

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Renders an (initially invisible) widget into `containerRef` and returns `getToken()`, which runs
 * the check and resolves to a single-use token, or null if it failed or timed out.
 * When Turnstile is not configured, `enabled` is false and getToken() resolves to null.
 * `active`: load and render only while the container is on screen (e.g. the wizard's review step).
 */
export function useTurnstile(action: string, active = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const ready = useRef<Promise<string | null> | null>(null);
  const pending = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !active) return;
    let cancelled = false;
    const settle = (token: string | null) => {
      pending.current?.(token);
      pending.current = null;
    };
    ready.current = loadTurnstile()
      .then((t) => {
        if (cancelled || !containerRef.current) return null;
        widgetId.current = t.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          action,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => settle(token),
          "error-callback": () => {
            settle(null);
            return true; // handled: no console noise from the widget
          },
          "timeout-callback": () => settle(null),
        });
        return widgetId.current;
      })
      .catch(() => null);
    return () => {
      cancelled = true;
      settle(null);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action, active]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!turnstileSiteKey) return null;
    const id = await ready.current;
    const t = window.turnstile;
    if (!id || !t) return null;
    pending.current?.(null);
    const token = new Promise<string | null>((resolve) => {
      pending.current = resolve;
      setTimeout(() => {
        if (pending.current === resolve) {
          pending.current = null;
          resolve(null);
        }
      }, TOKEN_TIMEOUT_MS);
    });
    t.reset(id); // tokens are single-use: always start a fresh check
    t.execute(id);
    return token;
  }, []);

  return { containerRef, enabled: Boolean(turnstileSiteKey), getToken };
}
