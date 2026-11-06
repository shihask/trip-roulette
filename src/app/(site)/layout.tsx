import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";

/** Public site pages: header and footer. The wizard (/plan) has its own focused layout. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <AppFooter />
    </>
  );
}
