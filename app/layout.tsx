import type { Metadata } from "next";
import { Permanent_Marker, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-permanent-marker",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

const APP_URL = "https://ruga-app.vercel.app";
const DESCRIPTION =
  "AI-powered prediction markets for crypto rug pulls. A token gets blacklisted — you bet whether it rugs within 7 days.";

export const metadata: Metadata = {
  title: { default: "Ruga", template: "%s · Ruga" },
  description: DESCRIPTION,
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "Ruga — Bet on the Rug",
    description: DESCRIPTION,
    url: APP_URL,
    siteName: "Ruga",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Ruga — Bet on the Rug",
    description: DESCRIPTION,
    creator: "@rugaapp"
  },
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${permanentMarker.variable} ${jetbrains.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
