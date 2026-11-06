"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/button-link";
import { ErrorState } from "@/components/states";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Error boundary for every page under the root layout. Never shows internals; offers a retry. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-12">
      <ErrorState
        title={online ? "Something went wrong" : "You're offline"}
        reference={digest || undefined}
        action={
          <>
            <button type="button" onClick={() => retry()} className={`${buttonVariants.outline} h-12 text-[15px]`}>
              Try again
            </button>
            <Link href={online ? "/" : "/saved"} className={`${buttonVariants.outline} h-12 text-[15px]`}>
              {online ? "Go to the homepage" : "Open saved trips"}
            </Link>
          </>
        }
      >
        {online
          ? "This page couldn't load. It's usually temporary. Your trips and saved items are safe."
          : "This page needs a connection. Saved trips still work offline."}
      </ErrorState>
    </main>
  );
}
