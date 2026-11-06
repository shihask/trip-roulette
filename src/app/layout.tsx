import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { OfflineBanner, ServiceWorkerRegistration } from "@/components/pwa";
import { StartTripClickTracker } from "@/lib/analytics";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Trip Roulette Kerala — Let Kerala surprise you",
    template: "%s · Trip Roulette Kerala",
  },
  description:
    "Tell us your budget, how much time you have and your mood. We shortlist three Kerala destinations that fit, then the wheel picks one.",
  applicationName: "Trip Roulette Kerala",
  appleWebApp: { capable: true, title: "Trip Roulette", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: "Trip Roulette Kerala",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D6A4C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold"
        >
          Skip to content
        </a>
        <OfflineBanner />
        {children}
        <ServiceWorkerRegistration />
        <StartTripClickTracker />
      </body>
    </html>
  );
}
