import type { Metadata, Viewport } from "next";
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
      </body>
    </html>
  );
}
