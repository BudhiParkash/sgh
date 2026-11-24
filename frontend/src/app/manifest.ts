import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "SGH",
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#07070b",
    theme_color: "#07070b",
    id: "/",
    scope: "/",
    orientation: "portrait",
    categories: ["games", "entertainment", "sports"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Sensitivity finder", url: "/sensitivity", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Tournaments", url: "/tournaments", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "My saved", url: "/saved", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
