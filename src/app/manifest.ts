import type { MetadataRoute } from "next";

/**
 * Next's file-based Web App Manifest route — served at /manifest.webmanifest
 * and linked into <head> automatically. This is what lets a mobile browser
 * offer "Add to Home Screen" / "Install" and launch Arthouse full-screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arthouse — Grid Reference Studio",
    short_name: "Arthouse",
    description:
      "Grid any photo, adjust the tones, and download a reference image to draw from.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f5f2",
    theme_color: "#f6f5f2",
    categories: ["art", "photo", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
