import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "ShotFlow — Film Production Platform",
  description: "Integrated film production scheduling, shot lists, and budget tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0a0a] text-[#ededed]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
