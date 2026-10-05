import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { GlobalDropZone } from "@/components/global-drop-zone";
import { ThemeProvider, type AccentTheme } from "@/components/theme-provider";
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

export const metadata: Metadata = {
  title: "Local Bay",
  description: "LAN torrent downloader for your ReadySHARE",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1115",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
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
        </ThemeProvider>
      </body>
    </html>
  );
}
