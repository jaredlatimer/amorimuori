import type { Metadata } from "next";
import { Fraunces, Archivo } from "next/font/google";
import "./globals.css";
import { DevController } from "@/components/DevController";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const BASE_URL = "https://amorimuori.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Amori Muori — Friday Night Take",
    template: "%s — Amori Muori",
  },
  description: "Authentic Neapolitan pizza, made to order every Friday in Ashburn Farm, VA. 900° wood-fired oven, 60-second bake. Pre-order online and pick up fresh.",
  keywords: ["Neapolitan pizza", "Ashburn", "Ashburn Farm", "Friday Night Take", "wood-fired pizza", "Northern Virginia pizza"],
  openGraph: {
    type: "website",
    siteName: "Amori Muori",
    title: "Amori Muori — Friday Night Take",
    description: "Authentic Neapolitan pizza, made to order every Friday in Ashburn Farm, VA. Pre-order online.",
    url: BASE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Amori Muori — Friday Night Take",
    description: "Authentic Neapolitan pizza, made to order every Friday in Ashburn Farm, VA. Pre-order online.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${archivo.variable}`}>
      <body>
        {children}
        {process.env.NEXT_PUBLIC_DEV_TOOLS === "1" && <DevController />}
      </body>
    </html>
  );
}
