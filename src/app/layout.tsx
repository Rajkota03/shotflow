import type { Metadata } from "next";
import { Courier_Prime, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ShotFlow — Script Breakdown & Scheduling",
  description: "Professional film production scheduling, breakdown, and budgeting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetBrainsMono.variable} ${courierPrime.variable} antialiased min-h-screen`}
        style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
