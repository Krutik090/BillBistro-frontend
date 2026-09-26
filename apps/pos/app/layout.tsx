import type { Metadata, Viewport } from "next";
import { Jost, Marcellus, Space_Mono } from "next/font/google";
import { themeInitScript } from "@billbistro/ui";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-jost" });
const marcellus = Marcellus({ subsets: ["latin"], variable: "--font-marcellus", weight: "400" });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-space-mono", weight: ["400", "700"] });

export const metadata: Metadata = { title: "Isara's POS", description: "Touch-first billing", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Isara's POS", statusBarStyle: "black-translucent" } };
export const viewport: Viewport = { themeColor: "#0C0704", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${jost.variable} ${marcellus.variable} ${spaceMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
