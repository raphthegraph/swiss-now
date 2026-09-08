import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Montserrat } from "next/font/google";
import { cssVariablesBlock } from "@swiss-now/motion/tokens";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/lang";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--sn-font-loaded",
});
// the wordmark only: SWISS in bold, NOW in light (docs/DESIGN.md)
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "700"],
  display: "swap",
  variable: "--sn-font-brand-loaded",
});

export const metadata: Metadata = {
  title: "Swiss Now",
  description: "A living, near-real-time map of Switzerland.",
};

// Design tokens as CSS custom properties, generated once at build/render time from @swiss-now/motion.
const tokenCss = cssVariablesBlock(":root")
  .replace("--sn-font-sans:", "--sn-font-sans: var(--sn-font-loaded), ")
  .replace("--sn-font-brand:", "--sn-font-brand: var(--sn-font-brand-loaded), ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
