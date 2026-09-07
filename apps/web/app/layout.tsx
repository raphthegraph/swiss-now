import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter_Tight } from "next/font/google";
import { cssVariablesBlock } from "@swiss-now/motion/tokens";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--sn-font-loaded",
});

export const metadata: Metadata = {
  title: "Swiss Now",
  description: "A living, near-real-time map of Switzerland.",
};

// Design tokens as CSS custom properties, generated once at build/render time from @swiss-now/motion.
const tokenCss = cssVariablesBlock(":root").replace(
  "--sn-font-sans:",
  `--sn-font-sans: var(--sn-font-loaded), `,
);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={interTight.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
