import { Cairo, Exo_2, Noto_Sans, Noto_Sans_Armenian, Orbitron } from "next/font/google";

// Reference typography: Orbitron (headings) + Cairo (body), both Latin-only.
// Cyrillic and Armenian glyphs fall back per-character to visually close faces;
// unicode-range subsetting means a page only downloads the scripts it renders.
export const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", display: "swap" });
export const cairo = Cairo({ subsets: ["latin"], variable: "--font-cairo", display: "swap" });
export const exo = Exo_2({ subsets: ["cyrillic"], variable: "--font-exo", display: "swap", preload: false });
export const notoSans = Noto_Sans({ subsets: ["cyrillic"], variable: "--font-noto-sans", display: "swap", preload: false });
export const notoArmenian = Noto_Sans_Armenian({
  subsets: ["armenian"],
  variable: "--font-noto-armenian",
  display: "swap",
  preload: false,
});

export const fontVariables = [orbitron, cairo, exo, notoSans, notoArmenian].map((f) => f.variable).join(" ");
