import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import DevExtensionErrorGuard from "@/components/DevExtensionErrorGuard";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alpha Marketplace",
  description: "A modern multi-vendor marketplace built for growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <DevExtensionErrorGuard />
        {children}
      </body>
    </html>
  );
}
