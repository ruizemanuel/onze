import type { Metadata } from "next";
import {
  Anton,
  Barlow_Condensed,
  Bebas_Neue,
  Big_Shoulders,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const inter = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-body",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const bigShoulders = Big_Shoulders({
  weight: ["700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-shoulders",
});

const barlow = Barlow_Condensed({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const jetbrains = JetBrains_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono-jb",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pick5-beta.vercel.app"),
  title: {
    default: "Onze — Fantasy XI del Mundial on-chain",
    template: "%s · Onze",
  },
  description:
    "Armá tu XI del Mundial 2026. Ganá la fase. No perdés nada. Built on Celo with an ERC-8004 verified AI Coach.",
  applicationName: "Onze",
  openGraph: {
    title: "Onze — Fantasy XI del Mundial on-chain",
    description:
      "Armá tu XI del Mundial 2026. Ganá la fase. No perdés nada. Built on Celo with an ERC-8004 verified AI Coach.",
    siteName: "Onze",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Onze — Fantasy XI del Mundial on-chain",
    description:
      "Armá tu XI del Mundial 2026. Ganá la fase. No perdés nada.",
  },
  other: {
    // Talent App project domain-ownership verification
    "talentapp:project_verification":
      "35eedb8130b9842ac1819851a16dcab4169acbb311210fccca6e3b4c7f8dd3f78e04499b246e1ee8f0c877ac092703de7896c1ce4348596fb2e0cadbeee02891",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${inter.variable} ${anton.variable} ${bigShoulders.variable} ${barlow.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="bg-[#08070D] text-white min-h-full flex flex-col font-sans">
        <Providers>
          {children}
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
