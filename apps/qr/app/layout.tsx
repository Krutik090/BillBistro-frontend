import type { Metadata } from "next";
import { Jost, Marcellus, Space_Mono } from "next/font/google";
import { themeInitScript } from "@billbistro/ui";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-jost" });
const marcellus = Marcellus({ subsets: ["latin"], variable: "--font-marcellus", weight: "400" });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-space-mono", weight: ["400", "700"] });

export const metadata: Metadata = { title: "Isara's Menu", description: "QR ordering" };

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
