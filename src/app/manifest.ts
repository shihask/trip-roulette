import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trip Roulette Kerala",
    short_name: "Trip Roulette",
    description: "Shortlist three Kerala destinations for your budget, time and mood, then let the wheel pick one.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F5F1",
    theme_color: "#1D6A4C",
    lang: "en-IN",
    categories: ["travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Plan a trip", url: "/plan" },
      { name: "Saved trips", url: "/saved" },
    ],
  };
}
