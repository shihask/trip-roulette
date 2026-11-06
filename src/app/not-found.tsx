import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { ButtonLink } from "@/components/button-link";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1 flex-col">
        <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-16">
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">
            This page isn&apos;t here yet
          </h1>
          <p className="text-[17px] leading-normal text-muted">
            It may still be in progress, or the link may be wrong.
          </p>
          <ButtonLink href="/" variant="primary" className="self-start">
            Back to home
          </ButtonLink>
        </main>
      </div>
      <AppFooter />
    </>
  );
}
