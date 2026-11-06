import type { Metadata } from "next";
import { SavedTripsList } from "@/components/saved-trips-list";

export const metadata: Metadata = {
  title: "Saved trips",
  description: "Trips you saved in this browser.",
};

export default function SavedPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-16 pt-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold tracking-[-0.02em]">Saved trips</h1>
        <p className="text-base leading-[1.45] text-muted">
          Kept only in this browser. Clearing your browser data removes them.
        </p>
      </div>
      <SavedTripsList />
    </main>
  );
}
