import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa";
import { ThemeProvider, themeBootstrapScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arthouse — Grid Reference Studio",
  description:
    "Upload a photo, apply a configurable grid and monochrome or tonal adjustments, then download a reference image to draw from. Everything runs in your browser.",
  applicationName: "Arthouse",
  keywords: [
    "grid method",
    "drawing reference",
    "grid overlay",
    "black and white photo",
    "artist tools",
  ],
  openGraph: {
    title: "Arthouse — Grid Reference Studio",
    description:
      "Grid any photo, adjust the tones, and download a reference image to draw from.",
    type: "website",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Lets Safari open the installed icon full-screen, without browser chrome,
  // instead of the ordinary Safari tab it would otherwise fall back to.
  appleWebApp: {
    capable: true,
    title: "Arthouse",
    statusBarStyle: "default",
  },
  other: {
    // Next's `appleWebApp.capable` only emits the modern, unprefixed
    // "mobile-web-app-capable" tag. Older iOS versions only ever recognised
    // the Apple-prefixed one, so it's added explicitly alongside it.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
