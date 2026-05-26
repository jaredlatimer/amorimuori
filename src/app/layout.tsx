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

export const metadata: Metadata = {
  title: "Amori Muori — Friday Night Take",
  description: "Neapolitan pizza, made to order. Ashburn Farm, Fridays.",
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
