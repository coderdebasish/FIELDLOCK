import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "FIELDLOCK — IIT Guwahati Sports Booking",
  description:
    "Intelligent sports facility booking for IIT Guwahati. Zero clashes, fair allocation, real-time availability.",
  keywords: ["IIT Guwahati", "sports booking", "facility management", "badminton", "tennis"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0a0a0f] text-white`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
