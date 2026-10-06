import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { GlobalDropZone } from "@/components/global-drop-zone";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider, type AccentTheme } from "@/components/theme-provider";
import { ensureBackgroundJobs } from "@/lib/background";
import { getSettingsMap } from "@/lib/db";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const APP_NAME = "Local Bay";
const APP_DESCRIPTION = "LAN torrent downloader and catalog for your ReadySHARE";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f1115",
  colorScheme: "dark",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  ensureBackgroundJobs();
  const settings = getSettingsMap();
  const theme =
    settings.theme === "signal" ? "signal" : ("ember" as AccentTheme);

  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${ibmPlexMono.variable} h-full antialiased`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider initialTheme={theme}>
          {children}
          <GlobalDropZone />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
